/**
 * /verify-member command
 *
 * Manually trigger captcha verification for a specific member
 * Useful for:
 * - Suspicious members who bypassed auto-verification
 * - Manual verification after raid protection
 * - Re-verification requests
 */

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
  GuildMember,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../types';
import { logger } from '../utils/logger';
import { getStatusColor } from '../utils/formatters';
import { createCaptchaChallenge } from '../bot-protection/services/captcha-service';
import { query } from '../utils/database';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('verify-member')
    .setDescription('Manually trigger captcha verification for a member')
    .addUserOption(option =>
      option
        .setName('member')
        .setDescription('The member to verify')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type of captcha challenge')
        .setRequired(false)
        .addChoices(
          { name: '🔢 Number (Math Problem)', value: 'number' },
          { name: '📝 Text (Question)', value: 'text' },
          { name: '🎲 Random', value: 'random' }
        )
    )
    .addStringOption(option =>
      option
        .setName('difficulty')
        .setDescription('Captcha difficulty')
        .setRequired(false)
        .addChoices(
          { name: 'Easy', value: 'easy' },
          { name: 'Medium', value: 'medium' },
          { name: 'Hard', value: 'hard' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const targetMember = interaction.options.getMember('member') as GuildMember;
      const captchaType = (interaction.options.getString('type') || 'random') as 'number' | 'text' | 'random';
      const difficulty = (interaction.options.getString('difficulty') || 'medium') as 'easy' | 'medium' | 'hard';

      if (!targetMember) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('error'))
          .setTitle('❌ Member Not Found')
          .setDescription('Could not find the specified member in this server.')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Check if member is a bot
      if (targetMember.user.bot) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('error'))
          .setTitle('❌ Cannot Verify Bot')
          .setDescription('You cannot verify bot accounts.')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Check if member is server owner
      if (targetMember.id === interaction.guild?.ownerId) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('error'))
          .setTitle('❌ Cannot Verify Server Owner')
          .setDescription('The server owner does not need verification.')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const guildId = interaction.guildId!;
      const userId = targetMember.id;

      // Check if member already has active captcha
      const activeCheck = await query(
        `SELECT id FROM captcha_verifications
         WHERE guild_id = $1 AND user_id = $2
         AND status = 'pending' AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [guildId, userId]
      );

      if (activeCheck.rowCount > 0) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('warning'))
          .setTitle('⚠️ Active Verification Exists')
          .setDescription(
            `${targetMember.user.tag} already has an active captcha verification.\n\n` +
            `Please ask them to complete it before creating a new one.`
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Generate captcha challenge
      const result = await createCaptchaChallenge(guildId, userId, {
        type: captchaType,
        difficulty,
        timeout_minutes: 10,
        max_attempts: 3,
        triggered_by: 'manual',
      });

      if (!result.success || !result.captcha) {
        throw new Error(result.error || 'Failed to create captcha');
      }

      // Send captcha to member via DM
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(getStatusColor('info'))
          .setTitle('🔐 Member Verification Required')
          .setDescription(
            `You've been asked to verify your membership in **${interaction.guild?.name}**.\n\n` +
            `Please complete the challenge below to gain access to the server.`
          )
          .addFields(
            {
              name: '📝 Challenge',
              value: `\`\`\`${result.captcha.challenge}\`\`\``,
              inline: false,
            },
            {
              name: '⏱️ Time Limit',
              value: '10 minutes',
              inline: true,
            },
            {
              name: '🎯 Attempts',
              value: '3',
              inline: true,
            }
          )
          .setFooter({ text: 'Reply with your answer to this message' })
          .setTimestamp();

        await targetMember.send({ embeds: [dmEmbed] });

        // Log audit event
        await query(
          `INSERT INTO security_audit_logs (
            guild_id, event_type, event_description,
            user_id, username, actor_id, actor_username, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            guildId,
            'manual_verification',
            'Manual captcha verification triggered',
            userId,
            targetMember.user.tag,
            interaction.user.id,
            interaction.user.tag,
            JSON.stringify({
              captcha_type: result.captcha.type,
              difficulty,
              verification_id: result.verification_id,
            }),
          ]
        );

        // Success response
        const successEmbed = new EmbedBuilder()
          .setColor(getStatusColor('success'))
          .setTitle('✅ Verification Sent')
          .setDescription(
            `Captcha verification has been sent to ${targetMember.user.tag}.\n\n` +
            `**Type:** ${result.captcha.type}\n` +
            `**Difficulty:** ${difficulty}\n` +
            `**Time Limit:** 10 minutes\n` +
            `**Max Attempts:** 3\n\n` +
            `They must complete the challenge via DM to verify their membership.`
          )
          .setFooter({ text: `Verification ID: ${result.verification_id}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

        logger.info('Manual captcha verification triggered', {
          guild_id: guildId,
          target_user_id: userId,
          target_username: targetMember.user.tag,
          admin_id: interaction.user.id,
          admin_username: interaction.user.tag,
          verification_id: result.verification_id,
          type: result.captcha.type,
          difficulty,
        });
      } catch (dmError: any) {
        // Failed to send DM - member has DMs disabled
        const errorEmbed = new EmbedBuilder()
          .setColor(getStatusColor('warning'))
          .setTitle('⚠️ DM Failed')
          .setDescription(
            `Captcha was created but could not be sent to ${targetMember.user.tag}.\n\n` +
            `**Reason:** Their DMs are disabled or they have blocked the bot.\n\n` +
            `**Options:**\n` +
            `1. Ask them to enable DMs and try again\n` +
            `2. Manually verify them using a different method\n` +
            `3. Kick and ask them to rejoin with DMs enabled`
          )
          .setFooter({ text: `Verification ID: ${result.verification_id}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });

        logger.warn('Failed to send captcha DM', {
          guild_id: guildId,
          user_id: userId,
          username: targetMember.user.tag,
          error: dmError.message,
        });
      }
    } catch (error: any) {
      logger.error('Error executing verify-member command', {
        error: error.message,
        guild_id: interaction.guildId,
        user_id: interaction.user.id,
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Verification Failed')
        .setDescription(
          'Failed to create verification challenge.\n\n' +
          'Please try again in a few moments. If the problem persists, contact support.'
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
