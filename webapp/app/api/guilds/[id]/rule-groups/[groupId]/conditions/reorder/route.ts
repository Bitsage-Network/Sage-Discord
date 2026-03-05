import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// PATCH /api/guilds/[id]/rule-groups/[groupId]/conditions/reorder
// Reorder conditions by updating their positions
// ============================================================

export async function PATCH(
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

    // Verify the group exists and belongs to this guild
    const groupCheck = await query(
      `SELECT id FROM rule_groups WHERE id = $1 AND guild_id = $2`,
      [groupId, guildId]
    )

    if (groupCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Rule group not found" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { conditionIds } = body

    if (!Array.isArray(conditionIds) || conditionIds.length === 0) {
      return NextResponse.json(
        { error: "conditionIds must be a non-empty array" },
        { status: 400 }
      )
    }

    // Verify all conditions belong to this group
    const conditionCheck = await query(
      `SELECT id FROM group_conditions
       WHERE group_id = $1 AND id = ANY($2::int[])`,
      [groupId, conditionIds]
    )

    if (conditionCheck.rows.length !== conditionIds.length) {
      return NextResponse.json(
        { error: "One or more conditions do not belong to this group" },
        { status: 400 }
      )
    }

    // Update positions for all conditions in a transaction
    // Using a CASE statement to update all positions in one query
    const caseStatements = conditionIds
      .map((id, index) => `WHEN ${parseInt(id)} THEN ${index}`)
      .join(" ")

    await query(
      `UPDATE group_conditions
       SET position = CASE id ${caseStatements} END,
           updated_at = NOW()
       WHERE id = ANY($1::int[])`,
      [conditionIds]
    )

    // Clear evaluation cache for this group
    await query(`DELETE FROM rule_evaluation_cache WHERE group_id = $1`, [groupId])

    // Log analytics
    await query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        guildId,
        "conditions_reordered",
        JSON.stringify({ group_id: groupId, condition_count: conditionIds.length }),
        session.user.discordId,
      ]
    ).catch((err) => console.error("Analytics logging failed:", err))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error reordering conditions:", error)
    return NextResponse.json(
      { error: "Failed to reorder conditions" },
      { status: 500 }
    )
  }
}
