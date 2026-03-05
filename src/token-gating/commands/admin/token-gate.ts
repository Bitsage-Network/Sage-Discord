/**
 * BitSage Discord Token-Gating - /token-gate Command
 *
 * Admin command for managing token-gating rules and role mappings.
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  Role,
} from 'discord.js';
import { query } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { RuleType, RuleRequirements } from '../../types';
import * as EMOJI from '../../../utils/emojis';

export const data = new SlashCommandBuilder()
  .setName('token-gate')
  .setDescription('Manage token-gating rules for role assignment')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

  // CREATE SUBCOMMAND
  .addSubcommand((subcommand) =>
    subcommand
      .setName('create')
      .setDescription('Create a new token-gating rule')
      .addRoleOption((option) =>
        option
          .setName('role')
          .setDescription('The role to assign when requirements are met')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('type')
          .setDescription('Type of rule')
          .setRequired(true)
          .addChoices(
            { name: 'Token Balance', value: 'token_balance' },
            { name: 'Staked Amount', value: 'staked_amount' },
            { name: 'Reputation Score', value: 'reputation' },
            { name: 'Active Validator', value: 'validator' },
            { name: 'Active Worker', value: 'worker' }
          )
      )
      .addStringOption((option) =>
        option
          .setName('requirements')
          .setDescription('Requirements as JSON (e.g., {"min_balance": "1000000000000000000000"})')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option.setName('name').setDescription('Rule name').setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('description')
          .setDescription('Rule description')
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName('privacy')
          .setDescription('Enable privacy features (ZK proofs/stealth addresses)')
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName('priority')
          .setDescription('Rule priority (higher = checked first, default: 0)')
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(100)
      )
  )

  // LIST SUBCOMMAND
  .addSubcommand((subcommand) =>
    subcommand
      .setName('list')
      .setDescription('List all token-gating rules for this server')
  )

  // EDIT SUBCOMMAND
  .addSubcommand((subcommand) =>
    subcommand
      .setName('edit')
      .setDescription('Edit an existing token-gating rule')
      .addIntegerOption((option) =>
        option
          .setName('rule-id')
          .setDescription('Rule ID to edit')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('requirements')
          .setDescription('New requirements as JSON')
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName('enabled')
          .setDescription('Enable or disable this rule')
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName('priority')
          .setDescription('New priority (0-100)')
          .setRequired(false)
          .setMinValue(0)
          .setMaxValue(100)
      )
      .addStringOption((option) =>
        option.setName('name').setDescription('New rule name').setRequired(false)
      )
      .addStringOption((option) =>
        option.setName('description').setDescription('New description').setRequired(false)
      )
  )

  // DELETE SUBCOMMAND
  .addSubcommand((subcommand) =>
    subcommand
      .setName('delete')
      .setDescription('Delete a token-gating rule')
      .addIntegerOption((option) =>
        option
          .setName('rule-id')
          .setDescription('Rule ID to delete')
          .setRequired(true)
      )
      .addBooleanOption((option) =>
        option
          .setName('remove-roles')
          .setDescription('Remove the role from members who have it')
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'create':
        await handleCreate(interaction);
        break;
      case 'list':
        await handleList(interaction);
        break;
      case 'edit':
        await handleEdit(interaction);
        break;
      case 'delete':
        await handleDelete(interaction);
        break;
    }
  } catch (error: any) {
    logger.error('Token-gate command failed', {
      guild_id: interaction.guildId,
      user_id: interaction.user.id,
      subcommand: interaction.options.getSubcommand(),
      error: error.message,
      stack: error.stack,
    });

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(`${EMOJI.STATUS.ERROR} Command Failed`)
      .setDescription(
        `Failed to execute command. Please try again later.\\n\\n` +
          `**Error:** ${error.message}`
      )
      .setFooter({ text: 'Contact bot administrator if this persists' })
      .setTimestamp();

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true }).catch(() => {});
  }
}

/**
 * Handle CREATE subcommand
 */
async function handleCreate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const role = interaction.options.getRole('role') as Role;
  const ruleType = interaction.options.getString('type') as RuleType;
  const requirementsJson = interaction.options.getString('requirements')!;
  const ruleName = interaction.options.getString('name')!;
  const description = interaction.options.getString('description');
  const privacyEnabled = interaction.options.getBoolean('privacy') || false;
  const priority = interaction.options.getInteger('priority') || 0;

  // Validate requirements JSON
  let requirements: RuleRequirements;
  try {
    requirements = JSON.parse(requirementsJson);
  } catch (error) {
    const invalidJsonEmbed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(`${EMOJI.STATUS.ERROR} Invalid Requirements`)
      .setDescription(
        `Failed to parse requirements JSON.\\n\\n` +
          `**Error:** Invalid JSON format\\n` +
          `**Provided:** \`${requirementsJson}\``
      )
      .addFields({
        name: 'Example Format',
        value:
          ruleType === 'token_balance'
            ? '`{"min_balance": "1000000000000000000000", "include_staked": true}`'
            : ruleType === 'staked_amount'
            ? '`{"min_amount": "500000000000000000000"}`'
            : ruleType === 'reputation'
            ? '`{"min_score": 800, "min_level": 3}`'
            : '`{}`',
        inline: false,
      })
      .setFooter({ text: 'Requirements must be valid JSON' })
      .setTimestamp();

    await interaction.editReply({ embeds: [invalidJsonEmbed] });
    return;
  }

  // Validate role
  if (role.managed) {
    const managedRoleEmbed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(`${EMOJI.STATUS.ERROR} Invalid Role`)
      .setDescription(
        `Cannot create token-gating rule for managed role ${role}.\\n\\n` +
          `Managed roles are controlled by integrations and cannot be manually assigned.`
      )
      .setFooter({ text: 'Choose a non-managed role' })
      .setTimestamp();

    await interaction.editReply({ embeds: [managedRoleEmbed] });
    return;
  }

  // Create rule
  const ruleResult = await query(
    `INSERT INTO token_gating_rules
     (guild_id, rule_name, description, rule_type, requirements, privacy_enabled, enabled, priority, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8)
     RETURNING id`,
    [
      interaction.guildId,
      ruleName,
      description,
      ruleType,
      JSON.stringify(requirements),
      privacyEnabled,
      priority,
      interaction.user.id,
    ]
  );

  const ruleId = ruleResult.rows[0].id;

  // Create role mapping
  await query(
    `INSERT INTO role_mappings
     (guild_id, rule_id, role_id, role_name, auto_assign, auto_remove)
     VALUES ($1, $2, $3, $4, TRUE, TRUE)`,
    [interaction.guildId, ruleId, role.id, role.name]
  );

  // Success embed
  const successEmbed = new EmbedBuilder()
    .setColor(0x00ff88)
    .setTitle(`${EMOJI.STATUS.SUCCESS} Token-Gating Rule Created`)
    .setDescription(`Successfully created rule **${ruleName}** (ID: ${ruleId})`)
    .addFields(
      {
        name: 'Role',
        value: role.toString(),
        inline: true,
      },
      {
        name: 'Type',
        value: formatRuleType(ruleType),
        inline: true,
      },
      {
        name: 'Priority',
        value: priority.toString(),
        inline: true,
      },
      {
        name: 'Requirements',
        value: `\`\`\`json\\n${JSON.stringify(requirements, null, 2)}\\n\`\`\``,
        inline: false,
      },
      {
        name: 'Settings',
        value:
          `✅ Auto-assign: Enabled\\n` +
          `✅ Auto-remove: Enabled\\n` +
          `${privacyEnabled ? '🎭 Privacy: Enabled' : '🔓 Privacy: Disabled'}`,
        inline: false,
      },
      {
        name: `${EMOJI.STATUS.INFO} Next Steps`,
        value:
          '1️⃣ Users with verified wallets will be checked automatically\\n' +
          `2️⃣ Role sync runs every hour\\n` +
          `3️⃣ Users can verify with \`/verify-wallet\``,
        inline: false,
      }
    )
    .setFooter({ text: 'BitSage Token-Gating • Starknet' })
    .setTimestamp();

  await interaction.editReply({ embeds: [successEmbed] });

  logger.info('Token-gating rule created', {
    guild_id: interaction.guildId,
    rule_id: ruleId,
    rule_name: ruleName,
    rule_type: ruleType,
    role_id: role.id,
    created_by: interaction.user.id,
  });
}

/**
 * Handle LIST subcommand
 */
async function handleList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const rulesResult = await query(
    `SELECT tgr.*, rm.role_id, rm.role_name, rm.auto_assign, rm.auto_remove
     FROM token_gating_rules tgr
     LEFT JOIN role_mappings rm ON tgr.id = rm.rule_id AND rm.guild_id = $1
     WHERE tgr.guild_id = $1
     ORDER BY tgr.priority DESC, tgr.created_at DESC`,
    [interaction.guildId]
  );

  if (rulesResult.rowCount === 0) {
    const noRulesEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${EMOJI.STATUS.INFO} No Token-Gating Rules`)
      .setDescription(
        `This server hasn't configured any token-gating rules yet.\\n\\n` +
          `Use \`/token-gate create\` to create your first rule!`
      )
      .addFields({
        name: 'Example Use Cases',
        value:
          '💎 Token holder roles (min balance)\\n' +
          '🔒 Staking rewards (min staked amount)\\n' +
          '⭐ Reputation tiers (min score)\\n' +
          '👑 Validator/Worker exclusive access',
        inline: false,
      })
      .setFooter({ text: 'BitSage Token-Gating • Starknet' })
      .setTimestamp();

    await interaction.editReply({ embeds: [noRulesEmbed] });
    return;
  }

  const listEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${EMOJI.PROGRESS.TROPHY} Token-Gating Rules (${rulesResult.rowCount})`)
    .setDescription(`Configured rules for **${interaction.guild?.name}**`)
    .setFooter({ text: 'BitSage Token-Gating • Starknet' })
    .setTimestamp();

  // Add each rule as a field
  for (const rule of rulesResult.rows.slice(0, 25)) {
    // Discord embed limit: 25 fields
    const role = interaction.guild?.roles.cache.get(rule.role_id);
    const roleMention = role ? role.toString() : `@${rule.role_name}`;
    const requirements = JSON.parse(rule.requirements);

    let reqText = '';
    if (rule.rule_type === 'token_balance') {
      reqText = `Min: ${formatBalance(requirements.min_balance)} SAGE`;
    } else if (rule.rule_type === 'staked_amount') {
      reqText = `Min: ${formatBalance(requirements.min_amount)} SAGE`;
    } else if (rule.rule_type === 'reputation') {
      reqText = `Min score: ${requirements.min_score}`;
    } else if (rule.rule_type === 'validator') {
      reqText = 'Must be active validator';
    } else if (rule.rule_type === 'worker') {
      reqText = 'Must be active worker';
    }

    const statusIcon = rule.enabled ? '✅' : '❌';
    const privacyIcon = rule.privacy_enabled ? '🎭' : '🔓';

    listEmbed.addFields({
      name: `${statusIcon} #${rule.id}: ${rule.rule_name} (Priority: ${rule.priority})`,
      value:
        `**Role:** ${roleMention}\\n` +
        `**Type:** ${formatRuleType(rule.rule_type)}\\n` +
        `**Requirements:** ${reqText}\\n` +
        `**Privacy:** ${privacyIcon} ${rule.privacy_enabled ? 'Enabled' : 'Disabled'}\\n` +
        `**Auto-assign:** ${rule.auto_assign ? 'Yes' : 'No'} | **Auto-remove:** ${rule.auto_remove ? 'Yes' : 'No'}`,
      inline: false,
    });
  }

  if (rulesResult.rowCount > 25) {
    listEmbed.addFields({
      name: `${EMOJI.STATUS.INFO} Note`,
      value: `Showing first 25 of ${rulesResult.rowCount} rules.`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [listEmbed] });
}

/**
 * Handle EDIT subcommand
 */
async function handleEdit(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const ruleId = interaction.options.getInteger('rule-id')!;
  const requirementsJson = interaction.options.getString('requirements');
  const enabled = interaction.options.getBoolean('enabled');
  const priority = interaction.options.getInteger('priority');
  const ruleName = interaction.options.getString('name');
  const description = interaction.options.getString('description');

  // Check if rule exists
  const ruleResult = await query(
    `SELECT * FROM token_gating_rules WHERE id = $1 AND guild_id = $2`,
    [ruleId, interaction.guildId]
  );

  if (ruleResult.rowCount === 0) {
    const notFoundEmbed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(`${EMOJI.STATUS.ERROR} Rule Not Found`)
      .setDescription(
        `Token-gating rule with ID **${ruleId}** not found in this server.\\n\\n` +
          `Use \`/token-gate list\` to see all rules.`
      )
      .setFooter({ text: 'BitSage Token-Gating • Starknet' })
      .setTimestamp();

    await interaction.editReply({ embeds: [notFoundEmbed] });
    return;
  }

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];
  let paramCounter = 1;

  if (requirementsJson !== null) {
    try {
      JSON.parse(requirementsJson); // Validate JSON
      updates.push(`requirements = $${paramCounter++}`);
      values.push(requirementsJson);
    } catch (error) {
      const invalidJsonEmbed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle(`${EMOJI.STATUS.ERROR} Invalid Requirements`)
        .setDescription(`Failed to parse requirements JSON.\\n\\n**Error:** Invalid JSON format`)
        .setFooter({ text: 'Requirements must be valid JSON' })
        .setTimestamp();

      await interaction.editReply({ embeds: [invalidJsonEmbed] });
      return;
    }
  }

  if (enabled !== null) {
    updates.push(`enabled = $${paramCounter++}`);
    values.push(enabled);
  }

  if (priority !== null) {
    updates.push(`priority = $${paramCounter++}`);
    values.push(priority);
  }

  if (ruleName !== null) {
    updates.push(`rule_name = $${paramCounter++}`);
    values.push(ruleName);
  }

  if (description !== null) {
    updates.push(`description = $${paramCounter++}`);
    values.push(description);
  }

  if (updates.length === 0) {
    const noChangesEmbed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle(`${EMOJI.STATUS.WARNING} No Changes`)
      .setDescription('You must specify at least one field to update.')
      .setFooter({ text: 'Use /token-gate list to see current values' })
      .setTimestamp();

    await interaction.editReply({ embeds: [noChangesEmbed] });
    return;
  }

  // Add updated_at
  updates.push(`updated_at = NOW()`);

  // Add WHERE clause parameters
  values.push(ruleId);
  values.push(interaction.guildId);

  // Execute update
  await query(
    `UPDATE token_gating_rules SET ${updates.join(', ')} WHERE id = $${paramCounter} AND guild_id = $${paramCounter + 1}`,
    values
  );

  // Success embed
  const successEmbed = new EmbedBuilder()
    .setColor(0x00ff88)
    .setTitle(`${EMOJI.STATUS.SUCCESS} Rule Updated`)
    .setDescription(`Successfully updated rule **#${ruleId}**`)
    .addFields({
      name: 'Changes Made',
      value: updates.slice(0, -1).join('\\n') || 'No changes',
      inline: false,
    })
    .setFooter({ text: 'Changes will apply on next role sync' })
    .setTimestamp();

  await interaction.editReply({ embeds: [successEmbed] });

  logger.info('Token-gating rule edited', {
    guild_id: interaction.guildId,
    rule_id: ruleId,
    updates: updates.slice(0, -1),
    edited_by: interaction.user.id,
  });
}

/**
 * Handle DELETE subcommand
 */
async function handleDelete(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const ruleId = interaction.options.getInteger('rule-id')!;
  const removeRoles = interaction.options.getBoolean('remove-roles') || false;

  // Check if rule exists
  const ruleResult = await query(
    `SELECT tgr.*, rm.role_id, rm.role_name
     FROM token_gating_rules tgr
     LEFT JOIN role_mappings rm ON tgr.id = rm.rule_id AND rm.guild_id = $2
     WHERE tgr.id = $1 AND tgr.guild_id = $2`,
    [ruleId, interaction.guildId]
  );

  if (ruleResult.rowCount === 0) {
    const notFoundEmbed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(`${EMOJI.STATUS.ERROR} Rule Not Found`)
      .setDescription(
        `Token-gating rule with ID **${ruleId}** not found in this server.\\n\\n` +
          `Use \`/token-gate list\` to see all rules.`
      )
      .setFooter({ text: 'BitSage Token-Gating • Starknet' })
      .setTimestamp();

    await interaction.editReply({ embeds: [notFoundEmbed] });
    return;
  }

  const rule = ruleResult.rows[0];
  const roleId = rule.role_id;

  // Delete rule (cascade will delete role mappings)
  await query(`DELETE FROM token_gating_rules WHERE id = $1 AND guild_id = $2`, [
    ruleId,
    interaction.guildId,
  ]);

  // Remove roles from members if requested
  let rolesRemoved = 0;
  if (removeRoles && roleId) {
    const role = interaction.guild?.roles.cache.get(roleId);
    if (role) {
      const members = interaction.guild?.members.cache.filter((m) =>
        m.roles.cache.has(roleId)
      );
      if (members) {
        for (const [_, member] of members) {
          try {
            await member.roles.remove(role);
            rolesRemoved++;
          } catch (error) {
            logger.error('Failed to remove role during rule deletion', {
              guild_id: interaction.guildId,
              user_id: member.id,
              role_id: roleId,
              error,
            });
          }
        }
      }
    }
  }

  // Success embed
  const successEmbed = new EmbedBuilder()
    .setColor(0x00ff88)
    .setTitle(`${EMOJI.STATUS.SUCCESS} Rule Deleted`)
    .setDescription(`Successfully deleted rule **${rule.rule_name}** (ID: ${ruleId})`)
    .addFields({
      name: 'What happened',
      value:
        `✅ Rule removed from database\\n` +
        `✅ Role mapping deleted\\n` +
        `${removeRoles ? `✅ Removed role from ${rolesRemoved} member(s)` : '⏭️ Role not removed from members'}`,
      inline: false,
    })
    .setFooter({ text: 'BitSage Token-Gating • Starknet' })
    .setTimestamp();

  await interaction.editReply({ embeds: [successEmbed] });

  logger.info('Token-gating rule deleted', {
    guild_id: interaction.guildId,
    rule_id: ruleId,
    rule_name: rule.rule_name,
    roles_removed: rolesRemoved,
    deleted_by: interaction.user.id,
  });
}

/**
 * Format rule type for display
 */
function formatRuleType(ruleType: string): string {
  const types: Record<string, string> = {
    token_balance: '💎 Token Balance',
    staked_amount: '🔒 Staked Amount',
    reputation: '⭐ Reputation Score',
    validator: '👑 Active Validator',
    worker: '⚙️ Active Worker',
  };

  return types[ruleType] || ruleType;
}

/**
 * Format balance for display (assumes 18 decimals like ERC20)
 */
function formatBalance(balance: string): string {
  const bn = BigInt(balance);
  const decimals = 18n;
  const divisor = 10n ** decimals;

  const whole = bn / divisor;
  const fraction = bn % divisor;

  if (whole === 0n && fraction === 0n) {
    return '0';
  }

  if (fraction === 0n) {
    return whole.toLocaleString();
  }

  const fractionStr = fraction.toString().padStart(Number(decimals), '0');
  const fractionTrimmed = fractionStr.slice(0, 2);

  return `${whole.toLocaleString()}.${fractionTrimmed}`;
}
