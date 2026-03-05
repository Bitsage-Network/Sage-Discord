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
    if (!session || !session.user?.id) {
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

    // Get achievements
    const result = await query(
      `SELECT * FROM gamification_achievements
       WHERE guild_id = $1
       ORDER BY position ASC, created_at DESC`,
      [guildId]
    );

    return NextResponse.json({ success: true, achievements: result.rows });
  } catch (error: any) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
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
    if (!body.name || !body.requirement_type || body.requirement_value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate unique key from name
    const key = body.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Create achievement
    const result = await query(
      `INSERT INTO gamification_achievements (
        guild_id, key, name, description, emoji, category, rarity, hidden,
        xp_reward, role_reward_id, nft_reward_campaign_id,
        requirement_type, requirement_value, requirement_data, position
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        guildId,
        key,
        body.name,
        body.description || null,
        body.emoji || '🏆',
        body.category || 'custom',
        body.rarity || 'common',
        body.hidden || false,
        body.xp_reward || 0,
        body.role_reward_id || null,
        body.nft_reward_campaign_id || null,
        body.requirement_type,
        body.requirement_value,
        body.requirement_data || null,
        body.position || 0
      ]
    );

    return NextResponse.json({ success: true, achievement: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating achievement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
