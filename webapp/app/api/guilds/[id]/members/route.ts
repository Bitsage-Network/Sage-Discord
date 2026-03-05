import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// GET /api/guilds/[id]/members
// List all guild members with verification status
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
      `SELECT g.id, g.owner_discord_id, g.discord_guild_id, gm.is_admin
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

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const verificationStatus = searchParams.get("verification") // verified, unverified, pending
    const roleFilter = searchParams.get("role")
    const searchQuery = searchParams.get("search")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Build query
    let whereConditions = ["gm.guild_id = $1"]
    let queryParams: any[] = [guildId]
    let paramIndex = 2

    // Filter by verification status
    if (verificationStatus === "verified") {
      whereConditions.push("wv.verified = TRUE")
    } else if (verificationStatus === "unverified") {
      whereConditions.push("wv.id IS NULL OR wv.verified = FALSE")
    } else if (verificationStatus === "pending") {
      whereConditions.push("wv.id IS NOT NULL AND wv.verified = FALSE")
    }

    // Filter by search query (username or Discord ID)
    if (searchQuery) {
      whereConditions.push(`(du.username ILIKE $${paramIndex} OR gm.discord_user_id ILIKE $${paramIndex})`)
      queryParams.push(`%${searchQuery}%`)
      paramIndex++
    }

    const whereClause = whereConditions.join(" AND ")

    // Fetch members with verification status and wallet info
    const membersResult = await query(
      `SELECT
         gm.id,
         gm.discord_user_id,
         gm.is_admin,
         gm.joined_at,
         du.username,
         wv.id as verification_id,
         wv.wallet_address,
         wv.verified,
         wv.verification_method,
         wv.verified_at,
         json_agg(
           DISTINCT jsonb_build_object(
             'rule_id', tgr.id,
             'rule_name', tgr.rule_name,
             'role_id', rm.role_id,
             'role_name', rm.role_name
           )
         ) FILTER (WHERE tgr.id IS NOT NULL) as token_gated_roles
       FROM guild_members gm
       LEFT JOIN discord_users du ON gm.discord_user_id = du.user_id
       LEFT JOIN wallet_verifications wv ON gm.discord_user_id = wv.user_id AND wv.verified = TRUE
       LEFT JOIN user_rule_cache urc ON gm.discord_user_id = urc.user_id AND urc.passes_rule = TRUE
       LEFT JOIN token_gating_rules tgr ON urc.rule_id = tgr.id
       LEFT JOIN role_mappings rm ON tgr.id = rm.rule_id
       WHERE ${whereClause}
       GROUP BY gm.id, gm.discord_user_id, gm.is_admin, gm.joined_at, du.username,
                wv.id, wv.wallet_address, wv.verified, wv.verification_method, wv.verified_at
       ORDER BY gm.joined_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limit, offset]
    )

    // Get total count
    const countResult = await query(
      `SELECT COUNT(DISTINCT gm.id) as total
       FROM guild_members gm
       LEFT JOIN discord_users du ON gm.discord_user_id = du.user_id
       LEFT JOIN wallet_verifications wv ON gm.discord_user_id = wv.user_id AND wv.verified = TRUE
       WHERE ${whereClause}`,
      queryParams
    )

    const members = membersResult.rows.map(member => ({
      ...member,
      token_gated_roles: member.token_gated_roles || [],
    }))

    return NextResponse.json({
      success: true,
      members,
      total: parseInt(countResult.rows[0]?.total || "0"),
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching guild members:", error)
    return NextResponse.json(
      { error: "Failed to fetch guild members" },
      { status: 500 }
    )
  }
}
