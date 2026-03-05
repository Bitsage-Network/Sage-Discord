import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { apiClient } from '../utils/api-client';
import { formatAddress, formatSageAmount, formatTimestamp, getJobStatusEmoji, getStatusColor } from '../utils/formatters';
import { logger } from '../utils/logger';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('jobs')
    .setDescription('View recent jobs or get information about a specific job')
    .addStringOption(option =>
      option
        .setName('job_id')
        .setDescription('Job ID (optional - leave empty to see recent jobs)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('limit')
        .setDescription('Number of recent jobs to show (default: 10, max: 25)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const jobId = interaction.options.getString('job_id');

      if (jobId) {
        // Get specific job
        const job = await apiClient.getJob(jobId);

        const embed = new EmbedBuilder()
          .setColor(getStatusColor(job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'pending'))
          .setTitle(`⚙️ Job: ${job.job_id}`)
          .setDescription(`**Status**: ${getJobStatusEmoji(job.status)} ${job.status.toUpperCase()}`)
          .addFields(
            {
              name: '👤 Worker',
              value: formatAddress(job.worker_address),
              inline: true
            },
            {
              name: '🏷️ Type',
              value: job.job_type,
              inline: true
            },
            {
              name: '💰 Payment',
              value: formatSageAmount(job.payment_amount),
              inline: true
            },
            {
              name: '📅 Submitted',
              value: formatTimestamp(job.submitted_at),
              inline: true
            }
          )
          .setFooter({ text: `Job ID: ${job.job_id}` })
          .setTimestamp();

        if (job.completed_at) {
          embed.addFields({
            name: '✅ Completed',
            value: formatTimestamp(job.completed_at),
            inline: true
          });
        }

        if (job.proof_hash) {
          embed.addFields({
            name: '🔐 Proof Hash',
            value: `\`${formatAddress(job.proof_hash)}\``,
            inline: true
          });
        }

        await interaction.editReply({ embeds: [embed] });
        logger.info(`Jobs command executed for ${jobId} by ${interaction.user.tag}`);
      } else {
        // Get recent jobs
        const limit = interaction.options.getInteger('limit') || 10;
        const jobs = await apiClient.getJobs(limit);

        if (jobs.length === 0) {
          const embed = new EmbedBuilder()
            .setColor(getStatusColor('info'))
            .setTitle('⚙️ Recent Jobs')
            .setDescription('No jobs found in the network.')
            .setTimestamp();

          await interaction.editReply({ embeds: [embed] });
          return;
        }

        const jobsList = jobs.map(job =>
          `${getJobStatusEmoji(job.status)} \`${job.job_id.slice(0, 8)}...\` - ${job.job_type} by \`${formatAddress(job.worker_address)}\` - ${formatSageAmount(job.payment_amount)}`
        ).join('\n');

        const completedJobs = jobs.filter(j => j.status === 'completed').length;
        const pendingJobs = jobs.filter(j => j.status === 'pending').length;
        const runningJobs = jobs.filter(j => j.status === 'running').length;
        const failedJobs = jobs.filter(j => j.status === 'failed').length;

        const embed = new EmbedBuilder()
          .setColor(getStatusColor('info'))
          .setTitle('⚙️ Recent Jobs')
          .setDescription(jobsList)
          .addFields(
            {
              name: '✅ Completed',
              value: String(completedJobs),
              inline: true
            },
            {
              name: '🔄 Running',
              value: String(runningJobs),
              inline: true
            },
            {
              name: '⏳ Pending',
              value: String(pendingJobs),
              inline: true
            },
            {
              name: '❌ Failed',
              value: String(failedJobs),
              inline: true
            }
          )
          .setFooter({ text: `Showing ${jobs.length} most recent jobs • Use /jobs <job_id> for details` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        logger.info(`Jobs list command executed (limit: ${limit}) by ${interaction.user.tag}`);
      }
    } catch (error) {
      logger.error('Error executing jobs command', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Error')
        .setDescription(error instanceof Error ? error.message : 'Failed to fetch job information')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
