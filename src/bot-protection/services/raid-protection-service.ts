/**
 * BitSage Discord Bot - Raid Protection Service
 *
 * Detects and prevents spam raids using join rate monitoring
 * and suspicious pattern detection
 */

import { Client, Guild, GuildMember, EmbedBuilder, TextChannel, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger';
import { getStatusColor } from '../../utils/formatters';
import { query } from '../../utils/database';

// ============================================================
// Types
// ============================================================

interface JoinEvent {
  guild_id: string;
  user_id: string;
  username: string;
  account_age_days: number;
  has_avatar: boolean;
  joined_at: Date;
}

interface RaidDetectionResult {
  is_raid: boolean;
  confidence: number; // 0-1
  reasons: string[];
  join_rate: number; // joins per minute
  suspicious_count: number;
  should_lockdown: boolean;
}

interface GuildRaidStats {
  guild_id: string;
  total_joins: number;
  suspicious_joins: number;
  join_rate: number; // per minute
  time_window: number; // minutes
}

// ============================================================
// Constants
// ============================================================

const MONITORING_WINDOW = 5; // Monitor last 5 minutes
const RAID_THRESHOLD_JOINS = 10; // 10+ joins in 5 min = potential raid
const RAID_THRESHOLD_RATE = 2.0; // 2+ joins per minute = high alert
const SUSPICIOUS_THRESHOLD = 0.6; // 60% suspicious = likely raid

const SUSPICIOUS_ACCOUNT_AGE_DAYS = 7; // Accounts < 7 days old
const AUTO_LOCKDOWN_CONFIDENCE = 0.8; // 80% confidence triggers auto-lockdown

// ============================================================
// Join Rate Monitoring
// ============================================================

/**
 * Record a member join event
 */
export async function recordJoinEvent(member: GuildMember): Promise<void> {
  try {
    const accountAge = Date.now() - member.user.createdTimestamp;
    const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
    const hasAvatar = member.user.avatar !== null;

    await query(
      `INSERT INTO join_rate_events (
        guild_id,
        user_id,
        username,
        account_age_days,
        has_avatar,
        discriminator,
        is_bot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        member.guild.id,
        member.id,
        member.user.username,
        accountAgeDays,
        hasAvatar,
        member.user.discriminator,
        member.user.bot,
      ]
    );

    logger.debug('Recorded join event', {
      guild_id: member.guild.id,
      user_id: member.id,
      username: member.user.tag,
      account_age_days: accountAgeDays,
      has_avatar: hasAvatar,
    });
  } catch (error: any) {
    logger.error('Failed to record join event', {
      error: error.message,
      guild_id: member.guild.id,
      user_id: member.id,
    });
  }
}

/**
 * Get join events within time window
 */
async function getRecentJoinEvents(
  guildId: string,
  windowMinutes: number = MONITORING_WINDOW
): Promise<JoinEvent[]> {
  try {
    const result = await query(
      `SELECT
        guild_id,
        user_id,
        username,
        account_age_days,
        has_avatar,
        joined_at
      FROM join_rate_events
      WHERE guild_id = $1
        AND joined_at >= NOW() - INTERVAL '${windowMinutes} minutes'
      ORDER BY joined_at DESC`,
      [guildId]
    );

    return result.rows.map(row => ({
      guild_id: row.guild_id,
      user_id: row.user_id,
      username: row.username,
      account_age_days: row.account_age_days,
      has_avatar: row.has_avatar,
      joined_at: row.joined_at,
    }));
  } catch (error: any) {
    logger.error('Failed to get recent join events', {
      error: error.message,
      guild_id: guildId,
    });
    return [];
  }
}

/**
 * Calculate join rate statistics
 */
async function calculateJoinRateStats(guildId: string): Promise<GuildRaidStats> {
  const joinEvents = await getRecentJoinEvents(guildId, MONITORING_WINDOW);

  const totalJoins = joinEvents.length;
  const suspiciousJoins = joinEvents.filter(
    event => event.account_age_days < SUSPICIOUS_ACCOUNT_AGE_DAYS || !event.has_avatar
  ).length;

  const joinRate = totalJoins / MONITORING_WINDOW;

  return {
    guild_id: guildId,
    total_joins: totalJoins,
    suspicious_joins: suspiciousJoins,
    join_rate: joinRate,
    time_window: MONITORING_WINDOW,
  };
}

// ============================================================
// Suspicious Pattern Detection
// ============================================================

/**
 * Detect suspicious patterns in join events
 */
function detectSuspiciousPatterns(joinEvents: JoinEvent[]): {
  patterns: string[];
  suspiciousCount: number;
} {
  const patterns: string[] = [];
  let suspiciousCount = 0;

  // Pattern 1: New accounts (< 7 days)
  const newAccounts = joinEvents.filter(e => e.account_age_days < SUSPICIOUS_ACCOUNT_AGE_DAYS);
  if (newAccounts.length > 0) {
    patterns.push(`${newAccounts.length} new accounts (< ${SUSPICIOUS_ACCOUNT_AGE_DAYS} days old)`);
    suspiciousCount += newAccounts.length;
  }

  // Pattern 2: No avatar
  const noAvatar = joinEvents.filter(e => !e.has_avatar);
  if (noAvatar.length > 0) {
    patterns.push(`${noAvatar.length} members without avatars`);
    suspiciousCount += noAvatar.length * 0.5; // Weight less than new accounts
  }

  // Pattern 3: Similar usernames (simple check for now)
  const usernames = joinEvents.map(e => e.username.toLowerCase());
  const uniqueUsernames = new Set(usernames);
  if (usernames.length > 5 && uniqueUsernames.size < usernames.length * 0.5) {
    patterns.push('Similar usernames detected');
    suspiciousCount += joinEvents.length * 0.3;
  }

  // Pattern 4: Rapid succession (all joins within 1 minute)
  if (joinEvents.length >= 5) {
    const timestamps = joinEvents.map(e => e.joined_at.getTime());
    const timeSpan = Math.max(...timestamps) - Math.min(...timestamps);
    const timeSpanMinutes = timeSpan / (1000 * 60);

    if (timeSpanMinutes < 1) {
      patterns.push(`${joinEvents.length} joins within 1 minute`);
      suspiciousCount += joinEvents.length * 0.5;
    }
  }

  return {
    patterns,
    suspiciousCount: Math.floor(suspiciousCount),
  };
}

/**
 * Analyze raid risk
 */
export async function analyzeRaidRisk(guildId: string): Promise<RaidDetectionResult> {
  const stats = await calculateJoinRateStats(guildId);
  const joinEvents = await getRecentJoinEvents(guildId, MONITORING_WINDOW);
  const { patterns, suspiciousCount } = detectSuspiciousPatterns(joinEvents);

  const reasons: string[] = [];
  let confidence = 0;

  // Factor 1: High join rate
  if (stats.join_rate >= RAID_THRESHOLD_RATE) {
    reasons.push(`High join rate: ${stats.join_rate.toFixed(2)} joins/min`);
    confidence += 0.3;
  } else if (stats.total_joins >= RAID_THRESHOLD_JOINS) {
    reasons.push(`Elevated join count: ${stats.total_joins} joins in ${MONITORING_WINDOW} min`);
    confidence += 0.2;
  }

  // Factor 2: Suspicious member ratio
  if (stats.total_joins > 0) {
    const suspiciousRatio = stats.suspicious_joins / stats.total_joins;
    if (suspiciousRatio >= SUSPICIOUS_THRESHOLD) {
      reasons.push(
        `High suspicious ratio: ${(suspiciousRatio * 100).toFixed(0)}% (${stats.suspicious_joins}/${stats.total_joins})`
      );
      confidence += 0.4;
    } else if (suspiciousRatio >= 0.3) {
      reasons.push(
        `Moderate suspicious ratio: ${(suspiciousRatio * 100).toFixed(0)}% (${stats.suspicious_joins}/${stats.total_joins})`
      );
      confidence += 0.2;
    }
  }

  // Factor 3: Suspicious patterns
  if (patterns.length > 0) {
    reasons.push(...patterns);
    confidence += Math.min(patterns.length * 0.1, 0.3);
  }

  // Cap confidence at 1.0
  confidence = Math.min(confidence, 1.0);

  const isRaid = confidence >= 0.5;
  const shouldLockdown = confidence >= AUTO_LOCKDOWN_CONFIDENCE;

  return {
    is_raid: isRaid,
    confidence,
    reasons,
    join_rate: stats.join_rate,
    suspicious_count: suspiciousCount,
    should_lockdown: shouldLockdown,
  };
}

// ============================================================
// Lockdown Management
// ============================================================

/**
 * Enable server lockdown
 */
export async function enableLockdown(
  guild: Guild,
  reason: string,
  performedBy: string = 'system'
): Promise<{ success: boolean; message: string }> {
  try {
    // Check if already locked down
    const statusResult = await query(
      `SELECT is_locked_down FROM guild_lockdown_status WHERE guild_id = $1`,
      [guild.id]
    );

    if (statusResult.rows[0]?.is_locked_down) {
      return {
        success: false,
        message: 'Server is already in lockdown mode',
      };
    }

    // Update lockdown status
    await query(
      `UPDATE guild_lockdown_status
       SET is_locked_down = TRUE,
           lockdown_reason = $1,
           locked_down_by = $2,
           locked_down_at = NOW(),
           updated_at = NOW()
       WHERE guild_id = $3`,
      [reason, performedBy, guild.id]
    );

    // Log to audit
    await query(
      `INSERT INTO security_audit_logs (
        guild_id, action, details, performed_by
      ) VALUES ($1, 'lockdown_enabled', $2, $3)`,
      [
        guild.id,
        JSON.stringify({ reason }),
        performedBy,
      ]
    );

    logger.warn('Server lockdown enabled', {
      guild_id: guild.id,
      guild_name: guild.name,
      reason,
      performed_by: performedBy,
    });

    return {
      success: true,
      message: `Server lockdown enabled: ${reason}`,
    };
  } catch (error: any) {
    logger.error('Failed to enable lockdown', {
      error: error.message,
      guild_id: guild.id,
    });

    return {
      success: false,
      message: `Failed to enable lockdown: ${error.message}`,
    };
  }
}

/**
 * Disable server lockdown
 */
export async function disableLockdown(
  guild: Guild,
  performedBy: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Check if locked down
    const statusResult = await query(
      `SELECT is_locked_down FROM guild_lockdown_status WHERE guild_id = $1`,
      [guild.id]
    );

    if (!statusResult.rows[0]?.is_locked_down) {
      return {
        success: false,
        message: 'Server is not in lockdown mode',
      };
    }

    // Update lockdown status
    await query(
      `UPDATE guild_lockdown_status
       SET is_locked_down = FALSE,
           lockdown_reason = NULL,
           locked_down_by = NULL,
           locked_down_at = NULL,
           updated_at = NOW()
       WHERE guild_id = $1`,
      [guild.id]
    );

    // Log to audit
    await query(
      `INSERT INTO security_audit_logs (
        guild_id, action, details, performed_by
      ) VALUES ($1, 'lockdown_disabled', $2, $3)`,
      [
        guild.id,
        JSON.stringify({ lifted_by: performedBy }),
        performedBy,
      ]
    );

    logger.info('Server lockdown disabled', {
      guild_id: guild.id,
      guild_name: guild.name,
      performed_by: performedBy,
    });

    return {
      success: true,
      message: 'Server lockdown disabled',
    };
  } catch (error: any) {
    logger.error('Failed to disable lockdown', {
      error: error.message,
      guild_id: guild.id,
    });

    return {
      success: false,
      message: `Failed to disable lockdown: ${error.message}`,
    };
  }
}

/**
 * Check if guild is in lockdown
 */
export async function isLockdownActive(guildId: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT is_locked_down FROM guild_lockdown_status WHERE guild_id = $1`,
      [guildId]
    );

    return result.rows[0]?.is_locked_down || false;
  } catch (error: any) {
    logger.error('Failed to check lockdown status', {
      error: error.message,
      guild_id: guildId,
    });
    return false;
  }
}

// ============================================================
// Alert System
// ============================================================

/**
 * Send raid alert to admins
 */
export async function sendRaidAlert(
  guild: Guild,
  raidResult: RaidDetectionResult,
  autoLockdown: boolean
): Promise<void> {
  try {
    // Find system channel or first text channel
    let alertChannel: TextChannel | null = null;

    if (guild.systemChannel && guild.systemChannel.type === ChannelType.GuildText) {
      alertChannel = guild.systemChannel as TextChannel;
    } else {
      const textChannels = guild.channels.cache.filter(
        c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me!)?.has('SendMessages')
      );

      if (textChannels.size > 0) {
        alertChannel = textChannels.first() as TextChannel;
      }
    }

    if (!alertChannel) {
      logger.warn('No channel found to send raid alert', {
        guild_id: guild.id,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(autoLockdown ? getStatusColor('error') : getStatusColor('warning'))
      .setTitle(autoLockdown ? '🚨 RAID DETECTED - AUTO-LOCKDOWN ENABLED' : '⚠️ Potential Raid Detected')
      .setDescription(
        autoLockdown
          ? `**Automatic lockdown has been enabled** due to detected raid activity.\n\n` +
            `Server is now in lockdown mode. New members will be prevented from joining.`
          : `Suspicious activity detected. Consider enabling lockdown with \`/lockdown enable\`.`
      )
      .addFields(
        {
          name: '📊 Raid Statistics',
          value:
            `**Confidence:** ${(raidResult.confidence * 100).toFixed(0)}%\n` +
            `**Join Rate:** ${raidResult.join_rate.toFixed(2)} joins/min\n` +
            `**Suspicious:** ${raidResult.suspicious_count} members`,
          inline: true,
        },
        {
          name: '🔍 Detection Reasons',
          value: raidResult.reasons.join('\n') || 'No specific reasons',
          inline: false,
        }
      )
      .setFooter({
        text: autoLockdown
          ? 'Use /lockdown disable to lift lockdown'
          : 'Use /lockdown enable to manually enable lockdown',
      })
      .setTimestamp();

    await alertChannel.send({
      content: autoLockdown ? '@here' : undefined,
      embeds: [embed],
    });

    logger.info('Raid alert sent', {
      guild_id: guild.id,
      channel_id: alertChannel.id,
      auto_lockdown: autoLockdown,
      confidence: raidResult.confidence,
    });
  } catch (error: any) {
    logger.error('Failed to send raid alert', {
      error: error.message,
      guild_id: guild.id,
    });
  }
}

// ============================================================
// Cleanup
// ============================================================

/**
 * Clean up old join events (run periodically)
 */
export async function cleanupOldJoinEvents(daysToKeep: number = 7): Promise<number> {
  try {
    const result = await query(
      `DELETE FROM join_rate_events
       WHERE joined_at < NOW() - INTERVAL '${daysToKeep} days'
       RETURNING id`,
      []
    );

    const deletedCount = result.rowCount;

    if (deletedCount > 0) {
      logger.info('Cleaned up old join events', {
        deleted_count: deletedCount,
        days_to_keep: daysToKeep,
      });
    }

    return deletedCount;
  } catch (error: any) {
    logger.error('Failed to cleanup old join events', {
      error: error.message,
    });
    return 0;
  }
}

// ============================================================
// Exports
// ============================================================

export default {
  recordJoinEvent,
  analyzeRaidRisk,
  enableLockdown,
  disableLockdown,
  isLockdownActive,
  sendRaidAlert,
  cleanupOldJoinEvents,
};
