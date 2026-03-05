import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { hash, ec } from "starknet"
import {
  verifyStarknetSignature,
  evaluateTokenBalanceRule,
  evaluateStakedAmountRule,
  computeMessageHash,
} from "@/lib/starknet"

// ============================================================
// POST /api/verify/complete
// Complete verification with wallet signature
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_token, wallet_address, signature } = body

    if (!session_token || !wallet_address || !signature) {
      return NextResponse.json(
        { error: "Missing required fields: session_token, wallet_address, signature" },
        { status: 400 }
      )
    }

    // Find verification session
    const sessionResult = await query(
      `SELECT * FROM verification_sessions
       WHERE session_token = $1 AND state = 'pending'`,
      [session_token]
    )

    if (sessionResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired verification session" },
        { status: 404 }
      )
    }

    const session = sessionResult.rows[0]

    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
      await query(
        `UPDATE verification_sessions SET state = 'expired' WHERE id = $1`,
        [session.id]
      )
      return NextResponse.json(
        { error: "Verification session expired" },
        { status: 400 }
      )
    }

    // Verify signature
    let isValid = false
    try {
      // Compute message hash
      const messageHash = computeMessageHash(session.challenge_message)

      // Verify signature using Starknet account abstraction
      isValid = await verifyStarknetSignature(
        wallet_address,
        messageHash,
        signature
      )

      console.log("Signature verification result:", {
        wallet: wallet_address,
        message_hash: messageHash,
        is_valid: isValid,
      })
    } catch (err) {
      console.error("Signature verification error:", err)
      isValid = false
    }

    if (!isValid) {
      await query(
        `UPDATE verification_sessions SET state = 'failed' WHERE id = $1`,
        [session.id]
      )
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      )
    }

    // Begin transaction
    await query("BEGIN")

    try {
      // Create or update wallet verification
      const verificationResult = await query(
        `INSERT INTO wallet_verifications (
           user_id,
           wallet_address,
           verification_method,
           signature,
           message,
           signed_at,
           verified,
           verified_at,
           expires_at
         ) VALUES ($1, $2, $3, $4, $5, NOW(), TRUE, NOW(), NOW() + INTERVAL '1 year')
         ON CONFLICT (user_id, wallet_address) DO UPDATE SET
           verified = TRUE,
           verified_at = NOW(),
           signature = EXCLUDED.signature,
           updated_at = NOW()
         RETURNING *`,
        [
          session.user_id,
          wallet_address,
          "signature",
          JSON.stringify(signature),
          session.challenge_message,
        ]
      )

      const verification = verificationResult.rows[0]

      // Update session state
      await query(
        `UPDATE verification_sessions
         SET state = 'verified',
             wallet_address = $1,
             signature = $2,
             completed_at = NOW()
         WHERE id = $3`,
        [wallet_address, JSON.stringify(signature), session.id]
      )

      // Find guild from session user
      const memberResult = await query(
        `SELECT gm.guild_id, g.discord_guild_id, g.name
         FROM guild_members gm
         JOIN guilds g ON gm.guild_id = g.id
         WHERE gm.discord_user_id = $1
         LIMIT 1`,
        [session.user_id]
      )

      if (memberResult.rows.length === 0) {
        throw new Error("Guild membership not found")
      }

      const guildInfo = memberResult.rows[0]

      // Fetch enabled token-gating rules
      const rulesResult = await query(
        `SELECT
           tgr.id,
           tgr.rule_name,
           tgr.rule_type,
           tgr.requirements,
           json_agg(
             json_build_object(
               'role_id', rm.role_id,
               'role_name', rm.role_name,
               'auto_assign', rm.auto_assign
             )
           ) FILTER (WHERE rm.id IS NOT NULL) as roles
         FROM token_gating_rules tgr
         LEFT JOIN role_mappings rm ON tgr.id = rm.rule_id
         WHERE tgr.guild_id = $1 AND tgr.enabled = TRUE
         GROUP BY tgr.id`,
        [guildInfo.guild_id]
      )

      // Evaluate rules and cache results
      const passedRules = []
      for (const rule of rulesResult.rows) {
        let passes = false
        let cached_balance = null
        let cached_stake = null

        // Evaluate rule based on type
        try {
          if (rule.rule_type === 'token_balance') {
            const result = await evaluateTokenBalanceRule(
              wallet_address,
              rule.requirements
            )
            passes = result.passes
            cached_balance = result.balance
            console.log(`Token balance rule evaluation:`, {
              rule_id: rule.id,
              passes,
              balance: result.balance,
            })
          } else if (rule.rule_type === 'staked_amount') {
            const result = await evaluateStakedAmountRule(
              wallet_address,
              rule.requirements
            )
            passes = result.passes
            cached_stake = result.stake
            console.log(`Staked amount rule evaluation:`, {
              rule_id: rule.id,
              passes,
              stake: result.stake,
            })
          } else {
            // Other rule types (reputation, validator, worker) not yet implemented
            console.log(`Rule type ${rule.rule_type} not yet implemented`)
          }
        } catch (error: any) {
          console.error(`Rule evaluation failed for rule ${rule.id}:`, error.message)
        }

        // Cache the result
        await query(
          `INSERT INTO user_rule_cache (
             user_id,
             rule_id,
             passes_rule,
             cached_balance,
             cached_stake,
             checked_at,
             expires_at
           ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW() + INTERVAL '1 hour')
           ON CONFLICT (user_id, rule_id) DO UPDATE SET
             passes_rule = EXCLUDED.passes_rule,
             cached_balance = EXCLUDED.cached_balance,
             cached_stake = EXCLUDED.cached_stake,
             checked_at = NOW(),
             expires_at = EXCLUDED.expires_at`,
          [session.user_id, rule.id, passes, cached_balance, cached_stake]
        )

        if (passes) {
          passedRules.push(rule)
        }
      }

      // Evaluate rule groups (Visual Requirement Builder)
      const ruleGroupsResult = await query(
        `SELECT
           rg.id,
           rg.name,
           rg.logic_operator,
           rg.description
         FROM rule_groups rg
         WHERE rg.guild_id = $1
         ORDER BY rg.position`,
        [guildInfo.guild_id]
      )

      const passedGroups = []
      for (const ruleGroup of ruleGroupsResult.rows) {
        // Get conditions for this group
        const conditionsResult = await query(
          `SELECT * FROM group_conditions WHERE group_id = $1 ORDER BY position`,
          [ruleGroup.id]
        )

        // Evaluate each condition
        const evaluationResults = []
        for (const condition of conditionsResult.rows) {
          const conditionData = condition.condition_data || {}

          // Evaluate the condition using blockchain/database
          const result = await evaluateCondition(
            wallet_address,
            condition.condition_type,
            conditionData,
            session.user_id
          )

          // Apply negation if needed
          let finalPasses = result.passes
          if (condition.negate) {
            finalPasses = !finalPasses
          }

          evaluationResults.push({
            condition_id: condition.id,
            condition_type: condition.condition_type,
            passes: finalPasses,
            actual_value: result.actual_value,
            expected_value: result.expected_value,
            reason: result.reason,
          })
        }

        // Apply logic operator to determine if group passes
        let groupPasses = false
        if (ruleGroup.logic_operator === "AND") {
          groupPasses = evaluationResults.every((r) => r.passes)
        } else if (ruleGroup.logic_operator === "OR") {
          groupPasses = evaluationResults.some((r) => r.passes)
        } else if (ruleGroup.logic_operator === "NOT") {
          groupPasses = !evaluationResults.some((r) => r.passes)
        }

        // Cache the result
        await query(
          `INSERT INTO rule_evaluation_cache (
             group_id,
             user_id,
             passes,
             evaluation_data,
             evaluated_at,
             expires_at
           ) VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '1 hour')
           ON CONFLICT (group_id, user_id) DO UPDATE SET
             passes = EXCLUDED.passes,
             evaluation_data = EXCLUDED.evaluation_data,
             evaluated_at = NOW(),
             expires_at = EXCLUDED.expires_at`,
          [
            ruleGroup.id,
            session.user_id,
            groupPasses,
            JSON.stringify({ results: evaluationResults }),
          ]
        )

        if (groupPasses) {
          // Get roles assigned to this group
          const rolesResult = await query(
            `SELECT role_id, role_name, auto_assign
             FROM group_role_assignments
             WHERE group_id = $1`,
            [ruleGroup.id]
          )

          passedGroups.push({
            ...ruleGroup,
            roles: rolesResult.rows,
          })
        }

        console.log(`Rule group evaluation:`, {
          group_id: ruleGroup.id,
          group_name: ruleGroup.name,
          passes: groupPasses,
          conditions_evaluated: evaluationResults.length,
        })
      }

      // Commit transaction
      await query("COMMIT")

      // Log analytics
      await query(
        `INSERT INTO analytics_events (
           guild_id,
           event_type,
           event_data,
           user_id
         ) VALUES ($1, $2, $3, $4)`,
        [
          guildInfo.guild_id,
          "wallet_verified",
          JSON.stringify({
            wallet_address,
            verification_method: "signature",
            rules_passed: passedRules.length,
            rule_groups_passed: passedGroups.length,
          }),
          session.user_id,
        ]
      ).catch(err => console.error("Analytics logging failed:", err))

      return NextResponse.json({
        success: true,
        verification: {
          verified: true,
          wallet_address: verification.wallet_address,
          verified_at: verification.verified_at,
        },
        rules_evaluated: rulesResult.rows.length,
        rules_passed: passedRules.length,
        passed_rules: passedRules,
        rule_groups_evaluated: ruleGroupsResult.rows.length,
        rule_groups_passed: passedGroups.length,
        passed_groups: passedGroups,
        message: "Wallet verified successfully! Role assignment will be processed by the Discord bot.",
      })
    } catch (error) {
      // Rollback transaction
      await query("ROLLBACK")
      throw error
    }
  } catch (error) {
    console.error("Error completing verification:", error)
    return NextResponse.json(
      { error: "Failed to complete verification" },
      { status: 500 }
    )
  }
}
