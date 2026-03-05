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

    // Get or create gamification config
    let configResult = await query(
      `SELECT * FROM gamification_config WHERE guild_id = $1`,
      [guildId]
    );

    if (configResult.rows.length === 0) {
      // Create default config
      configResult = await query(
        `INSERT INTO gamification_config (guild_id)
         VALUES ($1)
         RETURNING *`,
        [guildId]
      );
    }

    return NextResponse.json({
      success: true,
      config: configResult.rows[0]
    });
  } catch (error: any) {
    console.error('Error fetching gamification config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
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

    // Update config
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    const allowedFields = [
      'message_xp',
      'message_cooldown_seconds',
      'daily_claim_base_xp',
      'streak_bonus_multiplier',
      'max_streak_multiplier',
      'level_curve_type',
      'level_curve_base',
      'level_curve_multiplier',
      'level_curve_custom_formula',
      'level_up_announcement',
      'level_up_channel_id',
      'level_up_dm',
      'achievements_enabled',
      'quests_enabled',
      'daily_rewards_enabled',
      'leaderboard_enabled'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        updateValues.push(body[field]);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updateValues.push(guildId);

    const result = await query(
      `UPDATE gamification_config
       SET ${updateFields.join(', ')}
       WHERE guild_id = $${paramCount}
       RETURNING *`,
      updateValues
    );

    if (result.rows.length === 0) {
      // Create if doesn't exist
      const createResult = await query(
        `INSERT INTO gamification_config (guild_id)
         VALUES ($1)
         RETURNING *`,
        [guildId]
      );
      return NextResponse.json({ success: true, config: createResult.rows[0] });
    }

    return NextResponse.json({ success: true, config: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating gamification config:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
