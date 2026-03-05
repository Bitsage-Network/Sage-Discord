/**
 * BitSage Discord Token-Gating - Rule Evaluator Service
 *
 * Evaluates token-gating rules against user wallet holdings.
 * Supports 5 rule types:
 * - token_balance: Hold minimum tokens
 * - staked_amount: Stake minimum amount
 * - reputation: Minimum reputation score
 * - validator: Is active validator
 * - worker: Is active worker
 */

import { StarknetService } from './starknet-service';
import { TokenService } from './token-service';
import { logger } from '../../utils/logger';
import { query } from '../../utils/database';
import ERC20_ABI from '../abis/erc20.json';

export interface TokenGatingRule {
  id: number;
  rule_name: string;
  rule_type: string;
  requirements: any;
  enabled: boolean;
}

export interface RuleEvaluationResult {
  rule_id: number;
  passes_rule: boolean;
  cached_balance?: string;
  cached_stake?: string;
  cached_reputation?: number;
  reason?: string;
}

export class RuleEvaluator {
  private starknet: StarknetService;
  private tokenService: TokenService;

  constructor(starknet: StarknetService, tokenService: TokenService) {
    this.starknet = starknet;
    this.tokenService = tokenService;
  }

  /**
   * Evaluate a single rule for a wallet address
   */
  async evaluateRule(
    rule: TokenGatingRule,
    walletAddress: string
  ): Promise<RuleEvaluationResult> {
    try {
      logger.info('Evaluating token-gating rule', {
        rule_id: rule.id,
        rule_type: rule.rule_type,
        wallet: walletAddress,
      });

      switch (rule.rule_type) {
        case 'token_balance':
          return await this.evaluateTokenBalance(rule, walletAddress);

        case 'staked_amount':
          return await this.evaluateStakedAmount(rule, walletAddress);

        case 'reputation':
          return await this.evaluateReputation(rule, walletAddress);

        case 'validator':
          return await this.evaluateValidator(rule, walletAddress);

        case 'worker':
          return await this.evaluateWorker(rule, walletAddress);

        default:
          logger.warn('Unknown rule type', { rule_type: rule.rule_type });
          return {
            rule_id: rule.id,
            passes_rule: false,
            reason: `Unknown rule type: ${rule.rule_type}`,
          };
      }
    } catch (error: any) {
      logger.error('Failed to evaluate rule', {
        rule_id: rule.id,
        wallet: walletAddress,
        error: error.message,
      });

      return {
        rule_id: rule.id,
        passes_rule: false,
        reason: `Evaluation failed: ${error.message}`,
      };
    }
  }

  /**
   * Evaluate all rules for a user
   */
  async evaluateAllRules(
    userId: string,
    walletAddress: string,
    guildId: number
  ): Promise<RuleEvaluationResult[]> {
    try {
      // Fetch all enabled rules for this guild
      const rulesResult = await query(
        `SELECT id, rule_name, rule_type, requirements, enabled
         FROM token_gating_rules
         WHERE guild_id = $1 AND enabled = TRUE`,
        [guildId]
      );

      const rules: TokenGatingRule[] = rulesResult.rows;

      logger.info('Evaluating all rules', {
        user_id: userId,
        wallet: walletAddress,
        guild_id: guildId,
        rule_count: rules.length,
      });

      // Evaluate all rules in parallel
      const results = await Promise.all(
        rules.map((rule) => this.evaluateRule(rule, walletAddress))
      );

      // Cache results in database
      await this.cacheResults(userId, results);

      return results;
    } catch (error: any) {
      logger.error('Failed to evaluate all rules', {
        user_id: userId,
        wallet: walletAddress,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get roles a user should have based on cached rule results
   */
  async getAssignableRoles(userId: string, guildId: number): Promise<any[]> {
    try {
      // Query user_rule_cache and role_mappings
      const result = await query(
        `SELECT
           rm.role_id,
           rm.role_name,
           rm.auto_assign,
           tgr.rule_name,
           tgr.rule_type
         FROM user_rule_cache urc
         JOIN token_gating_rules tgr ON urc.rule_id = tgr.id
         JOIN role_mappings rm ON tgr.id = rm.rule_id
         WHERE urc.user_id = $1
           AND tgr.guild_id = $2
           AND urc.passes_rule = TRUE
           AND rm.auto_assign = TRUE
           AND tgr.enabled = TRUE`,
        [userId, guildId]
      );

      return result.rows;
    } catch (error: any) {
      logger.error('Failed to get assignable roles', {
        user_id: userId,
        guild_id: guildId,
        error: error.message,
      });
      return [];
    }
  }

  // ============================================================
  // Rule Type Evaluators
  // ============================================================

  /**
   * Evaluate token_balance rule
   */
  private async evaluateTokenBalance(
    rule: TokenGatingRule,
    walletAddress: string
  ): Promise<RuleEvaluationResult> {
    const { min_balance, token_address, include_staked } = rule.requirements;

    try {
      let balance: bigint;

      if (token_address) {
        // Custom token address
        const result = await this.starknet.callContract(
          token_address,
          ERC20_ABI,
          'balanceOf',
          [walletAddress]
        );
        balance = this.parseU256(result.result);
      } else {
        // Default SAGE token
        if (include_staked) {
          balance = await this.tokenService.getTotalBalance(
            walletAddress,
            true
          );
        } else {
          balance = await this.tokenService.getBalance(walletAddress);
        }
      }

      const minBalance = BigInt(min_balance);
      const passes = balance >= minBalance;

      logger.info('Token balance evaluation', {
        rule_id: rule.id,
        wallet: walletAddress,
        balance: balance.toString(),
        min_balance: minBalance.toString(),
        passes,
      });

      return {
        rule_id: rule.id,
        passes_rule: passes,
        cached_balance: balance.toString(),
        reason: passes
          ? 'Balance requirement met'
          : `Insufficient balance: ${balance.toString()} < ${minBalance.toString()}`,
      };
    } catch (error: any) {
      logger.error('Token balance evaluation failed', {
        rule_id: rule.id,
        wallet: walletAddress,
        error: error.message,
      });

      return {
        rule_id: rule.id,
        passes_rule: false,
        cached_balance: '0',
        reason: `Failed to check balance: ${error.message}`,
      };
    }
  }

  /**
   * Evaluate staked_amount rule
   */
  private async evaluateStakedAmount(
    rule: TokenGatingRule,
    walletAddress: string
  ): Promise<RuleEvaluationResult> {
    const { min_stake } = rule.requirements;

    try {
      const stakedAmount = await this.tokenService.getStakedAmount(
        walletAddress
      );
      const minStake = BigInt(min_stake);
      const passes = stakedAmount >= minStake;

      logger.info('Staked amount evaluation', {
        rule_id: rule.id,
        wallet: walletAddress,
        staked: stakedAmount.toString(),
        min_stake: minStake.toString(),
        passes,
      });

      return {
        rule_id: rule.id,
        passes_rule: passes,
        cached_stake: stakedAmount.toString(),
        reason: passes
          ? 'Stake requirement met'
          : `Insufficient stake: ${stakedAmount.toString()} < ${minStake.toString()}`,
      };
    } catch (error: any) {
      logger.error('Staked amount evaluation failed', {
        rule_id: rule.id,
        wallet: walletAddress,
        error: error.message,
      });

      return {
        rule_id: rule.id,
        passes_rule: false,
        cached_stake: '0',
        reason: `Failed to check stake: ${error.message}`,
      };
    }
  }

  /**
   * Evaluate reputation rule
   */
  private async evaluateReputation(
    rule: TokenGatingRule,
    walletAddress: string
  ): Promise<RuleEvaluationResult> {
    const { min_reputation, reputation_contract } = rule.requirements;

    try {
      // Query reputation contract
      const result = await this.starknet.callContract(
        reputation_contract,
        [], // TODO: Add reputation contract ABI
        'get_reputation',
        [walletAddress]
      );

      const reputation = parseInt(result.result[0] || '0');
      const minReputation = parseInt(min_reputation);
      const passes = reputation >= minReputation;

      logger.info('Reputation evaluation', {
        rule_id: rule.id,
        wallet: walletAddress,
        reputation,
        min_reputation: minReputation,
        passes,
      });

      return {
        rule_id: rule.id,
        passes_rule: passes,
        cached_reputation: reputation,
        reason: passes
          ? 'Reputation requirement met'
          : `Insufficient reputation: ${reputation} < ${minReputation}`,
      };
    } catch (error: any) {
      logger.error('Reputation evaluation failed', {
        rule_id: rule.id,
        wallet: walletAddress,
        error: error.message,
      });

      return {
        rule_id: rule.id,
        passes_rule: false,
        cached_reputation: 0,
        reason: `Failed to check reputation: ${error.message}`,
      };
    }
  }

  /**
   * Evaluate validator rule
   */
  private async evaluateValidator(
    rule: TokenGatingRule,
    walletAddress: string
  ): Promise<RuleEvaluationResult> {
    const { validator_contract, min_delegation } = rule.requirements;

    try {
      // Query validator contract to check if active
      const result = await this.starknet.callContract(
        validator_contract,
        [], // TODO: Add validator contract ABI
        'is_validator',
        [walletAddress]
      );

      const isValidator = parseInt(result.result[0] || '0') === 1;

      // If min_delegation specified, check delegation amount
      let passes = isValidator;
      if (isValidator && min_delegation) {
        const delegationResult = await this.starknet.callContract(
          validator_contract,
          [],
          'get_delegation',
          [walletAddress]
        );

        const delegation = this.parseU256(delegationResult.result);
        const minDelegation = BigInt(min_delegation);
        passes = delegation >= minDelegation;
      }

      logger.info('Validator evaluation', {
        rule_id: rule.id,
        wallet: walletAddress,
        is_validator: isValidator,
        passes,
      });

      return {
        rule_id: rule.id,
        passes_rule: passes,
        reason: passes
          ? 'Validator requirement met'
          : 'Not an active validator or insufficient delegation',
      };
    } catch (error: any) {
      logger.error('Validator evaluation failed', {
        rule_id: rule.id,
        wallet: walletAddress,
        error: error.message,
      });

      return {
        rule_id: rule.id,
        passes_rule: false,
        reason: `Failed to check validator status: ${error.message}`,
      };
    }
  }

  /**
   * Evaluate worker rule
   */
  private async evaluateWorker(
    rule: TokenGatingRule,
    walletAddress: string
  ): Promise<RuleEvaluationResult> {
    const { worker_contract, min_tasks } = rule.requirements;

    try {
      // Query worker contract to check if active
      const result = await this.starknet.callContract(
        worker_contract,
        [], // TODO: Add worker contract ABI
        'is_worker',
        [walletAddress]
      );

      const isWorker = parseInt(result.result[0] || '0') === 1;

      // If min_tasks specified, check task count
      let passes = isWorker;
      if (isWorker && min_tasks) {
        const tasksResult = await this.starknet.callContract(
          worker_contract,
          [],
          'get_completed_tasks',
          [walletAddress]
        );

        const completedTasks = parseInt(tasksResult.result[0] || '0');
        const minTasks = parseInt(min_tasks);
        passes = completedTasks >= minTasks;
      }

      logger.info('Worker evaluation', {
        rule_id: rule.id,
        wallet: walletAddress,
        is_worker: isWorker,
        passes,
      });

      return {
        rule_id: rule.id,
        passes_rule: passes,
        reason: passes
          ? 'Worker requirement met'
          : 'Not an active worker or insufficient tasks',
      };
    } catch (error: any) {
      logger.error('Worker evaluation failed', {
        rule_id: rule.id,
        wallet: walletAddress,
        error: error.message,
      });

      return {
        rule_id: rule.id,
        passes_rule: false,
        reason: `Failed to check worker status: ${error.message}`,
      };
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * Cache rule evaluation results
   */
  private async cacheResults(
    userId: string,
    results: RuleEvaluationResult[]
  ): Promise<void> {
    try {
      for (const result of results) {
        await query(
          `INSERT INTO user_rule_cache (
             user_id,
             rule_id,
             passes_rule,
             cached_balance,
             cached_stake,
             cached_reputation,
             checked_at,
             expires_at
           ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '1 hour')
           ON CONFLICT (user_id, rule_id) DO UPDATE SET
             passes_rule = EXCLUDED.passes_rule,
             cached_balance = EXCLUDED.cached_balance,
             cached_stake = EXCLUDED.cached_stake,
             cached_reputation = EXCLUDED.cached_reputation,
             checked_at = NOW(),
             expires_at = EXCLUDED.expires_at`,
          [
            userId,
            result.rule_id,
            result.passes_rule,
            result.cached_balance || null,
            result.cached_stake || null,
            result.cached_reputation || null,
          ]
        );
      }

      logger.info('Rule results cached', {
        user_id: userId,
        results_count: results.length,
      });
    } catch (error: any) {
      logger.error('Failed to cache rule results', {
        user_id: userId,
        error: error.message,
      });
    }
  }

  /**
   * Parse u256 from Starknet result (low, high format)
   */
  private parseU256(result: string[]): bigint {
    if (result.length < 2) {
      return BigInt(result[0] || '0');
    }

    const low = BigInt(result[0] || '0');
    const high = BigInt(result[1] || '0');

    return (high << 128n) + low;
  }
}
