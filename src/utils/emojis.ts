/**
 * Emoji Utilities for Rich Bot Responses
 */

// Status Emojis
export const STATUS = {
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  LOADING: '⏳',
  PENDING: '🔄',
  ONLINE: '🟢',
  IDLE: '🟡'
};

// Level & Progress
export const PROGRESS = {
  LEVEL_UP: '⬆️',
  XP: '✨',
  STAR: '⭐',
  TROPHY: '🏆',
  MEDAL: '🎖️',
  CROWN: '👑',
  GEM: '💎',
  CHECKMARK: '✅',
  ROCKET: '🚀',
  TARGET: '🎯',
  HOURGLASS: '⏳',
  FIRST: '🥇',
  SPARKLES: '✨'
};

// Actions
export const ACTIONS = {
  VERIFY: '🔐',
  LINK: '🔗',
  SEND: '📤',
  RECEIVE: '📥',
  MONEY: '💰',
  COIN: '🪙',
  CHART: '📊',
  CLOCK: '🕐',
  LEARN: '📚',
  HELP: '❓',
  CHAT: '💬'
};

// Social
export const SOCIAL = {
  WAVE: '👋',
  PARTY: '🎉',
  CONFETTI: '🎊',
  FIRE: '🔥',
  HEART: '❤️',
  THUMBS_UP: '👍',
  CLAP: '👏',
  CELEBRATE: '🥳',
  SPEECH: '💬'
};

// Network
export const NETWORK = {
  ROBOT: '🤖',
  COMPUTER: '💻',
  SERVER: '🖥️',
  GEAR: '⚙️',
  TOOLS: '🛠️',
  ZAP: '⚡',
  ROCKET: '🚀',
  SATELLITE: '🛰️',
  LINK: '🔗'
};

// Gamification
export const GAME = {
  DICE: '🎲',
  TARGET: '🎯',
  GIFT: '🎁',
  CALENDAR: '📅',
  STREAK: '🔥',
  BADGE: '🏅',
  LOCK: '🔒',
  UNLOCK: '🔓'
};

// Tier Emojis
export const TIER = {
  BRONZE: '🥉',
  SILVER: '🥈',
  GOLD: '🥇',
  DIAMOND: '💎',
  PLATINUM: '🏆'
};

// Rarity (for achievements)
export const RARITY = {
  COMMON: '⚪',
  RARE: '🔵',
  EPIC: '🟣',
  LEGENDARY: '🟡'
};

// Numbers
export const NUMBERS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

// Progress Bar
export function createProgressBar(current: number, total: number, length: number = 10): string {
  const percentage = Math.min(current / total, 1);
  const filled = Math.floor(percentage * length);
  const empty = length - filled;

  return '▓'.repeat(filled) + '░'.repeat(empty);
}

// Format with emoji
export function formatWithEmoji(type: string, value: string | number): string {
  switch (type) {
    case 'xp':
      return `${PROGRESS.XP} ${value} XP`;
    case 'level':
      return `${PROGRESS.LEVEL_UP} Level ${value}`;
    case 'streak':
      return `${GAME.STREAK} ${value} day streak`;
    case 'success':
      return `${STATUS.SUCCESS} ${value}`;
    case 'error':
      return `${STATUS.ERROR} ${value}`;
    case 'info':
      return `${STATUS.INFO} ${value}`;
    default:
      return String(value);
  }
}

// Celebration message
export function celebrationMessage(type: 'level_up' | 'achievement' | 'streak' | 'daily'): string {
  const celebrations = {
    level_up: `${PROGRESS.LEVEL_UP}${SOCIAL.PARTY}${SOCIAL.CONFETTI}`,
    achievement: `${PROGRESS.TROPHY}${SOCIAL.CELEBRATE}${PROGRESS.MEDAL}`,
    streak: `${GAME.STREAK}${SOCIAL.FIRE}${GAME.STREAK}`,
    daily: `${GAME.CALENDAR}${GAME.GIFT}${SOCIAL.PARTY}`
  };

  return celebrations[type] || SOCIAL.PARTY;
}

// Get tier emoji by stake amount (in SAGE tokens)
export function getTierEmojiByStake(stakeAmount: number): string {
  if (stakeAmount >= 10000) return TIER.DIAMOND;
  if (stakeAmount >= 5000) return TIER.GOLD;
  if (stakeAmount >= 1000) return TIER.SILVER;
  if (stakeAmount >= 100) return TIER.BRONZE;
  return '';
}

// Get rarity emoji
export function getRarityEmoji(rarity: 'common' | 'rare' | 'epic' | 'legendary'): string {
  return RARITY[rarity.toUpperCase() as keyof typeof RARITY] || RARITY.COMMON;
}
