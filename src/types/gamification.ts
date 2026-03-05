/**
 * Gamification Type Definitions
 */

export interface DiscordUser {
  user_id: string;
  username: string;
  discriminator?: string;
  wallet_address?: string;
  language: string;

  // Gamification
  xp: number;
  level: number;
  total_messages: number;

  // Streaks
  daily_streak: number;
  longest_streak: number;
  last_daily_claim?: Date;
  last_message_at?: Date;

  // Reputation
  reputation: number;
  helpful_votes: number;

  // Status
  verified: boolean;
  verified_at?: Date;
  onboarding_completed: boolean;
  onboarding_step: number;

  // Metadata
  created_at: Date;
  updated_at: Date;
}

export interface Achievement {
  id: number;
  key: string;
  name: string;
  description?: string;
  emoji?: string;
  category: 'first_steps' | 'network' | 'social' | 'special';
  xp_reward: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  hidden: boolean;
  requirement_type: string;
  requirement_value: number;
  created_at: Date;
}

export interface UserAchievement {
  user_id: string;
  achievement_id: number;
  earned_at: Date;
  achievement?: Achievement;
}

export interface Quest {
  id: number;
  title: string;
  description?: string;
  emoji?: string;
  quest_type: 'daily' | 'weekly' | 'one_time' | 'tutorial';
  xp_reward: number;
  requirement_type: string;
  requirement_value: number;
  requirement_data?: any;
  active: boolean;
  start_date?: Date;
  end_date?: Date;
  created_at: Date;
}

export interface UserQuest {
  user_id: string;
  quest_id: number;
  progress: number;
  completed: boolean;
  started_at: Date;
  completed_at?: Date;
  quest?: Quest;
}

export interface DailyClaim {
  user_id: string;
  claim_date: Date;
  xp_earned: number;
  streak_day: number;
  bonus_applied: boolean;
  claimed_at: Date;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  value: number; // xp, streak, reputation, etc.
  level?: number;
}

export interface XPGainResult {
  xp_gained: number;
  new_total_xp: number;
  old_level: number;
  new_level: number;
  leveled_up: boolean;
  achievements_unlocked: Achievement[];
}

export interface LevelInfo {
  current_level: number;
  current_xp: number;
  xp_for_current_level: number;
  xp_for_next_level: number;
  xp_progress: number; // percentage
  xp_remaining: number;
}

// XP Configuration
export const XP_CONFIG = {
  MESSAGE_XP: 5,
  MESSAGE_COOLDOWN_SECONDS: 60, // 1 minute between XP gains
  DAILY_CLAIM_BASE_XP: 50,
  STREAK_BONUS_MULTIPLIER: 1.1, // 10% bonus per streak day (capped)
  MAX_STREAK_MULTIPLIER: 2.0, // Max 2x XP from streaks
  LEVEL_UP_ANNOUNCEMENT: true,
  XP_PER_LEVEL: 100 // Base XP needed for each level
};

// Level calculation: level = floor(sqrt(xp / 100)) + 1
export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / XP_CONFIG.XP_PER_LEVEL)) + 1;
}

export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * XP_CONFIG.XP_PER_LEVEL;
}

export function getLevelInfo(xp: number): LevelInfo {
  const current_level = calculateLevel(xp);
  const xp_for_current = xpForLevel(current_level);
  const xp_for_next = xpForLevel(current_level + 1);
  const xp_progress_in_level = xp - xp_for_current;
  const xp_needed_for_level = xp_for_next - xp_for_current;

  return {
    current_level,
    current_xp: xp,
    xp_for_current_level: xp_for_current,
    xp_for_next_level: xp_for_next,
    xp_progress: (xp_progress_in_level / xp_needed_for_level) * 100,
    xp_remaining: xp_for_next - xp
  };
}

// Rarity colors
export const RARITY_COLORS = {
  common: 0x808080, // Gray
  rare: 0x0099ff, // Blue
  epic: 0x9b59b6, // Purple
  legendary: 0xf1c40f // Gold
};

// Rarity emojis
export const RARITY_EMOJIS = {
  common: '⚪',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟡'
};
