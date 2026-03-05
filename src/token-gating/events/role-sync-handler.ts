/**
 * BitSage Discord Token-Gating - Role Sync Handler
 *
 * Automatically assigns and removes Discord roles based on token-gating rules.
 * Runs periodically and on-demand.
 */

import { Client, GuildMember, Guild } from 'discord.js';
import { query } from '../../utils/database';
import { logger } from '../../utils/logger';
import { RuleMatcher } from '../utils/rule-matcher';
import { TokenGatingModule } from '../index';
import { tokenGatingConfig } from '../utils/config';

export class RoleSyncHandler {
  private client: Client;
  private ruleMatcher: RuleMatcher;
  private tokenGating: TokenGatingModule;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
    this.tokenGating = TokenGatingModule.getInstance();
    this.ruleMatcher = new RuleMatcher(
      this.tokenGating.tokenService,
      this.tokenGating.privacyService
    );
  }

  /**
   * Start automatic role sync scheduler
   */
  start(): void {
    if (!tokenGatingConfig.role_sync.enabled) {
      logger.info('Automatic role sync is disabled');
      return;
    }

    const intervalMs = tokenGatingConfig.role_sync.interval * 1000;

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncAllGuilds();
      } catch (error: any) {
        logger.error('Error in role sync scheduler', {
          error: error.message,
        });
      }
    }, intervalMs);

    logger.info('Role sync scheduler started', {
      interval_seconds: tokenGatingConfig.role_sync.interval,
    });
  }

  /**
   * Stop automatic role sync scheduler
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      logger.info('Role sync scheduler stopped');
    }
  }

  /**
   * Sync roles for all guilds
   */
  async syncAllGuilds(): Promise<void> {
    logger.info('Starting role sync for all guilds');

    const startTime = Date.now();
    let totalSynced = 0;

    for (const [guildId, guild] of this.client.guilds.cache) {
      try {
        const synced = await this.syncGuild(guild);
        totalSynced += synced;
      } catch (error: any) {
        logger.error('Failed to sync guild', {
          guild_id: guildId,
          error: error.message,
        });
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Role sync completed for all guilds', {
      guilds: this.client.guilds.cache.size,
      users_synced: totalSynced,
      duration_ms: duration,
    });
  }

  /**
   * Sync roles for a specific guild
   */
  async syncGuild(guild: Guild): Promise<number> {
    try {
      // Get all verified users
      const verifiedUsers = await query(
        `SELECT DISTINCT wv.user_id, wv.wallet_address
         FROM wallet_verifications wv
         WHERE wv.verified = TRUE`,
        []
      );

      if (verifiedUsers.rowCount === 0) {
        logger.debug('No verified users to sync', { guild_id: guild.id });
        return 0;
      }

      let syncedCount = 0;

      for (const row of verifiedUsers.rows) {
        try {
          const member = await guild.members.fetch(row.user_id).catch(() => null);
          if (!member) {
            continue; // User not in this guild
          }

          await this.syncMemberRoles(member, row.wallet_address);
          syncedCount++;
        } catch (error: any) {
          logger.warn('Failed to sync member roles', {
            user_id: row.user_id,
            guild_id: guild.id,
            error: error.message,
          });
        }
      }

      logger.info('Guild role sync completed', {
        guild_id: guild.id,
        guild_name: guild.name,
        users_synced: syncedCount,
      });

      return syncedCount;
    } catch (error: any) {
      logger.error('Failed to sync guild roles', {
        guild_id: guild.id,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Sync roles for a specific member
   */
  async syncMemberRoles(
    member: GuildMember,
    walletAddress?: string
  ): Promise<void> {
    try {
      const userId = member.user.id;
      const guildId = member.guild.id;

      // Get wallet address if not provided
      if (!walletAddress) {
        const verification = await query(
          `SELECT wallet_address FROM wallet_verifications
           WHERE user_id = $1 AND verified = TRUE
           LIMIT 1`,
          [userId]
        );

        if (verification.rowCount === 0) {
          logger.debug('Member has no verified wallet', {
            user_id: userId,
            guild_id: guildId,
          });
          return;
        }

        walletAddress = verification.rows[0].wallet_address;
      }

      // Evaluate rules
      const ruleResults = await this.ruleMatcher.evaluateUserRules(
        userId,
        walletAddress,
        guildId
      );

      // Get role mappings
      const roleMappings = await query(
        `SELECT rm.rule_id, rm.role_id, rm.role_name, rm.auto_assign, rm.auto_remove
         FROM role_mappings rm
         JOIN token_gating_rules tgr ON rm.rule_id = tgr.id
         WHERE tgr.guild_id = $1 AND tgr.enabled = TRUE`,
        [guildId]
      );

      if (roleMappings.rowCount === 0) {
        return; // No role mappings for this guild
      }

      let rolesAdded = 0;
      let rolesRemoved = 0;

      for (const mapping of roleMappings.rows) {
        const role = member.guild.roles.cache.get(mapping.role_id);
        if (!role) {
          logger.warn('Role not found in guild', {
            role_id: mapping.role_id,
            role_name: mapping.role_name,
            guild_id: guildId,
          });
          continue;
        }

        const ruleResult = ruleResults.find(r => r.rule_id === mapping.rule_id);
        const passesRule = ruleResult?.passes ?? false;
        const hasRole = member.roles.cache.has(mapping.role_id);

        // Add role if passes and doesn't have it
        if (passesRule && !hasRole && mapping.auto_assign) {
          try {
            await member.roles.add(role);
            rolesAdded++;
            logger.info('Token-gated role assigned', {
              user_id: userId,
              user_tag: member.user.tag,
              role: mapping.role_name,
              rule_id: mapping.rule_id,
            });
          } catch (error: any) {
            logger.error('Failed to assign role', {
              user_id: userId,
              role: mapping.role_name,
              error: error.message,
            });
          }
        }

        // Remove role if doesn't pass and has it
        if (!passesRule && hasRole && mapping.auto_remove) {
          try {
            await member.roles.remove(role);
            rolesRemoved++;
            logger.info('Token-gated role removed', {
              user_id: userId,
              user_tag: member.user.tag,
              role: mapping.role_name,
              rule_id: mapping.rule_id,
            });
          } catch (error: any) {
            logger.error('Failed to remove role', {
              user_id: userId,
              role: mapping.role_name,
              error: error.message,
            });
          }
        }
      }

      if (rolesAdded > 0 || rolesRemoved > 0) {
        logger.debug('Member roles synced', {
          user_id: userId,
          user_tag: member.user.tag,
          roles_added: rolesAdded,
          roles_removed: rolesRemoved,
        });
      }
    } catch (error: any) {
      logger.error('Failed to sync member roles', {
        user_id: member.user.id,
        guild_id: member.guild.id,
        error: error.message,
      });
    }
  }

  /**
   * Trigger immediate sync for a user (called after wallet verification)
   */
  async syncUserImmediately(
    userId: string,
    guildId: string,
    walletAddress: string
  ): Promise<void> {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        logger.warn('Guild not found for immediate sync', { guild_id: guildId });
        return;
      }

      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        logger.warn('Member not found for immediate sync', {
          user_id: userId,
          guild_id: guildId,
        });
        return;
      }

      await this.syncMemberRoles(member, walletAddress);

      logger.info('Immediate role sync completed', {
        user_id: userId,
        guild_id: guildId,
      });
    } catch (error: any) {
      logger.error('Failed to perform immediate role sync', {
        user_id: userId,
        guild_id: guildId,
        error: error.message,
      });
    }
  }

  /**
   * Update last_recheck timestamp for role mappings
   */
  private async updateRecheckTimestamp(guildId: string): Promise<void> {
    try {
      await query(
        `UPDATE role_mappings
         SET last_recheck = NOW()
         FROM token_gating_rules
         WHERE role_mappings.rule_id = token_gating_rules.id
         AND token_gating_rules.guild_id = $1`,
        [guildId]
      );
    } catch (error: any) {
      logger.warn('Failed to update recheck timestamp', {
        guild_id: guildId,
        error: error.message,
      });
    }
  }
}

/**
 * Initialize and start role sync handler
 */
export function initializeRoleSyncHandler(client: Client): RoleSyncHandler {
  const handler = new RoleSyncHandler(client);
  handler.start();
  return handler;
}
