import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { apiClient } from '../utils/api-client';
import { formatAddress, formatSageAmount, getTierEmoji, getStatusColor } from '../utils/formatters';
import { logger } from '../utils/logger';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('View wallet/validator information')
    .addStringOption(option =>
      option
        .setName('address')
        .setDescription('Starknet wallet address')
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const address = interaction.options.getString('address', true);

      // Validate address format (basic check)
      if (!address.startsWith('0x')) {
        throw new Error('Invalid Starknet address. Address must start with 0x');
      }

      const walletInfo = await apiClient.getWalletInfo(address);

      const embed = new EmbedBuilder()
        .setColor(getStatusColor('info'))
        .setTitle(`💼 Wallet: ${formatAddress(walletInfo.address)}`)
        .setDescription([
          `**Type**: ${walletInfo.is_worker ? '🤖 Worker' : '👤 User'}`,
          walletInfo.tier ? `**Tier**: ${getTierEmoji(walletInfo.tier)} ${walletInfo.tier.toUpperCase()}` : ''
        ].filter(Boolean).join('\n'))
        .addFields(
          {
            name: '🔒 Staked',
            value: formatSageAmount(walletInfo.staked_amount),
            inline: true
          },
          {
            name: '⭐ Reputation',
            value: `${walletInfo.reputation_score}/1000`,
            inline: true
          },
          {
            name: '⚙️ Jobs Completed',
            value: String(walletInfo.jobs_completed),
            inline: true
          },
          {
            name: '💰 Total Earned',
            value: formatSageAmount(walletInfo.total_earned),
            inline: true
          },
          {
            name: '🎁 Pending Rewards',
            value: formatSageAmount(walletInfo.pending_rewards),
            inline: true
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true
          }
        )
        .setFooter({ text: `Address: ${walletInfo.address}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      logger.info(`Wallet command executed for ${formatAddress(address)} by ${interaction.user.tag}`);
    } catch (error) {
      logger.error('Error executing wallet command', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Error')
        .setDescription(error instanceof Error ? error.message : 'Failed to fetch wallet information')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
