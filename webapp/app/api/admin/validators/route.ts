import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// POST /api/admin/validators
// Register or update a validator profile
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
      validator_type,
      stake_amount,
      total_validations,
      successful_validations,
      failed_validations,
      uptime_percentage,
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

    // Create or update validator profile
    const validatorResult = await query(
      `INSERT INTO validator_profiles (
         user_id,
         guild_id,
         is_active,
         validator_type,
         stake_amount,
         total_validations,
         successful_validations,
         failed_validations,
         uptime_percentage,
         last_heartbeat
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (user_id, guild_id)
       DO UPDATE SET
         is_active = COALESCE($3, validator_profiles.is_active),
         validator_type = COALESCE($4, validator_profiles.validator_type),
         stake_amount = COALESCE($5, validator_profiles.stake_amount),
         total_validations = COALESCE($6, validator_profiles.total_validations),
         successful_validations = COALESCE($7, validator_profiles.successful_validations),
         failed_validations = COALESCE($8, validator_profiles.failed_validations),
         uptime_percentage = COALESCE($9, validator_profiles.uptime_percentage),
         last_heartbeat = NOW()
       RETURNING *`,
      [
        user_id,
        guild_id,
        is_active !== undefined ? is_active : true,
        validator_type,
        stake_amount,
        total_validations,
        successful_validations,
        failed_validations,
        uptime_percentage,
      ]
    )

    return NextResponse.json({
      success: true,
      validator: validatorResult.rows[0],
      message: "Validator profile updated successfully",
    })
  } catch (error: any) {
    console.error("Error updating validator profile:", error)
    return NextResponse.json(
      { error: "Failed to update validator profile", details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================
// GET /api/admin/validators
// Get validator profiles and validation history
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
    const validator_type = searchParams.get("validator_type")
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
    let whereClause = "vp.guild_id = $1"

    if (user_id) {
      queryParams.push(user_id)
      whereClause += ` AND vp.user_id = $${queryParams.length}`
    }

    if (is_active !== null && is_active !== undefined) {
      queryParams.push(is_active === "true")
      whereClause += ` AND vp.is_active = $${queryParams.length}`
    }

    if (validator_type) {
      queryParams.push(validator_type)
      whereClause += ` AND vp.validator_type = $${queryParams.length}`
    }

    // Get validator profiles
    const validatorsResult = await query(
      `SELECT vp.*, du.username, du.avatar
       FROM validator_profiles vp
       LEFT JOIN discord_users du ON vp.user_id = du.user_id
       WHERE ${whereClause}
       ORDER BY vp.uptime_percentage DESC, vp.total_validations DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    )

    // Get validation history if specific user
    let validations = []
    let uptime = []
    if (user_id) {
      const validationsResult = await query(
        `SELECT vv.* FROM validator_validations vv
         JOIN validator_profiles vp ON vv.validator_id = vp.id
         WHERE vp.user_id = $1 AND vp.guild_id = $2
         ORDER BY vv.validated_at DESC
         LIMIT 100`,
        [user_id, guild_id]
      )
      validations = validationsResult.rows

      const uptimeResult = await query(
        `SELECT vu.* FROM validator_uptime vu
         JOIN validator_profiles vp ON vu.validator_id = vp.id
         WHERE vp.user_id = $1 AND vp.guild_id = $2
         ORDER BY vu.timestamp DESC
         LIMIT 100`,
        [user_id, guild_id]
      )
      uptime = uptimeResult.rows
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM validator_profiles vp WHERE ${whereClause}`,
      queryParams
    )

    return NextResponse.json({
      success: true,
      validators: validatorsResult.rows,
      validations: user_id ? validations : undefined,
      uptime: user_id ? uptime : undefined,
      pagination: {
        total: parseInt(countResult.rows[0]?.total || "0"),
        limit,
        offset,
      },
    })
  } catch (error: any) {
    console.error("Error fetching validators:", error)
    return NextResponse.json(
      { error: "Failed to fetch validators" },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/admin/validators
// Deactivate a validator profile
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

    // Deactivate validator
    await query(
      `UPDATE validator_profiles SET is_active = FALSE WHERE user_id = $1 AND guild_id = $2`,
      [user_id, guild_id]
    )

    return NextResponse.json({
      success: true,
      message: "Validator profile deactivated",
    })
  } catch (error: any) {
    console.error("Error deactivating validator:", error)
    return NextResponse.json(
      { error: "Failed to deactivate validator" },
      { status: 500 }
    )
  }
}
