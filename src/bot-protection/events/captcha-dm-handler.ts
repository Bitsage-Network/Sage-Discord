/**
 * BitSage Discord Bot - Captcha DM Handler
 *
 * Handles Direct Messages from users answering captcha challenges
 */

import { Client, Message, EmbedBuilder, GuildMember } from 'discord.js';
import { logger } from '../../utils/logger';
import { getStatusColor } from '../../utils/formatters';
import { getActiveCaptcha, verifyCaptchaAnswer } from '../services/captcha-service';
import { query } from '../../utils/database';

/**
 * Handle incoming DM messages for captcha verification
 */
export async function handleCaptchaDM(message: Message): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  // Only process DMs
  if (message.guild) return;

  try {
    const userId = message.author.id;
    const userAnswer = message.content.trim();

    // Get all active captcha verifications for this user across all guilds
    const result = await query(
      `SELECT cv.*, gbpc.guild_id
       FROM captcha_verifications cv
       LEFT JOIN guild_bot_protection_config gbpc ON cv.guild_id = gbpc.guild_id
       WHERE cv.user_id = $1
       AND cv.status = 'pending'
       AND cv.expires_at > NOW()
       ORDER BY cv.created_at DESC`,
      [userId]
    );

    if (result.rowCount === 0) {
      // No active captcha
      const embed = new EmbedBuilder()
        .setColor(getStatusColor('info'))
        .setTitle('ℹ️ No Active Verification')
        .setDescription(
          `You don't have any active captcha verifications.\n\n` +
          `If you were asked to verify, the challenge may have expired.\n` +
          `Please ask a server administrator to send you a new verification.`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // Process the most recent captcha
    const verification = result.rows[0];
    const verificationId = verification.id;
    const guildId = verification.guild_id;

    // Verify the answer
    const verifyResult = await verifyCaptchaAnswer(verificationId, userAnswer);

    if (verifyResult.passed) {
      // ✅ Correct answer! Mark member as verified
      await markMemberVerified(guildId, userId, verificationId);

      const successEmbed = new EmbedBuilder()
        .setColor(getStatusColor('success'))
        .setTitle('✅ Verification Complete!')
        .setDescription(
          `Congratulations! You have successfully completed the verification.\n\n` +
          `You now have access to the server. Welcome! 🎉`
        )
        .setTimestamp();

      await message.reply({ embeds: [successEmbed] });

      logger.info('Member verified via captcha DM', {
        user_id: userId,
        username: message.author.tag,
        guild_id: guildId,
        verification_id: verificationId,
      });
    } else if (verifyResult.should_kick) {
      // ❌ Failed - kick member
      await kickUnverifiedMember(guildId, userId, 'Failed captcha verification');

      const failedEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Verification Failed')
        .setDescription(
          `${verifyResult.message}\n\n` +
          `You have been removed from the server due to failed verification.\n\n` +
          `If you believe this was a mistake, please contact a server administrator.`
        )
        .setTimestamp();

      await message.reply({ embeds: [failedEmbed] });

      logger.warn('Member kicked for failed captcha', {
        user_id: userId,
        username: message.author.tag,
        guild_id: guildId,
        verification_id: verificationId,
      });
    } else {
      // ⚠️ Wrong answer, but has more attempts
      const retryEmbed = new EmbedBuilder()
        .setColor(getStatusColor('warning'))
        .setTitle('⚠️ Incorrect Answer')
        .setDescription(
          `${verifyResult.message}\n\n` +
          `**Challenge:** ${verification.challenge}\n\n` +
          `Please try again.`
        )
        .setFooter({ text: `Attempts remaining: ${verifyResult.attempts_remaining}` })
        .setTimestamp();

      await message.reply({ embeds: [retryEmbed] });
    }
  } catch (error: any) {
    logger.error('Error handling captcha DM', {
      error: error.message,
      user_id: message.author.id,
      username: message.author.tag,
    });

    const errorEmbed = new EmbedBuilder()
      .setColor(getStatusColor('error'))
      .setTitle('❌ Error')
      .setDescription(
        'An error occurred while processing your verification.\n\n' +
        'Please contact a server administrator for assistance.'
      )
      .setTimestamp();

    await message.reply({ embeds: [errorEmbed] }).catch(() => {});
  }
}

/**
 * Mark member as verified and assign verified role
 */
async function markMemberVerified(guildId: string, userId: string, verificationId: number): Promise<void> {
  try {
    // Get bot client
    const client = require('../../index').client as Client;
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);

    // Update member verification status
    await query(
      `INSERT INTO member_verification_status (
        guild_id, user_id, is_verified, verification_method, verified_at
      ) VALUES ($1, $2, TRUE, 'captcha', NOW())
      ON CONFLICT (guild_id, user_id) DO UPDATE
      SET is_verified = TRUE,
          verification_method = 'captcha',
          verified_at = NOW(),
          updated_at = NOW()`,
      [guildId, userId]
    );

    // Get guild config
    const configResult = await query(
      `SELECT * FROM guild_bot_protection_config WHERE guild_id = $1`,
      [guildId]
    );

    if (configResult.rowCount > 0) {
      const config = configResult.rows[0];

      // Assign verified role if configured
      if (config.auto_assign_verified_role && config.verified_role_id) {
        try {
          const verifiedRole = await guild.roles.fetch(config.verified_role_id);
          if (verifiedRole) {
            await member.roles.add(verifiedRole);
            logger.info('Assigned verified role', {
              guild_id: guildId,
              user_id: userId,
              role_id: config.verified_role_id,
            });
          }
        } catch (roleError: any) {
          logger.error('Failed to assign verified role', {
            error: roleError.message,
            guild_id: guildId,
            user_id: userId,
          });
        }
      }

      // Remove waiting room role if configured
      if (config.waiting_room_enabled && config.waiting_room_role_id) {
        try {
          const waitingRoomRole = await guild.roles.fetch(config.waiting_room_role_id);
          if (waitingRoomRole && member.roles.cache.has(config.waiting_room_role_id)) {
            await member.roles.remove(waitingRoomRole);
            logger.info('Removed waiting room role', {
              guild_id: guildId,
              user_id: userId,
              role_id: config.waiting_room_role_id,
            });
          }
        } catch (roleError: any) {
          logger.error('Failed to remove waiting room role', {
            error: roleError.message,
            guild_id: guildId,
            user_id: userId,
          });
        }
      }
    }

    // Log audit event
    await query(
      `INSERT INTO security_audit_logs (
        guild_id, event_type, event_description,
        user_id, username, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        guildId,
        'captcha_passed',
        'Member passed captcha verification',
        userId,
        member.user.tag,
        JSON.stringify({ verification_id: verificationId }),
      ]
    );
  } catch (error: any) {
    logger.error('Failed to mark member as verified', {
      error: error.message,
      guild_id: guildId,
      user_id: userId,
    });
    throw error;
  }
}

/**
 * Kick unverified member from server
 */
async function kickUnverifiedMember(guildId: string, userId: string, reason: string): Promise<void> {
  try {
    // Get bot client
    const client = require('../../index').client as Client;
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);

    // Update member status
    await query(
      `UPDATE member_verification_status
       SET is_kicked = TRUE,
           kick_reason = $1,
           kicked_at = NOW(),
           updated_at = NOW()
       WHERE guild_id = $2 AND user_id = $3`,
      [reason, guildId, userId]
    );

    // Kick member
    await member.kick(reason);

    // Log audit event
    await query(
      `INSERT INTO security_audit_logs (
        guild_id, event_type, event_description,
        user_id, username, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        guildId,
        'member_kicked',
        'Member kicked for failed verification',
        userId,
        member.user.tag,
        JSON.stringify({ reason }),
      ]
    );

    logger.info('Member kicked for failed verification', {
      guild_id: guildId,
      user_id: userId,
      username: member.user.tag,
      reason,
    });
  } catch (error: any) {
    logger.error('Failed to kick unverified member', {
      error: error.message,
      guild_id: guildId,
      user_id: userId,
    });
    // Don't throw - member might have already left
  }
}

/**
 * Register the DM handler with the Discord client
 */
export function registerCaptchaDMHandler(client: Client): void {
  client.on('messageCreate', async (message) => {
    await handleCaptchaDM(message);
  });

  logger.info('Captcha DM handler registered');
}

export default {
  handleCaptchaDM,
  registerCaptchaDMHandler,
};
