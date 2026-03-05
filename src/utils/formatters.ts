/**
 * Utility functions for formatting data for Discord display
 */

/**
 * Format SAGE token amount from wei (18 decimals)
 */
export function formatSageAmount(weiAmount: string): string {
  try {
    const amount = BigInt(weiAmount);
    const decimals = 18n;
    const divisor = 10n ** decimals;

    const integerPart = amount / divisor;
    const fractionalPart = amount % divisor;

    // Format with commas for thousands
    const formattedInteger = integerPart.toLocaleString('en-US');

    // Show up to 2 decimal places
    if (fractionalPart === 0n) {
      return `${formattedInteger} SAGE`;
    }

    const fractionalStr = fractionalPart.toString().padStart(Number(decimals), '0');
    const trimmedFractional = fractionalStr.slice(0, 2);

    return `${formattedInteger}.${trimmedFractional} SAGE`;
  } catch (error) {
    return '0 SAGE';
  }
}

/**
 * Format duration in seconds to human-readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  } else if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
}

/**
 * Format Starknet address for display (truncated)
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format timestamp to Discord timestamp
 */
export function formatTimestamp(isoString: string, style: 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R' = 'R'): string {
  const timestamp = Math.floor(new Date(isoString).getTime() / 1000);
  return `<t:${timestamp}:${style}>`;
}

/**
 * Get emoji for job status
 */
export function getJobStatusEmoji(status: string): string {
  const emojiMap: Record<string, string> = {
    'pending': '⏳',
    'running': '🔄',
    'completed': '✅',
    'failed': '❌'
  };
  return emojiMap[status] || '❓';
}

/**
 * Get emoji for worker status
 */
export function getWorkerStatusEmoji(status: string): string {
  const emojiMap: Record<string, string> = {
    'active': '🟢',
    'inactive': '🟡',
    'slashed': '🔴'
  };
  return emojiMap[status] || '⚪';
}

/**
 * Get color for embed based on status
 */
export function getStatusColor(status: string): number {
  const colorMap: Record<string, number> = {
    'success': 0x00ff00,  // Green
    'pending': 0xffaa00,  // Orange
    'error': 0xff0000,    // Red
    'info': 0x0099ff      // Blue
  };
  return colorMap[status] || 0x808080; // Gray default
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(1)}%`;
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Get tier emoji
 */
export function getTierEmoji(tier?: string): string {
  const emojiMap: Record<string, string> = {
    'bronze': '🥉',
    'silver': '🥈',
    'gold': '🥇',
    'diamond': '💎'
  };
  return tier ? emojiMap[tier] || '' : '';
}
