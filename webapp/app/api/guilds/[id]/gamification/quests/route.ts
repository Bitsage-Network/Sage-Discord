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

    // Get quests
    const result = await query(
      `SELECT * FROM gamification_quests
       WHERE guild_id = $1
       ORDER BY featured DESC, position ASC, created_at DESC`,
      [guildId]
    );

    return NextResponse.json({ success: true, quests: result.rows });
  } catch (error: any) {
    console.error('Error fetching quests:', error);
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
    if (!body.title || !body.quest_type || !body.requirement_type || body.requirement_value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create quest
    const result = await query(
      `INSERT INTO gamification_quests (
        guild_id, title, description, emoji, quest_type,
        requirement_type, requirement_value, requirement_data,
        xp_reward, role_reward_id, nft_reward_campaign_id,
        active, featured, start_date, end_date, reset_frequency, position
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        guildId,
        body.title,
        body.description || null,
        body.emoji || '🎯',
        body.quest_type,
        body.requirement_type,
        body.requirement_value,
        body.requirement_data || null,
        body.xp_reward || 0,
        body.role_reward_id || null,
        body.nft_reward_campaign_id || null,
        body.active ?? true,
        body.featured || false,
        body.start_date || null,
        body.end_date || null,
        body.reset_frequency || null,
        body.position || 0
      ]
    );

    return NextResponse.json({ success: true, quest: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating quest:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
