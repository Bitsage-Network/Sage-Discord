import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"
import { UpdateTokenGatingRuleSchema, validateRequirements } from "@/lib/schemas"

// ============================================================
// GET /api/guilds/[id]/token-gating/[ruleId]
// Get a single token-gating rule
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: guildId, ruleId } = params

    // Check guild access
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
        { error: "You don't have permission to view this guild" },
        { status: 403 }
      )
    }

    // Fetch rule with role mappings
    const ruleResult = await query(
      `SELECT
         tgr.*,
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
       WHERE tgr.id = $1 AND tgr.guild_id = $2
       GROUP BY tgr.id`,
      [ruleId, guildId]
    )

    if (ruleResult.rows.length === 0) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    const rule = ruleResult.rows[0]

    return NextResponse.json({
      success: true,
      rule: {
        ...rule,
        roles: rule.roles || [],
      },
    })
  } catch (error) {
    console.error("Error fetching token-gating rule:", error)
    return NextResponse.json(
      { error: "Failed to fetch token-gating rule" },
      { status: 500 }
    )
  }
}

// ============================================================
// PATCH /api/guilds/[id]/token-gating/[ruleId]
// Update a token-gating rule
// ============================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: guildId, ruleId } = params
    const body = await request.json()

    // Validate request body
    const validation = UpdateTokenGatingRuleSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Check guild access
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

    // Check if rule exists and belongs to this guild
    const ruleCheck = await query(
      `SELECT * FROM token_gating_rules WHERE id = $1 AND guild_id = $2`,
      [ruleId, guildId]
    )

    if (ruleCheck.rows.length === 0) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    const existingRule = ruleCheck.rows[0]

    // Validate requirements if provided
    if (data.requirements) {
      const requirementsValid = validateRequirements(
        existingRule.rule_type,
        data.requirements
      )
      if (!requirementsValid) {
        return NextResponse.json(
          { error: `Invalid requirements for rule type: ${existingRule.rule_type}` },
          { status: 400 }
        )
      }
    }

    // Begin transaction
    await query("BEGIN")

    try {
      // Build update query dynamically
      const updateFields: string[] = []
      const updateValues: any[] = []
      let paramIndex = 1

      if (data.rule_name !== undefined) {
        updateFields.push(`rule_name = $${paramIndex++}`)
        updateValues.push(data.rule_name)
      }

      if (data.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`)
        updateValues.push(data.description)
      }

      if (data.requirements !== undefined) {
        updateFields.push(`requirements = $${paramIndex++}`)
        updateValues.push(JSON.stringify(data.requirements))
      }

      if (data.privacy_enabled !== undefined) {
        updateFields.push(`privacy_enabled = $${paramIndex++}`)
        updateValues.push(data.privacy_enabled)
      }

      if (data.require_zk_proof !== undefined) {
        updateFields.push(`require_zk_proof = $${paramIndex++}`)
        updateValues.push(data.require_zk_proof)
      }

      if (data.allow_stealth_address !== undefined) {
        updateFields.push(`allow_stealth_address = $${paramIndex++}`)
        updateValues.push(data.allow_stealth_address)
      }

      if (data.enabled !== undefined) {
        updateFields.push(`enabled = $${paramIndex++}`)
        updateValues.push(data.enabled)
      }

      if (data.priority !== undefined) {
        updateFields.push(`priority = $${paramIndex++}`)
        updateValues.push(data.priority)
      }

      // Always update updated_at
      updateFields.push(`updated_at = NOW()`)

      // Add ruleId and guildId as final parameters
      updateValues.push(ruleId, guildId)

      // Update rule
      const updateQuery = `
        UPDATE token_gating_rules
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex++} AND guild_id = $${paramIndex++}
        RETURNING *
      `

      const ruleResult = await query(updateQuery, updateValues)
      const updatedRule = ruleResult.rows[0]

      // Update role mappings if provided
      if (data.roles !== undefined) {
        // Delete existing role mappings
        await query(
          `DELETE FROM role_mappings WHERE rule_id = $1`,
          [ruleId]
        )

        // Insert new role mappings
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
              ruleId,
              role.role_id,
              role.role_name,
              role.auto_assign,
              role.auto_remove,
              3600,
            ]
          )
          roleMappings.push(roleMappingResult.rows[0])
        }

        updatedRule.roles = roleMappings
      } else {
        // Fetch existing role mappings
        const rolesResult = await query(
          `SELECT * FROM role_mappings WHERE rule_id = $1`,
          [ruleId]
        )
        updatedRule.roles = rolesResult.rows
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
          "token_gating_rule_updated",
          JSON.stringify({
            rule_id: ruleId,
            rule_name: updatedRule.rule_name,
            updated_fields: Object.keys(data),
          }),
          session.user.discordId,
        ]
      ).catch(err => console.error("Analytics logging failed:", err))

      return NextResponse.json({
        success: true,
        rule: updatedRule,
      })
    } catch (error) {
      // Rollback transaction
      await query("ROLLBACK")
      throw error
    }
  } catch (error) {
    console.error("Error updating token-gating rule:", error)
    return NextResponse.json(
      { error: "Failed to update token-gating rule" },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/guilds/[id]/token-gating/[ruleId]
// Delete a token-gating rule
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; ruleId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: guildId, ruleId } = params

    // Check guild access
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

    // Check if rule exists
    const ruleCheck = await query(
      `SELECT * FROM token_gating_rules WHERE id = $1 AND guild_id = $2`,
      [ruleId, guildId]
    )

    if (ruleCheck.rows.length === 0) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    const rule = ruleCheck.rows[0]

    // Delete rule (role_mappings will be deleted via CASCADE)
    await query(
      `DELETE FROM token_gating_rules WHERE id = $1 AND guild_id = $2`,
      [ruleId, guildId]
    )

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
        "token_gating_rule_deleted",
        JSON.stringify({
          rule_id: ruleId,
          rule_name: rule.rule_name,
          rule_type: rule.rule_type,
        }),
        session.user.discordId,
      ]
    ).catch(err => console.error("Analytics logging failed:", err))

    return NextResponse.json({
      success: true,
      message: "Token-gating rule deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting token-gating rule:", error)
    return NextResponse.json(
      { error: "Failed to delete token-gating rule" },
      { status: 500 }
    )
  }
}
