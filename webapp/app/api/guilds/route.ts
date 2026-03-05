import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

// POST /api/guilds - Create a new guild
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { name, slug, description, twitter_url, website_url, discord_guild_id } =
      body;

    // Validation
    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      );
    }

    // Validate slug format (lowercase, alphanumeric, hyphens only)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        {
          error:
            "Invalid slug format. Use lowercase letters, numbers, and hyphens only.",
        },
        { status: 400 }
      );
    }

    // Check if slug already exists
    const existingGuild = await pool.query(
      "SELECT id FROM guilds WHERE slug = $1",
      [slug]
    );

    if (existingGuild.rows.length > 0) {
      return NextResponse.json(
        { error: "This URL slug is already taken. Please choose another." },
        { status: 409 }
      );
    }

    // Insert new guild
    const result = await pool.query(
      `INSERT INTO guilds (name, slug, description, twitter_url, website_url, discord_guild_id, owner_discord_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, name, slug, description, twitter_url, website_url, discord_guild_id, is_public, created_at`,
      [
        name,
        slug,
        description || null,
        twitter_url || null,
        website_url || null,
        discord_guild_id || null,
        session.user.discordId,
      ]
    );

    const newGuild = result.rows[0];

    // Create default home page for the guild
    await pool.query(
      `INSERT INTO guild_pages (guild_id, slug, title, content, icon, order_index, is_published, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        newGuild.id,
        "home",
        "Welcome",
        JSON.stringify({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: `Welcome to ${name}! Edit this page to customize your guild.`,
                },
              ],
            },
          ],
        }),
        "🏠",
        0,
        true,
      ]
    );

    // Add creator as guild member with admin privileges
    await pool.query(
      `INSERT INTO guild_members (guild_id, discord_user_id, is_admin, is_verified, joined_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [newGuild.id, session.user.discordId, true, true]
    );

    // Create free subscription for the guild
    await pool.query(
      `INSERT INTO subscriptions (guild_id, plan_tier, verified_member_limit, features, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [
        newGuild.id,
        "free",
        100,
        JSON.stringify(["basic_token_gating"]),
        "active",
      ]
    );

    // Log analytics event
    await pool.query(
      `INSERT INTO analytics_events (guild_id, event_type, event_data, user_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        newGuild.id,
        "guild_created",
        JSON.stringify({ guild_name: name, slug }),
        session.user.discordId,
      ]
    );

    return NextResponse.json(newGuild, { status: 201 });
  } catch (error: any) {
    console.error("Error creating guild:", error);
    return NextResponse.json(
      { error: "Failed to create guild. Please try again." },
      { status: 500 }
    );
  }
}

// GET /api/guilds - List guilds for authenticated user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized - Please login" },
        { status: 401 }
      );
    }

    // Fetch guilds where user is owner or member
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
        g.owner_discord_id,
        g.created_at,
        g.updated_at,
        gm.is_admin,
        (SELECT COUNT(*) FROM guild_members WHERE guild_id = g.id) as member_count,
        (SELECT COUNT(*) FROM token_gating_rules WHERE guild_ref_id = g.id) as role_count
      FROM guilds g
      LEFT JOIN guild_members gm ON g.id = gm.guild_id AND gm.discord_user_id = $1
      WHERE g.owner_discord_id = $1 OR gm.discord_user_id = $1
      ORDER BY g.created_at DESC`,
      [session.user.discordId]
    );

    return NextResponse.json(result.rows, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching guilds:", error);
    return NextResponse.json(
      { error: "Failed to fetch guilds. Please try again." },
      { status: 500 }
    );
  }
}
