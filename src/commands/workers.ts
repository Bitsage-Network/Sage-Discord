import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { apiClient } from '../utils/api-client';
import { formatAddress, formatSageAmount, formatTimestamp, getWorkerStatusEmoji, getStatusColor } from '../utils/formatters';
import { logger } from '../utils/logger';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('workers')
    .setDescription('View active workers or get information about a specific worker')
    .addStringOption(option =>
      option
        .setName('address')
        .setDescription('Worker address (optional - leave empty to see all workers)')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const address = interaction.options.getString('address');

      if (address) {
        // Get specific worker
        const worker = await apiClient.getWorker(address);

        const embed = new EmbedBuilder()
          .setColor(getStatusColor('info'))
          .setTitle(`🤖 Worker: ${formatAddress(worker.address)}`)
          .setDescription(`**Status**: ${getWorkerStatusEmoji(worker.status)} ${worker.status.toUpperCase()}`)
          .addFields(
            {
              name: '📊 Performance',
              value: [
                `**Jobs Completed**: ${worker.jobs_completed}`,
                `**Reputation Score**: ${worker.reputation_score}/1000`
              ].join('\n'),
              inline: true
            },
            {
              name: '💰 Earnings',
              value: `**Total**: ${formatSageAmount(worker.total_earnings)}`,
              inline: true
            }
          )
          .setFooter({ text: `Address: ${worker.address}` })
          .setTimestamp();

        if (worker.gpu_model) {
          embed.addFields({
            name: '🖥️ Hardware',
            value: worker.gpu_model,
            inline: true
          });
        }

        if (worker.last_heartbeat) {
          embed.addFields({
            name: '💓 Last Heartbeat',
            value: formatTimestamp(worker.last_heartbeat),
            inline: true
          });
        }

        await interaction.editReply({ embeds: [embed] });
        logger.info(`Workers command executed for ${address} by ${interaction.user.tag}`);
      } else {
        // Get all workers
        const workers = await apiClient.getWorkers();

        if (workers.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(getStatusColor('info'))
            .setTitle('👥 Active Workers')
            .setDescription('No workers currently registered in the network.')
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          return;
        }

        const activeWorkers = workers.filter(w => w.status === 'active');
        const inactiveWorkers = workers.filter(w => w.status === 'inactive');
        const slashedWorkers = workers.filter(w => w.status === 'slashed');

        const workersList = workers.slice(0, 10).map(w =>
          `${getWorkerStatusEmoji(w.status)} \`${formatAddress(w.address)}\` - ${w.jobs_completed} jobs, Score: ${w.reputation_score}`
        ).join('\n');

        const embed = new EmbedBuilder()
          .setColor(getStatusColor('info'))
          .setTitle('👥 BitSage Workers')
          .setDescription(`**Total Workers**: ${workers.length}\n\n${workersList}`)
          .addFields(
            {
              name: '🟢 Active',
              value: String(activeWorkers.length),
              inline: true
            },
            {
              name: '🟡 Inactive',
              value: String(inactiveWorkers.length),
              inline: true
            },
            {
              name: '🔴 Slashed',
              value: String(slashedWorkers.length),
              inline: true
            }
          )
          .setFooter({ text: 'Showing top 10 workers • Use /workers <address> for details' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        logger.info(`Workers list command executed by ${interaction.user.tag}`);
      }
    } catch (error) {
      logger.error('Error executing workers command', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Error')
        .setDescription(error instanceof Error ? error.message : 'Failed to fetch worker information')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
