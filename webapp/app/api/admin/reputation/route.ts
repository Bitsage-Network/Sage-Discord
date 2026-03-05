import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// POST /api/admin/reputation
// Add or adjust user reputation points
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // Security: Only allow if user is admin
    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { user_id, guild_id, points, transaction_type, reason, source } = body

    if (!user_id || !guild_id || points === undefined) {
      return NextResponse.json(
        { error: "user_id, guild_id, and points are required" },
        { status: 400 }
      )
    }

    // Check if user has admin access to this guild
    const accessCheck = await query(
      `SELECT 1 FROM guilds WHERE id = $1 AND owner_discord_id = $2
       UNION
       SELECT 1 FROM guild_members WHERE guild_id = $1 AND discord_user_id = $2 AND is_admin = TRUE`,
      [guild_id, session.user.discordId]
    )

    if (accessCheck.rows.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Begin transaction
    await query("BEGIN")

    try {
      // Get or create user reputation record
      const reputationResult = await query(
        `INSERT INTO user_reputation (user_id, guild_id, reputation_points, level, total_earned, total_spent)
         VALUES ($1, $2, $3, 1, 0, 0)
         ON CONFLICT (user_id, guild_id)
         DO UPDATE SET
           reputation_points = user_reputation.reputation_points + $3,
           total_earned = user_reputation.total_earned + CASE WHEN $3 > 0 THEN $3 ELSE 0 END,
           total_spent = user_reputation.total_spent + CASE WHEN $3 < 0 THEN ABS($3) ELSE 0 END,
           last_updated = NOW()
         RETURNING *`,
        [user_id, guild_id, points]
      )

      const reputation = reputationResult.rows[0]

      // Calculate new level (every 100 points = 1 level)
      const newLevel = Math.floor(reputation.reputation_points / 100) + 1

      if (newLevel !== reputation.level) {
        await query(
          `UPDATE user_reputation SET level = $1 WHERE id = $2`,
          [newLevel, reputation.id]
        )
      }

      // Record transaction
      await query(
        `INSERT INTO reputation_transactions (
           user_id, guild_id, points, transaction_type, reason, source, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          user_id,
          guild_id,
          points,
          transaction_type || "admin_adjustment",
          reason || "Manual adjustment by admin",
          source || "admin_panel",
          JSON.stringify({ admin_id: session.user.discordId }),
        ]
      )

      // Commit transaction
      await query("COMMIT")

      return NextResponse.json({
        success: true,
        reputation: {
          ...reputation,
          level: newLevel,
        },
        message: `Successfully ${points > 0 ? "added" : "deducted"} ${Math.abs(points)} reputation points`,
      })
    } catch (error) {
      await query("ROLLBACK")
      throw error
    }
  } catch (error: any) {
    console.error("Error adjusting reputation:", error)
    return NextResponse.json(
      { error: "Failed to adjust reputation", details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================
// GET /api/admin/reputation
// Get user reputation and transaction history
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get("user_id")
    const guild_id = searchParams.get("guild_id")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

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

    if (user_id) {
      queryParams.push(user_id)
      whereClause += ` AND user_id = $${queryParams.length}`
    }

    // Get reputation data
    const reputationResult = await query(
      `SELECT ur.*, du.username, du.avatar
       FROM user_reputation ur
       LEFT JOIN discord_users du ON ur.user_id = du.user_id
       WHERE ${whereClause}
       ORDER BY ur.reputation_points DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    )

    // Get transaction history if specific user
    let transactions = []
    if (user_id) {
      const transactionResult = await query(
        `SELECT * FROM reputation_transactions
         WHERE guild_id = $1 AND user_id = $2
         ORDER BY created_at DESC
         LIMIT 100`,
        [guild_id, user_id]
      )
      transactions = transactionResult.rows
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM user_reputation WHERE ${whereClause}`,
      queryParams
    )

    return NextResponse.json({
      success: true,
      reputation: reputationResult.rows,
      transactions: user_id ? transactions : undefined,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || "0"),
        limit,
        offset,
      },
    })
  } catch (error: any) {
    console.error("Error fetching reputation:", error)
    return NextResponse.json(
      { error: "Failed to fetch reputation" },
      { status: 500 }
    )
  }
}
