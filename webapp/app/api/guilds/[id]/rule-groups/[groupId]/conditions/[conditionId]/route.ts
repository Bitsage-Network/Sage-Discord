import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// PATCH /api/guilds/[id]/rule-groups/[groupId]/conditions/[conditionId]
// Update a single condition
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; groupId: string; conditionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const guildId = params.id
    const groupId = parseInt(params.groupId)
    const conditionId = parseInt(params.conditionId)

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

    // Verify the condition belongs to the specified group
    const conditionCheck = await query(
      `SELECT gc.id
       FROM group_conditions gc
       JOIN rule_groups rg ON gc.group_id = rg.id
       WHERE gc.id = $1 AND gc.group_id = $2 AND rg.guild_id = $3`,
      [conditionId, groupId, guildId]
    )

    if (conditionCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "Condition not found or does not belong to this group" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { condition_type, condition_data, negate, label } = body

    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []
    let paramCount = 1

    if (condition_type !== undefined) {
      updates.push(`condition_type = $${paramCount}`)
      values.push(condition_type)
      paramCount++
    }

    if (condition_data !== undefined) {
      updates.push(`condition_data = $${paramCount}`)
      values.push(JSON.stringify(condition_data))
      paramCount++
    }

    if (negate !== undefined) {
      updates.push(`negate = $${paramCount}`)
      values.push(negate)
      paramCount++
    }

    if (label !== undefined) {
      updates.push(`label = $${paramCount}`)
      values.push(label)
      paramCount++
    }

    // Always update the updated_at timestamp
    updates.push(`updated_at = NOW()`)

    if (updates.length === 1) {
      // Only the timestamp update, no actual changes
      return NextResponse.json({ success: true, message: "No changes provided" })
    }

    // Add condition ID to the values array
    values.push(conditionId)

    // Execute update
    await query(
      `UPDATE group_conditions
       SET ${updates.join(", ")}
       WHERE id = $${paramCount}`,
      values
    )

    // Clear evaluation cache for this group
    await query(`DELETE FROM rule_evaluation_cache WHERE group_id = $1`, [groupId])

    // Log analytics
    await query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        guildId,
        "condition_updated",
        JSON.stringify({ group_id: groupId, condition_id: conditionId }),
        session.user.discordId,
      ]
    ).catch((err) => console.error("Analytics logging failed:", err))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating condition:", error)
    return NextResponse.json(
      { error: "Failed to update condition" },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/guilds/[id]/rule-groups/[groupId]/conditions/[conditionId]
// Delete a single condition
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; groupId: string; conditionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const guildId = params.id
    const groupId = parseInt(params.groupId)
    const conditionId = parseInt(params.conditionId)

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

    // Verify the condition belongs to the specified group and delete it
    const result = await query(
      `DELETE FROM group_conditions gc
       USING rule_groups rg
       WHERE gc.id = $1
       AND gc.group_id = $2
       AND gc.group_id = rg.id
       AND rg.guild_id = $3
       RETURNING gc.id`,
      [conditionId, groupId, guildId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Condition not found or does not belong to this group" },
        { status: 404 }
      )
    }

    // Clear evaluation cache for this group
    await query(`DELETE FROM rule_evaluation_cache WHERE group_id = $1`, [groupId])

    // Log analytics
    await query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        guildId,
        "condition_deleted",
        JSON.stringify({ group_id: groupId, condition_id: conditionId }),
        session.user.discordId,
      ]
    ).catch((err) => console.error("Analytics logging failed:", err))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting condition:", error)
    return NextResponse.json(
      { error: "Failed to delete condition" },
      { status: 500 }
    )
  }
}
