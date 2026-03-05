/**
 * BitSage Discord - Reward Delivery Service
 *
 * Delivers all reward types (roles, XP, access grants) to Discord members.
 * Integrates with existing infrastructure:
 * - Role assignment pattern from verification-service.ts
 * - XP system from gamification-service.ts
 * - Discord.js for channel permissions
 */

import { Client } from 'discord.js';
import { query } from '../utils/database';
import { logger } from '../utils/logger';
import { addXP } from './gamification-service';

interface DeliveryResult {
  success: boolean;
  details: any;
  error?: string;
  txHash?: string | null;
}

export class RewardDeliveryService {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Main delivery method - routes to specific handlers based on reward type
   */
  async deliverReward(
    campaignId: string,
    userId: string,
    claimId: string
  ): Promise<DeliveryResult> {
    try {
      logger.info('Starting reward delivery', {
        campaign_id: campaignId,
        user_id: userId,
        claim_id: claimId,
      });

      // 1. Fetch campaign details
      const campaignResult = await query(
        `SELECT * FROM reward_campaigns WHERE id = $1`,
        [campaignId]
      );

      if (campaignResult.rows.length === 0) {
        throw new Error('Campaign not found');
      }

      const campaign = campaignResult.rows[0];

      // 2. Route to specific delivery handler based on reward type
      let deliveryResult: { details: any; txHash?: string | null };

      switch (campaign.reward_type) {
        case 'role':
          deliveryResult = await this.deliverRoleReward(campaign, userId);
          break;

        case 'xp':
          deliveryResult = await this.deliverXPReward(campaign, userId);
          break;

        case 'access_grant':
          deliveryResult = await this.deliverAccessGrantReward(campaign, userId);
          break;

        // Phase 2 reward types
        case 'nft':
          deliveryResult = await this.deliverNFTReward(campaign, userId, claimId);
          break;

        case 'poap':
          deliveryResult = await this.deliverPOAPReward(campaign, userId, claimId);
          break;

        case 'webhook':
          deliveryResult = await this.deliverWebhookReward(campaign, userId, claimId);
          break;

        default:
          throw new Error(`Unknown reward type: ${campaign.reward_type}`);
      }

      // 3. Update claim status to completed
      await query(
        `UPDATE reward_claims
         SET status = 'completed',
             delivery_details = $1,
             transaction_hash = $2
         WHERE id = $3`,
        [
          JSON.stringify(deliveryResult.details),
          deliveryResult.txHash || null,
          claimId,
        ]
      );

      // 4. Update queue status to completed
      await query(
        `UPDATE reward_delivery_queue
         SET status = 'completed',
             processed_at = NOW()
         WHERE claim_id = $1`,
        [claimId]
      );

      // 5. Log analytics event
      await this.logDeliveryAnalytics(campaignId, userId, 'success', campaign.reward_type);

      // 6. Send DM notification to user
      await this.notifyUser(userId, campaign, deliveryResult);

      logger.info('Reward delivered successfully', {
        campaign_id: campaignId,
        user_id: userId,
        reward_type: campaign.reward_type,
      });

      return {
        success: true,
        details: deliveryResult.details,
        txHash: deliveryResult.txHash,
      };
    } catch (error: any) {
      logger.error('Reward delivery failed', {
        campaign_id: campaignId,
        user_id: userId,
        claim_id: claimId,
        error: error.message,
      });

      // Update claim with error
      await query(
        `UPDATE reward_claims
         SET status = 'failed',
             error_message = $1,
             retries = retries + 1
         WHERE id = $2`,
        [error.message, claimId]
      ).catch((err) => logger.error('Failed to update claim error', { error: err }));

      // Update queue status to failed
      await query(
        `UPDATE reward_delivery_queue
         SET status = 'failed'
         WHERE claim_id = $1`,
        [claimId]
      ).catch((err) => logger.error('Failed to update queue error', { error: err }));

      // Log failed delivery
      const campaignResult = await query(
        `SELECT reward_type FROM reward_campaigns WHERE id = $1`,
        [campaignId]
      );
      const rewardType = campaignResult.rows[0]?.reward_type || 'unknown';
      await this.logDeliveryAnalytics(campaignId, userId, 'failed', rewardType);

      return {
        success: false,
        details: null,
        error: error.message,
      };
    }
  }

  /**
   * Deliver role reward (reuses existing pattern from verification-service.ts)
   */
  private async deliverRoleReward(
    campaign: any,
    userId: string
  ): Promise<{ details: any; txHash: null }> {
    try {
      const { role_ids } = campaign.reward_config;

      if (!role_ids || !Array.isArray(role_ids) || role_ids.length === 0) {
        throw new Error('Invalid reward_config: role_ids array is required');
      }

      // Get guild Discord ID
      const guildResult = await query(
        `SELECT discord_guild_id FROM guilds WHERE id = $1`,
        [campaign.guild_id]
      );

      if (guildResult.rows.length === 0) {
        throw new Error('Guild not found');
      }

      const discordGuildId = guildResult.rows[0].discord_guild_id;

      // Fetch Discord guild
      const guild = await this.client.guilds.fetch(discordGuildId);
      if (!guild) {
        throw new Error(`Discord guild ${discordGuildId} not found`);
      }

      // Fetch Discord member
      const member = await guild.members.fetch(userId);
      if (!member) {
        throw new Error(`Discord member ${userId} not found in guild`);
      }

      const assignedRoles: Array<{ id: string; name: string }> = [];

      // Assign each role
      for (const roleId of role_ids) {
        const role = guild.roles.cache.get(roleId);

        if (!role) {
          logger.warn('Role not found in guild', {
            role_id: roleId,
            guild_id: discordGuildId,
          });
          continue;
        }

        // Check if member already has role
        if (member.roles.cache.has(roleId)) {
          logger.debug('Member already has role', {
            user_id: userId,
            role_id: roleId,
          });
          continue;
        }

        // Assign role
        await member.roles.add(role, `Reward: ${campaign.name}`);

        assignedRoles.push({
          id: roleId,
          name: role.name,
        });

        logger.info('Role assigned via reward', {
          user_id: userId,
          role_id: roleId,
          role_name: role.name,
          campaign_id: campaign.id,
        });
      }

      return {
        details: {
          assigned_roles: assignedRoles,
          requested_roles: role_ids.length,
          successfully_assigned: assignedRoles.length,
        },
        txHash: null,
      };
    } catch (error: any) {
      logger.error('Role reward delivery failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Deliver XP reward (reuses existing gamification service)
   */
  private async deliverXPReward(
    campaign: any,
    userId: string
  ): Promise<{ details: any; txHash: null }> {
    try {
      const { xp_amount } = campaign.reward_config;

      if (!xp_amount || typeof xp_amount !== 'number' || xp_amount <= 0) {
        throw new Error('Invalid reward_config: xp_amount must be a positive number');
      }

      // Get username from discord_users table
      const userResult = await query(
        `SELECT username FROM discord_users WHERE user_id = $1`,
        [userId]
      );

      const username = userResult.rows[0]?.username || 'Unknown User';

      // Award XP using existing gamification service
      // This automatically handles level-ups and achievements
      const xpResult = await addXP(userId, username, xp_amount);

      logger.info('XP reward delivered', {
        user_id: userId,
        xp_amount: xp_amount,
        new_total_xp: xpResult.new_total_xp,
        leveled_up: xpResult.leveled_up,
        campaign_id: campaign.id,
      });

      return {
        details: {
          xp_gained: xpResult.xp_gained,
          new_total_xp: xpResult.new_total_xp,
          leveled_up: xpResult.leveled_up,
          new_level: xpResult.new_level,
          old_level: xpResult.old_level,
        },
        txHash: null,
      };
    } catch (error: any) {
      logger.error('XP reward delivery failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Deliver access grant reward (NEW - grants channel access)
   */
  private async deliverAccessGrantReward(
    campaign: any,
    userId: string
  ): Promise<{ details: any; txHash: null }> {
    try {
      const { channel_ids, duration_hours } = campaign.reward_config;

      if (!channel_ids || !Array.isArray(channel_ids) || channel_ids.length === 0) {
        throw new Error('Invalid reward_config: channel_ids array is required');
      }

      // Get guild Discord ID
      const guildResult = await query(
        `SELECT discord_guild_id FROM guilds WHERE id = $1`,
        [campaign.guild_id]
      );

      if (guildResult.rows.length === 0) {
        throw new Error('Guild not found');
      }

      const discordGuildId = guildResult.rows[0].discord_guild_id;

      // Fetch Discord guild
      const guild = await this.client.guilds.fetch(discordGuildId);
      if (!guild) {
        throw new Error(`Discord guild ${discordGuildId} not found`);
      }

      // Fetch Discord member
      const member = await guild.members.fetch(userId);
      if (!member) {
        throw new Error(`Discord member ${userId} not found in guild`);
      }

      const grantedChannels: Array<{ id: string; name: string }> = [];
      const durationHours = duration_hours || 0; // 0 = permanent

      // Grant access to each channel
      for (const channelId of channel_ids) {
        const channel = guild.channels.cache.get(channelId);

        if (!channel) {
          logger.warn('Channel not found in guild', {
            channel_id: channelId,
            guild_id: discordGuildId,
          });
          continue;
        }

        // Check if text or voice channel (only these support permission overwrites for users)
        if (!channel.isTextBased() && !channel.isVoiceBased()) {
          logger.warn('Channel type does not support user permissions', {
            channel_id: channelId,
            channel_type: channel.type,
          });
          continue;
        }

        // Grant read/send permissions
        await channel.permissionOverwrites.create(member, {
          ViewChannel: true,
          SendMessages: channel.isTextBased() ? true : null, // Only for text channels
          ReadMessageHistory: channel.isTextBased() ? true : null,
          Connect: channel.isVoiceBased() ? true : null, // Only for voice channels
          Speak: channel.isVoiceBased() ? true : null,
        });

        grantedChannels.push({
          id: channelId,
          name: channel.name,
        });

        logger.info('Channel access granted via reward', {
          user_id: userId,
          channel_id: channelId,
          channel_name: channel.name,
          campaign_id: campaign.id,
          duration_hours: durationHours || 'permanent',
        });

        // If temporary access, schedule removal
        if (durationHours > 0) {
          await this.scheduleAccessRemoval(
            userId,
            channelId,
            discordGuildId,
            durationHours,
            campaign.id
          );
        }
      }

      return {
        details: {
          granted_channels: grantedChannels,
          requested_channels: channel_ids.length,
          successfully_granted: grantedChannels.length,
          duration_hours: durationHours || 'permanent',
          expires_at: durationHours > 0
            ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
            : null,
        },
        txHash: null,
      };
    } catch (error: any) {
      logger.error('Access grant reward delivery failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Schedule access removal for temporary channel grants
   */
  private async scheduleAccessRemoval(
    userId: string,
    channelId: string,
    guildId: string,
    durationHours: number,
    campaignId: string
  ): Promise<void> {
    try {
      // Calculate expiration time
      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

      // Store in database for background job to process
      await query(
        `INSERT INTO scheduled_access_removals
           (user_id, channel_id, guild_id, expires_at, campaign_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, channel_id) DO UPDATE
         SET expires_at = $4, campaign_id = $5`,
        [userId, channelId, guildId, expiresAt, campaignId]
      ).catch(async (err: any) => {
        // If table doesn't exist, log warning (this feature requires additional migration)
        if (err.message.includes('does not exist')) {
          logger.warn(
            'scheduled_access_removals table not found - temporary access removal not scheduled. ' +
            'Create migration to add this table for temporary access grants.',
            { user_id: userId, channel_id: channelId }
          );
        } else {
          throw err;
        }
      });

      logger.info('Access removal scheduled', {
        user_id: userId,
        channel_id: channelId,
        expires_at: expiresAt.toISOString(),
      });
    } catch (error: any) {
      logger.error('Failed to schedule access removal', {
        user_id: userId,
        channel_id: channelId,
        error: error.message,
      });
      // Don't throw - delivery succeeded even if scheduling failed
    }
  }

  /**
   * Send DM notification to user about reward delivery
   */
  private async notifyUser(userId: string, campaign: any, result: any): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);

      let message = `🎉 **Congratulations!** You've received the **${campaign.name}** reward!\n\n`;

      switch (campaign.reward_type) {
        case 'role':
          if (result.details.assigned_roles.length > 0) {
            const roles = result.details.assigned_roles.map((r: any) => r.name).join(', ');
            message += `**Roles Assigned:** ${roles}\n`;
            message += `You now have access to exclusive channels and features!`;
          } else {
            message += `You already have all the roles from this reward!`;
          }
          break;

        case 'xp':
          message += `**XP Gained:** +${result.details.xp_gained} XP\n`;
          message += `**Total XP:** ${result.details.new_total_xp}\n`;

          if (result.details.leveled_up) {
            message += `\n🎊 **Level Up!** You're now level **${result.details.new_level}**!`;
          } else {
            message += `**Current Level:** ${result.details.new_level}`;
          }
          break;

        case 'access_grant':
          if (result.details.granted_channels.length > 0) {
            const channels = result.details.granted_channels.map((c: any) => c.name).join(', ');
            message += `**Access Granted:** #${channels}\n`;

            if (result.details.duration_hours === 'permanent') {
              message += `**Duration:** Permanent`;
            } else {
              message += `**Duration:** ${result.details.duration_hours} hours\n`;
              message += `**Expires:** ${new Date(result.details.expires_at).toLocaleString()}`;
            }
          } else {
            message += `You already have access to all channels from this reward!`;
          }
          break;
      }

      if (campaign.description) {
        message += `\n\n_${campaign.description}_`;
      }

      await user.send(message);

      logger.debug('Reward notification sent to user', { user_id: userId });
    } catch (error: any) {
      // Fail silently if DMs are disabled
      logger.debug('Could not send reward notification DM', {
        user_id: userId,
        error: error.message,
      });
    }
  }

  /**
   * Log analytics event for reward delivery
   */
  private async logDeliveryAnalytics(
    campaignId: string,
    userId: string,
    status: 'success' | 'failed',
    rewardType: string
  ): Promise<void> {
    try {
      const campaignResult = await query(
        `SELECT guild_id, name FROM reward_campaigns WHERE id = $1`,
        [campaignId]
      );

      if (campaignResult.rows.length > 0) {
        const campaign = campaignResult.rows[0];

        await query(
          `INSERT INTO analytics_events (
             guild_id,
             event_type,
             event_data,
             user_id
           ) VALUES ($1, $2, $3, $4)`,
          [
            campaign.guild_id,
            `reward_delivery_${status}`,
            JSON.stringify({
              campaign_id: campaignId,
              campaign_name: campaign.name,
              reward_type: rewardType,
            }),
            userId,
          ]
        );
      }
    } catch (error: any) {
      logger.error('Failed to log delivery analytics', {
        campaign_id: campaignId,
        error: error.message,
      });
      // Don't throw - analytics failure shouldn't break delivery
    }
  }

  /**
   * Retry failed delivery (called by scheduler for failed claims)
   */
  async retryFailedDelivery(claimId: string): Promise<boolean> {
    try {
      const claimResult = await query(
        `SELECT * FROM reward_claims WHERE id = $1 AND status = 'failed'`,
        [claimId]
      );

      if (claimResult.rows.length === 0) {
        logger.warn('Claim not found or not in failed status', { claim_id: claimId });
        return false;
      }

      const claim = claimResult.rows[0];

      // Check retry limit (max 3 retries)
      if (claim.retries >= 3) {
        logger.warn('Max retries exceeded for claim', {
          claim_id: claimId,
          retries: claim.retries,
        });
        return false;
      }

      logger.info('Retrying failed delivery', {
        claim_id: claimId,
        attempt: claim.retries + 1,
      });

      // Add back to queue with higher priority
      await query(
        `INSERT INTO reward_delivery_queue (
           campaign_id,
           claim_id,
           discord_user_id,
           priority,
           status,
           scheduled_for
         ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [claim.campaign_id, claimId, claim.discord_user_id, 5, 'pending']
      );

      // Reset claim status to pending
      await query(
        `UPDATE reward_claims SET status = 'pending' WHERE id = $1`,
        [claimId]
      );

      return true;
    } catch (error: any) {
      logger.error('Failed to retry delivery', {
        claim_id: claimId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Deliver NFT reward (transferable via external ERC721 contract)
   * Phase 2 Feature - Requires Starknet integration
   */
  private async deliverNFTReward(
    campaign: any,
    userId: string,
    claimId: string
  ): Promise<{ details: any; txHash: string | null }> {
    try {
      const { NFTMintingService } = require('./reward-nft-service');
      const nftService = new NFTMintingService();

      // Get user's Starknet wallet
      const walletAddress = await nftService.getUserWallet(userId);
      if (!walletAddress) {
        throw new Error('User has not verified their Starknet wallet. Please run /verify first.');
      }

      // Mint NFT
      const mintResult = await nftService.mintNFT(campaign.id, userId, walletAddress);

      if (!mintResult.success) {
        throw new Error(mintResult.error || 'NFT minting failed');
      }

      // Record mint in database
      await nftService.recordMint(
        claimId,
        campaign.id,
        userId,
        walletAddress,
        campaign.reward_config.contract_address,
        mintResult.token_id!,
        mintResult.tx_hash!,
        campaign.reward_config
      );

      logger.info('NFT reward delivered', {
        user_id: userId,
        token_id: mintResult.token_id,
        tx_hash: mintResult.tx_hash,
        campaign_id: campaign.id,
      });

      return {
        details: {
          token_id: mintResult.token_id,
          contract_address: campaign.reward_config.contract_address,
          wallet_address: walletAddress,
          explorer_url: nftService.getExplorerUrl(mintResult.tx_hash!),
        },
        txHash: mintResult.tx_hash || null,
      };
    } catch (error: any) {
      logger.error('NFT reward delivery failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Deliver POAP reward (soulbound via achievement_nft.cairo)
   * Phase 2 Feature - Requires Starknet integration
   */
  private async deliverPOAPReward(
    campaign: any,
    userId: string,
    claimId: string
  ): Promise<{ details: any; txHash: string | null }> {
    try {
      const { NFTMintingService } = require('./reward-nft-service');
      const nftService = new NFTMintingService();

      // Get user's Starknet wallet
      const walletAddress = await nftService.getUserWallet(userId);
      if (!walletAddress) {
        throw new Error('User has not verified their Starknet wallet. Please run /verify first.');
      }

      // Get achievement type from config (100+ for Discord rewards)
      const achievementType = campaign.reward_config.achievement_type || 100;

      // Mint POAP (soulbound NFT)
      const mintResult = await nftService.mintPOAP(
        campaign.id,
        userId,
        walletAddress,
        achievementType
      );

      if (!mintResult.success) {
        throw new Error(mintResult.error || 'POAP minting failed');
      }

      // Record mint in database
      await nftService.recordMint(
        claimId,
        campaign.id,
        userId,
        walletAddress,
        campaign.reward_config.contract_address,
        mintResult.token_id!,
        mintResult.tx_hash!,
        {
          ...campaign.reward_config,
          is_soulbound: true,
          achievement_type: achievementType,
        }
      );

      logger.info('POAP reward delivered', {
        user_id: userId,
        token_id: mintResult.token_id,
        achievement_type: achievementType,
        tx_hash: mintResult.tx_hash,
        campaign_id: campaign.id,
      });

      return {
        details: {
          token_id: mintResult.token_id,
          contract_address: campaign.reward_config.contract_address,
          achievement_type: achievementType,
          wallet_address: walletAddress,
          is_soulbound: true,
          explorer_url: nftService.getExplorerUrl(mintResult.tx_hash!),
        },
        txHash: mintResult.tx_hash || null,
      };
    } catch (error: any) {
      logger.error('POAP reward delivery failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Deliver webhook reward (call external API with HMAC auth)
   * Phase 2 Feature
   */
  private async deliverWebhookReward(
    campaign: any,
    userId: string,
    claimId: string
  ): Promise<{ details: any; txHash: null }> {
    try {
      const { WebhookService } = require('./reward-webhook-service');
      const webhookService = new WebhookService();

      // Get user details
      const userResult = await query(
        `SELECT username, starknet_address FROM discord_users WHERE user_id = $1`,
        [userId]
      );

      const username = userResult.rows[0]?.username || 'Unknown User';
      const walletAddress = userResult.rows[0]?.starknet_address || undefined;

      // Build webhook payload
      const payload = webhookService.buildPayload(
        campaign,
        userId,
        username,
        walletAddress
      );

      // Send webhook with retry
      const webhookConfig = {
        url: campaign.reward_config.url,
        method: campaign.reward_config.method || 'POST',
        headers: campaign.reward_config.headers || {},
        use_hmac: campaign.reward_config.use_hmac || false,
        rate_limit: campaign.reward_config.rate_limit,
        timeout: campaign.reward_config.timeout,
      };

      const webhookResult = await webhookService.sendWebhookWithRetry(
        campaign.id,
        claimId,
        userId,
        webhookConfig,
        payload
      );

      if (!webhookResult.success) {
        throw new Error(webhookResult.error || 'Webhook delivery failed');
      }

      logger.info('Webhook reward delivered', {
        user_id: userId,
        webhook_url: webhookConfig.url,
        status: webhookResult.status,
        response_time: webhookResult.response_time_ms,
        campaign_id: campaign.id,
      });

      return {
        details: {
          webhook_url: webhookConfig.url,
          status_code: webhookResult.status,
          response_time_ms: webhookResult.response_time_ms,
          response_body: webhookResult.response_body,
        },
        txHash: null,
      };
    } catch (error: any) {
      logger.error('Webhook reward delivery failed', { error: error.message });
      throw error;
    }
  }
}
