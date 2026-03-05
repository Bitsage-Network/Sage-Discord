import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

/**
 * POST /api/guilds/[id]/rewards/[campaignId]/preview
 * Preview eligible users for a campaign (with optional cache refresh)
 */
export async function POST(
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

    // 3. Check campaign exists
    const campaignCheck = await query(
      `SELECT id, name, status FROM reward_campaigns WHERE id = $1 AND guild_id = $2`,
      [campaignId, guildId]
    )

    if (campaignCheck.rows.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const campaign = campaignCheck.rows[0]

    // 4. Get eligible users from cache
    const eligibleResult = await query(
      `SELECT
         re.discord_user_id,
         re.eligible,
         re.last_checked,
         du.username,
         du.level,
         du.xp,
         du.total_messages
       FROM reward_eligibility re
       JOIN discord_users du ON re.discord_user_id = du.user_id
       WHERE re.campaign_id = $1 AND re.eligible = true
       ORDER BY re.last_checked DESC
       LIMIT 100`,
      [campaignId]
    )

    // 5. Get users who have already claimed
    const claimedResult = await query(
      `SELECT discord_user_id, status, claimed_at
       FROM reward_claims
       WHERE campaign_id = $1`,
      [campaignId]
    )

    const claimedUsers = new Map(
      claimedResult.rows.map(row => [row.discord_user_id, row])
    )

    // 6. Combine data
    const eligibleUsers = eligibleResult.rows.map(user => ({
      user_id: user.discord_user_id,
      username: user.username || "Unknown",
      level: user.level,
      xp: user.xp,
      total_messages: user.total_messages,
      last_checked: user.last_checked,
      has_claimed: claimedUsers.has(user.discord_user_id),
      claim_status: claimedUsers.get(user.discord_user_id)?.status,
      claimed_at: claimedUsers.get(user.discord_user_id)?.claimed_at,
    }))

    // 7. Get cache statistics
    const cacheStatsResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE eligible = true) as eligible_count,
         COUNT(*) FILTER (WHERE eligible = false) as ineligible_count,
         MAX(last_checked) as last_updated
       FROM reward_eligibility
       WHERE campaign_id = $1`,
      [campaignId]
    )

    const cacheStats = cacheStatsResult.rows[0] || {
      eligible_count: 0,
      ineligible_count: 0,
      last_updated: null,
    }

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
      },
      eligible_users: eligibleUsers,
      stats: {
        eligible_count: parseInt(cacheStats.eligible_count),
        ineligible_count: parseInt(cacheStats.ineligible_count),
        claimed_count: claimedResult.rows.length,
        unclaimed_eligible: eligibleUsers.filter(u => !u.has_claimed).length,
        cache_last_updated: cacheStats.last_updated,
      },
    })
  } catch (error: any) {
    console.error("Error previewing eligible users:", error)
    return NextResponse.json(
      { error: "Failed to preview eligible users" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/guilds/[id]/rewards/[campaignId]/preview
 * Refresh eligibility cache for all guild members
 */
export async function PUT(
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

    // 3. Check campaign exists
    const campaignCheck = await query(
      `SELECT id FROM reward_campaigns WHERE id = $1 AND guild_id = $2`,
      [campaignId, guildId]
    )

    if (campaignCheck.rows.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // 4. Get all guild members
    const membersResult = await query(
      `SELECT DISTINCT discord_id
       FROM guild_members
       WHERE guild_id = $1
       LIMIT 1000`,
      [guildId]
    )

    const userIds = membersResult.rows.map(row => row.discord_id)

    // 5. Trigger cache refresh via reward eligibility service
    // This is an async operation - we'll return immediately and let it process in background
    const eligibilityService = (global as any).rewardEligibilityService

    if (!eligibilityService) {
      return NextResponse.json(
        { error: "Reward eligibility service not available" },
        { status: 503 }
      )
    }

    // Start cache update in background (don't await)
    eligibilityService.updateEligibilityCache(campaignId, userIds)
      .catch((err: Error) => {
        console.error("Background cache update failed:", err)
      })

    return NextResponse.json({
      success: true,
      message: "Eligibility cache refresh started",
      users_to_check: userIds.length,
    })
  } catch (error: any) {
    console.error("Error refreshing eligibility cache:", error)
    return NextResponse.json(
      { error: "Failed to refresh eligibility cache" },
      { status: 500 }
    )
  }
}
