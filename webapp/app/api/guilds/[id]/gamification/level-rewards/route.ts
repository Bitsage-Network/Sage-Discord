import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guildId = params.id;

    // Check authorization
    const guildCheck = await query(
      `SELECT owner_discord_id FROM guilds WHERE id = $1`,
      [guildId]
    );

    if (guildCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
    }

    const isOwner = guildCheck.rows[0].owner_discord_id === session.user.discordId;
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get level rewards
    const result = await query(
      `SELECT * FROM gamification_level_rewards
       WHERE guild_id = $1
       ORDER BY level ASC`,
      [guildId]
    );

    return NextResponse.json({ success: true, rewards: result.rows });
  } catch (error: any) {
    console.error('Error fetching level rewards:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guildId = params.id;
    const body = await req.json();

    // Check authorization
    const guildCheck = await query(
      `SELECT owner_discord_id FROM guilds WHERE id = $1`,
      [guildId]
    );

    if (guildCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Guild not found' }, { status: 404 });
    }

    const isOwner = guildCheck.rows[0].owner_discord_id === session.user.discordId;
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate required fields
    if (!body.level) {
      return NextResponse.json({ error: 'Level is required' }, { status: 400 });
    }

    // Check if level reward already exists
    const existing = await query(
      `SELECT id FROM gamification_level_rewards
       WHERE guild_id = $1 AND level = $2`,
      [guildId, body.level]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Reward for this level already exists' }, { status: 409 });
    }

    // Create level reward
    const result = await query(
      `INSERT INTO gamification_level_rewards (
        guild_id, level, role_id, xp_bonus,
        achievement_id, nft_reward_campaign_id, custom_message, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        guildId,
        body.level,
        body.role_id || null,
        body.xp_bonus || 0,
        body.achievement_id || null,
        body.nft_reward_campaign_id || null,
        body.custom_message || null,
        body.active ?? true
      ]
    );

    return NextResponse.json({ success: true, reward: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating level reward:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
