import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"
import { CreateTokenGatingRuleSchema, validateRequirements } from "@/lib/schemas"
import { z } from "zod"

// ============================================================
// GET /api/guilds/[id]/token-gating
// List all token-gating rules for a guild
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const guildId = params.id

    // Check if user has access to this guild
    const guildCheck = await query(
      `SELECT g.id, g.owner_discord_id, gm.is_admin
       FROM guilds g
       LEFT JOIN guild_members gm ON g.id = gm.guild_id AND gm.discord_user_id = $1
       WHERE g.id = $2`,
      [session.user.discordId, guildId]
    )

    if (guildCheck.rows.length === 0) {
      return NextResponse.json({ error: "Guild not found" }, { status: 404 })
    }

    const guild = guildCheck.rows[0]
    const isOwner = guild.owner_discord_id === session.user.discordId
    const isAdmin = guild.is_admin === true

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You don't have permission to manage this guild" },
        { status: 403 }
      )
    }

    // Fetch all rules with their role mappings
    const rulesResult = await query(
      `SELECT
         tgr.id,
         tgr.guild_id,
         tgr.rule_name,
         tgr.description,
         tgr.rule_type,
         tgr.requirements,
         tgr.privacy_enabled,
         tgr.require_zk_proof,
         tgr.allow_stealth_address,
         tgr.enabled,
         tgr.priority,
         tgr.created_by,
         tgr.created_at,
         tgr.updated_at,
         json_agg(
           json_build_object(
             'id', rm.id,
             'role_id', rm.role_id,
             'role_name', rm.role_name,
             'auto_assign', rm.auto_assign,
             'auto_remove', rm.auto_remove,
             'recheck_interval', rm.recheck_interval
           )
         ) FILTER (WHERE rm.id IS NOT NULL) as roles
       FROM token_gating_rules tgr
       LEFT JOIN role_mappings rm ON tgr.id = rm.rule_id
       WHERE tgr.guild_id = $1
       GROUP BY tgr.id
       ORDER BY tgr.priority DESC, tgr.created_at DESC`,
      [guildId]
    )

    const rules = rulesResult.rows.map(rule => ({
      ...rule,
      roles: rule.roles || [],
    }))

    return NextResponse.json({
      success: true,
      rules,
      count: rules.length,
    })
  } catch (error) {
    console.error("Error fetching token-gating rules:", error)
    return NextResponse.json(
      { error: "Failed to fetch token-gating rules" },
      { status: 500 }
    )
  }
}

// ============================================================
// POST /api/guilds/[id]/token-gating
// Create a new token-gating rule
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const guildId = params.id
    const body = await request.json()

    // Validate request body
    const validation = CreateTokenGatingRuleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Validate requirements based on rule type
    const requirementsValid = validateRequirements(data.rule_type, data.requirements)
    if (!requirementsValid) {
      return NextResponse.json(
        { error: `Invalid requirements for rule type: ${data.rule_type}` },
        { status: 400 }
      )
    }

    // Check if user has access to this guild
    const guildCheck = await query(
      `SELECT g.id, g.owner_discord_id, gm.is_admin
       FROM guilds g
       LEFT JOIN guild_members gm ON g.id = gm.guild_id AND gm.discord_user_id = $1
       WHERE g.id = $2`,
      [session.user.discordId, guildId]
    )

    if (guildCheck.rows.length === 0) {
      return NextResponse.json({ error: "Guild not found" }, { status: 404 })
    }

    const guild = guildCheck.rows[0]
    const isOwner = guild.owner_discord_id === session.user.discordId
    const isAdmin = guild.is_admin === true

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You don't have permission to manage this guild" },
        { status: 403 }
      )
    }

    // Begin transaction
    const client = await query("BEGIN")

    try {
      // Insert token-gating rule
      const ruleResult = await query(
        `INSERT INTO token_gating_rules (
           guild_id,
           rule_name,
           description,
           rule_type,
           requirements,
           privacy_enabled,
           require_zk_proof,
           allow_stealth_address,
           enabled,
           priority,
           created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          guildId,
          data.rule_name,
          data.description || null,
          data.rule_type,
          JSON.stringify(data.requirements),
          data.privacy_enabled,
          data.require_zk_proof,
          data.allow_stealth_address,
          data.enabled,
          data.priority,
          session.user.discordId,
        ]
      )

      const rule = ruleResult.rows[0]

      // Insert role mappings
      const roleMappings = []
      for (const role of data.roles) {
        const roleMappingResult = await query(
          `INSERT INTO role_mappings (
             guild_id,
             rule_id,
             role_id,
             role_name,
             auto_assign,
             auto_remove,
             recheck_interval
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [
            guildId,
            rule.id,
            role.role_id,
            role.role_name,
            role.auto_assign,
            role.auto_remove,
            3600, // Default 1 hour recheck interval
          ]
        )
        roleMappings.push(roleMappingResult.rows[0])
      }

      // Commit transaction
      await query("COMMIT")

      // Log analytics event
      await query(
        `INSERT INTO analytics_events (
           guild_id,
           event_type,
           event_data,
           user_id
         ) VALUES ($1, $2, $3, $4)`,
        [
          guildId,
          "token_gating_rule_created",
          JSON.stringify({
            rule_id: rule.id,
            rule_name: data.rule_name,
            rule_type: data.rule_type,
            roles: data.roles.map(r => r.role_name),
          }),
          session.user.discordId,
        ]
      ).catch(err => console.error("Analytics logging failed:", err))

      return NextResponse.json({
        success: true,
        rule: {
          ...rule,
          roles: roleMappings,
        },
      }, { status: 201 })
    } catch (error) {
      // Rollback transaction
      await query("ROLLBACK")
      throw error
    }
  } catch (error) {
    console.error("Error creating token-gating rule:", error)

    // Check for specific errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten() },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to create token-gating rule" },
      { status: 500 }
    )
  }
}
