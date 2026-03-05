import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { query } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; questId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guildId = params.id;
    const questId = params.questId;
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
      'title', 'description', 'emoji', 'quest_type',
      'requirement_type', 'requirement_value', 'requirement_data',
      'xp_reward', 'role_reward_id', 'nft_reward_campaign_id',
      'active', 'featured', 'start_date', 'end_date', 'reset_frequency', 'position'
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

    updateValues.push(questId);
    updateValues.push(guildId);

    const result = await query(
      `UPDATE gamification_quests
       SET ${updateFields.join(', ')}
       WHERE id = $${paramCount} AND guild_id = $${paramCount + 1}
       RETURNING *`,
      updateValues
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, quest: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating quest:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; questId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const guildId = params.id;
    const questId = params.questId;

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

    // Delete quest
    const result = await query(
      `DELETE FROM gamification_quests
       WHERE id = $1 AND guild_id = $2
       RETURNING id`,
      [questId, guildId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting quest:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
