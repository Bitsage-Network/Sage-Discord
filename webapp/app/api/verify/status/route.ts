import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"

// ============================================================
// GET /api/verify/status?discord_id=123&guild_slug=bitsage
// Check verification status for a user
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const discordId = searchParams.get("discord_id")
    const guildSlug = searchParams.get("guild_slug")

    if (!discordId) {
      return NextResponse.json(
        { error: "Missing required parameter: discord_id" },
        { status: 400 }
      )
    }

    // Get guild info if slug provided
    let guildId = null
    if (guildSlug) {
      const guildResult = await query(
        `SELECT id FROM guilds WHERE slug = $1`,
        [guildSlug]
      )
      if (guildResult.rows.length > 0) {
        guildId = guildResult.rows[0].id
      }
    }

    // Check existing verification
    const verificationResult = await query(
      `SELECT
         wv.*,
         du.username,
         du.avatar
       FROM wallet_verifications wv
       LEFT JOIN discord_users du ON wv.user_id = du.user_id
       WHERE wv.user_id = $1 AND wv.verified = TRUE
       ORDER BY wv.verified_at DESC
       LIMIT 1`,
      [discordId]
    )

    if (verificationResult.rows.length === 0) {
      // Check if there's a pending session
      const sessionResult = await query(
        `SELECT * FROM verification_sessions
         WHERE user_id = $1 AND state = 'pending' AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [discordId]
      )

      if (sessionResult.rows.length > 0) {
        return NextResponse.json({
          verified: false,
          status: "pending",
          session: {
            expires_at: sessionResult.rows[0].expires_at,
          },
        })
      }

      return NextResponse.json({
        verified: false,
        status: "not_verified",
        message: "No wallet verification found",
      })
    }

    const verification = verificationResult.rows[0]

    // If guild specified, get token-gated roles for this user
    let assignedRoles = []
    let eligibleRoles = []

    if (guildId) {
      // Get rules the user passes
      const cacheResult = await query(
        `SELECT
           urc.*,
           tgr.rule_name,
           tgr.rule_type,
           json_agg(
             json_build_object(
               'role_id', rm.role_id,
               'role_name', rm.role_name
             )
           ) FILTER (WHERE rm.id IS NOT NULL) as roles
         FROM user_rule_cache urc
         JOIN token_gating_rules tgr ON urc.rule_id = tgr.id
         LEFT JOIN role_mappings rm ON tgr.id = rm.rule_id
         WHERE urc.user_id = $1 AND tgr.guild_id = $2 AND urc.passes_rule = TRUE
         GROUP BY urc.user_id, urc.rule_id, urc.passes_rule, urc.cached_balance,
                  urc.cached_stake, urc.cached_reputation, urc.checked_at, urc.expires_at,
                  tgr.rule_name, tgr.rule_type`,
        [discordId, guildId]
      )

      assignedRoles = cacheResult.rows.flatMap(rule => rule.roles || [])

      // Get all enabled rules to show what they're eligible for
      const allRulesResult = await query(
        `SELECT
           tgr.id,
           tgr.rule_name,
           tgr.rule_type,
           tgr.requirements,
           json_agg(
             json_build_object(
               'role_id', rm.role_id,
               'role_name', rm.role_name
             )
           ) FILTER (WHERE rm.id IS NOT NULL) as roles
         FROM token_gating_rules tgr
         LEFT JOIN role_mappings rm ON tgr.id = rm.rule_id
         WHERE tgr.guild_id = $1 AND tgr.enabled = TRUE
         GROUP BY tgr.id`,
        [guildId]
      )

      eligibleRoles = allRulesResult.rows
    }

    return NextResponse.json({
      verified: true,
      status: "verified",
      verification: {
        wallet_address: verification.wallet_address,
        verification_method: verification.verification_method,
        verified_at: verification.verified_at,
      },
      user: {
        username: verification.username,
        avatar: verification.avatar,
      },
      assigned_roles: assignedRoles,
      eligible_roles: eligibleRoles,
    })
  } catch (error) {
    console.error("Error checking verification status:", error)
    return NextResponse.json(
      { error: "Failed to check verification status" },
      { status: 500 }
    )
  }
}
