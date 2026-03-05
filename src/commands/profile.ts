import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { getUserProfile, getOrCreateUser } from '../services/gamification-service';
import { getLevelInfo } from '../types/gamification';
import { createProgressBar } from '../utils/emojis';
import * as EMOJI from '../utils/emojis';
import { logger } from '../utils/logger';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your BitSage profile and stats')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('User to view profile for (optional)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const userId = targetUser.id;
      const username = targetUser.username;

      // Get or create user
      let user = await getUserProfile(userId);
      if (!user) {
        user = await getOrCreateUser(userId, username);
      }

      const levelInfo = getLevelInfo(user.xp);
      const progressBar = createProgressBar(
        user.xp - levelInfo.xp_for_current_level,
        levelInfo.xp_for_next_level - levelInfo.xp_for_current_level,
        20
      );

      const embed = new EmbedBuilder()
        .setColor(0x00aaff)
        .setTitle(`${EMOJI.NETWORK.ROBOT} ${username}'s Profile`)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          {
            name: `${EMOJI.PROGRESS.LEVEL_UP} Level`,
            value: `**Level ${user.level}**`,
            inline: true
          },
          {
            name: `${EMOJI.PROGRESS.XP} Total XP`,
            value: `**${user.xp.toLocaleString()} XP**`,
            inline: true
          },
          {
            name: `${EMOJI.SOCIAL.WAVE} Messages`,
            value: `**${user.total_messages.toLocaleString()}**`,
            inline: true
          },
          {
            name: '\u200B',
            value: `**Progress to Level ${user.level + 1}**\n${progressBar}\n${user.xp - levelInfo.xp_for_current_level}/${levelInfo.xp_for_next_level - levelInfo.xp_for_current_level} XP (${Math.floor(levelInfo.xp_progress)}%)`,
            inline: false
          }
        );

      // Add streak if active
      if (user.daily_streak > 0) {
        embed.addFields({
          name: `${EMOJI.GAME.STREAK} Daily Streak`,
          value: `**${user.daily_streak} days** (Best: ${user.longest_streak})`,
          inline: true
        });
      }

      // Add reputation if any
      if (user.reputation > 0 || user.helpful_votes > 0) {
        embed.addFields({
          name: `${EMOJI.PROGRESS.STAR} Reputation`,
          value: `**${user.reputation}** (${user.helpful_votes} helpful votes)`,
          inline: true
        });
      }

      // Add verified status
      if (user.verified) {
        embed.addFields({
          name: `${EMOJI.ACTIONS.VERIFY} Verification`,
          value: user.wallet_address
            ? `Verified ${EMOJI.STATUS.SUCCESS}\n\`${user.wallet_address.slice(0, 10)}...${user.wallet_address.slice(-8)}\``
            : `Verified ${EMOJI.STATUS.SUCCESS}`,
          inline: false
        });
      }

      embed.setFooter({
        text: `Member since ${new Date(user.created_at).toLocaleDateString()}`
      });
      embed.setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      logger.info(`Profile viewed: ${username} (${userId})`);
    } catch (error) {
      logger.error('Error executing profile command', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${EMOJI.STATUS.ERROR} Error`)
        .setDescription('Failed to load profile. Please try again later.')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
