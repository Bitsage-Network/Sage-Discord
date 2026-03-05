import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"
import { CreateRewardCampaignSchema } from "@/lib/schemas"

/**
 * GET /api/guilds/[id]/rewards
 * List all reward campaigns for a guild
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const guildId = params.id

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

    // 3. Fetch campaigns with related data
    const campaignsResult = await query(
      `SELECT
         rc.*,
         rg.name as rule_group_name,
         (SELECT COUNT(*) FROM reward_claims WHERE campaign_id = rc.id) as total_claims,
         (SELECT COUNT(*) FROM reward_claims WHERE campaign_id = rc.id AND status = 'completed') as successful_claims
       FROM reward_campaigns rc
       LEFT JOIN rule_groups rg ON rc.rule_group_id = rg.id
       WHERE rc.guild_id = $1
       ORDER BY rc.created_at DESC`,
      [guildId]
    )

    return NextResponse.json({
      success: true,
      campaigns: campaignsResult.rows,
      count: campaignsResult.rows.length,
    })
  } catch (error: any) {
    console.error("Error fetching reward campaigns:", error)
    return NextResponse.json(
      { error: "Failed to fetch reward campaigns" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/guilds/[id]/rewards
 * Create a new reward campaign
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const guildId = params.id
    const body = await request.json()

    // 2. Validation
    const validation = CreateRewardCampaignSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // 3. Authorization - check guild access
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

    // 4. Validate reward_config based on reward_type
    if (data.reward_type === "role") {
      if (!data.reward_config.role_ids || !Array.isArray(data.reward_config.role_ids)) {
        return NextResponse.json(
          { error: "role_ids array is required for role rewards" },
          { status: 400 }
        )
      }
    }

    if (data.reward_type === "xp") {
      if (typeof data.reward_config.xp_amount !== "number" || data.reward_config.xp_amount <= 0) {
        return NextResponse.json(
          { error: "xp_amount (positive number) is required for XP rewards" },
          { status: 400 }
        )
      }
    }

    if (data.reward_type === "access_grant") {
      if (!data.reward_config.channel_ids || !Array.isArray(data.reward_config.channel_ids)) {
        return NextResponse.json(
          { error: "channel_ids array is required for access grant rewards" },
          { status: 400 }
        )
      }
    }

    // 5. Insert campaign
    const campaignResult = await query(
      `INSERT INTO reward_campaigns (
         guild_id,
         name,
         description,
         reward_type,
         reward_config,
         trigger_type,
         trigger_config,
         auto_claim,
         eligibility_requirements,
         rule_group_id,
         max_claims,
         cooldown_hours,
         start_date,
         end_date,
         status,
         claimed_count,
         created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active', 0, NOW())
       RETURNING *`,
      [
        guildId,
        data.name,
        data.description || null,
        data.reward_type,
        JSON.stringify(data.reward_config),
        data.trigger_type,
        JSON.stringify(data.trigger_config || {}),
        data.auto_claim,
        JSON.stringify(data.eligibility_requirements || {}),
        data.rule_group_id || null,
        data.max_claims || null,
        data.cooldown_hours,
        data.start_date || null,
        data.end_date || null,
      ]
    )

    const campaign = campaignResult.rows[0]

    // 6. Log analytics
    await query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        guildId,
        "reward_campaign_created",
        JSON.stringify({
          campaign_id: campaign.id,
          campaign_name: data.name,
          reward_type: data.reward_type,
        }),
        session.user.discordId,
      ]
    ).catch(err => console.error("Analytics logging failed:", err))

    return NextResponse.json({
      success: true,
      campaign,
    }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating reward campaign:", error)
    return NextResponse.json(
      { error: "Failed to create reward campaign" },
      { status: 500 }
    )
  }
}
