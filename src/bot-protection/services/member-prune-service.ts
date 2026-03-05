/**
 * BitSage Discord Bot - Member Pruning Service
 *
 * Automatically removes unverified members after a configurable timeout
 */

import { Client, Guild, GuildMember, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger';
import { getStatusColor } from '../../utils/formatters';
import { query } from '../../utils/database';

// ============================================================
// Types
// ============================================================

interface PruneCandidate {
  guild_id: string;
  user_id: string;
  joined_at: Date;
  hours_since_join: number;
  timeout_hours: number;
  send_dm: boolean;
}

interface PruneConfig {
  prune_unverified_enabled: boolean;
  prune_timeout_hours: number;
  prune_send_dm: boolean;
}

interface PruneResult {
  total_checked: number;
  sent_warnings: number;
  removed_members: number;
  errors: number;
}

// ============================================================
// Constants
// ============================================================

const PRUNE_INTERVAL = 15 * 60 * 1000; // Run every 15 minutes
const WARNING_HOURS = 1; // Warn 1 hour before pruning

// ============================================================
// Main Pruning Logic
// ============================================================

/**
 * Find unverified members who need to be pruned
 */
async function findPruneCandidates(): Promise<PruneCandidate[]> {
  try {
    const result = await query(
      `SELECT
        mvs.guild_id,
        mvs.user_id,
        mvs.joined_at,
        EXTRACT(EPOCH FROM (NOW() - mvs.joined_at)) / 3600 AS hours_since_join,
        gbc.prune_timeout_hours AS timeout_hours,
        gbc.prune_send_dm AS send_dm
      FROM member_verification_status mvs
      JOIN guild_bot_protection_config gbc ON mvs.guild_id = gbc.guild_id
      WHERE mvs.is_verified = FALSE
        AND mvs.is_kicked = FALSE
        AND gbc.prune_unverified_enabled = TRUE
        AND EXTRACT(EPOCH FROM (NOW() - mvs.joined_at)) / 3600 >= gbc.prune_timeout_hours
      ORDER BY mvs.joined_at ASC`
    );

    return result.rows.map(row => ({
      guild_id: row.guild_id,
      user_id: row.user_id,
      joined_at: row.joined_at,
      hours_since_join: parseFloat(row.hours_since_join),
      timeout_hours: row.timeout_hours,
      send_dm: row.send_dm,
    }));
  } catch (error: any) {
    logger.error('Failed to find prune candidates', {
      error: error.message,
    });
    return [];
  }
}

/**
 * Find members who need a warning (approaching prune timeout)
 */
async function findWarningCandidates(): Promise<PruneCandidate[]> {
  try {
    const result = await query(
      `SELECT
        mvs.guild_id,
        mvs.user_id,
        mvs.joined_at,
        EXTRACT(EPOCH FROM (NOW() - mvs.joined_at)) / 3600 AS hours_since_join,
        gbc.prune_timeout_hours AS timeout_hours,
        gbc.prune_send_dm AS send_dm
      FROM member_verification_status mvs
      JOIN guild_bot_protection_config gbc ON mvs.guild_id = gbc.guild_id
      WHERE mvs.is_verified = FALSE
        AND mvs.is_kicked = FALSE
        AND gbc.prune_unverified_enabled = TRUE
        AND gbc.prune_send_dm = TRUE
        AND EXTRACT(EPOCH FROM (NOW() - mvs.joined_at)) / 3600 >= (gbc.prune_timeout_hours - ${WARNING_HOURS})
        AND EXTRACT(EPOCH FROM (NOW() - mvs.joined_at)) / 3600 < gbc.prune_timeout_hours
        AND mvs.prune_warning_sent = FALSE
      ORDER BY mvs.joined_at ASC`
    );

    return result.rows.map(row => ({
      guild_id: row.guild_id,
      user_id: row.user_id,
      joined_at: row.joined_at,
      hours_since_join: parseFloat(row.hours_since_join),
      timeout_hours: row.timeout_hours,
      send_dm: row.send_dm,
    }));
  } catch (error: any) {
    logger.error('Failed to find warning candidates', {
      error: error.message,
    });
    return [];
  }
}

/**
 * Send warning DM to member before pruning
 */
async function sendPruneWarning(
  member: GuildMember,
  hoursRemaining: number
): Promise<boolean> {
  try {
    const embed = new EmbedBuilder()
      .setColor(getStatusColor('warning'))
      .setTitle('⚠️ Verification Required')
      .setDescription(
        `You have not completed verification for **${member.guild.name}**.\n\n` +
        `If you don't verify within the next **${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}**, ` +
        `you will be automatically removed from the server.`
      )
      .addFields(
        {
          name: '🔐 How to Verify',
          value: 'Check your DMs for the verification challenge, or ask a server admin for help.',
          inline: false,
        },
        {
          name: '⏱️ Time Remaining',
          value: `**${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}**`,
          inline: false,
        }
      )
      .setFooter({ text: 'This is an automated message' })
      .setTimestamp();

    await member.send({ embeds: [embed] });

    // Mark warning as sent
    await query(
      `UPDATE member_verification_status
       SET prune_warning_sent = TRUE, updated_at = NOW()
       WHERE guild_id = $1 AND user_id = $2`,
      [member.guild.id, member.id]
    );

    logger.info('Prune warning sent', {
      guild_id: member.guild.id,
      user_id: member.id,
      username: member.user.tag,
      hours_remaining: hoursRemaining,
    });

    return true;
  } catch (error: any) {
    logger.warn('Failed to send prune warning', {
      guild_id: member.guild.id,
      user_id: member.id,
      error: error.message,
    });
    return false;
  }
}

/**
 * Send final notification before kicking
 */
async function sendFinalNotification(member: GuildMember): Promise<void> {
  try {
    const embed = new EmbedBuilder()
      .setColor(getStatusColor('error'))
      .setTitle('❌ Removed from Server')
      .setDescription(
        `You have been removed from **${member.guild.name}** due to not completing verification.\n\n` +
        `This helps keep the server safe from spam and bots.`
      )
      .addFields({
        name: '🔄 Want to Rejoin?',
        value: 'You can rejoin the server and complete verification at any time.',
        inline: false,
      })
      .setFooter({ text: 'This is an automated message' })
      .setTimestamp();

    await member.send({ embeds: [embed] });

    logger.info('Final notification sent before prune', {
      guild_id: member.guild.id,
      user_id: member.id,
      username: member.user.tag,
    });
  } catch (error: any) {
    // DM might fail, not critical
    logger.debug('Failed to send final notification', {
      guild_id: member.guild.id,
      user_id: member.id,
      error: error.message,
    });
  }
}

/**
 * Remove (kick) an unverified member
 */
async function pruneMember(
  member: GuildMember,
  sendNotification: boolean
): Promise<boolean> {
  try {
    // Send final notification if enabled
    if (sendNotification) {
      await sendFinalNotification(member);
    }

    // Kick member
    await member.kick('Unverified - Auto-pruned by bot protection');

    // Update database
    await query(
      `UPDATE member_verification_status
       SET is_kicked = TRUE,
           kick_reason = 'Auto-pruned (unverified)',
           kicked_at = NOW(),
           updated_at = NOW()
       WHERE guild_id = $1 AND user_id = $2`,
      [member.guild.id, member.id]
    );

    // Log to audit table
    await query(
      `INSERT INTO security_audit_logs (
        guild_id, user_id, action, details, performed_by
      ) VALUES ($1, $2, 'member_pruned', $3, 'system')`,
      [
        member.guild.id,
        member.id,
        JSON.stringify({
          username: member.user.tag,
          joined_at: member.joinedAt?.toISOString(),
          reason: 'unverified_timeout',
        }),
      ]
    );

    logger.info('Member pruned', {
      guild_id: member.guild.id,
      user_id: member.id,
      username: member.user.tag,
    });

    return true;
  } catch (error: any) {
    logger.error('Failed to prune member', {
      guild_id: member.guild.id,
      user_id: member.id,
      error: error.message,
    });
    return false;
  }
}

// ============================================================
// Scheduled Task
// ============================================================

/**
 * Run the pruning task
 */
async function runPruneTask(client: Client): Promise<PruneResult> {
  const result: PruneResult = {
    total_checked: 0,
    sent_warnings: 0,
    removed_members: 0,
    errors: 0,
  };

  try {
    // Find candidates for warnings
    const warningCandidates = await findWarningCandidates();

    for (const candidate of warningCandidates) {
      result.total_checked++;

      try {
        const guild = await client.guilds.fetch(candidate.guild_id);
        const member = await guild.members.fetch(candidate.user_id);

        const hoursRemaining = Math.max(
          1,
          Math.floor(candidate.timeout_hours - candidate.hours_since_join)
        );

        const warned = await sendPruneWarning(member, hoursRemaining);
        if (warned) {
          result.sent_warnings++;
        }
      } catch (error: any) {
        logger.warn('Error processing warning candidate', {
          guild_id: candidate.guild_id,
          user_id: candidate.user_id,
          error: error.message,
        });
        result.errors++;
      }
    }

    // Find candidates for pruning
    const pruneCandidates = await findPruneCandidates();

    for (const candidate of pruneCandidates) {
      result.total_checked++;

      try {
        const guild = await client.guilds.fetch(candidate.guild_id);
        const member = await guild.members.fetch(candidate.user_id);

        const pruned = await pruneMember(member, candidate.send_dm);
        if (pruned) {
          result.removed_members++;
        }
      } catch (error: any) {
        logger.warn('Error processing prune candidate', {
          guild_id: candidate.guild_id,
          user_id: candidate.user_id,
          error: error.message,
        });
        result.errors++;
      }
    }

    if (result.removed_members > 0 || result.sent_warnings > 0) {
      logger.info('Prune task completed', result);
    }
  } catch (error: any) {
    logger.error('Prune task failed', {
      error: error.message,
    });
  }

  return result;
}

/**
 * Start the member pruning scheduler
 */
export function startMemberPruningScheduler(client: Client): NodeJS.Timeout {
  logger.info('Starting member pruning scheduler', {
    interval: `${PRUNE_INTERVAL / 1000 / 60} minutes`,
    warning_hours: WARNING_HOURS,
  });

  // Run immediately on startup
  setTimeout(() => runPruneTask(client), 30000); // Wait 30s for bot to be ready

  // Run periodically
  const interval = setInterval(() => runPruneTask(client), PRUNE_INTERVAL);

  return interval;
}

/**
 * Stop the member pruning scheduler
 */
export function stopMemberPruningScheduler(interval: NodeJS.Timeout): void {
  clearInterval(interval);
  logger.info('Member pruning scheduler stopped');
}

/**
 * Manually run the pruning task (for testing or admin commands)
 */
export async function runManualPrune(client: Client): Promise<PruneResult> {
  logger.info('Running manual prune task');
  return await runPruneTask(client);
}

// ============================================================
// Exports
// ============================================================

export default {
  startMemberPruningScheduler,
  stopMemberPruningScheduler,
  runManualPrune,
};
