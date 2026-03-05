import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// GET /api/guilds/[id]/channels
// Fetch Discord channels for a guild
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

    // Check if user has access to this guild
    const guildCheck = await query(
      `SELECT g.id, g.discord_guild_id, g.owner_discord_id, gm.is_admin
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

    // Check if Discord guild is linked
    if (!guild.discord_guild_id) {
      return NextResponse.json(
        {
          error: "Discord server not linked",
          message: "Please link a Discord server to this guild first",
        },
        { status: 400 }
      )
    }

    // Fetch channels from Discord API
    const botToken = process.env.DISCORD_BOT_TOKEN
    if (!botToken) {
      console.error("DISCORD_BOT_TOKEN not configured")
      return NextResponse.json(
        { error: "Discord bot not configured" },
        { status: 500 }
      )
    }

    const discordResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guild.discord_guild_id}/channels`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      }
    )

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text()
      console.error("Discord API error:", errorText)

      if (discordResponse.status === 404) {
        return NextResponse.json(
          {
            error: "Discord server not found",
            message: "The linked Discord server could not be found. Please check the server ID.",
          },
          { status: 404 }
        )
      }

      if (discordResponse.status === 403) {
        return NextResponse.json(
          {
            error: "Bot not in server",
            message: "The bot is not in the linked Discord server. Please invite the bot first.",
          },
          { status: 403 }
        )
      }

      return NextResponse.json(
        { error: "Failed to fetch Discord channels" },
        { status: discordResponse.status }
      )
    }

    const channels = await discordResponse.json()

    // Discord channel types:
    // 0 = Text, 2 = Voice, 4 = Category, 5 = Announcement, 13 = Stage, 15 = Forum
    // For access grants, we probably want text channels (0, 5, 15)
    const filteredChannels = channels
      .filter((channel: any) => {
        // Include text channels, announcement channels, and forum channels
        return [0, 5, 15].includes(channel.type)
      })
      .sort((a: any, b: any) => {
        // Sort by position
        return (a.position || 0) - (b.position || 0)
      })
      .map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: channel.position,
        parent_id: channel.parent_id,
        topic: channel.topic,
        nsfw: channel.nsfw,
      }))

    return NextResponse.json({
      success: true,
      channels: filteredChannels,
      count: filteredChannels.length,
      guild_id: guild.discord_guild_id,
    })
  } catch (error) {
    console.error("Error fetching Discord channels:", error)
    return NextResponse.json(
      { error: "Failed to fetch Discord channels" },
      { status: 500 }
    )
  }
}
