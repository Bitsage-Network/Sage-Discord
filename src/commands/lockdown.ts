/**
 * /lockdown command
 *
 * Manually enable or disable server lockdown to prevent raids
 */

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../types';
import { logger } from '../utils/logger';
import { getStatusColor } from '../utils/formatters';
import {
  enableLockdown,
  disableLockdown,
  isLockdownActive,
  analyzeRaidRisk,
} from '../bot-protection/services/raid-protection-service';
import { query } from '../utils/database';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Manage server lockdown mode to prevent raids')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enable')
        .setDescription('Enable server lockdown (prevents new joins)')
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for lockdown')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('disable')
        .setDescription('Disable server lockdown (allow new joins)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check current lockdown status and raid risk')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();
      const guild = interaction.guild!;

      switch (subcommand) {
        case 'enable':
          await handleLockdownEnable(interaction);
          break;
        case 'disable':
          await handleLockdownDisable(interaction);
          break;
        case 'status':
          await handleLockdownStatus(interaction);
          break;
        default:
          await interaction.editReply({
            content: `Unknown subcommand: ${subcommand}`,
          });
      }
    } catch (error: any) {
      logger.error('Error executing lockdown command', {
        error: error.message,
        guild_id: interaction.guildId,
        user_id: interaction.user.id,
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Error')
        .setDescription(`Failed to execute lockdown command: ${error.message}`)
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};

/**
 * Enable lockdown
 */
async function handleLockdownEnable(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild!;
  const reason = interaction.options.getString('reason', false) || 'Manual lockdown by admin';
  const performedBy = interaction.user.id;

  const result = await enableLockdown(guild, reason, performedBy);

  if (!result.success) {
    const embed = new EmbedBuilder()
      .setColor(getStatusColor('warning'))
      .setTitle('⚠️ Lockdown Not Enabled')
      .setDescription(result.message)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(getStatusColor('error'))
    .setTitle('🔒 Server Lockdown Enabled')
    .setDescription(
      `**${guild.name}** is now in lockdown mode.\n\n` +
      `New members will be prevented from joining the server until lockdown is disabled.`
    )
    .addFields(
      {
        name: '📝 Reason',
        value: reason,
        inline: false,
      },
      {
        name: '👤 Enabled By',
        value: `<@${performedBy}>`,
        inline: true,
      },
      {
        name: '⏱️ Enabled At',
        value: new Date().toLocaleString(),
        inline: true,
      }
    )
    .setFooter({ text: 'Use /lockdown disable to lift lockdown' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info('Lockdown enabled via command', {
    guild_id: guild.id,
    reason,
    performed_by: performedBy,
  });
}

/**
 * Disable lockdown
 */
async function handleLockdownDisable(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild!;
  const performedBy = interaction.user.id;

  const result = await disableLockdown(guild, performedBy);

  if (!result.success) {
    const embed = new EmbedBuilder()
      .setColor(getStatusColor('warning'))
      .setTitle('⚠️ Lockdown Not Disabled')
      .setDescription(result.message)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(getStatusColor('success'))
    .setTitle('✅ Server Lockdown Disabled')
    .setDescription(
      `**${guild.name}** lockdown has been lifted.\n\n` +
      `New members can now join the server normally.`
    )
    .addFields(
      {
        name: '👤 Disabled By',
        value: `<@${performedBy}>`,
        inline: true,
      },
      {
        name: '⏱️ Disabled At',
        value: new Date().toLocaleString(),
        inline: true,
      }
    )
    .setFooter({ text: 'Lockdown can be re-enabled with /lockdown enable' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info('Lockdown disabled via command', {
    guild_id: guild.id,
    performed_by: performedBy,
  });
}

/**
 * Show lockdown status and raid risk
 */
async function handleLockdownStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild!;

  // Check current lockdown status
  const isLocked = await isLockdownActive(guild.id);

  // Get lockdown details if active
  let lockdownDetails: any = null;
  if (isLocked) {
    const result = await query(
      `SELECT lockdown_reason, locked_down_by, locked_down_at
       FROM guild_lockdown_status
       WHERE guild_id = $1`,
      [guild.id]
    );

    lockdownDetails = result.rows[0];
  }

  // Analyze current raid risk
  const raidRisk = await analyzeRaidRisk(guild.id);

  const embed = new EmbedBuilder()
    .setColor(isLocked ? getStatusColor('error') : getStatusColor('info'))
    .setTitle(isLocked ? '🔒 Server Lockdown Status' : '🛡️ Server Security Status')
    .setDescription(
      isLocked
        ? `**${guild.name}** is currently in lockdown mode.`
        : `**${guild.name}** is not in lockdown mode.`
    );

  if (isLocked && lockdownDetails) {
    embed.addFields(
      {
        name: '📝 Reason',
        value: lockdownDetails.lockdown_reason || 'Not specified',
        inline: false,
      },
      {
        name: '👤 Enabled By',
        value: lockdownDetails.locked_down_by === 'system'
          ? 'Auto-lockdown (raid detected)'
          : `<@${lockdownDetails.locked_down_by}>`,
        inline: true,
      },
      {
        name: '⏱️ Enabled At',
        value: new Date(lockdownDetails.locked_down_at).toLocaleString(),
        inline: true,
      }
    );
  }

  // Add raid risk analysis
  embed.addFields({
    name: '🔍 Current Raid Risk Analysis',
    value:
      `**Risk Level:** ${getRiskLevelText(raidRisk.confidence)}\n` +
      `**Confidence:** ${(raidRisk.confidence * 100).toFixed(0)}%\n` +
      `**Join Rate:** ${raidRisk.join_rate.toFixed(2)} joins/min (last 5 min)\n` +
      `**Suspicious Members:** ${raidRisk.suspicious_count}`,
    inline: false,
  });

  if (raidRisk.reasons.length > 0) {
    embed.addFields({
      name: '⚠️ Detection Factors',
      value: raidRisk.reasons.join('\n'),
      inline: false,
    });
  }

  // Add recommendations
  const recommendations: string[] = [];
  if (raidRisk.is_raid && !isLocked) {
    recommendations.push('⚠️ Consider enabling lockdown immediately');
  }
  if (isLocked && raidRisk.confidence < 0.2) {
    recommendations.push('✅ Raid risk is low, safe to disable lockdown');
  }
  if (!isLocked && raidRisk.confidence < 0.3) {
    recommendations.push('✅ No immediate action needed');
  }

  if (recommendations.length > 0) {
    embed.addFields({
      name: '💡 Recommendations',
      value: recommendations.join('\n'),
      inline: false,
    });
  }

  embed.setFooter({
    text: isLocked
      ? 'Use /lockdown disable to lift lockdown'
      : 'Use /lockdown enable to enable lockdown',
  });
  embed.setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Get risk level text based on confidence
 */
function getRiskLevelText(confidence: number): string {
  if (confidence >= 0.8) return '🔴 **CRITICAL** (Auto-lockdown threshold)';
  if (confidence >= 0.5) return '🟠 **HIGH** (Raid likely)';
  if (confidence >= 0.3) return '🟡 **MODERATE** (Monitor closely)';
  return '🟢 **LOW** (Normal activity)';
}
