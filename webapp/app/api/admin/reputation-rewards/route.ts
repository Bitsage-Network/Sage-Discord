import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// POST /api/admin/reputation-rewards
// Configure reputation rewards for a guild
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      guild_id,
      action_type,
      points,
      cooldown_seconds,
      max_per_day,
      enabled,
    } = body

    if (!guild_id || !action_type || points === undefined) {
      return NextResponse.json(
        { error: "guild_id, action_type, and points are required" },
        { status: 400 }
      )
    }

    // Check access
    const accessCheck = await query(
      `SELECT 1 FROM guilds WHERE id = $1 AND owner_discord_id = $2
       UNION
       SELECT 1 FROM guild_members WHERE guild_id = $1 AND discord_user_id = $2 AND is_admin = TRUE`,
      [guild_id, session.user.discordId]
    )

    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Validate action_type
    const validActionTypes = [
      "message_sent",
      "reaction_received",
      "voice_minute",
      "quest_completed",
      "event_attended",
      "referral",
      "daily_login",
    ]

    if (!validActionTypes.includes(action_type)) {
      return NextResponse.json(
        { error: `Invalid action_type. Must be one of: ${validActionTypes.join(", ")}` },
        { status: 400 }
      )
    }

    // Create or update reputation reward
    const rewardResult = await query(
      `INSERT INTO reputation_rewards (
         guild_id,
         action_type,
         points,
         cooldown_seconds,
         max_per_day,
         enabled,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (guild_id, action_type)
       DO UPDATE SET
         points = $3,
         cooldown_seconds = COALESCE($4, reputation_rewards.cooldown_seconds),
         max_per_day = $5,
         enabled = COALESCE($6, reputation_rewards.enabled),
         updated_at = NOW()
       RETURNING *`,
      [
        guild_id,
        action_type,
        points,
        cooldown_seconds || 0,
        max_per_day,
        enabled !== undefined ? enabled : true,
      ]
    )

    return NextResponse.json({
      success: true,
      reward: rewardResult.rows[0],
      message: "Reputation reward configured successfully",
    })
  } catch (error: any) {
    console.error("Error configuring reputation reward:", error)
    return NextResponse.json(
      { error: "Failed to configure reputation reward", details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================
// GET /api/admin/reputation-rewards
// Get reputation reward configurations
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const guild_id = searchParams.get("guild_id")
    const enabled = searchParams.get("enabled")

    if (!guild_id) {
      return NextResponse.json(
        { error: "guild_id is required" },
        { status: 400 }
      )
    }

    // Check access
    const accessCheck = await query(
      `SELECT 1 FROM guilds WHERE id = $1 AND owner_discord_id = $2
       UNION
       SELECT 1 FROM guild_members WHERE guild_id = $1 AND discord_user_id = $2 AND is_admin = TRUE`,
      [guild_id, session.user.discordId]
    )

    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let queryParams: any[] = [guild_id]
    let whereClause = "guild_id = $1"

    if (enabled !== null && enabled !== undefined) {
      queryParams.push(enabled === "true")
      whereClause += ` AND enabled = $${queryParams.length}`
    }

    // Get reputation rewards
    const rewardsResult = await query(
      `SELECT * FROM reputation_rewards
       WHERE ${whereClause}
       ORDER BY action_type`,
      queryParams
    )

    return NextResponse.json({
      success: true,
      rewards: rewardsResult.rows,
    })
  } catch (error: any) {
    console.error("Error fetching reputation rewards:", error)
    return NextResponse.json(
      { error: "Failed to fetch reputation rewards" },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/admin/reputation-rewards
// Disable a reputation reward
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const guild_id = searchParams.get("guild_id")
    const action_type = searchParams.get("action_type")

    if (!guild_id || !action_type) {
      return NextResponse.json(
        { error: "guild_id and action_type are required" },
        { status: 400 }
      )
    }

    // Check access
    const accessCheck = await query(
      `SELECT 1 FROM guilds WHERE id = $1 AND owner_discord_id = $2
       UNION
       SELECT 1 FROM guild_members WHERE guild_id = $1 AND discord_user_id = $2 AND is_admin = TRUE`,
      [guild_id, session.user.discordId]
    )

    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Disable reputation reward
    await query(
      `UPDATE reputation_rewards SET enabled = FALSE, updated_at = NOW()
       WHERE guild_id = $1 AND action_type = $2`,
      [guild_id, action_type]
    )

    return NextResponse.json({
      success: true,
      message: "Reputation reward disabled",
    })
  } catch (error: any) {
    console.error("Error disabling reputation reward:", error)
    return NextResponse.json(
      { error: "Failed to disable reputation reward" },
      { status: 500 }
    )
  }
}
