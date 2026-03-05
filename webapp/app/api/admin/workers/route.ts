import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// POST /api/admin/workers
// Register or update a worker profile
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      user_id,
      guild_id,
      is_active,
      worker_type,
      skill_level,
      total_jobs_completed,
      total_jobs_failed,
      total_rewards_earned,
      average_rating,
    } = body

    if (!user_id || !guild_id) {
      return NextResponse.json(
        { error: "user_id and guild_id are required" },
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

    // Create or update worker profile
    const workerResult = await query(
      `INSERT INTO worker_profiles (
         user_id,
         guild_id,
         is_active,
         worker_type,
         skill_level,
         total_jobs_completed,
         total_jobs_failed,
         total_rewards_earned,
         average_rating,
         last_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (user_id, guild_id)
       DO UPDATE SET
         is_active = COALESCE($3, worker_profiles.is_active),
         worker_type = COALESCE($4, worker_profiles.worker_type),
         skill_level = COALESCE($5, worker_profiles.skill_level),
         total_jobs_completed = COALESCE($6, worker_profiles.total_jobs_completed),
         total_jobs_failed = COALESCE($7, worker_profiles.total_jobs_failed),
         total_rewards_earned = COALESCE($8, worker_profiles.total_rewards_earned),
         average_rating = COALESCE($9, worker_profiles.average_rating),
         last_active = NOW()
       RETURNING *`,
      [
        user_id,
        guild_id,
        is_active !== undefined ? is_active : true,
        worker_type,
        skill_level,
        total_jobs_completed,
        total_jobs_failed,
        total_rewards_earned,
        average_rating,
      ]
    )

    return NextResponse.json({
      success: true,
      worker: workerResult.rows[0],
      message: "Worker profile updated successfully",
    })
  } catch (error: any) {
    console.error("Error updating worker profile:", error)
    return NextResponse.json(
      { error: "Failed to update worker profile", details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================
// GET /api/admin/workers
// Get worker profiles and job history
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
    const is_active = searchParams.get("is_active")
    const worker_type = searchParams.get("worker_type")
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
    let whereClause = "wp.guild_id = $1"

    if (user_id) {
      queryParams.push(user_id)
      whereClause += ` AND wp.user_id = $${queryParams.length}`
    }

    if (is_active !== null && is_active !== undefined) {
      queryParams.push(is_active === "true")
      whereClause += ` AND wp.is_active = $${queryParams.length}`
    }

    if (worker_type) {
      queryParams.push(worker_type)
      whereClause += ` AND wp.worker_type = $${queryParams.length}`
    }

    // Get worker profiles
    const workersResult = await query(
      `SELECT wp.*, du.username, du.avatar
       FROM worker_profiles wp
       LEFT JOIN discord_users du ON wp.user_id = du.user_id
       WHERE ${whereClause}
       ORDER BY wp.total_jobs_completed DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    )

    // Get job history if specific user
    let jobs = []
    if (user_id) {
      const jobsResult = await query(
        `SELECT wj.* FROM worker_jobs wj
         JOIN worker_profiles wp ON wj.worker_id = wp.id
         WHERE wp.user_id = $1 AND wp.guild_id = $2
         ORDER BY wj.created_at DESC
         LIMIT 100`,
        [user_id, guild_id]
      )
      jobs = jobsResult.rows
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM worker_profiles wp WHERE ${whereClause}`,
      queryParams
    )

    return NextResponse.json({
      success: true,
      workers: workersResult.rows,
      jobs: user_id ? jobs : undefined,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || "0"),
        limit,
        offset,
      },
    })
  } catch (error: any) {
    console.error("Error fetching workers:", error)
    return NextResponse.json(
      { error: "Failed to fetch workers" },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/admin/workers
// Deactivate a worker profile
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const user_id = searchParams.get("user_id")
    const guild_id = searchParams.get("guild_id")

    if (!user_id || !guild_id) {
      return NextResponse.json(
        { error: "user_id and guild_id are required" },
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

    // Deactivate worker
    await query(
      `UPDATE worker_profiles SET is_active = FALSE WHERE user_id = $1 AND guild_id = $2`,
      [user_id, guild_id]
    )

    return NextResponse.json({
      success: true,
      message: "Worker profile deactivated",
    })
  } catch (error: any) {
    console.error("Error deactivating worker:", error)
    return NextResponse.json(
      { error: "Failed to deactivate worker" },
      { status: 500 }
    )
  }
}
