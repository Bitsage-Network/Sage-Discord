import { query } from '../../utils/database';
import { RuleEvaluator } from './rule-evaluator';

interface RuleGroup {
  id: number;
  guild_id: string;
  parent_group_id: number | null;
  logic_operator: 'AND' | 'OR' | 'NOT';
  name: string;
  description: string;
  position: number;
}

interface GroupCondition {
  id: number;
  group_id: number;
  rule_id: number | null;
  condition_type: string;
  condition_data: any;
  negate: boolean;
  position: number;
  label: string | null;
}

interface GroupRole {
  id: number;
  group_id: number;
  role_id: string;
  role_name: string;
  auto_assign: boolean;
}

interface EvaluationResult {
  passes: boolean;
  details: any;
}

export class RuleGroupEvaluator {
  private ruleEvaluator: RuleEvaluator;

  constructor(ruleEvaluator: RuleEvaluator) {
    this.ruleEvaluator = ruleEvaluator;
  }

  /**
   * Evaluate a rule group for a specific user
   */
  async evaluateGroup(
    groupId: number,
    userId: string,
    walletAddress?: string
  ): Promise<EvaluationResult> {
    try {
      // Get the rule group
      const groupResult = await query(
        `SELECT * FROM rule_groups WHERE id = $1`,
        [groupId]
      );

      if (groupResult.rows.length === 0) {
        throw new Error(`Rule group ${groupId} not found`);
      }

      const group: RuleGroup = groupResult.rows[0];

      // Get all conditions for this group
      const conditionsResult = await query(
        `SELECT * FROM group_conditions WHERE group_id = $1 ORDER BY position`,
        [groupId]
      );

      const conditions: GroupCondition[] = conditionsResult.rows;

      // Evaluate each condition
      const conditionResults: EvaluationResult[] = [];

      for (const condition of conditions) {
        const result = await this.evaluateCondition(condition, userId, walletAddress);
        conditionResults.push(result);
      }

      // Apply logic operator
      const passes = this.applyLogicOperator(
        group.logic_operator,
        conditionResults
      );

      return {
        passes,
        details: {
          group_id: groupId,
          group_name: group.name,
          logic_operator: group.logic_operator,
          conditions: conditionResults.map((result, index) => ({
            condition_id: conditions[index].id,
            condition_type: conditions[index].condition_type,
            negate: conditions[index].negate,
            passes: result.passes,
            details: result.details,
          })),
        },
      };
    } catch (error) {
      const err = error as Error;
      console.error(`Error evaluating rule group ${groupId}:`, err);
      return {
        passes: false,
        details: { error: err.message },
      };
    }
  }

  /**
   * Evaluate a single condition
   */
  private async evaluateCondition(
    condition: GroupCondition,
    _userId: string,
    walletAddress?: string
  ): Promise<EvaluationResult> {
    try {
      let result: EvaluationResult;

      // For MVP: Only support referencing existing rules
      if (condition.rule_id && walletAddress) {
        // Fetch the rule first
        const ruleQuery = await query(
          `SELECT * FROM token_gating_rules WHERE id = $1`,
          [condition.rule_id]
        );

        if (ruleQuery.rows.length === 0) {
          result = {
            passes: false,
            details: { error: `Rule ${condition.rule_id} not found` },
          };
        } else {
          const rule = ruleQuery.rows[0];
          const ruleResult = await this.ruleEvaluator.evaluateRule(
            rule,
            walletAddress
          );

          result = {
            passes: ruleResult.passes_rule,
            details: ruleResult,
          };
        }
      } else {
        // Inline conditions not yet supported - fail gracefully
        result = {
          passes: false,
          details: {
            error: 'Inline conditions not yet supported. Please reference an existing token-gating rule.',
            condition_type: condition.condition_type,
          },
        };
      }

      // Apply negation if needed
      if (condition.negate) {
        result.passes = !result.passes;
        result.details = {
          ...result.details,
          negated: true,
        };
      }

      return result;
    } catch (error) {
      const err = error as Error;
      console.error(
        `Error evaluating condition ${condition.id}:`,
        err
      );
      return {
        passes: false,
        details: { error: err.message },
      };
    }
  }

  /**
   * Apply logic operator to condition results
   */
  private applyLogicOperator(
    operator: 'AND' | 'OR' | 'NOT',
    results: EvaluationResult[]
  ): boolean {
    switch (operator) {
      case 'AND':
        return results.every((r) => r.passes);

      case 'OR':
        return results.some((r) => r.passes);

      case 'NOT':
        return !results.some((r) => r.passes);

      default:
        console.error(`Unknown logic operator: ${operator}`);
        return false;
    }
  }

  /**
   * Get all roles assigned to a rule group
   */
  async getGroupRoles(groupId: number): Promise<GroupRole[]> {
    const result = await query(
      `SELECT * FROM group_role_assignments WHERE group_id = $1`,
      [groupId]
    );

    return result.rows;
  }

  /**
   * Get all rule groups for a guild
   */
  async getGuildRuleGroups(guildId: string): Promise<RuleGroup[]> {
    const result = await query(
      `SELECT * FROM rule_groups WHERE guild_id = $1 ORDER BY position`,
      [guildId]
    );

    return result.rows;
  }

  /**
   * Cache evaluation result
   */
  async cacheEvaluation(
    groupId: number,
    userId: string,
    passes: boolean,
    evaluationData: any,
    ttlMinutes: number = 5
  ): Promise<void> {
    await query(
      `INSERT INTO rule_evaluation_cache (group_id, user_id, passes, evaluation_data, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${ttlMinutes} minutes')
       ON CONFLICT (group_id, user_id)
       DO UPDATE SET
         passes = EXCLUDED.passes,
         evaluation_data = EXCLUDED.evaluation_data,
         evaluated_at = NOW(),
         expires_at = NOW() + INTERVAL '${ttlMinutes} minutes'`,
      [groupId, userId, passes, JSON.stringify(evaluationData)]
    );
  }

  /**
   * Get cached evaluation result
   */
  async getCachedEvaluation(
    groupId: number,
    userId: string
  ): Promise<EvaluationResult | null> {
    const result = await query(
      `SELECT passes, evaluation_data
       FROM rule_evaluation_cache
       WHERE group_id = $1 AND user_id = $2
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [groupId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      passes: result.rows[0].passes,
      details: result.rows[0].evaluation_data,
    };
  }

  /**
   * Clear cache for a rule group
   */
  async clearGroupCache(groupId: number): Promise<void> {
    await query(
      `DELETE FROM rule_evaluation_cache WHERE group_id = $1`,
      [groupId]
    );
  }

  /**
   * Evaluate all rule groups for a user and return qualifying roles
   */
  async evaluateAllGroupsForUser(
    guildId: string,
    userId: string,
    walletAddress?: string
  ): Promise<string[]> {
    const groups = await this.getGuildRuleGroups(guildId);
    const qualifyingRoles: string[] = [];

    for (const group of groups) {
      // Check cache first
      let result = await this.getCachedEvaluation(group.id, userId);

      // Evaluate if not cached
      if (!result) {
        result = await this.evaluateGroup(group.id, userId, walletAddress);
        await this.cacheEvaluation(
          group.id,
          userId,
          result.passes,
          result.details
        );
      }

      // If user qualifies, get roles
      if (result.passes) {
        const groupRoles = await this.getGroupRoles(group.id);
        groupRoles.forEach((role) => {
          if (role.auto_assign && !qualifyingRoles.includes(role.role_id)) {
            qualifyingRoles.push(role.role_id);
          }
        });
      }
    }

    return qualifyingRoles;
  }
}
