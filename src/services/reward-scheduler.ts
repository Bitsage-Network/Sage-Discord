/**
 * BitSage Discord - Reward Scheduler
 *
 * Background queue processor that:
 * - Polls reward_delivery_queue every 30 seconds
 * - Processes pending deliveries
 * - Handles rule_pass triggers (called when user passes rule group)
 * - Manages retry logic for failed deliveries
 */

import { Client } from 'discord.js';
import { query } from '../utils/database';
import { logger } from '../utils/logger';
import { RewardDeliveryService } from './reward-delivery-service';
import { RewardEligibilityService } from './reward-eligibility-service';

export class RewardScheduler {
  private interval: NodeJS.Timeout | null = null;
  private deliveryService: RewardDeliveryService;
  private eligibilityService: RewardEligibilityService;
  private isProcessing: boolean = false;

  constructor(
    deliveryService: RewardDeliveryService,
    eligibilityService: RewardEligibilityService
  ) {
    this.deliveryService = deliveryService;
    this.eligibilityService = eligibilityService;
  }

  /**
   * Start background scheduler (called at bot startup)
   */
  start(client: Client): void {
    if (this.interval) {
      logger.warn('Reward scheduler already running');
      return;
    }

    logger.info('Starting reward scheduler (30s interval)...');

    // Process queue every 30 seconds
    this.interval = setInterval(() => {
      this.processQueue().catch((error) => {
        logger.error('Queue processing error', { error: error.message });
      });
    }, 30000); // 30 seconds

    // Process queue immediately on startup
    this.processQueue().catch((error) => {
      logger.error('Initial queue processing error', { error: error.message });
    });

    logger.info('✅ Reward scheduler started');
  }

  /**
   * Stop scheduler (called at bot shutdown)
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Reward scheduler stopped');
    }
  }

  /**
   * Process delivery queue
   * Fetches pending items and delivers rewards
   */
  async processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      logger.debug('Queue processing already in progress, skipping');
      return;
    }

    try {
      this.isProcessing = true;

      // Fetch pending queue items (ordered by priority DESC, then created_at ASC)
      const queueResult = await query(
        `SELECT * FROM reward_delivery_queue
         WHERE status = 'pending'
           AND scheduled_for <= NOW()
         ORDER BY priority DESC, created_at ASC
         LIMIT 50`,
        []
      );

      if (queueResult.rows.length === 0) {
        logger.debug('No pending rewards to process');
        return;
      }

      logger.info(`Processing ${queueResult.rows.length} queued reward(s)`);

      // Process each queue item
      for (const item of queueResult.rows) {
        try {
          // Mark as processing
          await query(
            `UPDATE reward_delivery_queue SET status = 'processing' WHERE id = $1`,
            [item.id]
          );

          logger.info('Processing reward delivery', {
            queue_id: item.id,
            campaign_id: item.campaign_id,
            user_id: item.discord_user_id,
            priority: item.priority,
          });

          // Deliver reward
          const result = await this.deliveryService.deliverReward(
            item.campaign_id,
            item.discord_user_id,
            item.claim_id
          );

          if (result.success) {
            logger.info('Reward delivery succeeded from queue', {
              queue_id: item.id,
              campaign_id: item.campaign_id,
              user_id: item.discord_user_id,
            });
          } else {
            logger.warn('Reward delivery failed from queue', {
              queue_id: item.id,
              campaign_id: item.campaign_id,
              user_id: item.discord_user_id,
              error: result.error,
            });
          }
        } catch (error: any) {
          logger.error('Failed to process queue item', {
            queue_id: item.id,
            campaign_id: item.campaign_id,
            user_id: item.discord_user_id,
            error: error.message,
          });

          // Mark as failed (delivery service already updated the status)
          await query(
            `UPDATE reward_delivery_queue SET status = 'failed' WHERE id = $1`,
            [item.id]
          ).catch((err) => {
            logger.error('Failed to update queue item status', {
              queue_id: item.id,
              error: err.message,
            });
          });
        }
      }
    } catch (error: any) {
      logger.error('Queue processing failed', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle rule_pass trigger
   * Called when a user passes a rule group (automatic reward trigger)
   */
  async handleRulePassTrigger(
    userId: string,
    guildId: string,
    ruleGroupId?: number
  ): Promise<void> {
    try {
      logger.info('Handling rule_pass trigger', {
        user_id: userId,
        guild_id: guildId,
        rule_group_id: ruleGroupId,
      });

      // Find campaigns with trigger_type='rule_pass' for this guild
      let campaignsQuery = `
        SELECT * FROM reward_campaigns
        WHERE guild_id = $1
          AND trigger_type = 'rule_pass'
          AND status = 'active'
      `;

      const params: any[] = [guildId];

      // If specific rule group triggered, filter by it
      if (ruleGroupId !== undefined) {
        campaignsQuery += ` AND rule_group_id = $2`;
        params.push(ruleGroupId);
      }

      const campaignsResult = await query(campaignsQuery, params);

      if (campaignsResult.rows.length === 0) {
        logger.debug('No rule_pass campaigns found for guild', {
          guild_id: guildId,
          rule_group_id: ruleGroupId,
        });
        return;
      }

      logger.info(`Found ${campaignsResult.rows.length} rule_pass campaign(s)`, {
        guild_id: guildId,
      });

      // Process each campaign
      for (const campaign of campaignsResult.rows) {
        try {
          // Check eligibility
          const eligibility = await this.eligibilityService.checkEligibility(
            campaign.id,
            userId
          );

          if (!eligibility.eligible) {
            logger.debug('User not eligible for rule_pass campaign', {
              campaign_id: campaign.id,
              campaign_name: campaign.name,
              user_id: userId,
              reason: eligibility.reason,
            });
            continue;
          }

          logger.info('User eligible for rule_pass campaign', {
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            user_id: userId,
          });

          // If auto_claim is enabled, automatically deliver reward
          if (campaign.auto_claim) {
            await this.createClaimAndQueue(
              campaign.id,
              userId,
              'automatic',
              0 // Priority 0 for automatic claims
            );

            logger.info('Auto-claim triggered', {
              campaign_id: campaign.id,
              campaign_name: campaign.name,
              user_id: userId,
            });
          } else {
            // Send notification to user that they're eligible
            await this.notifyEligibleUser(userId, campaign);

            logger.info('Eligibility notification sent', {
              campaign_id: campaign.id,
              campaign_name: campaign.name,
              user_id: userId,
            });
          }
        } catch (error: any) {
          logger.error('Failed to process rule_pass campaign', {
            campaign_id: campaign.id,
            user_id: userId,
            error: error.message,
          });
          // Continue with next campaign
        }
      }
    } catch (error: any) {
      logger.error('Rule pass trigger handling failed', {
        user_id: userId,
        guild_id: guildId,
        error: error.message,
      });
    }
  }

  /**
   * Create claim and add to delivery queue
   * Used for both manual and automatic claims
   */
  async createClaimAndQueue(
    campaignId: string,
    userId: string,
    deliveryMethod: 'manual' | 'automatic' | 'scheduled',
    priority: number
  ): Promise<string | null> {
    try {
      // Create claim record
      const claimResult = await query(
        `INSERT INTO reward_claims (
           campaign_id,
           discord_user_id,
           claimed_at,
           status,
           delivery_method
         ) VALUES ($1, $2, NOW(), 'pending', $3)
         RETURNING id`,
        [campaignId, userId, deliveryMethod]
      );

      const claimId = claimResult.rows[0].id;

      // Add to delivery queue
      await query(
        `INSERT INTO reward_delivery_queue (
           campaign_id,
           claim_id,
           discord_user_id,
           priority,
           status,
           scheduled_for
         ) VALUES ($1, $2, $3, $4, 'pending', NOW())`,
        [campaignId, claimId, userId, priority]
      );

      // Increment campaign claimed_count
      await query(
        `UPDATE reward_campaigns
         SET claimed_count = claimed_count + 1
         WHERE id = $1`,
        [campaignId]
      );

      logger.info('Claim created and queued', {
        campaign_id: campaignId,
        claim_id: claimId,
        user_id: userId,
        delivery_method: deliveryMethod,
        priority,
      });

      return claimId;
    } catch (error: any) {
      // Check if error is due to unique constraint (user already claimed)
      if (error.message.includes('unique') || error.code === '23505') {
        logger.warn('User already claimed this campaign', {
          campaign_id: campaignId,
          user_id: userId,
        });
        return null;
      }

      logger.error('Failed to create claim and queue', {
        campaign_id: campaignId,
        user_id: userId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Notify user that they're eligible for a reward (but haven't claimed yet)
   * Used when auto_claim is false
   */
  private async notifyEligibleUser(userId: string, campaign: any): Promise<void> {
    try {
      // Get Discord client from global (set during bot startup)
      const client = (global as any).discordClient as Client;

      if (!client) {
        logger.warn('Discord client not available for notification');
        return;
      }

      const user = await client.users.fetch(userId);

      let message = `🎁 **You're now eligible for a reward!**\n\n`;
      message += `**Campaign:** ${campaign.name}\n`;

      if (campaign.description) {
        message += `**Description:** ${campaign.description}\n`;
      }

      message += `**Type:** ${this.formatRewardType(campaign.reward_type)}\n\n`;
      message += `Use \`/rewards claim ${campaign.name}\` to claim your reward!`;

      await user.send(message);

      logger.debug('Eligibility notification sent', {
        user_id: userId,
        campaign_id: campaign.id,
      });
    } catch (error: any) {
      // Fail silently if DMs are disabled
      logger.debug('Could not send eligibility notification DM', {
        user_id: userId,
        campaign_id: campaign.id,
        error: error.message,
      });
    }
  }

  /**
   * Format reward type for display
   */
  private formatRewardType(rewardType: string): string {
    switch (rewardType) {
      case 'role':
        return 'Discord Role(s)';
      case 'xp':
        return 'XP/Points';
      case 'access_grant':
        return 'Channel Access';
      case 'nft':
        return 'NFT Mint';
      case 'poap':
        return 'POAP Badge';
      case 'webhook':
        return 'Custom Reward';
      default:
        return rewardType;
    }
  }

  /**
   * Clean up old completed queue items (optional maintenance task)
   * Call this periodically (e.g., daily) to prevent queue table from growing too large
   */
  async cleanupCompletedQueueItems(olderThanDays: number = 7): Promise<void> {
    try {
      const result = await query(
        `DELETE FROM reward_delivery_queue
         WHERE status IN ('completed', 'failed')
           AND processed_at < NOW() - INTERVAL '${olderThanDays} days'`,
        []
      );

      logger.info('Cleaned up old queue items', {
        deleted_count: result.rowCount,
        older_than_days: olderThanDays,
      });
    } catch (error: any) {
      logger.error('Failed to clean up queue items', { error: error.message });
    }
  }

  /**
   * Get queue statistics (for monitoring)
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    try {
      const result = await query(
        `SELECT
           status,
           COUNT(*) as count
         FROM reward_delivery_queue
         GROUP BY status`,
        []
      );

      const stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      };

      for (const row of result.rows) {
        stats[row.status as keyof typeof stats] = parseInt(row.count);
      }

      return stats;
    } catch (error: any) {
      logger.error('Failed to get queue stats', { error: error.message });
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  }
}

/**
 * Global instance (set during bot startup)
 * Allows other modules to trigger reward events
 */
declare global {
  var rewardScheduler: RewardScheduler | undefined;
  var discordClient: Client | undefined;
}
