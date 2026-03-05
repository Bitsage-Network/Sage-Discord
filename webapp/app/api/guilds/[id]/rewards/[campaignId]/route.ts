import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"
import { UpdateRewardCampaignSchema } from "@/lib/schemas"

/**
 * GET /api/guilds/[id]/rewards/[campaignId]
 * Get single campaign details
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

    // 3. Fetch campaign with related data
    const campaignResult = await query(
      `SELECT
         rc.*,
         rg.name as rule_group_name,
         (SELECT COUNT(*) FROM reward_claims WHERE campaign_id = rc.id) as total_claims,
         (SELECT COUNT(*) FROM reward_claims WHERE campaign_id = rc.id AND status = 'completed') as successful_claims,
         (SELECT COUNT(*) FROM reward_claims WHERE campaign_id = rc.id AND status = 'pending') as pending_claims,
         (SELECT COUNT(*) FROM reward_claims WHERE campaign_id = rc.id AND status = 'failed') as failed_claims
       FROM reward_campaigns rc
       LEFT JOIN rule_groups rg ON rc.rule_group_id = rg.id
       WHERE rc.id = $1 AND rc.guild_id = $2`,
      [campaignId, guildId]
    )

    if (campaignResult.rows.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const campaign = campaignResult.rows[0]

    return NextResponse.json({
      success: true,
      campaign,
    })
  } catch (error: any) {
    console.error("Error fetching campaign:", error)
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/guilds/[id]/rewards/[campaignId]
 * Update campaign
 */
export async function PATCH(
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
    const body = await request.json()

    // 2. Validation
    const validation = UpdateRewardCampaignSchema.safeParse(body)
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

    // 4. Check campaign exists
    const campaignCheck = await query(
      `SELECT * FROM reward_campaigns WHERE id = $1 AND guild_id = $2`,
      [campaignId, guildId]
    )

    if (campaignCheck.rows.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    // 5. Build dynamic update query
    const updateFields: string[] = []
    const updateValues: any[] = []
    let paramIndex = 1

    if (data.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`)
      updateValues.push(data.name)
    }

    if (data.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`)
      updateValues.push(data.description)
    }

    if (data.reward_type !== undefined) {
      updateFields.push(`reward_type = $${paramIndex++}`)
      updateValues.push(data.reward_type)
    }

    if (data.reward_config !== undefined) {
      updateFields.push(`reward_config = $${paramIndex++}`)
      updateValues.push(JSON.stringify(data.reward_config))
    }

    if (data.trigger_type !== undefined) {
      updateFields.push(`trigger_type = $${paramIndex++}`)
      updateValues.push(data.trigger_type)
    }

    if (data.trigger_config !== undefined) {
      updateFields.push(`trigger_config = $${paramIndex++}`)
      updateValues.push(JSON.stringify(data.trigger_config))
    }

    if (data.auto_claim !== undefined) {
      updateFields.push(`auto_claim = $${paramIndex++}`)
      updateValues.push(data.auto_claim)
    }

    if (data.rule_group_id !== undefined) {
      updateFields.push(`rule_group_id = $${paramIndex++}`)
      updateValues.push(data.rule_group_id)
    }

    if (data.eligibility_requirements !== undefined) {
      updateFields.push(`eligibility_requirements = $${paramIndex++}`)
      updateValues.push(JSON.stringify(data.eligibility_requirements))
    }

    if (data.max_claims !== undefined) {
      updateFields.push(`max_claims = $${paramIndex++}`)
      updateValues.push(data.max_claims)
    }

    if (data.cooldown_hours !== undefined) {
      updateFields.push(`cooldown_hours = $${paramIndex++}`)
      updateValues.push(data.cooldown_hours)
    }

    if (data.start_date !== undefined) {
      updateFields.push(`start_date = $${paramIndex++}`)
      updateValues.push(data.start_date)
    }

    if (data.end_date !== undefined) {
      updateFields.push(`end_date = $${paramIndex++}`)
      updateValues.push(data.end_date)
    }

    if (data.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`)
      updateValues.push(data.status)
    }

    // Always update updated_at
    updateFields.push(`updated_at = NOW()`)

    // Add campaignId and guildId as final parameters
    updateValues.push(campaignId, guildId)

    // 6. Execute update
    const updateQuery = `
      UPDATE reward_campaigns
      SET ${updateFields.join(", ")}
      WHERE id = $${paramIndex++} AND guild_id = $${paramIndex++}
      RETURNING *
    `

    const campaignResult = await query(updateQuery, updateValues)
    const updatedCampaign = campaignResult.rows[0]

    // 7. Clear eligibility cache if requirements changed
    if (data.rule_group_id !== undefined || data.eligibility_requirements !== undefined) {
      await query(
        `DELETE FROM reward_eligibility WHERE campaign_id = $1`,
        [campaignId]
      ).catch(err => console.error("Failed to clear eligibility cache:", err))
    }

    // 8. Log analytics
    await query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        guildId,
        "reward_campaign_updated",
        JSON.stringify({
          campaign_id: campaignId,
          updated_fields: Object.keys(data),
        }),
        session.user.discordId,
      ]
    ).catch(err => console.error("Analytics logging failed:", err))

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
    })
  } catch (error: any) {
    console.error("Error updating campaign:", error)
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/guilds/[id]/rewards/[campaignId]
 * Delete campaign
 */
export async function DELETE(
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
      `SELECT * FROM reward_campaigns WHERE id = $1 AND guild_id = $2`,
      [campaignId, guildId]
    )

    if (campaignCheck.rows.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const campaign = campaignCheck.rows[0]

    // 4. Delete campaign (cascades to claims, eligibility, queue)
    await query(
      `DELETE FROM reward_campaigns WHERE id = $1 AND guild_id = $2`,
      [campaignId, guildId]
    )

    // 5. Log analytics
    await query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        guildId,
        "reward_campaign_deleted",
        JSON.stringify({
          campaign_id: campaignId,
          campaign_name: campaign.name,
          reward_type: campaign.reward_type,
        }),
        session.user.discordId,
      ]
    ).catch(err => console.error("Analytics logging failed:", err))

    return NextResponse.json({
      success: true,
      message: "Campaign deleted successfully",
    })
  } catch (error: any) {
    console.error("Error deleting campaign:", error)
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    )
  }
}
