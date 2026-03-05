import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { apiClient } from '../utils/api-client';
import { getStatusColor } from '../utils/formatters';
import { logger } from '../utils/logger';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot and API status'),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const start = Date.now();

      // Check API health
      const apiHealthy = await apiClient.healthCheck();

      const latency = Date.now() - start;
      const wsLatency = interaction.client.ws.ping;

      const embed = new EmbedBuilder()
        .setColor(apiHealthy ? getStatusColor('success') : getStatusColor('error'))
        .setTitle('🏓 Pong!')
        .addFields(
          {
            name: '🤖 Bot Latency',
            value: `${latency}ms`,
            inline: true
          },
          {
            name: '🌐 WebSocket Latency',
            value: `${wsLatency}ms`,
            inline: true
          },
          {
            name: '🔌 API Status',
            value: apiHealthy ? '✅ Healthy' : '❌ Unhealthy',
            inline: true
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      logger.info(`Ping command executed by ${interaction.user.tag}`);
    } catch (error) {
      logger.error('Error executing ping command', error);

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Error')
        .setDescription('Failed to check status')
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
};
