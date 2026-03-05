/**
 * BitSage Discord - Reward Eligibility Service
 *
 * Checks if users qualify for reward campaigns.
 * Integrates with:
 * - RuleGroupEvaluator for blockchain/token-gating requirements
 * - discord_users table for XP/level/message requirements
 * - reward_claims for cooldown enforcement
 */

import { query } from '../utils/database';
import { logger } from '../utils/logger';
import { RuleGroupEvaluator } from '../token-gating/services/rule-group-evaluator';

interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  data?: any;
}

export class RewardEligibilityService {
  private ruleGroupEvaluator: RuleGroupEvaluator;

  constructor(ruleGroupEvaluator: RuleGroupEvaluator) {
    this.ruleGroupEvaluator = ruleGroupEvaluator;
  }

  /**
   * Check if user is eligible for a campaign
   */
  async checkEligibility(campaignId: string, userId: string): Promise<EligibilityResult> {
    try {
      // 1. Fetch campaign
      const campaignResult = await query(
        `SELECT * FROM reward_campaigns WHERE id = $1`,
        [campaignId]
      );

      if (campaignResult.rows.length === 0) {
        return { eligible: false, reason: 'Campaign not found' };
      }

      const campaign = campaignResult.rows[0];

      // 2. Check campaign status
      if (campaign.status !== 'active') {
        return {
          eligible: false,
          reason: `Campaign is ${campaign.status}`,
        };
      }

      // 3. Check start/end dates
      const now = new Date();

      if (campaign.start_date) {
        const startDate = new Date(campaign.start_date);
        if (startDate > now) {
          return {
            eligible: false,
            reason: `Campaign starts on ${startDate.toLocaleDateString()}`,
          };
        }
      }

      if (campaign.end_date) {
        const endDate = new Date(campaign.end_date);
        if (endDate < now) {
          return {
            eligible: false,
            reason: `Campaign ended on ${endDate.toLocaleDateString()}`,
          };
        }
      }

      // 4. Check max claims limit (global campaign limit)
      if (campaign.max_claims !== null && campaign.max_claims !== undefined) {
        if (campaign.claimed_count >= campaign.max_claims) {
          return {
            eligible: false,
            reason: `Campaign has reached maximum claims (${campaign.max_claims})`,
          };
        }
      }

      // 5. Check if user has already claimed
      const existingClaimsResult = await query(
        `SELECT * FROM reward_claims
         WHERE campaign_id = $1 AND discord_user_id = $2
         ORDER BY claimed_at DESC
         LIMIT 1`,
        [campaignId, userId]
      );

      if (existingClaimsResult.rows.length > 0) {
        const lastClaim = existingClaimsResult.rows[0];

        // If cooldown is 0, user can only claim once
        if (campaign.cooldown_hours === 0) {
          return {
            eligible: false,
            reason: 'You have already claimed this reward',
          };
        }

        // If cooldown > 0, check if cooldown period has passed
        if (campaign.cooldown_hours > 0) {
          const lastClaimTime = new Date(lastClaim.claimed_at);
          const cooldownMs = campaign.cooldown_hours * 60 * 60 * 1000;
          const cooldownEnd = new Date(lastClaimTime.getTime() + cooldownMs);

          if (now < cooldownEnd) {
            const hoursRemaining = Math.ceil(
              (cooldownEnd.getTime() - now.getTime()) / (60 * 60 * 1000)
            );
            return {
              eligible: false,
              reason: `Cooldown active. You can claim again in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`,
            };
          }
        }
      }

      // 6. Check rule group eligibility (if linked)
      if (campaign.rule_group_id) {
        const ruleGroupEligibility = await this.checkRuleGroupEligibility(
          campaign.rule_group_id,
          userId
        );

        if (!ruleGroupEligibility.eligible) {
          return ruleGroupEligibility;
        }
      }

      // 7. Check custom eligibility requirements
      if (campaign.eligibility_requirements) {
        const customEligibility = await this.checkCustomRequirements(
          userId,
          campaign.eligibility_requirements
        );

        if (!customEligibility.eligible) {
          return customEligibility;
        }
      }

      // All checks passed!
      return {
        eligible: true,
        data: {
          campaign_id: campaignId,
          campaign_name: campaign.name,
          reward_type: campaign.reward_type,
          rule_group_passed: !!campaign.rule_group_id,
          custom_requirements_passed: !!campaign.eligibility_requirements,
        },
      };
    } catch (error: any) {
      logger.error('Eligibility check failed', {
        campaign_id: campaignId,
        user_id: userId,
        error: error.message,
      });

      return {
        eligible: false,
        reason: 'Eligibility check error - please try again later',
      };
    }
  }

  /**
   * Check if user passes rule group requirements
   */
  private async checkRuleGroupEligibility(
    ruleGroupId: number,
    userId: string
  ): Promise<EligibilityResult> {
    try {
      // Get wallet address for user
      const walletResult = await query(
        `SELECT wallet_address FROM wallet_verifications
         WHERE user_id = $1 AND verified = TRUE
         ORDER BY verified_at DESC
         LIMIT 1`,
        [userId]
      );

      if (walletResult.rows.length === 0) {
        return {
          eligible: false,
          reason: 'You must verify your wallet first',
        };
      }

      const walletAddress = walletResult.rows[0].wallet_address;

      // Evaluate rule group using existing RuleGroupEvaluator
      const evaluation = await this.ruleGroupEvaluator.evaluateGroup(
        ruleGroupId,
        userId,
        walletAddress
      );

      if (!evaluation.passes) {
        return {
          eligible: false,
          reason: 'You do not meet the token-gating requirements for this reward',
          data: evaluation.details,
        };
      }

      return {
        eligible: true,
        data: {
          rule_group_id: ruleGroupId,
          evaluation_details: evaluation.details,
        },
      };
    } catch (error: any) {
      logger.error('Rule group eligibility check failed', {
        rule_group_id: ruleGroupId,
        user_id: userId,
        error: error.message,
      });

      return {
        eligible: false,
        reason: 'Failed to check token-gating requirements',
      };
    }
  }

  /**
   * Check custom requirements (min level, min XP, min messages, etc.)
   */
  private async checkCustomRequirements(
    userId: string,
    requirements: any
  ): Promise<EligibilityResult> {
    try {
      // Fetch user data from discord_users table
      const userResult = await query(
        `SELECT * FROM discord_users WHERE user_id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return {
          eligible: false,
          reason: 'User profile not found - please send a message first',
        };
      }

      const user = userResult.rows[0];

      // Check min_level requirement
      if (requirements.min_level !== undefined && requirements.min_level !== null) {
        if (user.level < requirements.min_level) {
          return {
            eligible: false,
            reason: `Requires level ${requirements.min_level} (you are level ${user.level})`,
          };
        }
      }

      // Check min_xp requirement
      if (requirements.min_xp !== undefined && requirements.min_xp !== null) {
        if (user.xp < requirements.min_xp) {
          return {
            eligible: false,
            reason: `Requires ${requirements.min_xp} XP (you have ${user.xp} XP)`,
          };
        }
      }

      // Check min_messages requirement
      if (requirements.min_messages !== undefined && requirements.min_messages !== null) {
        if (user.total_messages < requirements.min_messages) {
          return {
            eligible: false,
            reason: `Requires ${requirements.min_messages} messages (you have ${user.total_messages})`,
          };
        }
      }

      // Check min_reputation requirement
      if (requirements.min_reputation !== undefined && requirements.min_reputation !== null) {
        if (user.reputation < requirements.min_reputation) {
          return {
            eligible: false,
            reason: `Requires ${requirements.min_reputation} reputation (you have ${user.reputation})`,
          };
        }
      }

      // Check min_streak requirement
      if (requirements.min_streak !== undefined && requirements.min_streak !== null) {
        if (user.daily_streak < requirements.min_streak) {
          return {
            eligible: false,
            reason: `Requires ${requirements.min_streak} day streak (you have ${user.daily_streak})`,
          };
        }
      }

      // Check verified requirement
      if (requirements.verified === true) {
        if (!user.verified) {
          return {
            eligible: false,
            reason: 'You must verify your wallet first',
          };
        }
      }

      // All custom requirements passed
      return {
        eligible: true,
        data: {
          user_level: user.level,
          user_xp: user.xp,
          user_messages: user.total_messages,
          user_reputation: user.reputation,
          user_streak: user.daily_streak,
        },
      };
    } catch (error: any) {
      logger.error('Custom requirements check failed', {
        user_id: userId,
        error: error.message,
      });

      return {
        eligible: false,
        reason: 'Failed to check custom requirements',
      };
    }
  }

  /**
   * Update eligibility cache for a campaign
   * (Called periodically or when campaign is updated)
   */
  async updateEligibilityCache(campaignId: string, userIds: string[]): Promise<void> {
    try {
      logger.info('Updating eligibility cache', {
        campaign_id: campaignId,
        user_count: userIds.length,
      });

      let updated = 0;

      for (const userId of userIds) {
        try {
          const eligibility = await this.checkEligibility(campaignId, userId);

          await query(
            `INSERT INTO reward_eligibility (
               campaign_id,
               discord_user_id,
               eligible,
               eligibility_data,
               last_checked
             ) VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (campaign_id, discord_user_id)
             DO UPDATE SET
               eligible = $3,
               eligibility_data = $4,
               last_checked = NOW()`,
            [
              campaignId,
              userId,
              eligibility.eligible,
              JSON.stringify(eligibility.data || {}),
            ]
          );

          updated++;
        } catch (error: any) {
          logger.error('Failed to update eligibility for user', {
            campaign_id: campaignId,
            user_id: userId,
            error: error.message,
          });
          // Continue with next user
        }
      }

      logger.info('Eligibility cache updated', {
        campaign_id: campaignId,
        updated_count: updated,
        total_count: userIds.length,
      });
    } catch (error: any) {
      logger.error('Failed to update eligibility cache', {
        campaign_id: campaignId,
        error: error.message,
      });
    }
  }

  /**
   * Get all eligible users for a campaign (for preview)
   * Uses cached eligibility data if available
   */
  async getEligibleUsers(
    campaignId: string
  ): Promise<Array<{ userId: string; username: string; eligible: boolean }>> {
    try {
      // Fetch from cache (joined with discord_users for usernames)
      const cacheResult = await query(
        `SELECT
           re.discord_user_id as user_id,
           du.username,
           re.eligible
         FROM reward_eligibility re
         JOIN discord_users du ON re.discord_user_id = du.user_id
         WHERE re.campaign_id = $1 AND re.eligible = true
         ORDER BY re.last_checked DESC
         LIMIT 100`,
        [campaignId]
      );

      return cacheResult.rows.map((row) => ({
        userId: row.user_id,
        username: row.username || 'Unknown',
        eligible: row.eligible,
      }));
    } catch (error: any) {
      logger.error('Failed to get eligible users', {
        campaign_id: campaignId,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Clear eligibility cache for a campaign
   * (Called when campaign is updated or deleted)
   */
  async clearEligibilityCache(campaignId: string): Promise<void> {
    try {
      await query(
        `DELETE FROM reward_eligibility WHERE campaign_id = $1`,
        [campaignId]
      );

      logger.info('Eligibility cache cleared', { campaign_id: campaignId });
    } catch (error: any) {
      logger.error('Failed to clear eligibility cache', {
        campaign_id: campaignId,
        error: error.message,
      });
    }
  }

  /**
   * Get eligibility summary for a user across all active campaigns
   */
  async getUserEligibilitySummary(
    userId: string,
    guildId: string
  ): Promise<Array<{ campaignId: string; campaignName: string; eligible: boolean; reason?: string }>> {
    try {
      // Get all active campaigns for guild
      const campaignsResult = await query(
        `SELECT id, name FROM reward_campaigns
         WHERE guild_id = $1 AND status = 'active'
         ORDER BY created_at DESC`,
        [guildId]
      );

      const summary = [];

      for (const campaign of campaignsResult.rows) {
        const eligibility = await this.checkEligibility(campaign.id, userId);

        summary.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          eligible: eligibility.eligible,
          reason: eligibility.reason,
        });
      }

      return summary;
    } catch (error: any) {
      logger.error('Failed to get user eligibility summary', {
        user_id: userId,
        guild_id: guildId,
        error: error.message,
      });
      return [];
    }
  }
}
