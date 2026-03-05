import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// GET /api/guilds/[id]/bot-config
// Get bot protection configuration for a guild
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

    // Check guild access
    const guildCheck = await query(
      `SELECT g.id, g.discord_guild_id, g.owner_discord_id, gm.is_admin
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

    // Fetch bot protection config
    const configResult = await query(
      `SELECT * FROM guild_bot_protection_config WHERE guild_id = $1`,
      [guild.discord_guild_id || guildId]
    )

    // If no config exists, return defaults
    if (configResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        config: {
          guild_id: guild.discord_guild_id || guildId,
          captcha_enabled: true,
          captcha_on_join: true,
          captcha_type: "number",
          captcha_difficulty: "medium",
          captcha_timeout_minutes: 10,
          max_captcha_attempts: 3,
          verified_role_name: "Verified",
          auto_create_verified_role: true,
          auto_assign_verified_role: true,
          waiting_room_enabled: false,
          prune_unverified_enabled: false,
          prune_timeout_hours: 24,
          prune_send_dm: true,
          rules_enabled: false,
          require_rules_acceptance: false,
        },
        exists: false,
      })
    }

    // Fetch guild rules
    const rulesResult = await query(
      `SELECT * FROM guild_rules WHERE guild_id = $1 ORDER BY rule_number`,
      [guild.discord_guild_id || guildId]
    )

    return NextResponse.json({
      success: true,
      config: configResult.rows[0],
      rules: rulesResult.rows,
      exists: true,
    })
  } catch (error) {
    console.error("Error fetching bot config:", error)
    return NextResponse.json(
      { error: "Failed to fetch bot configuration" },
      { status: 500 }
    )
  }
}

// ============================================================
// POST/PUT /api/guilds/[id]/bot-config
// Create or update bot protection configuration
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

    // Check guild access
    const guildCheck = await query(
      `SELECT g.id, g.discord_guild_id, g.owner_discord_id, gm.is_admin
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

    const discordGuildId = guild.discord_guild_id || guildId

    // Upsert configuration
    const configResult = await query(
      `INSERT INTO guild_bot_protection_config (
         guild_id,
         captcha_enabled,
         captcha_on_join,
         captcha_type,
         captcha_difficulty,
         captcha_timeout_minutes,
         max_captcha_attempts,
         verified_role_id,
         verified_role_name,
         auto_create_verified_role,
         auto_assign_verified_role,
         waiting_room_enabled,
         waiting_room_role_id,
         waiting_room_channel_id,
         prune_unverified_enabled,
         prune_timeout_hours,
         prune_send_dm,
         rules_enabled,
         rules_text,
         rules_channel_id,
         require_rules_acceptance,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW()
       )
       ON CONFLICT (guild_id) DO UPDATE SET
         captcha_enabled = EXCLUDED.captcha_enabled,
         captcha_on_join = EXCLUDED.captcha_on_join,
         captcha_type = EXCLUDED.captcha_type,
         captcha_difficulty = EXCLUDED.captcha_difficulty,
         captcha_timeout_minutes = EXCLUDED.captcha_timeout_minutes,
         max_captcha_attempts = EXCLUDED.max_captcha_attempts,
         verified_role_id = EXCLUDED.verified_role_id,
         verified_role_name = EXCLUDED.verified_role_name,
         auto_create_verified_role = EXCLUDED.auto_create_verified_role,
         auto_assign_verified_role = EXCLUDED.auto_assign_verified_role,
         waiting_room_enabled = EXCLUDED.waiting_room_enabled,
         waiting_room_role_id = EXCLUDED.waiting_room_role_id,
         waiting_room_channel_id = EXCLUDED.waiting_room_channel_id,
         prune_unverified_enabled = EXCLUDED.prune_unverified_enabled,
         prune_timeout_hours = EXCLUDED.prune_timeout_hours,
         prune_send_dm = EXCLUDED.prune_send_dm,
         rules_enabled = EXCLUDED.rules_enabled,
         rules_text = EXCLUDED.rules_text,
         rules_channel_id = EXCLUDED.rules_channel_id,
         require_rules_acceptance = EXCLUDED.require_rules_acceptance,
         updated_at = NOW()
       RETURNING *`,
      [
        discordGuildId,
        body.captcha_enabled ?? true,
        body.captcha_on_join ?? true,
        body.captcha_type || "number",
        body.captcha_difficulty || "medium",
        body.captcha_timeout_minutes || 10,
        body.max_captcha_attempts || 3,
        body.verified_role_id || null,
        body.verified_role_name || "Verified",
        body.auto_create_verified_role ?? true,
        body.auto_assign_verified_role ?? true,
        body.waiting_room_enabled ?? false,
        body.waiting_room_role_id || null,
        body.waiting_room_channel_id || null,
        body.prune_unverified_enabled ?? false,
        body.prune_timeout_hours || 24,
        body.prune_send_dm ?? true,
        body.rules_enabled ?? false,
        body.rules_text || null,
        body.rules_channel_id || null,
        body.require_rules_acceptance ?? false,
      ]
    )

    // Update guild rules if provided
    if (body.rules && Array.isArray(body.rules)) {
      // Delete existing rules
      await query(`DELETE FROM guild_rules WHERE guild_id = $1`, [discordGuildId])

      // Insert new rules
      for (const rule of body.rules) {
        if (rule.rule_text && rule.rule_text.trim()) {
          await query(
            `INSERT INTO guild_rules (guild_id, rule_number, rule_text, emoji, enabled)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              discordGuildId,
              rule.rule_number || 1,
              rule.rule_text,
              rule.emoji || null,
              rule.enabled ?? true,
            ]
          )
        }
      }
    }

    // Log analytics event
    await query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        guildId,
        "bot_config_updated",
        JSON.stringify({ updated_fields: Object.keys(body) }),
        session.user.discordId,
      ]
    ).catch((err) => console.error("Analytics logging failed:", err))

    return NextResponse.json({
      success: true,
      config: configResult.rows[0],
    })
  } catch (error) {
    console.error("Error updating bot config:", error)
    return NextResponse.json(
      { error: "Failed to update bot configuration" },
      { status: 500 }
    )
  }
}
