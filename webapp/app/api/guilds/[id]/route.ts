import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

// GET /api/guilds/[id] - Get guild details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const { id } = params;

    // Fetch guild details
    const result = await pool.query(
      `SELECT
        g.id,
        g.name,
        g.slug,
        g.description,
        g.logo_url,
        g.banner_url,
        g.twitter_url,
        g.website_url,
        g.discord_guild_id,
        g.is_public,
        g.theme,
        g.owner_discord_id,
        g.created_at,
        g.updated_at,
        gm.is_admin,
        (SELECT COUNT(*) FROM guild_members WHERE guild_id = g.id) as member_count,
        (SELECT COUNT(*) FROM token_gating_rules WHERE guild_ref_id = g.id) as role_count,
        (SELECT COUNT(*) FROM guild_pages WHERE guild_id = g.id) as page_count
      FROM guilds g
      LEFT JOIN guild_members gm ON g.id = gm.guild_id AND gm.discord_user_id = $2
      WHERE g.id = $1`,
      [id, session.user.discordId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Guild not found" }, { status: 404 });
    }

    const guild = result.rows[0];

    // Check if user has access (owner or member)
    if (
      guild.owner_discord_id !== session.user.discordId &&
      !guild.is_admin
    ) {
      return NextResponse.json(
        { error: "You do not have access to this guild" },
        { status: 403 }
      );
    }

    return NextResponse.json(guild, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching guild:", error);
    return NextResponse.json(
      { error: "Failed to fetch guild. Please try again." },
      { status: 500 }
    );
  }
}

// PATCH /api/guilds/[id] - Update guild
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await req.json();

    // Check if user is owner or admin
    const guildCheck = await pool.query(
      `SELECT g.owner_discord_id, gm.is_admin
       FROM guilds g
       LEFT JOIN guild_members gm ON g.id = gm.guild_id AND gm.discord_user_id = $2
       WHERE g.id = $1`,
      [id, session.user.discordId]
    );

    if (guildCheck.rows.length === 0) {
      return NextResponse.json({ error: "Guild not found" }, { status: 404 });
    }

    const guild = guildCheck.rows[0];
    const isOwner = guild.owner_discord_id === session.user.discordId;
    const isAdmin = guild.is_admin === true;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to update this guild" },
        { status: 403 }
      );
    }

    // Build update query dynamically based on provided fields
    const allowedFields = [
      "name",
      "slug",
      "description",
      "logo_url",
      "banner_url",
      "twitter_url",
      "website_url",
      "discord_guild_id",
      "is_public",
      "theme",
    ];

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "slug") {
          // Validate slug format
          const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
          if (!slugRegex.test(body[field])) {
            return NextResponse.json(
              {
                error:
                  "Invalid slug format. Use lowercase letters, numbers, and hyphens only.",
              },
              { status: 400 }
            );
          }

          // Check if slug is already taken by another guild
          const existingGuild = await pool.query(
            "SELECT id FROM guilds WHERE slug = $1 AND id != $2",
            [body[field], id]
          );

          if (existingGuild.rows.length > 0) {
            return NextResponse.json(
              {
                error: "This URL slug is already taken. Please choose another.",
              },
              { status: 409 }
            );
          }
        }

        updates.push(`${field} = $${paramIndex}`);
        values.push(field === "theme" ? JSON.stringify(body[field]) : body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `UPDATE guilds SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`;

    const result = await pool.query(query, values);

    // Log analytics event
    await pool.query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        id,
        "guild_updated",
        JSON.stringify({ updated_fields: Object.keys(body) }),
        session.user.discordId,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error: any) {
    console.error("Error updating guild:", error);
    return NextResponse.json(
      { error: "Failed to update guild. Please try again." },
      { status: 500 }
    );
  }
}

// DELETE /api/guilds/[id] - Delete guild
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const { id } = params;

    // Check if user is owner (only owner can delete)
    const guildCheck = await pool.query(
      `SELECT owner_discord_id, name FROM guilds WHERE id = $1`,
      [id]
    );

    if (guildCheck.rows.length === 0) {
      return NextResponse.json({ error: "Guild not found" }, { status: 404 });
    }

    const guild = guildCheck.rows[0];

    if (guild.owner_discord_id !== session.user.discordId) {
      return NextResponse.json(
        { error: "Only the guild owner can delete the guild" },
        { status: 403 }
      );
    }

    // Delete guild (CASCADE will delete related records)
    await pool.query(`DELETE FROM guilds WHERE id = $1`, [id]);

    // Log analytics event (note: guild_id will be orphaned, but that's ok for historical data)
    await pool.query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        id,
        "guild_deleted",
        JSON.stringify({ guild_name: guild.name }),
        session.user.discordId,
      ]
    );

    return NextResponse.json(
      { message: "Guild deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting guild:", error);
    return NextResponse.json(
      { error: "Failed to delete guild. Please try again." },
      { status: 500 }
    );
  }
}
