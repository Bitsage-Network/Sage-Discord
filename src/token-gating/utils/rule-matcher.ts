/**
 * BitSage Discord Token-Gating - Rule Evaluation Engine
 *
 * Evaluates user eligibility for token-gated roles based on blockchain state.
 * Supports: token balance, staked amount, reputation, validator, worker
 */

import { query } from '../../utils/database';
import { logger } from '../../utils/logger';
import {
  TokenGatingRule,
  RuleResult,
  TokenBalanceRequirements,
  StakedAmountRequirements,
  ReputationRequirements,
  ValidatorRequirements,
  WorkerRequirements,
  TokenGatingError,
} from '../types';
import { TokenService } from '../services/token-service';
import { PrivacyService } from '../services/privacy-service';

export class RuleMatcher {
  constructor(
    private tokenService: TokenService,
    private privacyService: PrivacyService,
    // Future services will be injected here
    // private reputationService: ReputationService,
    // private validatorService: ValidatorService,
    // private workerService: WorkerService,
  ) {}

  /**
   * Evaluate all rules for a user
   */
  async evaluateUserRules(
    userId: string,
    walletAddress: string,
    guildId: string
  ): Promise<RuleResult[]> {
    try {
      // Get all enabled rules for this guild, ordered by priority
      const rulesResult = await query<TokenGatingRule>(
        `SELECT * FROM token_gating_rules
         WHERE guild_id = $1 AND enabled = TRUE
         ORDER BY priority DESC`,
        [guildId]
      );

      if (rulesResult.rowCount === 0) {
        logger.debug('No token-gating rules found for guild', { guildId });
        return [];
      }

      const results: RuleResult[] = [];

      // Evaluate each rule
      for (const rule of rulesResult.rows) {
        try {
          const passes = await this.evaluateSingleRule(rule, walletAddress, userId);

          // Get role mapping for this rule
          const roleMapping = await query(
            `SELECT role_id, role_name FROM role_mappings
             WHERE rule_id = $1 AND guild_id = $2 LIMIT 1`,
            [rule.id, guildId]
          );

          results.push({
            rule_id: rule.id,
            rule_name: rule.rule_name,
            passes,
            role_id: roleMapping.rows[0]?.role_id,
            role_name: roleMapping.rows[0]?.role_name,
          });

          logger.debug('Rule evaluated', {
            rule_id: rule.id,
            rule_name: rule.rule_name,
            passes,
            user_id: userId,
          });
        } catch (error: any) {
          logger.error('Failed to evaluate rule', {
            rule_id: rule.id,
            rule_name: rule.rule_name,
            error: error.message,
          });

          // Continue evaluating other rules even if one fails
          results.push({
            rule_id: rule.id,
            rule_name: rule.rule_name,
            passes: false,
            role_id: undefined,
            role_name: undefined,
          });
        }
      }

      return results;
    } catch (error: any) {
      logger.error('Failed to evaluate user rules', {
        user_id: userId,
        guild_id: guildId,
        error: error.message,
      });

      throw new TokenGatingError(
        'Failed to evaluate user rules',
        'RULE_EVALUATION_ERROR',
        { userId, guildId, error: error.message }
      );
    }
  }

  /**
   * Evaluate a single rule for a wallet address
   */
  async evaluateSingleRule(
    rule: TokenGatingRule,
    walletAddress: string,
    userId: string
  ): Promise<boolean> {
    // Check cache first
    const cached = await this.getCachedRuleResult(userId, rule.id);
    if (cached !== null) {
      logger.debug('Using cached rule result', {
        rule_id: rule.id,
        user_id: userId,
        passes: cached,
      });
      return cached;
    }

    // If rule is privacy-enabled, check for valid ZK proof first
    if (rule.privacy_enabled || rule.require_zk_proof) {
      const zkProofValid = await this.checkZKProofForRule(userId, walletAddress, rule);
      if (zkProofValid) {
        logger.info('User passed rule via ZK proof', {
          rule_id: rule.id,
          user_id: userId,
        });
        await this.cacheRuleResult(userId, rule.id, true, { method: 'zk_proof' });
        return true;
      }

      // If ZK proof is required (not just optional), fail if no valid proof
      if (rule.require_zk_proof) {
        logger.debug('User failed rule: ZK proof required but not provided', {
          rule_id: rule.id,
          user_id: userId,
        });
        await this.cacheRuleResult(userId, rule.id, false, { method: 'zk_proof_required' });
        return false;
      }
    }

    // Evaluate based on rule type
    let passes = false;
    let cachedData: any = {};

    switch (rule.rule_type) {
      case 'token_balance':
        const balanceResult = await this.evaluateTokenBalance(
          rule.requirements as TokenBalanceRequirements,
          walletAddress
        );
        passes = balanceResult.passes;
        cachedData.balance = balanceResult.balance;
        break;

      case 'staked_amount':
        const stakedResult = await this.evaluateStakedAmount(
          rule.requirements as StakedAmountRequirements,
          walletAddress
        );
        passes = stakedResult.passes;
        cachedData.stake = stakedResult.stake;
        break;

      case 'reputation':
        // TODO: Implement reputation service
        logger.warn('Reputation rules not yet implemented', {
          rule_id: rule.id,
        });
        passes = false;
        break;

      case 'validator':
        // TODO: Implement validator service
        logger.warn('Validator rules not yet implemented', {
          rule_id: rule.id,
        });
        passes = false;
        break;

      case 'worker':
        // TODO: Implement worker service
        logger.warn('Worker rules not yet implemented', {
          rule_id: rule.id,
        });
        passes = false;
        break;

      default:
        logger.error('Unknown rule type', {
          rule_id: rule.id,
          rule_type: rule.rule_type,
        });
        passes = false;
    }

    // Cache the result
    await this.cacheRuleResult(userId, rule.id, passes, cachedData);

    return passes;
  }

  /**
   * Evaluate token balance rule
   */
  private async evaluateTokenBalance(
    requirements: TokenBalanceRequirements,
    walletAddress: string
  ): Promise<{ passes: boolean; balance: string }> {
    const minBalance = BigInt(requirements.min_balance);
    const includeStaked = requirements.include_staked ?? false;

    // Get balance (with caching)
    const balance = await this.tokenService.getTotalBalance(
      walletAddress,
      includeStaked
    );

    const passes = balance >= minBalance;

    logger.debug('Token balance rule evaluated', {
      wallet: walletAddress,
      balance: balance.toString(),
      min_balance: minBalance.toString(),
      include_staked: includeStaked,
      passes,
    });

    return {
      passes,
      balance: balance.toString(),
    };
  }

  /**
   * Evaluate staked amount rule
   */
  private async evaluateStakedAmount(
    requirements: StakedAmountRequirements,
    walletAddress: string
  ): Promise<{ passes: boolean; stake: string }> {
    const minAmount = BigInt(requirements.min_amount);

    // Get staked amount (with caching)
    const stake = await this.tokenService.getStakedAmount(walletAddress);

    const passes = stake >= minAmount;

    logger.debug('Staked amount rule evaluated', {
      wallet: walletAddress,
      stake: stake.toString(),
      min_amount: minAmount.toString(),
      passes,
    });

    return {
      passes,
      stake: stake.toString(),
    };
  }

  /**
   * Get cached rule result
   */
  private async getCachedRuleResult(
    userId: string,
    ruleId: number
  ): Promise<boolean | null> {
    try {
      const result = await query(
        `SELECT passes_rule FROM user_rule_cache
         WHERE user_id = $1 AND rule_id = $2 AND expires_at > NOW()`,
        [userId, ruleId]
      );

      if (result.rowCount === 0) {
        return null;
      }

      return result.rows[0].passes_rule;
    } catch (error: any) {
      logger.warn('Failed to get cached rule result', {
        user_id: userId,
        rule_id: ruleId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Cache rule result
   */
  private async cacheRuleResult(
    userId: string,
    ruleId: number,
    passes: boolean,
    cachedData: {
      balance?: string;
      stake?: string;
      reputation?: number;
    }
  ): Promise<void> {
    try {
      // Get cache TTL from rule
      const ruleResult = await query(
        'SELECT id FROM token_gating_rules WHERE id = $1',
        [ruleId]
      );

      if (ruleResult.rowCount === 0) {
        return;
      }

      // Default 1 hour cache
      const cacheTTL = 3600;

      await query(
        `INSERT INTO user_rule_cache
         (user_id, rule_id, passes_rule, cached_balance, cached_stake, cached_reputation, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '${cacheTTL} seconds')
         ON CONFLICT (user_id, rule_id)
         DO UPDATE SET
           passes_rule = $3,
           cached_balance = $4,
           cached_stake = $5,
           cached_reputation = $6,
           checked_at = NOW(),
           expires_at = NOW() + INTERVAL '${cacheTTL} seconds'`,
        [
          userId,
          ruleId,
          passes,
          cachedData.balance || null,
          cachedData.stake || null,
          cachedData.reputation || null,
        ]
      );

      logger.debug('Rule result cached', {
        user_id: userId,
        rule_id: ruleId,
        passes,
        ttl: cacheTTL,
      });
    } catch (error: any) {
      logger.warn('Failed to cache rule result', {
        user_id: userId,
        rule_id: ruleId,
        error: error.message,
      });
    }
  }

  /**
   * Invalidate cached rule results for a user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      await query('DELETE FROM user_rule_cache WHERE user_id = $1', [userId]);

      logger.info('User rule cache invalidated', { user_id: userId });
    } catch (error: any) {
      logger.error('Failed to invalidate user cache', {
        user_id: userId,
        error: error.message,
      });
    }
  }

  /**
   * Get failed rule IDs for a user (for role removal)
   */
  async getFailedRuleIds(
    userId: string,
    walletAddress: string,
    guildId: string
  ): Promise<number[]> {
    const results = await this.evaluateUserRules(userId, walletAddress, guildId);
    return results.filter((r) => !r.passes).map((r) => r.rule_id);
  }

  /**
   * Get passed rule IDs for a user (for role assignment)
   */
  async getPassedRuleIds(
    userId: string,
    walletAddress: string,
    guildId: string
  ): Promise<number[]> {
    const results = await this.evaluateUserRules(userId, walletAddress, guildId);
    return results.filter((r) => r.passes).map((r) => r.rule_id);
  }

  /**
   * Check if user has valid ZK proof for a rule
   *
   * Checks for valid, non-expired nullifier that meets the rule's threshold
   */
  private async checkZKProofForRule(
    userId: string,
    walletAddress: string,
    rule: TokenGatingRule
  ): Promise<boolean> {
    try {
      // Extract threshold from rule requirements
      let requiredThreshold: bigint;

      switch (rule.rule_type) {
        case 'token_balance':
          const balanceReqs = rule.requirements as TokenBalanceRequirements;
          requiredThreshold = BigInt(balanceReqs.min_balance);
          break;

        case 'staked_amount':
          const stakedReqs = rule.requirements as StakedAmountRequirements;
          requiredThreshold = BigInt(stakedReqs.min_amount);
          break;

        default:
          // ZK proofs currently only supported for balance/staked rules
          logger.debug('ZK proofs not supported for rule type', {
            rule_type: rule.rule_type,
            rule_id: rule.id,
          });
          return false;
      }

      // Check for valid nullifier in database
      const nullifierResult = await query(
        `SELECT nullifier, threshold, verified_at, expires_at
         FROM zk_proof_nullifiers
         WHERE discord_id = $1
           AND starknet_address = $2
           AND threshold >= $3
           AND expires_at > NOW()
         ORDER BY verified_at DESC
         LIMIT 1`,
        [userId, walletAddress, requiredThreshold.toString()]
      );

      if (nullifierResult.rowCount === 0) {
        logger.debug('No valid ZK proof found', {
          user_id: userId,
          rule_id: rule.id,
          required_threshold: requiredThreshold.toString(),
        });
        return false;
      }

      const nullifier = nullifierResult.rows[0];

      logger.info('Valid ZK proof found', {
        user_id: userId,
        rule_id: rule.id,
        nullifier: nullifier.nullifier,
        threshold: nullifier.threshold,
        verified_at: nullifier.verified_at,
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to check ZK proof for rule', {
        user_id: userId,
        rule_id: rule.id,
        error: error.message,
      });
      return false;
    }
  }
}
