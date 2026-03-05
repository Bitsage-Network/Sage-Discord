import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { apiClient } from '../utils/api-client';
import { formatAddress, formatSageAmount, formatTimestamp, getStatusColor } from '../utils/formatters';
import { logger } from '../utils/logger';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rewards')
    .setDescription('Check rewards information for an address')
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

      // Validate address format
      if (!address.startsWith('0x')) {
        throw new Error('Invalid Starknet address. Address must start with 0x');
      }

      const rewardInfo = await apiClient.getRewards(address);

      const embed = new EmbedBuilder()
        .setColor(getStatusColor('info'))
        .setTitle(`🎁 Rewards: ${formatAddress(rewardInfo.address)}`)
        .addFields(
          {
            name: '💰 Pending Rewards',
            value: formatSageAmount(rewardInfo.pending_rewards),
            inline: true
          },
          {
            name: '✅ Claimed Rewards',
            value: formatSageAmount(rewardInfo.claimed_rewards),
            inline: true
          }
        )
        .setFooter({ text: `Address: ${rewardInfo.address}` })
        .setTimestamp();

      if (rewardInfo.next_claim_available_at) {
        embed.addFields({
          name: '⏰ Next Claim Available',
          value: formatTimestamp(rewardInfo.next_claim_available_at),
          inline: false
        });
      }

      // Calculate total rewards
      const totalRewards = BigInt(rewardInfo.pending_rewards) + BigInt(rewardInfo.claimed_rewards);
      embed.addFields({
        name: '📊 Total Rewards',
        value: formatSageAmount(totalRewards.toString()),
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });
      logger.info(`Rewards command executed for ${formatAddress(address)} by ${interaction.user.tag}`);
    } catch (error) {
      logger.error('Error executing rewards command', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Error')
        .setDescription(error instanceof Error ? error.message : 'Failed to fetch rewards information')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
