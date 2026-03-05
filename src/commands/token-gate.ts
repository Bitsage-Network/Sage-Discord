/**
 * /token-gate command (Admin only)
 *
 * Manage token-gating rules for Discord roles.
 * Subcommands: create, edit, list, delete
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
import { query } from '../utils/database';
import { RuleType, TokenBalanceRequirements } from '../token-gating/types';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('token-gate')
    .setDescription('Manage token-gating rules (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('create')
        .setDescription('Create a new token-gating rule')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('Discord role to assign')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Rule type')
            .setRequired(true)
            .addChoices(
              { name: 'Token Balance', value: 'token_balance' },
              { name: 'Staked Amount', value: 'staked_amount' },
              { name: 'Reputation Score', value: 'reputation' },
              { name: 'Validator Node', value: 'validator' },
              { name: 'Worker Node', value: 'worker' }
            )
        )
        .addStringOption(option =>
          option
            .setName('min_balance')
            .setDescription('Minimum token balance (for token_balance type)')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('include_staked')
            .setDescription('Include staked tokens in balance check (default: false)')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('priority')
            .setDescription('Rule priority (higher = evaluated first, default: 0)')
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(100)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List all token-gating rules')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('delete')
        .setDescription('Delete a token-gating rule')
        .addIntegerOption(option =>
          option
            .setName('rule_id')
            .setDescription('ID of the rule to delete')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'create':
          await handleCreate(interaction);
          break;
        case 'list':
          await handleList(interaction);
          break;
        case 'delete':
          await handleDelete(interaction);
          break;
        default:
          throw new Error(`Unknown subcommand: ${subcommand}`);
      }
    } catch (error: any) {
      logger.error('Error executing token-gate command', {
        error: error.message,
        user_id: interaction.user.id,
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Error')
        .setDescription(
          'Failed to execute command.\n\n' +
          `Error: ${error.message}`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};

async function handleCreate(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const role = interaction.options.getRole('role', true);
  const ruleType = interaction.options.getString('type', true) as RuleType;
  const minBalance = interaction.options.getString('min_balance');
  const includeStaked = interaction.options.getBoolean('include_staked') ?? false;
  const priority = interaction.options.getInteger('priority') ?? 0;

  // Validate requirements based on rule type
  let requirements: any = {};

  switch (ruleType) {
    case 'token_balance':
      if (!minBalance) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('error'))
          .setTitle('❌ Missing Required Parameter')
          .setDescription('`min_balance` is required for token_balance rules.')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Validate min_balance is a valid number
      const balanceNum = parseFloat(minBalance);
      if (isNaN(balanceNum) || balanceNum <= 0) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('error'))
          .setTitle('❌ Invalid Balance')
          .setDescription('`min_balance` must be a positive number.')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Convert to wei (18 decimals)
      const balanceWei = (BigInt(Math.floor(balanceNum)) * BigInt(10 ** 18)).toString();

      requirements = {
        min_balance: balanceWei,
        include_staked: includeStaked,
      } as TokenBalanceRequirements;
      break;

    case 'staked_amount':
      // TODO: Implement staked amount requirements
      const embed = new EmbedBuilder()
        .setColor(getStatusColor('warning'))
        .setTitle('⚠️ Not Yet Implemented')
        .setDescription('Staked amount rules are not yet implemented.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;

    default:
      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('warning'))
        .setTitle('⚠️ Not Yet Implemented')
        .setDescription(`${ruleType} rules are not yet implemented.`)
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
      return;
  }

  // Create rule
  const ruleResult = await query(
    `INSERT INTO token_gating_rules
     (guild_id, rule_name, description, rule_type, requirements, enabled, priority, created_by)
     VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)
     RETURNING id`,
    [
      guildId,
      `${role.name} - ${ruleType}`,
      `Auto-generated rule for ${role.name}`,
      ruleType,
      JSON.stringify(requirements),
      priority,
      interaction.user.id,
    ]
  );

  const ruleId = ruleResult.rows[0].id;

  // Create role mapping
  await query(
    `INSERT INTO role_mappings
     (guild_id, rule_id, role_id, role_name, auto_assign, auto_remove, recheck_interval)
     VALUES ($1, $2, $3, $4, TRUE, TRUE, 3600)`,
    [guildId, ruleId, role.id, role.name]
  );

  const embed = new EmbedBuilder()
    .setColor(getStatusColor('success'))
    .setTitle('✅ Token-Gating Rule Created')
    .setDescription(
      `Successfully created token-gating rule!\n\n` +
      `**Rule ID:** ${ruleId}\n` +
      `**Role:** ${role}\n` +
      `**Type:** ${ruleType}\n` +
      `**Priority:** ${priority}\n\n` +
      `**Requirements:**\n` +
      `${formatRequirements(ruleType, requirements)}\n\n` +
      `Users who meet these requirements will automatically receive the ${role} role.`
    )
    .setFooter({ text: 'Roles are synced automatically every hour' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info('Token-gating rule created', {
    rule_id: ruleId,
    guild_id: guildId,
    role: role.name,
    type: ruleType,
    created_by: interaction.user.tag,
  });
}

async function handleList(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;

  const rules = await query(
    `SELECT tgr.id, tgr.rule_name, tgr.rule_type, tgr.requirements, tgr.enabled, tgr.priority,
            rm.role_name, rm.role_id
     FROM token_gating_rules tgr
     LEFT JOIN role_mappings rm ON tgr.id = rm.rule_id
     WHERE tgr.guild_id = $1
     ORDER BY tgr.priority DESC, tgr.id ASC`,
    [guildId]
  );

  if (rules.rowCount === 0) {
    const embed = new EmbedBuilder()
      .setColor(getStatusColor('info'))
      .setTitle('📋 Token-Gating Rules')
      .setDescription(
        'No token-gating rules configured yet.\n\n' +
        'Use `/token-gate create` to create your first rule.'
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(getStatusColor('info'))
    .setTitle('📋 Token-Gating Rules')
    .setDescription(
      `Total rules: ${rules.rowCount}\n\n` +
      'Here are all configured token-gating rules:'
    )
    .setTimestamp();

  for (const rule of rules.rows) {
    const requirements = JSON.parse(rule.requirements);
    const statusEmoji = rule.enabled ? '✅' : '❌';

    embed.addFields({
      name: `${statusEmoji} Rule #${rule.id} - ${rule.role_name || 'Unknown Role'}`,
      value:
        `**Type:** ${rule.rule_type}\n` +
        `**Priority:** ${rule.priority}\n` +
        `**Requirements:** ${formatRequirements(rule.rule_type, requirements)}\n` +
        `**Status:** ${rule.enabled ? 'Enabled' : 'Disabled'}`,
      inline: false,
    });
  }

  embed.setFooter({ text: 'Use /token-gate delete <id> to remove a rule' });

  await interaction.editReply({ embeds: [embed] });
}

async function handleDelete(interaction: ChatInputCommandInteraction) {
  const guildId = interaction.guildId!;
  const ruleId = interaction.options.getInteger('rule_id', true);

  // Check if rule exists and belongs to this guild
  const ruleCheck = await query(
    `SELECT id, rule_name FROM token_gating_rules WHERE id = $1 AND guild_id = $2`,
    [ruleId, guildId]
  );

  if (ruleCheck.rowCount === 0) {
    const embed = new EmbedBuilder()
      .setColor(getStatusColor('error'))
      .setTitle('❌ Rule Not Found')
      .setDescription(`No rule found with ID ${ruleId} in this server.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const ruleName = ruleCheck.rows[0].rule_name;

  // Delete rule (role_mappings will be deleted via CASCADE)
  await query('DELETE FROM token_gating_rules WHERE id = $1', [ruleId]);

  const embed = new EmbedBuilder()
    .setColor(getStatusColor('success'))
    .setTitle('✅ Rule Deleted')
    .setDescription(
      `Successfully deleted token-gating rule!\n\n` +
      `**Rule ID:** ${ruleId}\n` +
      `**Rule Name:** ${ruleName}`
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  logger.info('Token-gating rule deleted', {
    rule_id: ruleId,
    guild_id: guildId,
    deleted_by: interaction.user.tag,
  });
}

function formatRequirements(ruleType: string, requirements: any): string {
  switch (ruleType) {
    case 'token_balance':
      const balance = BigInt(requirements.min_balance);
      const balanceFormatted = (Number(balance) / 10 ** 18).toLocaleString();
      return `Minimum ${balanceFormatted} SAGE tokens${requirements.include_staked ? ' (including staked)' : ''}`;
    case 'staked_amount':
      return `Minimum ${requirements.min_amount} staked tokens`;
    case 'reputation':
      return `Minimum reputation score: ${requirements.min_score}`;
    case 'validator':
      return 'Must be an active validator';
    case 'worker':
      return 'Must be an active worker node';
    default:
      return JSON.stringify(requirements);
  }
}
