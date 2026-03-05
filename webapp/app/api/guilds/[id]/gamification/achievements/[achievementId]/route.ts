import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; achievementId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guildId = params.id;
    const achievementId = params.achievementId;
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

    // Build update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    const allowedFields = [
      'name', 'description', 'emoji', 'category', 'rarity', 'hidden',
      'xp_reward', 'role_reward_id', 'nft_reward_campaign_id',
      'requirement_type', 'requirement_value', 'requirement_data',
      'position', 'active'
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        updateValues.push(body[field]);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updateValues.push(achievementId);
    updateValues.push(guildId);

    const result = await query(
      `UPDATE gamification_achievements
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount} AND guild_id = $${paramCount + 1}
       RETURNING *`,
      updateValues
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, achievement: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating achievement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; achievementId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guildId = params.id;
    const achievementId = params.achievementId;

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

    // Delete achievement
    const result = await query(
      `DELETE FROM gamification_achievements
       WHERE id = $1 AND guild_id = $2
       RETURNING id`,
      [achievementId, guildId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting achievement:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
