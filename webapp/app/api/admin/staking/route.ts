import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// POST /api/admin/staking
// Add or update staking contract configuration
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
      contract_address,
      contract_name,
      token_address,
      min_stake_amount,
      lock_period_days,
      is_active,
    } = body

    if (!guild_id || !contract_address || !token_address) {
      return NextResponse.json(
        { error: "guild_id, contract_address, and token_address are required" },
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

    // Validate contract address format (Starknet addresses start with 0x)
    if (!contract_address.startsWith("0x")) {
      return NextResponse.json(
        { error: "Invalid contract address format" },
        { status: 400 }
      )
    }

    // Create or update staking contract
    const stakingResult = await query(
      `INSERT INTO staking_contracts (
         guild_id,
         contract_address,
         contract_name,
         token_address,
         min_stake_amount,
         lock_period_days,
         is_active,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (guild_id, contract_address)
       DO UPDATE SET
         contract_name = COALESCE($3, staking_contracts.contract_name),
         token_address = COALESCE($4, staking_contracts.token_address),
         min_stake_amount = COALESCE($5, staking_contracts.min_stake_amount),
         lock_period_days = COALESCE($6, staking_contracts.lock_period_days),
         is_active = COALESCE($7, staking_contracts.is_active),
         updated_at = NOW()
       RETURNING *`,
      [
        guild_id,
        contract_address,
        contract_name,
        token_address,
        min_stake_amount || "0",
        lock_period_days || 0,
        is_active !== undefined ? is_active : true,
      ]
    )

    return NextResponse.json({
      success: true,
      staking_contract: stakingResult.rows[0],
      message: "Staking contract configured successfully",
    })
  } catch (error: any) {
    console.error("Error configuring staking contract:", error)
    return NextResponse.json(
      { error: "Failed to configure staking contract", details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================
// GET /api/admin/staking
// Get staking contract configurations
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const guild_id = searchParams.get("guild_id")
    const is_active = searchParams.get("is_active")

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

    if (is_active !== null && is_active !== undefined) {
      queryParams.push(is_active === "true")
      whereClause += ` AND is_active = $${queryParams.length}`
    }

    // Get staking contracts
    const stakingResult = await query(
      `SELECT * FROM staking_contracts
       WHERE ${whereClause}
       ORDER BY is_active DESC, created_at DESC`,
      queryParams
    )

    return NextResponse.json({
      success: true,
      staking_contracts: stakingResult.rows,
    })
  } catch (error: any) {
    console.error("Error fetching staking contracts:", error)
    return NextResponse.json(
      { error: "Failed to fetch staking contracts" },
      { status: 500 }
    )
  }
}

// ============================================================
// DELETE /api/admin/staking
// Deactivate a staking contract
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.discordId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const guild_id = searchParams.get("guild_id")
    const contract_address = searchParams.get("contract_address")

    if (!guild_id || !contract_address) {
      return NextResponse.json(
        { error: "guild_id and contract_address are required" },
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

    // Deactivate staking contract
    await query(
      `UPDATE staking_contracts SET is_active = FALSE, updated_at = NOW()
       WHERE guild_id = $1 AND contract_address = $2`,
      [guild_id, contract_address]
    )

    return NextResponse.json({
      success: true,
      message: "Staking contract deactivated",
    })
  } catch (error: any) {
    console.error("Error deactivating staking contract:", error)
    return NextResponse.json(
      { error: "Failed to deactivate staking contract" },
      { status: 500 }
    )
  }
}
