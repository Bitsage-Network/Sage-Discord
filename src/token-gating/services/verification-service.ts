/**
 * BitSage Discord Token-Gating - Verification Service
 *
 * Handles wallet verification events from the webapp and assigns Discord roles.
 * Integrates with:
 * - RuleEvaluator for token-gating checks
 * - StarknetService for signature verification
 * - Discord bot for role assignment
 */

import { Client } from 'discord.js';
import { StarknetService } from './starknet-service';
import { RuleEvaluator } from './rule-evaluator';
import { RuleGroupEvaluator } from './rule-group-evaluator';
import { logger } from '../../utils/logger';
import { query } from '../../utils/database';

export interface VerificationEvent {
  event: 'wallet_verified';
  discord_id: string;
  wallet_address: string;
  guild_id: string; // Discord guild ID
  signature: string[];
  message_hash: string;
}

export class VerificationService {
  private client: Client;
  private starknet: StarknetService;
  private ruleEvaluator: RuleEvaluator;
  private ruleGroupEvaluator: RuleGroupEvaluator;

  constructor(
    client: Client,
    starknet: StarknetService,
    ruleEvaluator: RuleEvaluator,
    ruleGroupEvaluator: RuleGroupEvaluator
  ) {
    this.client = client;
    this.starknet = starknet;
    this.ruleEvaluator = ruleEvaluator;
    this.ruleGroupEvaluator = ruleGroupEvaluator;
  }

  /**
   * Handle wallet verification event from webapp
   */
  async handleVerificationEvent(
    event: VerificationEvent
  ): Promise<{ success: boolean; assigned_roles: any[]; error?: string }> {
    try {
      logger.info('Processing verification event', {
        discord_id: event.discord_id,
        wallet: event.wallet_address,
        discord_guild_id: event.guild_id,
      });

      // 1. Verify signature
      const signatureValid = await this.starknet.verifySignature(
        event.wallet_address,
        event.message_hash,
        event.signature
      );

      if (!signatureValid) {
        logger.warn('Invalid signature', {
          discord_id: event.discord_id,
          wallet: event.wallet_address,
        });
        return {
          success: false,
          assigned_roles: [],
          error: 'Invalid signature',
        };
      }

      // 2. Get guild info from database
      const guildResult = await query(
        `SELECT id, name FROM guilds WHERE discord_guild_id = $1`,
        [event.guild_id]
      );

      if (guildResult.rows.length === 0) {
        logger.warn('Guild not found in database', {
          discord_guild_id: event.guild_id,
        });
        return {
          success: false,
          assigned_roles: [],
          error: 'Guild not found',
        };
      }

      const guildInfo = guildResult.rows[0];
      const guildId = guildInfo.id;

      // 3. Evaluate token-gating rules
      const ruleResults = await this.ruleEvaluator.evaluateAllRules(
        event.discord_id,
        event.wallet_address,
        guildId
      );

      logger.info('Rule evaluation complete', {
        discord_id: event.discord_id,
        total_rules: ruleResults.length,
        passed_rules: ruleResults.filter((r) => r.passes_rule).length,
      });

      // 4. Get roles to assign from both token-gating rules and rule groups
      const simpleRoles = await this.ruleEvaluator.getAssignableRoles(
        event.discord_id,
        guildId
      );

      const groupRoleIds = await this.ruleGroupEvaluator.evaluateAllGroupsForUser(
        guildId,
        event.discord_id,
        event.wallet_address
      );

      // Combine and deduplicate roles
      const assignableRoles = [...simpleRoles];
      for (const roleId of groupRoleIds) {
        if (!assignableRoles.find(r => r.role_id === roleId)) {
          assignableRoles.push({ role_id: roleId, role_name: 'Rule Group Role', auto_assign: true });
        }
      }

      // 5. Assign roles in Discord
      const assignedRoles = await this.assignRolesToMember(
        event.guild_id,
        event.discord_id,
        assignableRoles
      );

      // 6. Log analytics
      await this.logAnalytics(
        guildId,
        event.discord_id,
        event.wallet_address,
        ruleResults.length,
        assignedRoles.length
      );

      // 7. Trigger reward campaigns (if any roles were assigned)
      if ((global as any).rewardScheduler && assignedRoles.length > 0) {
        try {
          // Extract rule group IDs if any group roles were assigned
          const ruleGroupId = groupRoleIds.length > 0 ? guildInfo.id : undefined;

          await (global as any).rewardScheduler.handleRulePassTrigger(
            event.discord_id,
            guildId,
            ruleGroupId
          );

          logger.debug('Reward trigger processed', {
            discord_id: event.discord_id,
            guild_id: guildId,
          });
        } catch (error: any) {
          // Don't fail verification if reward trigger fails
          logger.error('Reward trigger failed', {
            discord_id: event.discord_id,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        assigned_roles: assignedRoles,
      };
    } catch (error: any) {
      logger.error('Verification event processing failed', {
        discord_id: event.discord_id,
        error: error.message,
      });

      return {
        success: false,
        assigned_roles: [],
        error: error.message,
      };
    }
  }

  /**
   * Poll for newly verified users and assign roles
   * This is an alternative to webhooks - runs periodically
   */
  async pollVerifiedUsers(): Promise<void> {
    try {
      // Find users who verified in the last 5 minutes but haven't had roles assigned
      const verifiedUsers = await query(
        `SELECT
           wv.user_id as discord_id,
           wv.wallet_address,
           g.discord_guild_id,
           g.id as guild_id,
           wv.signature,
           wv.message
         FROM wallet_verifications wv
         JOIN guild_members gm ON wv.user_id = gm.discord_id
         JOIN guilds g ON gm.guild_id = g.id
         WHERE wv.verified = TRUE
           AND wv.verified_at > NOW() - INTERVAL '5 minutes'
         ORDER BY wv.verified_at DESC
         LIMIT 100`
      );

      logger.info('Polling for verified users', {
        count: verifiedUsers.rows.length,
      });

      for (const user of verifiedUsers.rows) {
        try {
          // Get assignable roles from both systems
          const simpleRoles =
            await this.ruleEvaluator.getAssignableRoles(
              user.discord_id,
              user.guild_id
            );

          const groupRoleIds = await this.ruleGroupEvaluator.evaluateAllGroupsForUser(
            user.guild_id,
            user.discord_id,
            user.wallet_address
          );

          // Combine and deduplicate roles
          const assignableRoles = [...simpleRoles];
          for (const roleId of groupRoleIds) {
            if (!assignableRoles.find(r => r.role_id === roleId)) {
              assignableRoles.push({ role_id: roleId, role_name: 'Rule Group Role', auto_assign: true });
            }
          }

          if (assignableRoles.length === 0) {
            logger.debug('No assignable roles for user', {
              discord_id: user.discord_id,
            });
            continue;
          }

          // Assign roles
          await this.assignRolesToMember(
            user.discord_guild_id,
            user.discord_id,
            assignableRoles
          );
        } catch (error: any) {
          logger.error('Failed to process verified user', {
            discord_id: user.discord_id,
            error: error.message,
          });
        }
      }
    } catch (error: any) {
      logger.error('Polling verified users failed', {
        error: error.message,
      });
    }
  }

  /**
   * Assign roles to a Discord member
   */
  private async assignRolesToMember(
    discordGuildId: string,
    discordUserId: string,
    roles: any[]
  ): Promise<any[]> {
    try {
      // Get Discord guild
      const guild = await this.client.guilds.fetch(discordGuildId);
      if (!guild) {
        logger.warn('Discord guild not found', { guild_id: discordGuildId });
        return [];
      }

      // Get Discord member
      const member = await guild.members.fetch(discordUserId);
      if (!member) {
        logger.warn('Discord member not found', {
          guild_id: discordGuildId,
          user_id: discordUserId,
        });
        return [];
      }

      const assignedRoles: any[] = [];

      for (const roleInfo of roles) {
        try {
          // Find role in guild
          const role = guild.roles.cache.get(roleInfo.role_id);
          if (!role) {
            logger.warn('Discord role not found', {
              role_id: roleInfo.role_id,
              role_name: roleInfo.role_name,
            });
            continue;
          }

          // Check if member already has role
          if (member.roles.cache.has(role.id)) {
            logger.debug('Member already has role', {
              user_id: discordUserId,
              role_id: role.id,
            });
            continue;
          }

          // Assign role
          await member.roles.add(role);

          logger.info('Role assigned', {
            user_id: discordUserId,
            role_id: role.id,
            role_name: role.name,
          });

          assignedRoles.push({
            role_id: role.id,
            role_name: role.name,
          });

          // Send DM to user
          try {
            await member.send(
              `🎉 You've been assigned the **${role.name}** role in **${guild.name}**! You now have access to token-gated channels.`
            );
          } catch (dmError) {
            logger.debug('Could not send DM to user', {
              user_id: discordUserId,
            });
          }
        } catch (error: any) {
          logger.error('Failed to assign role', {
            user_id: discordUserId,
            role_id: roleInfo.role_id,
            error: error.message,
          });
        }
      }

      return assignedRoles;
    } catch (error: any) {
      logger.error('Failed to assign roles to member', {
        guild_id: discordGuildId,
        user_id: discordUserId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Remove roles from member who no longer pass requirements
   */
  async syncMemberRoles(
    discordGuildId: string,
    discordUserId: string
  ): Promise<void> {
    try {
      // Get guild info
      const guildResult = await query(
        `SELECT id FROM guilds WHERE discord_guild_id = $1`,
        [discordGuildId]
      );

      if (guildResult.rows.length === 0) {
        return;
      }

      const guildId = guildResult.rows[0].id;

      // Get wallet address
      const walletResult = await query(
        `SELECT wallet_address FROM wallet_verifications
         WHERE user_id = $1 AND verified = TRUE
         LIMIT 1`,
        [discordUserId]
      );

      if (walletResult.rows.length === 0) {
        logger.debug('No verified wallet for user', {
          discord_id: discordUserId,
        });
        return;
      }

      const walletAddress = walletResult.rows[0].wallet_address;

      // Re-evaluate all rules
      await this.ruleEvaluator.evaluateAllRules(
        discordUserId,
        walletAddress,
        guildId
      );

      // Get current assignable roles
      const assignableRoles = await this.ruleEvaluator.getAssignableRoles(
        discordUserId,
        guildId
      );

      const assignableRoleIds = new Set(assignableRoles.map((r) => r.role_id));

      // Get Discord member
      const guild = await this.client.guilds.fetch(discordGuildId);
      const member = await guild.members.fetch(discordUserId);

      // Get all token-gated roles in this guild
      const allTokenGatedRoles = await query(
        `SELECT DISTINCT rm.role_id, rm.role_name
         FROM role_mappings rm
         JOIN token_gating_rules tgr ON rm.rule_id = tgr.id
         WHERE tgr.guild_id = $1`,
        [guildId]
      );

      // Remove roles user no longer qualifies for
      for (const roleInfo of allTokenGatedRoles.rows) {
        if (
          !assignableRoleIds.has(roleInfo.role_id) &&
          member.roles.cache.has(roleInfo.role_id)
        ) {
          const role = guild.roles.cache.get(roleInfo.role_id);
          if (role) {
            await member.roles.remove(role);
            logger.info('Role removed (no longer qualifies)', {
              user_id: discordUserId,
              role_id: role.id,
              role_name: role.name,
            });
          }
        }
      }

      // Add roles user now qualifies for
      await this.assignRolesToMember(
        discordGuildId,
        discordUserId,
        assignableRoles
      );
    } catch (error: any) {
      logger.error('Failed to sync member roles', {
        guild_id: discordGuildId,
        user_id: discordUserId,
        error: error.message,
      });
    }
  }

  /**
   * Log analytics event
   */
  private async logAnalytics(
    guildId: number,
    userId: string,
    walletAddress: string,
    rulesEvaluated: number,
    rolesAssigned: number
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO analytics_events (
           guild_id,
           event_type,
           event_data,
           user_id
         ) VALUES ($1, $2, $3, $4)`,
        [
          guildId,
          'wallet_verified',
          JSON.stringify({
            wallet_address: walletAddress,
            rules_evaluated: rulesEvaluated,
            roles_assigned: rolesAssigned,
          }),
          userId,
        ]
      );
    } catch (error: any) {
      logger.error('Failed to log analytics', { error: error.message });
    }
  }
}
