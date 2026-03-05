import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"
import { evaluateCondition } from "@/lib/starknet"

// ============================================================
// GET /api/guilds/[id]/rule-groups/[groupId]/preview
// Preview members who qualify for this rule group
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; groupId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const guildId = params.id
    const groupId = parseInt(params.groupId)

    // Check access
    const accessCheck = await query(
      `SELECT 1 FROM guilds WHERE id = $1 AND owner_discord_id = $2
       UNION
       SELECT 1 FROM guild_members WHERE guild_id = $1 AND discord_user_id = $2 AND is_admin = TRUE`,
      [guildId, session.user.discordId]
    )

    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    const filter = searchParams.get("filter") || "all" // all, passes, fails
    const includeDetails = searchParams.get("includeDetails") === "true"

    // Get rule group
    const groupResult = await query(
      `SELECT * FROM rule_groups WHERE id = $1 AND guild_id = $2`,
      [groupId, guildId]
    )

    if (groupResult.rows.length === 0) {
      return NextResponse.json({ error: "Rule group not found" }, { status: 404 })
    }

    const group = groupResult.rows[0]

    // Get conditions if details are requested
    let conditions: any[] = []
    if (includeDetails) {
      const conditionsResult = await query(
        `SELECT id, condition_type, condition_data, negate, label
         FROM group_conditions
         WHERE group_id = $1
         ORDER BY position`,
        [groupId]
      )
      conditions = conditionsResult.rows
    }

    // Get qualifying members from cache
    let whereClause = "rec.group_id = $1"
    const queryParams: any[] = [groupId]

    if (filter === "passes") {
      whereClause += " AND rec.passes = TRUE"
    } else if (filter === "fails") {
      whereClause += " AND rec.passes = FALSE"
    }

    const membersResult = await query(
      `SELECT
         rec.user_id,
         rec.passes,
         rec.evaluation_data,
         rec.evaluated_at,
         du.username
       FROM rule_evaluation_cache rec
       LEFT JOIN discord_users du ON rec.user_id = du.user_id
       WHERE ${whereClause}
         AND (rec.expires_at IS NULL OR rec.expires_at > NOW())
       ORDER BY rec.passes DESC, rec.evaluated_at DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    )

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM rule_evaluation_cache rec
       WHERE ${whereClause}
         AND (rec.expires_at IS NULL OR rec.expires_at > NOW())`,
      queryParams
    )

    const total = parseInt(countResult.rows[0]?.total || "0")

    // Count passing/failing
    const statsResult = await query(
      `SELECT
         SUM(CASE WHEN passes = TRUE THEN 1 ELSE 0 END) as passing,
         SUM(CASE WHEN passes = FALSE THEN 1 ELSE 0 END) as failing
       FROM rule_evaluation_cache
       WHERE group_id = $1
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [groupId]
    )

    const stats = statsResult.rows[0] || { passing: 0, failing: 0 }

    // Enrich member data with condition details if requested
    const enrichedMembers = includeDetails
      ? membersResult.rows.map((member) => {
          const evaluationData = member.evaluation_data || {}
          const results = evaluationData.results || []

          // Merge condition metadata with evaluation results
          const enrichedResults = results.map((result: any) => {
            const condition = conditions.find((c) => c.id === result.condition_id)
            return {
              ...result,
              condition_label: result.label || condition?.label || null,
              condition_data: condition?.condition_data || {},
            }
          })

          return {
            ...member,
            evaluation_data: {
              ...evaluationData,
              results: enrichedResults,
              logic_operator: group.logic_operator,
            },
          }
        })
      : membersResult.rows

    return NextResponse.json({
      success: true,
      members: enrichedMembers,
      conditions: includeDetails ? conditions : undefined,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats: {
        total,
        passing: parseInt(stats.passing || "0"),
        failing: parseInt(stats.failing || "0"),
      },
    })
  } catch (error) {
    console.error("Error fetching rule group preview:", error)
    return NextResponse.json(
      { error: "Failed to fetch preview" },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/guilds/[id]/rule-groups/[groupId]/preview
// Evaluate a specific user against this rule group (for testing)
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; groupId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const guildId = params.id
    const groupId = parseInt(params.groupId)

    // Check access
    const accessCheck = await query(
      `SELECT 1 FROM guilds WHERE id = $1 AND owner_discord_id = $2
       UNION
       SELECT 1 FROM guild_members WHERE guild_id = $1 AND discord_user_id = $2 AND is_admin = TRUE`,
      [guildId, session.user.discordId]
    )

    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { user_id } = body

    if (!user_id) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 })
    }

    // Get rule group with conditions
    const groupResult = await query(
      `SELECT * FROM rule_groups WHERE id = $1 AND guild_id = $2`,
      [groupId, guildId]
    )

    if (groupResult.rows.length === 0) {
      return NextResponse.json({ error: "Rule group not found" }, { status: 404 })
    }

    const group = groupResult.rows[0]

    // Get conditions
    const conditionsResult = await query(
      `SELECT * FROM group_conditions WHERE group_id = $1 ORDER BY position`,
      [groupId]
    )

    // Get user's wallet address
    const walletResult = await query(
      `SELECT wallet_address FROM wallet_verifications
       WHERE user_id = $1 AND verified = TRUE
       ORDER BY verified_at DESC LIMIT 1`,
      [user_id]
    )

    const walletAddress = walletResult.rows[0]?.wallet_address

    if (!walletAddress) {
      return NextResponse.json(
        { error: "User has not verified a wallet" },
        { status: 400 }
      )
    }

    // Evaluate each condition
    const evaluationResults = []
    let passes = false

    for (const condition of conditionsResult.rows) {
      const conditionData = condition.condition_data || {}

      // Evaluate the condition using blockchain/database
      const result = await evaluateCondition(
        walletAddress,
        condition.condition_type,
        conditionData,
        user_id
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
        negate: condition.negate,
        label: condition.label,
        actual_value: result.actual_value,
        expected_value: result.expected_value,
        reason: result.reason,
      })
    }

    // Apply logic operator
    if (group.logic_operator === "AND") {
      passes = evaluationResults.every((r) => r.passes)
    } else if (group.logic_operator === "OR") {
      passes = evaluationResults.some((r) => r.passes)
    } else if (group.logic_operator === "NOT") {
      passes = !evaluationResults.some((r) => r.passes)
    }

    // Cache result
    await query(
      `INSERT INTO rule_evaluation_cache (group_id, user_id, passes, evaluation_data, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '5 minutes')
       ON CONFLICT (group_id, user_id)
       DO UPDATE SET
         passes = EXCLUDED.passes,
         evaluation_data = EXCLUDED.evaluation_data,
         evaluated_at = NOW(),
         expires_at = NOW() + INTERVAL '5 minutes'`,
      [groupId, user_id, passes, JSON.stringify({ results: evaluationResults })]
    )

    return NextResponse.json({
      success: true,
      evaluation: {
        user_id,
        group_id: groupId,
        passes,
        logic_operator: group.logic_operator,
        conditions: evaluationResults,
      },
    })
  } catch (error) {
    console.error("Error evaluating rule group:", error)
    return NextResponse.json(
      { error: "Failed to evaluate rule group" },
      { status: 500 }
    )
  }
}
