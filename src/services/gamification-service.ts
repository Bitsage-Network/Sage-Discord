import { query } from '../utils/database';
import { logger } from '../utils/logger';
import {
  DiscordUser,
  XPGainResult,
  Achievement,
  XP_CONFIG,
  calculateLevel
} from '../types/gamification';

/**
 * Gamification Service
 * Handles XP, levels, daily rewards, and achievements
 */

/**
 * Get or create a user
 */
export async function getOrCreateUser(userId: string, username: string): Promise<DiscordUser> {
  try {
    // Try to get existing user
    const result = await query(
      'SELECT * FROM discord_users WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length > 0) {
      return result.rows[0] as DiscordUser;
    }

    // Create new user
    const insertResult = await query(
      `INSERT INTO discord_users (user_id, username, xp, level)
       VALUES ($1, $2, 0, 1)
       RETURNING *`,
      [userId, username]
    );

    logger.info(`New user created: ${username} (${userId})`);
    return insertResult.rows[0] as DiscordUser;
  } catch (error) {
    logger.error('Error getting/creating user', { userId, error });
    throw error;
  }
}

/**
 * Add XP to a user
 */
export async function addXP(
  userId: string,
  username: string,
  xpAmount: number
): Promise<XPGainResult> {
  try {
    const user = await getOrCreateUser(userId, username);
    const oldLevel = user.level;
    const newTotalXP = user.xp + xpAmount;
    const newLevel = calculateLevel(newTotalXP);

    // Update user XP and level
    await query(
      `UPDATE discord_users
       SET xp = $1, level = $2, updated_at = NOW()
       WHERE user_id = $3`,
      [newTotalXP, newLevel, userId]
    );

    const leveledUp = newLevel > oldLevel;

    // Check for achievements if leveled up
    const achievements: Achievement[] = [];
    if (leveledUp) {
      logger.info(`User ${username} leveled up: ${oldLevel} → ${newLevel}`);
      // TODO: Check and unlock level-based achievements
    }

    return {
      xp_gained: xpAmount,
      new_total_xp: newTotalXP,
      old_level: oldLevel,
      new_level: newLevel,
      leveled_up: leveledUp,
      achievements_unlocked: achievements
    };
  } catch (error) {
    logger.error('Error adding XP', { userId, xpAmount, error });
    throw error;
  }
}

/**
 * Award XP for sending a message (with cooldown)
 */
export async function awardMessageXP(
  userId: string,
  username: string,
  channelId: string
): Promise<XPGainResult | null> {
  try {
    // Check cooldown
    const cooldownResult = await query(
      `SELECT last_xp_at FROM message_xp
       WHERE user_id = $1 AND channel_id = $2`,
      [userId, channelId]
    );

    const now = new Date();
    if (cooldownResult.rows.length > 0) {
      const lastXP = new Date((cooldownResult.rows[0] as { last_xp_at: Date }).last_xp_at);
      const secondsSince = (now.getTime() - lastXP.getTime()) / 1000;

      if (secondsSince < XP_CONFIG.MESSAGE_COOLDOWN_SECONDS) {
        // Still on cooldown
        return null;
      }
    }

    // Award XP
    const result = await addXP(userId, username, XP_CONFIG.MESSAGE_XP);

    // Update message XP tracking
    await query(
      `INSERT INTO message_xp (user_id, channel_id, message_count, xp_earned, last_xp_at)
       VALUES ($1, $2, 1, $3, NOW())
       ON CONFLICT (user_id, channel_id)
       DO UPDATE SET
         message_count = message_xp.message_count + 1,
         xp_earned = message_xp.xp_earned + $3,
         last_xp_at = NOW()`,
      [userId, channelId, XP_CONFIG.MESSAGE_XP]
    );

    // Increment total messages
    await query(
      `UPDATE discord_users
       SET total_messages = total_messages + 1,
           last_message_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );

    return result;
  } catch (error) {
    logger.error('Error awarding message XP', { userId, channelId, error });
    throw error;
  }
}

/**
 * Claim daily reward
 */
export async function claimDailyReward(
  userId: string,
  username: string
): Promise<{ success: boolean; xp_earned?: number; streak?: number; message?: string }> {
  try {
    const user = await getOrCreateUser(userId, username);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if already claimed today
    const claimCheck = await query(
      `SELECT * FROM daily_claims
       WHERE user_id = $1 AND claim_date = $2`,
      [userId, today]
    );

    if (claimCheck.rows.length > 0) {
      return {
        success: false,
        message: 'You already claimed your daily reward today! Come back tomorrow.'
      };
    }

    // Calculate streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const yesterdayClaim = await query(
      `SELECT * FROM daily_claims
       WHERE user_id = $1 AND claim_date = $2`,
      [userId, yesterdayStr]
    );

    let newStreak: number;
    if (yesterdayClaim.rows.length > 0) {
      // Continuing streak
      newStreak = user.daily_streak + 1;
    } else {
      // Broken streak or first time
      newStreak = 1;
    }

    // Calculate XP with streak bonus
    const baseXP = XP_CONFIG.DAILY_CLAIM_BASE_XP;
    const streakMultiplier = Math.min(
      1 + (newStreak - 1) * (XP_CONFIG.STREAK_BONUS_MULTIPLIER - 1),
      XP_CONFIG.MAX_STREAK_MULTIPLIER
    );
    const totalXP = Math.floor(baseXP * streakMultiplier);

    // Update user streak
    await query(
      `UPDATE discord_users
       SET daily_streak = $1,
           longest_streak = GREATEST(longest_streak, $1),
           last_daily_claim = NOW()
       WHERE user_id = $2`,
      [newStreak, userId]
    );

    // Award XP
    await addXP(userId, username, totalXP);

    // Record claim
    await query(
      `INSERT INTO daily_claims (user_id, claim_date, xp_earned, streak_day, claimed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, today, totalXP, newStreak]
    );

    logger.info(`Daily reward claimed: ${username} - ${totalXP} XP (${newStreak} day streak)`);

    return {
      success: true,
      xp_earned: totalXP,
      streak: newStreak
    };
  } catch (error) {
    logger.error('Error claiming daily reward', { userId, error });
    throw error;
  }
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: string): Promise<DiscordUser | null> {
  try {
    const result = await query(
      'SELECT * FROM discord_users WHERE user_id = $1',
      [userId]
    );

    return result.rows.length > 0 ? result.rows[0] as DiscordUser : null;
  } catch (error) {
    logger.error('Error getting user profile', { userId, error });
    throw error;
  }
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(type: 'xp' | 'streak' | 'reputation', limit: number = 10) {
  try {
    let orderBy: string;
    switch (type) {
      case 'xp':
        orderBy = 'xp DESC, level DESC';
        break;
      case 'streak':
        orderBy = 'daily_streak DESC, longest_streak DESC';
        break;
      case 'reputation':
        orderBy = 'reputation DESC, helpful_votes DESC';
        break;
    }

    const result = await query(
      `SELECT user_id, username, xp, level, daily_streak, longest_streak, reputation, helpful_votes
       FROM discord_users
       WHERE ${type === 'xp' ? 'xp' : type === 'streak' ? 'daily_streak' : 'reputation'} > 0
       ORDER BY ${orderBy}
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  } catch (error) {
    logger.error('Error getting leaderboard', { type, error });
    throw error;
  }
}
