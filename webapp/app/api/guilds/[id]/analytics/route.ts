import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// GET /api/guilds/[id]/analytics
// Fetch analytics data for a guild
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
        { error: "You don't have permission to view this guild" },
        { status: 403 }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get("range") || "30d" // 7d, 30d, 90d, all

    // Get time range filter
    let memberDateFilter = ""
    let verificationDateFilter = ""
    switch (timeRange) {
      case "7d":
        memberDateFilter = "AND joined_at >= NOW() - INTERVAL '7 days'"
        verificationDateFilter = "AND wv.signed_at >= NOW() - INTERVAL '7 days'"
        break
      case "30d":
        memberDateFilter = "AND joined_at >= NOW() - INTERVAL '30 days'"
        verificationDateFilter = "AND wv.signed_at >= NOW() - INTERVAL '30 days'"
        break
      case "90d":
        memberDateFilter = "AND joined_at >= NOW() - INTERVAL '90 days'"
        verificationDateFilter = "AND wv.signed_at >= NOW() - INTERVAL '90 days'"
        break
      default:
        memberDateFilter = ""
        verificationDateFilter = ""
    }

    // 1. Member Statistics
    const memberStatsResult = await query(
      `SELECT
         COUNT(*) as total_members,
         COUNT(CASE WHEN wv.verified = TRUE THEN 1 END) as verified_members,
         COUNT(CASE WHEN wv.id IS NOT NULL AND wv.verified = FALSE THEN 1 END) as pending_verifications,
         COUNT(CASE WHEN wv.id IS NULL THEN 1 END) as unverified_members
       FROM guild_members gm
       LEFT JOIN wallet_verifications wv ON gm.discord_user_id = wv.user_id
       WHERE gm.guild_id = $1`,
      [guildId]
    )

    const memberStats = memberStatsResult.rows[0]

    // 2. Member Growth Over Time (daily for last 30 days or weekly for 90 days)
    const growthInterval = timeRange === "90d" ? "7 days" : "1 day"
    const growthResult = await query(
      `SELECT
         date_trunc('day', joined_at) as date,
         COUNT(*) as new_members,
         SUM(COUNT(*)) OVER (ORDER BY date_trunc('day', joined_at)) as cumulative_members
       FROM guild_members
       WHERE guild_id = $1 ${memberDateFilter}
       GROUP BY date_trunc('day', joined_at)
       ORDER BY date`,
      [guildId]
    )

    // 3. Verification Success Rate
    const verificationStatsResult = await query(
      `SELECT
         COUNT(*) as total_attempts,
         COUNT(CASE WHEN verified = TRUE THEN 1 END) as successful,
         COUNT(CASE WHEN verified = FALSE THEN 1 END) as failed,
         AVG(CASE WHEN verified = TRUE THEN EXTRACT(EPOCH FROM (verified_at - signed_at)) END) as avg_verification_time
       FROM wallet_verifications wv
       JOIN guild_members gm ON wv.user_id = gm.discord_user_id
       WHERE gm.guild_id = $1 ${verificationDateFilter}`,
      [guildId]
    )

    const verificationStats = verificationStatsResult.rows[0]
    const successRate =
      verificationStats.total_attempts > 0
        ? (verificationStats.successful / verificationStats.total_attempts) * 100
        : 0

    // 4. Role Distribution
    const roleDistributionResult = await query(
      `SELECT
         tgr.rule_name,
         tgr.rule_type,
         rm.role_name,
         COUNT(DISTINCT urc.user_id) as member_count
       FROM token_gating_rules tgr
       LEFT JOIN role_mappings rm ON tgr.id = rm.rule_id
       LEFT JOIN user_rule_cache urc ON tgr.id = urc.rule_id AND urc.passes_rule = TRUE
       WHERE tgr.guild_id = $1 AND tgr.enabled = TRUE
       GROUP BY tgr.id, tgr.rule_name, tgr.rule_type, rm.role_name
       ORDER BY member_count DESC`,
      [guildId]
    )

    // 5. Top Token Holders (if we have balance data)
    const topHoldersResult = await query(
      `SELECT
         wv.wallet_address,
         du.username,
         urc.cached_balance,
         urc.cached_stake
       FROM wallet_verifications wv
       JOIN guild_members gm ON wv.user_id = gm.discord_user_id
       LEFT JOIN discord_users du ON wv.user_id = du.user_id
       LEFT JOIN user_rule_cache urc ON wv.user_id = urc.user_id
       WHERE gm.guild_id = $1 AND wv.verified = TRUE AND urc.cached_balance IS NOT NULL
       ORDER BY urc.cached_balance DESC
       LIMIT 10`,
      [guildId]
    )

    // 6. Recent Activity (analytics events)
    const recentActivityResult = await query(
      `SELECT
         event_type,
         event_data,
         created_at,
         user_id
       FROM analytics_events
       WHERE guild_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [guildId]
    )

    // 7. Token-Gating Rules Performance
    const rulesPerformanceResult = await query(
      `SELECT
         tgr.id,
         tgr.rule_name,
         tgr.rule_type,
         tgr.enabled,
         COUNT(DISTINCT urc.user_id) FILTER (WHERE urc.passes_rule = TRUE) as passing_members,
         COUNT(DISTINCT urc.user_id) FILTER (WHERE urc.passes_rule = FALSE) as failing_members
       FROM token_gating_rules tgr
       LEFT JOIN user_rule_cache urc ON tgr.id = urc.rule_id
       WHERE tgr.guild_id = $1
       GROUP BY tgr.id, tgr.rule_name, tgr.rule_type, tgr.enabled
       ORDER BY passing_members DESC`,
      [guildId]
    )

    // 8. Failed Verifications (recent)
    const failedVerificationsResult = await query(
      `SELECT
         wv.user_id,
         du.username,
         wv.wallet_address,
         wv.signed_at,
         wv.verification_method
       FROM wallet_verifications wv
       JOIN guild_members gm ON wv.user_id = gm.discord_user_id
       LEFT JOIN discord_users du ON wv.user_id = du.user_id
       WHERE gm.guild_id = $1 AND wv.verified = FALSE
       ORDER BY wv.signed_at DESC
       LIMIT 20`,
      [guildId]
    )

    return NextResponse.json({
      success: true,
      analytics: {
        member_stats: {
          total: parseInt(memberStats.total_members),
          verified: parseInt(memberStats.verified_members),
          pending: parseInt(memberStats.pending_verifications),
          unverified: parseInt(memberStats.unverified_members),
        },
        member_growth: growthResult.rows,
        verification_stats: {
          total_attempts: parseInt(verificationStats.total_attempts || "0"),
          successful: parseInt(verificationStats.successful || "0"),
          failed: parseInt(verificationStats.failed || "0"),
          success_rate: Math.round(successRate * 100) / 100,
          avg_verification_time: parseFloat(verificationStats.avg_verification_time || "0"),
        },
        role_distribution: roleDistributionResult.rows,
        top_holders: topHoldersResult.rows,
        recent_activity: recentActivityResult.rows,
        rules_performance: rulesPerformanceResult.rows,
        failed_verifications: failedVerificationsResult.rows,
      },
      time_range: timeRange,
    })
  } catch (error) {
    console.error("Error fetching analytics:", error)
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}
