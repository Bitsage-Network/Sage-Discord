import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// GET /api/guilds/[id]/rule-groups
// List all rule groups for a guild with hierarchical structure
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const guildId = params.id

    // Check if user has access to this guild
    const accessCheck = await query(
      `SELECT 1 FROM guilds WHERE id = $1 AND owner_discord_id = $2
       UNION
       SELECT 1 FROM guild_members WHERE guild_id = $1 AND discord_user_id = $2 AND is_admin = TRUE`,
      [guildId, session.user.discordId]
    )

    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get all rule groups with their conditions and role assignments
    const groupsResult = await query(
      `SELECT
         rg.id,
         rg.parent_group_id,
         rg.logic_operator,
         rg.name,
         rg.description,
         rg.position,
         rg.created_at,
         rg.updated_at,
         (
           SELECT json_agg(
             json_build_object(
               'id', gc.id,
               'rule_id', gc.rule_id,
               'condition_type', gc.condition_type,
               'condition_data', gc.condition_data,
               'negate', gc.negate,
               'position', gc.position,
               'label', gc.label
             ) ORDER BY gc.position
           )
           FROM group_conditions gc
           WHERE gc.group_id = rg.id
         ) as conditions,
         (
           SELECT json_agg(
             json_build_object(
               'role_id', gra.role_id,
               'role_name', gra.role_name,
               'auto_assign', gra.auto_assign
             )
           )
           FROM group_role_assignments gra
           WHERE gra.group_id = rg.id
         ) as roles
       FROM rule_groups rg
       WHERE rg.guild_id = $1
       ORDER BY rg.position, rg.id`,
      [guildId]
    )

    // Build hierarchical structure
    const groups = groupsResult.rows
    const rootGroups = groups.filter((g) => !g.parent_group_id)

    const buildTree = (parentId: number | null): any[] => {
      return groups
        .filter((g) => g.parent_group_id === parentId)
        .map((group) => ({
          ...group,
          children: buildTree(group.id),
          conditions: group.conditions || [],
          roles: group.roles || [],
        }))
    }

    const tree = rootGroups.map((group) => ({
      ...group,
      children: buildTree(group.id),
      conditions: group.conditions || [],
      roles: group.roles || [],
    }))

    return NextResponse.json({
      success: true,
      groups: tree,
      total: groups.length,
    })
  } catch (error) {
    console.error("Error fetching rule groups:", error)
    return NextResponse.json(
      { error: "Failed to fetch rule groups" },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/guilds/[id]/rule-groups
// Create a new rule group
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const guildId = params.id

    // Check if user has access
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
    const {
      parent_group_id,
      logic_operator = "AND",
      name,
      description,
      position = 0,
      conditions = [],
      roles = [],
    } = body

    // Validate logic operator
    if (!["AND", "OR", "NOT"].includes(logic_operator)) {
      return NextResponse.json(
        { error: "Invalid logic operator" },
        { status: 400 }
      )
    }

    // Create rule group
    const groupResult = await query(
      `INSERT INTO rule_groups (guild_id, parent_group_id, logic_operator, name, description, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [guildId, parent_group_id || null, logic_operator, name, description, position]
    )

    const group = groupResult.rows[0]

    // Add conditions
    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i]
      await query(
        `INSERT INTO group_conditions (group_id, rule_id, condition_type, condition_data, negate, position, label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          group.id,
          cond.rule_id || null,
          cond.condition_type,
          JSON.stringify(cond.condition_data || {}),
          cond.negate || false,
          i,
          cond.label || null,
        ]
      )
    }

    // Add role assignments
    for (const role of roles) {
      await query(
        `INSERT INTO group_role_assignments (group_id, role_id, role_name, auto_assign)
         VALUES ($1, $2, $3, $4)`,
        [group.id, role.role_id, role.role_name, role.auto_assign !== false]
      )
    }

    // Log analytics
    await query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        guildId,
        "rule_group_created",
        JSON.stringify({
          group_id: group.id,
          logic_operator,
          conditions_count: conditions.length,
          roles_count: roles.length,
        }),
        session.user.discordId,
      ]
    ).catch((err) => console.error("Analytics logging failed:", err))

    return NextResponse.json({
      success: true,
      group: {
        ...group,
        conditions,
        roles,
      },
    })
  } catch (error) {
    console.error("Error creating rule group:", error)
    return NextResponse.json(
      { error: "Failed to create rule group" },
      { status: 500 }
    )
  }
}
