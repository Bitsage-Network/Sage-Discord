import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { query } from "@/lib/db"

// ============================================================
// GET /api/guilds/[id]/roles
// Fetch Discord roles for a guild
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

    // Fetch roles from Discord API
    const botToken = process.env.DISCORD_BOT_TOKEN
    if (!botToken) {
      console.error("DISCORD_BOT_TOKEN not configured")
      return NextResponse.json(
        { error: "Discord bot not configured" },
        { status: 500 }
      )
    }

    const discordResponse = await fetch(
      `https://discord.com/api/v10/guilds/${guild.discord_guild_id}/roles`,
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
        { error: "Failed to fetch Discord roles" },
        { status: discordResponse.status }
      )
    }

    const roles = await discordResponse.json()

    // Filter out @everyone role and managed roles (bot roles)
    // Also sort by position (higher roles first)
    const filteredRoles = roles
      .filter((role: any) => {
        // Exclude @everyone role
        if (role.id === guild.discord_guild_id) return false

        // Exclude managed roles (bot roles, integration roles)
        if (role.managed) return false

        // Exclude dangerous roles with admin permissions
        // Permission bit 0x8 = ADMINISTRATOR
        if ((role.permissions & 0x8) !== 0) return false

        return true
      })
      .sort((a: any, b: any) => b.position - a.position)
      .map((role: any) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
        managed: role.managed,
        mentionable: role.mentionable,
        permissions: role.permissions,
      }))

    return NextResponse.json({
      success: true,
      roles: filteredRoles,
      count: filteredRoles.length,
      guild_id: guild.discord_guild_id,
    })
  } catch (error) {
    console.error("Error fetching Discord roles:", error)
    return NextResponse.json(
      { error: "Failed to fetch Discord roles" },
      { status: 500 }
    )
  }
}
