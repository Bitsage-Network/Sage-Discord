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

    // Get stats (these queries are approximations - adjust based on your actual schema)
    const [
      totalUsersResult,
      avgLevelResult,
      totalXPResult,
      achievementsResult,
      questsResult,
      activeUsersResult
    ] = await Promise.all([
      // Total users
      query(
        `SELECT COUNT(*) as count FROM discord_users WHERE verified = true`,
        []
      ),
      // Average level
      query(
        `SELECT AVG(level) as avg_level FROM discord_users WHERE verified = true`,
        []
      ),
      // Total XP earned
      query(
        `SELECT SUM(xp) as total_xp FROM discord_users WHERE verified = true`,
        []
      ),
      // Achievements earned
      query(
        `SELECT COUNT(*) as count FROM gamification_user_achievements gua
         JOIN gamification_achievements ga ON gua.achievement_id = ga.id
         WHERE ga.guild_id = $1`,
        [guildId]
      ),
      // Quests completed
      query(
        `SELECT COUNT(*) as count FROM gamification_user_quests guq
         JOIN gamification_quests gq ON guq.quest_id = gq.id
         WHERE gq.guild_id = $1 AND guq.completed = true`,
        [guildId]
      ),
      // Active users (messaged in last 7 days)
      query(
        `SELECT COUNT(*) as count FROM discord_users
         WHERE verified = true
         AND last_message_at > NOW() - INTERVAL '7 days'`,
        []
      )
    ]);

    const stats = {
      total_users: parseInt(totalUsersResult.rows[0]?.count || 0),
      avg_level: parseFloat(avgLevelResult.rows[0]?.avg_level || 0),
      total_xp_earned: parseInt(totalXPResult.rows[0]?.total_xp || 0),
      achievements_earned: parseInt(achievementsResult.rows[0]?.count || 0),
      quests_completed: parseInt(questsResult.rows[0]?.count || 0),
      active_users_7d: parseInt(activeUsersResult.rows[0]?.count || 0)
    };

    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error('Error fetching gamification stats:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
