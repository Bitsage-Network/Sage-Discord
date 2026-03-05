import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

/**
 * GET /api/guilds/[id]/rewards/[campaignId]/claims
 * Get claim history for a campaign
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; campaignId: string } }
) {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: guildId, campaignId } = params

    // 2. Authorization - check guild access
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

    // 3. Get query parameters for pagination
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    const status = searchParams.get("status") // Filter by status

    // 4. Check campaign exists
    const campaignCheck = await query(
      `SELECT id, name FROM reward_campaigns WHERE id = $1 AND guild_id = $2`,
      [campaignId, guildId]
    )

    if (campaignCheck.rows.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // 5. Build claims query
    let claimsQuery = `
      SELECT
        rc.id,
        rc.discord_user_id,
        rc.status,
        rc.claimed_at,
        rc.delivery_method,
        rc.delivery_details,
        rc.error_message,
        rc.retries,
        du.username,
        du.level,
        du.xp
      FROM reward_claims rc
      LEFT JOIN discord_users du ON rc.discord_user_id = du.user_id
      WHERE rc.campaign_id = $1
    `

    const queryParams: any[] = [campaignId]
    let paramIndex = 2

    // Add status filter if provided
    if (status && ["pending", "completed", "failed"].includes(status)) {
      claimsQuery += ` AND rc.status = $${paramIndex++}`
      queryParams.push(status)
    }

    // Add ordering and pagination
    claimsQuery += `
      ORDER BY rc.claimed_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `
    queryParams.push(limit, offset)

    // 6. Execute query
    const claimsResult = await query(claimsQuery, queryParams)

    // 7. Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM reward_claims
      WHERE campaign_id = $1
    `

    const countParams: any[] = [campaignId]

    if (status && ["pending", "completed", "failed"].includes(status)) {
      countQuery += ` AND status = $2`
      countParams.push(status)
    }

    const countResult = await query(countQuery, countParams)
    const total = parseInt(countResult.rows[0]?.total || "0")

    // 8. Get status breakdown
    const statsResult = await query(
      `SELECT
         status,
         COUNT(*) as count
       FROM reward_claims
       WHERE campaign_id = $1
       GROUP BY status`,
      [campaignId]
    )

    const stats = {
      total: total,
      pending: 0,
      completed: 0,
      failed: 0,
    }

    for (const row of statsResult.rows) {
      stats[row.status as keyof typeof stats] = parseInt(row.count)
    }

    return NextResponse.json({
      success: true,
      campaign: campaignCheck.rows[0],
      claims: claimsResult.rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats,
    })
  } catch (error: any) {
    console.error("Error fetching claims:", error)
    return NextResponse.json(
      { error: "Failed to fetch claims" },
      { status: 500 }
    )
  }
}
