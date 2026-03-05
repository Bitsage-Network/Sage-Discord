import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { apiClient } from '../utils/api-client';
import { formatDuration, formatNumber, formatPercentage, getStatusColor } from '../utils/formatters';
import { logger } from '../utils/logger';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View BitSage Network statistics'),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const stats = await apiClient.getNetworkStats();

      const successRate = formatPercentage(stats.completed_jobs, stats.total_jobs);
      const failureRate = formatPercentage(stats.failed_jobs, stats.total_jobs);

      const embed = new EmbedBuilder()
        .setColor(getStatusColor('info'))
        .setTitle('📊 BitSage Network Statistics')
        .setDescription('Real-time network performance metrics')
        .addFields(
          {
            name: '👥 Workers',
            value: [
              `**Total**: ${formatNumber(stats.total_workers)}`,
              `**Active**: ${formatNumber(stats.active_workers)} (${formatPercentage(stats.active_workers, stats.total_workers)})`
            ].join('\n'),
            inline: true
          },
          {
            name: '⚙️ Jobs',
            value: [
              `**Total**: ${formatNumber(stats.total_jobs)}`,
              `**Completed**: ${formatNumber(stats.completed_jobs)}`,
              `**Pending**: ${formatNumber(stats.pending_jobs)}`,
              `**Failed**: ${formatNumber(stats.failed_jobs)}`
            ].join('\n'),
            inline: true
          },
          {
            name: '📈 Performance',
            value: [
              `**Success Rate**: ${successRate}`,
              `**Failure Rate**: ${failureRate}`,
              `**Avg Job Time**: ${formatDuration(stats.average_job_duration_seconds)}`
            ].join('\n'),
            inline: true
          },
          {
            name: '🔐 Proofs Generated',
            value: `**${formatNumber(stats.total_proofs_generated)}** ZK proofs`,
            inline: true
          },
          {
            name: '⏱️ Network Uptime',
            value: formatDuration(stats.network_uptime_seconds),
            inline: true
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: true
          }
        )
        .setFooter({ text: 'BitSage Network • Decentralized Compute' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      logger.info(`Stats command executed by ${interaction.user.tag}`);
    } catch (error) {
      logger.error('Error executing stats command', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Error')
        .setDescription(error instanceof Error ? error.message : 'Failed to fetch network statistics')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
