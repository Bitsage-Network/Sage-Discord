import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { randomBytes } from "crypto"

// ============================================================
// POST /api/verify/start
// Start verification process - create session and challenge
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { guild_slug, discord_id } = body

    if (!guild_slug || !discord_id) {
      return NextResponse.json(
        { error: "Missing required fields: guild_slug, discord_id" },
        { status: 400 }
      )
    }

    // Find guild by slug
    const guildResult = await query(
      `SELECT id, discord_guild_id, name, slug FROM guilds WHERE slug = $1`,
      [guild_slug]
    )

    if (guildResult.rows.length === 0) {
      return NextResponse.json({ error: "Guild not found" }, { status: 404 })
    }

    const guild = guildResult.rows[0]

    // Check if user is a member of this guild
    const memberResult = await query(
      `SELECT * FROM guild_members WHERE guild_id = $1 AND discord_id = $2`,
      [guild.id, discord_id]
    )

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { error: "You must be a member of this Discord server to verify" },
        { status: 403 }
      )
    }

    // Check if user already has an active verification
    const existingVerification = await query(
      `SELECT * FROM wallet_verifications
       WHERE user_id = $1 AND verified = TRUE
       ORDER BY verified_at DESC LIMIT 1`,
      [discord_id]
    )

    if (existingVerification.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: "You already have a verified wallet",
        existing_verification: {
          wallet_address: existingVerification.rows[0].wallet_address,
          verified_at: existingVerification.rows[0].verified_at,
        },
      })
    }

    // Generate verification challenge
    const nonce = randomBytes(32).toString("hex")
    const sessionToken = randomBytes(32).toString("hex")
    const challengeMessage = `Sign this message to verify your Starknet wallet ownership for ${guild.name}.\n\nNonce: ${nonce}\nTimestamp: ${Date.now()}`

    // Create verification session
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

    const sessionResult = await query(
      `INSERT INTO verification_sessions (
         user_id,
         state,
         verification_method,
         challenge_message,
         challenge_nonce,
         session_token,
         expires_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, session_token, challenge_message, expires_at`,
      [discord_id, "pending", "signature", challengeMessage, nonce, sessionToken, expiresAt]
    )

    const session = sessionResult.rows[0]

    // Fetch token-gating rules for this guild to show requirements
    const rulesResult = await query(
      `SELECT
         tgr.id,
         tgr.rule_name,
         tgr.description,
         tgr.rule_type,
         tgr.requirements,
         tgr.enabled,
         json_agg(
           json_build_object(
             'role_id', rm.role_id,
             'role_name', rm.role_name
           )
         ) FILTER (WHERE rm.id IS NOT NULL) as roles
       FROM token_gating_rules tgr
       LEFT JOIN role_mappings rm ON tgr.id = rm.rule_id
       WHERE tgr.guild_id = $1 AND tgr.enabled = TRUE
       GROUP BY tgr.id
       ORDER BY tgr.priority DESC`,
      [guild.id]
    )

    return NextResponse.json({
      success: true,
      session: {
        session_id: session.id,
        session_token: session.session_token,
        challenge_message: session.challenge_message,
        expires_at: session.expires_at,
      },
      guild: {
        id: guild.id,
        name: guild.name,
        slug: guild.slug,
      },
      requirements: rulesResult.rows.map(rule => ({
        ...rule,
        roles: rule.roles || [],
      })),
    })
  } catch (error) {
    console.error("Error starting verification:", error)
    return NextResponse.json(
      { error: "Failed to start verification" },
      { status: 500 }
    )
  }
}
