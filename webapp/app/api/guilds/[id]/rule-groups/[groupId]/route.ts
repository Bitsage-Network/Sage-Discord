import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// GET /api/guilds/[id]/rule-groups/[groupId]
// Get a specific rule group with all details
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

    // Get rule group
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

    // Get role assignments
    const rolesResult = await query(
      `SELECT * FROM group_role_assignments WHERE group_id = $1`,
      [groupId]
    )

    // Get child groups
    const childrenResult = await query(
      `SELECT * FROM rule_groups WHERE parent_group_id = $1 ORDER BY position`,
      [groupId]
    )

    return NextResponse.json({
      success: true,
      group: {
        ...group,
        conditions: conditionsResult.rows,
        roles: rolesResult.rows,
        children: childrenResult.rows,
      },
    })
  } catch (error) {
    console.error("Error fetching rule group:", error)
    return NextResponse.json(
      { error: "Failed to fetch rule group" },
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH /api/guilds/[id]/rule-groups/[groupId]
// Update a rule group
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

    const body = await request.json()
    const { logic_operator, name, description, position, conditions, roles } = body

    // Update rule group
    await query(
      `UPDATE rule_groups
       SET logic_operator = COALESCE($1, logic_operator),
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           position = COALESCE($4, position),
           updated_at = NOW()
       WHERE id = $5 AND guild_id = $6`,
      [logic_operator, name, description, position, groupId, guildId]
    )

    // Update conditions if provided
    if (conditions !== undefined) {
      // Delete existing conditions
      await query(`DELETE FROM group_conditions WHERE group_id = $1`, [groupId])

      // Add new conditions
      for (let i = 0; i < conditions.length; i++) {
        const cond = conditions[i]
        await query(
          `INSERT INTO group_conditions (group_id, rule_id, condition_type, condition_data, negate, position, label)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            groupId,
            cond.rule_id || null,
            cond.condition_type,
            JSON.stringify(cond.condition_data || {}),
            cond.negate || false,
            i,
            cond.label || null,
          ]
        )
      }
    }

    // Update roles if provided
    if (roles !== undefined) {
      // Delete existing role assignments
      await query(`DELETE FROM group_role_assignments WHERE group_id = $1`, [groupId])

      // Add new role assignments
      for (const role of roles) {
        await query(
          `INSERT INTO group_role_assignments (group_id, role_id, role_name, auto_assign)
           VALUES ($1, $2, $3, $4)`,
          [groupId, role.role_id, role.role_name, role.auto_assign !== false]
        )
      }
    }

    // Clear evaluation cache
    await query(`DELETE FROM rule_evaluation_cache WHERE group_id = $1`, [groupId])

    // Log analytics
    await query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        guildId,
        "rule_group_updated",
        JSON.stringify({ group_id: groupId }),
        session.user.discordId,
      ]
    ).catch((err) => console.error("Analytics logging failed:", err))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating rule group:", error)
    return NextResponse.json(
      { error: "Failed to update rule group" },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/guilds/[id]/rule-groups/[groupId]
// Delete a rule group (cascades to conditions and role assignments)
// ============================================================

export async function DELETE(
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

    // Delete rule group (cascades to conditions, roles, child groups)
    const result = await query(
      `DELETE FROM rule_groups WHERE id = $1 AND guild_id = $2 RETURNING id`,
      [groupId, guildId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Rule group not found" }, { status: 404 })
    }

    // Log analytics
    await query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        guildId,
        "rule_group_deleted",
        JSON.stringify({ group_id: groupId }),
        session.user.discordId,
      ]
    ).catch((err) => console.error("Analytics logging failed:", err))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting rule group:", error)
    return NextResponse.json(
      { error: "Failed to delete rule group" },
      { status: 500 }
    )
  }
}
