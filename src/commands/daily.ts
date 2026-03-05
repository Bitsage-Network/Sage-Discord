import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { claimDailyReward } from '../services/gamification-service';
import { celebrationMessage } from '../utils/emojis';
import * as EMOJI from '../utils/emojis';
import { logger } from '../utils/logger';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward and maintain your streak!'),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const userId = interaction.user.id;
      const username = interaction.user.username;

      const result = await claimDailyReward(userId, username);

      if (!result.success) {
        // Already claimed
        const embed = new EmbedBuilder()
          .setColor(0xffa500) // Orange
          .setTitle(`${EMOJI.GAME.CALENDAR} Daily Reward`)
          .setDescription(result.message || 'You\'ve already claimed your daily reward!')
          .setFooter({ text: 'Come back tomorrow for your next reward!' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Success!
      const isNewStreak = result.streak === 1;
      const celebration = celebrationMessage('daily');

      const embed = new EmbedBuilder()
        .setColor(0x00ff00) // Green
        .setTitle(`${celebration} Daily Reward Claimed!`)
        .setDescription(
          isNewStreak
            ? `Welcome back! Start a new streak today!`
            : `Amazing! You're on a **${result.streak} day streak!** ${EMOJI.GAME.STREAK}`
        )
        .addFields(
          {
            name: `${EMOJI.PROGRESS.XP} XP Earned`,
            value: `**+${result.xp_earned} XP**`,
            inline: true
          },
          {
            name: `${EMOJI.GAME.STREAK} Current Streak`,
            value: `**${result.streak} days**`,
            inline: true
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true
          }
        )
        .setFooter({
          text: result.streak && result.streak >= 7
            ? 'Incredible dedication! Keep it going!'
            : 'Come back tomorrow to continue your streak!'
        })
        .setTimestamp();

      // Add streak milestone messages
      if (result.streak === 7) {
        embed.addFields({
          name: `${EMOJI.PROGRESS.TROPHY} Milestone Reached!`,
          value: '7 day streak! You\'re dedicated to the BitSage community!'
        });
      } else if (result.streak === 30) {
        embed.addFields({
          name: `${EMOJI.PROGRESS.CROWN} Epic Milestone!`,
          value: '30 day streak! You\'re a true BitSage legend!'
        });
      } else if (result.streak === 100) {
        embed.addFields({
          name: `${EMOJI.PROGRESS.GEM} LEGENDARY STREAK!`,
          value: '100 DAYS! You are unstoppable!'
        });
      }

      await interaction.editReply({ embeds: [embed] });
      logger.info(`Daily reward claimed: ${username} (${userId}) - ${result.streak} day streak`);
    } catch (error) {
      logger.error('Error executing daily command', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${EMOJI.STATUS.ERROR} Error`)
        .setDescription('Failed to claim daily reward. Please try again later.')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
