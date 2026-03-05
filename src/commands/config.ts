/**
 * /config command
 *
 * Configure bot protection settings for the server
 *
 * Subcommands:
 * - verified-role: Configure verified role
 * - waiting-room: Configure waiting room
 * - captcha: Configure captcha settings
 * - rules: Manage server rules
 * - prune: Configure member pruning
 * - view: View current configuration
 */

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionFlagsBits,
  Role,
  GuildChannel,
} from 'discord.js';
import { Command } from '../types';
import { logger } from '../utils/logger';
import { getStatusColor } from '../utils/formatters';
import {
  setVerifiedRole,
  setWaitingRoomRole,
  disableWaitingRoom,
  getOrCreateVerifiedRole,
} from '../bot-protection/services/role-manager';
import { query } from '../utils/database';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot protection settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('verified-role')
        .setDescription('Configure the verified member role')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role to assign to verified members')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('auto-assign')
            .setDescription('Automatically assign this role when members verify')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('create')
            .setDescription('Create a new verified role if not specified')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('waiting-room')
        .setDescription('Configure waiting room for unverified members')
        .addBooleanOption(option =>
          option
            .setName('enable')
            .setDescription('Enable or disable waiting room')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The waiting room role')
            .setRequired(false)
        )
        .addChannelOption(option =>
          option
            .setName('channel')
            .setDescription('Channel where unverified members can see')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('captcha')
        .setDescription('Configure captcha verification settings')
        .addBooleanOption(option =>
          option
            .setName('enable')
            .setDescription('Enable or disable captcha verification')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('on-join')
            .setDescription('Send captcha when members join')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Type of captcha')
            .setRequired(false)
            .addChoices(
              { name: 'Number (Math)', value: 'number' },
              { name: 'Text (Questions)', value: 'text' },
              { name: 'Random', value: 'random' }
            )
        )
        .addStringOption(option =>
          option
            .setName('difficulty')
            .setDescription('Captcha difficulty')
            .setRequired(false)
            .addChoices(
              { name: 'Easy', value: 'easy' },
              { name: 'Medium', value: 'medium' },
              { name: 'Hard', value: 'hard' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('timeout')
            .setDescription('Timeout in minutes (5-60)')
            .setRequired(false)
            .setMinValue(5)
            .setMaxValue(60)
        )
        .addIntegerOption(option =>
          option
            .setName('max-attempts')
            .setDescription('Maximum attempts (1-5)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(5)
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('rules')
        .setDescription('Manage server rules displayed to new members')
        .addSubcommand(subcommand =>
          subcommand
            .setName('add')
            .setDescription('Add a server rule (max 5 rules)')
            .addIntegerOption(option =>
              option
                .setName('number')
                .setDescription('Rule number (1-5)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(5)
            )
            .addStringOption(option =>
              option
                .setName('text')
                .setDescription('The rule text')
                .setRequired(true)
                .setMaxLength(200)
            )
            .addStringOption(option =>
              option
                .setName('emoji')
                .setDescription('Optional emoji for the rule')
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove')
            .setDescription('Remove a server rule')
            .addIntegerOption(option =>
              option
                .setName('number')
                .setDescription('Rule number to remove (1-5)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(5)
            )
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('view')
            .setDescription('View all server rules')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('clear')
            .setDescription('Clear all server rules')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('enable')
            .setDescription('Enable or disable showing rules in verification')
            .addBooleanOption(option =>
              option
                .setName('enabled')
                .setDescription('Enable or disable rules display')
                .setRequired(true)
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('prune')
        .setDescription('Configure automatic removal of unverified members')
        .addBooleanOption(option =>
          option
            .setName('enable')
            .setDescription('Enable or disable auto-pruning')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('timeout')
            .setDescription('Hours before pruning unverified members (1-168)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(168)
        )
        .addBooleanOption(option =>
          option
            .setName('send-dm')
            .setDescription('Send DM notification before pruning')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('View current bot protection configuration')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const subcommandGroup = interaction.options.getSubcommandGroup();
      const subcommand = interaction.options.getSubcommand();

      if (subcommandGroup === 'rules') {
        await handleRulesConfig(interaction, subcommand);
        return;
      }

      switch (subcommand) {
        case 'verified-role':
          await handleVerifiedRoleConfig(interaction);
          break;
        case 'waiting-room':
          await handleWaitingRoomConfig(interaction);
          break;
        case 'captcha':
          await handleCaptchaConfig(interaction);
          break;
        case 'prune':
          await handlePruneConfig(interaction);
          break;
        case 'view':
          await handleViewConfig(interaction);
          break;
        default:
          await interaction.editReply({
            content: `Unknown subcommand: ${subcommand}`,
          });
      }
    } catch (error: any) {
      logger.error('Error executing config command', {
        error: error.message,
        guild_id: interaction.guildId,
        user_id: interaction.user.id,
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Configuration Error')
        .setDescription(
          'Failed to update configuration.\n\n' +
          'Please try again. If the problem persists, contact support.'
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};

// ============================================================
// Verified Role Configuration
// ============================================================

async function handleVerifiedRoleConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  const role = interaction.options.getRole('role') as Role | null;
  const autoAssign = interaction.options.getBoolean('auto-assign');
  const create = interaction.options.getBoolean('create');

  const guild = interaction.guild!;
  const guildId = guild.id;

  if (create) {
    // Create new verified role
    const newRole = await getOrCreateVerifiedRole(guild);

    if (!newRole) {
      const embed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Failed to Create Role')
        .setDescription('Could not create verified role. Please check bot permissions.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(getStatusColor('success'))
      .setTitle('✅ Verified Role Created')
      .setDescription(
        `Created and configured verified role: ${newRole}\n\n` +
        `**Auto-assign:** ${autoAssign !== false ? 'Enabled' : 'Disabled'}\n\n` +
        `This role will be automatically assigned to members who complete verification.`
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (!role) {
    // Show current configuration
    const configResult = await query(
      `SELECT verified_role_id, verified_role_name, auto_assign_verified_role
       FROM guild_bot_protection_config
       WHERE guild_id = $1`,
      [guildId]
    );

    if (configResult.rowCount === 0 || !configResult.rows[0].verified_role_id) {
      const embed = new EmbedBuilder()
        .setColor(getStatusColor('info'))
        .setTitle('ℹ️ Verified Role Not Configured')
        .setDescription(
          'No verified role has been set up yet.\n\n' +
          '**To configure:**\n' +
          '```/config verified-role role:@RoleName```\n' +
          '**Or create automatically:**\n' +
          '```/config verified-role create:true```'
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const config = configResult.rows[0];
    const roleId = config.verified_role_id;
    const currentRole = await guild.roles.fetch(roleId).catch(() => null);

    const embed = new EmbedBuilder()
      .setColor(getStatusColor('info'))
      .setTitle('✅ Verified Role Configuration')
      .addFields(
        {
          name: 'Role',
          value: currentRole ? `${currentRole}` : `⚠️ Role not found (ID: ${roleId})`,
          inline: true,
        },
        {
          name: 'Auto-assign',
          value: config.auto_assign_verified_role ? '✅ Enabled' : '❌ Disabled',
          inline: true,
        }
      )
      .setFooter({ text: 'Use /config verified-role to change' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Set verified role
  const result = await setVerifiedRole(guild, role.id, autoAssign !== false);

  const embed = new EmbedBuilder()
    .setColor(result.success ? getStatusColor('success') : getStatusColor('error'))
    .setTitle(result.success ? '✅ Verified Role Updated' : '❌ Configuration Failed')
    .setDescription(
      result.success
        ? `Verified role set to ${role}\n\n` +
          `**Auto-assign:** ${autoAssign !== false ? 'Enabled' : 'Disabled'}\n\n` +
          `Members who complete verification will receive this role.`
        : result.message
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ============================================================
// Waiting Room Configuration
// ============================================================

async function handleWaitingRoomConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  const enable = interaction.options.getBoolean('enable', true);
  const role = interaction.options.getRole('role') as Role | null;
  const channel = interaction.options.getChannel('channel') as GuildChannel | null;

  const guild = interaction.guild!;
  const guildId = guild.id;

  if (!enable) {
    // Disable waiting room
    await disableWaitingRoom(guildId);

    const embed = new EmbedBuilder()
      .setColor(getStatusColor('success'))
      .setTitle('✅ Waiting Room Disabled')
      .setDescription('Waiting room has been disabled for this server.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Enable waiting room
  if (!role) {
    // Auto-create role
    const result = await query(
      `UPDATE guild_bot_protection_config
       SET waiting_room_enabled = TRUE,
           waiting_room_channel_id = $1,
           updated_at = NOW()
       WHERE guild_id = $2`,
      [channel?.id || null, guildId]
    );

    const embed = new EmbedBuilder()
      .setColor(getStatusColor('success'))
      .setTitle('✅ Waiting Room Enabled')
      .setDescription(
        'Waiting room has been enabled.\n\n' +
        (channel ? `**Channel:** ${channel}\n\n` : '') +
        'A "Waiting Room" role will be auto-created when the next member joins.'
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Set waiting room role
  const result = await setWaitingRoomRole(guild, role.id, channel?.id);

  const embed = new EmbedBuilder()
    .setColor(result.success ? getStatusColor('success') : getStatusColor('error'))
    .setTitle(result.success ? '✅ Waiting Room Configured' : '❌ Configuration Failed')
    .setDescription(
      result.success
        ? `Waiting room role set to ${role}\n\n` +
          (channel ? `**Channel:** ${channel}\n\n` : '') +
          `Unverified members will receive this role until they complete verification.`
        : result.message
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ============================================================
// Captcha Configuration
// ============================================================

async function handleCaptchaConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  const enable = interaction.options.getBoolean('enable');
  const onJoin = interaction.options.getBoolean('on-join');
  const type = interaction.options.getString('type');
  const difficulty = interaction.options.getString('difficulty');
  const timeout = interaction.options.getInteger('timeout');
  const maxAttempts = interaction.options.getInteger('max-attempts');

  const guildId = interaction.guildId!;

  // Build update query dynamically
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (enable !== null) {
    updates.push(`captcha_enabled = $${paramIndex++}`);
    values.push(enable);
  }

  if (onJoin !== null) {
    updates.push(`captcha_on_join = $${paramIndex++}`);
    values.push(onJoin);
  }

  if (type) {
    updates.push(`captcha_type = $${paramIndex++}`);
    values.push(type);
  }

  if (difficulty) {
    updates.push(`captcha_difficulty = $${paramIndex++}`);
    values.push(difficulty);
  }

  if (timeout) {
    updates.push(`captcha_timeout_minutes = $${paramIndex++}`);
    values.push(timeout);
  }

  if (maxAttempts) {
    updates.push(`max_captcha_attempts = $${paramIndex++}`);
    values.push(maxAttempts);
  }

  if (updates.length === 0) {
    // No changes - show current config
    const configResult = await query(
      `SELECT * FROM guild_bot_protection_config WHERE guild_id = $1`,
      [guildId]
    );

    if (configResult.rowCount === 0) {
      const embed = new EmbedBuilder()
        .setColor(getStatusColor('info'))
        .setTitle('ℹ️ Captcha Not Configured')
        .setDescription('Captcha verification is not yet configured for this server.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const config = configResult.rows[0];

    const embed = new EmbedBuilder()
      .setColor(getStatusColor('info'))
      .setTitle('🔐 Captcha Configuration')
      .addFields(
        {
          name: 'Status',
          value: config.captcha_enabled ? '✅ Enabled' : '❌ Disabled',
          inline: true,
        },
        {
          name: 'On Join',
          value: config.captcha_on_join ? '✅ Enabled' : '❌ Disabled',
          inline: true,
        },
        {
          name: '\u200B',
          value: '\u200B',
          inline: true,
        },
        {
          name: 'Type',
          value: config.captcha_type,
          inline: true,
        },
        {
          name: 'Difficulty',
          value: config.captcha_difficulty,
          inline: true,
        },
        {
          name: '\u200B',
          value: '\u200B',
          inline: true,
        },
        {
          name: 'Timeout',
          value: `${config.captcha_timeout_minutes} minutes`,
          inline: true,
        },
        {
          name: 'Max Attempts',
          value: config.max_captcha_attempts.toString(),
          inline: true,
        }
      )
      .setFooter({ text: 'Use /config captcha to change settings' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Apply updates
  updates.push(`updated_at = NOW()`);
  values.push(guildId);

  await query(
    `UPDATE guild_bot_protection_config
     SET ${updates.join(', ')}
     WHERE guild_id = $${paramIndex}`,
    values
  );

  const embed = new EmbedBuilder()
    .setColor(getStatusColor('success'))
    .setTitle('✅ Captcha Configuration Updated')
    .setDescription(
      'Captcha settings have been updated:\n\n' +
      (enable !== null ? `**Enabled:** ${enable ? 'Yes' : 'No'}\n` : '') +
      (onJoin !== null ? `**On Join:** ${onJoin ? 'Yes' : 'No'}\n` : '') +
      (type ? `**Type:** ${type}\n` : '') +
      (difficulty ? `**Difficulty:** ${difficulty}\n` : '') +
      (timeout ? `**Timeout:** ${timeout} minutes\n` : '') +
      (maxAttempts ? `**Max Attempts:** ${maxAttempts}\n` : '')
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ============================================================
// View Configuration
// ============================================================

async function handleViewConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;

  // Fetch configuration
  const configResult = await query(
    `SELECT * FROM guild_bot_protection_config WHERE guild_id = $1`,
    [guildId]
  );

  if (configResult.rowCount === 0) {
    const embed = new EmbedBuilder()
      .setColor(getStatusColor('warning'))
      .setTitle('⚠️ Not Configured')
      .setDescription(
        'Bot protection is not yet configured for this server.\n\n' +
        'Use `/config captcha` to get started.'
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const config = configResult.rows[0];

  // Fetch verified role
  let verifiedRoleText = '❌ Not set';
  if (config.verified_role_id) {
    const role = await guild.roles.fetch(config.verified_role_id).catch(() => null);
    verifiedRoleText = role ? `${role}` : '⚠️ Role deleted';
  }

  // Fetch waiting room role
  let waitingRoomText = '❌ Disabled';
  if (config.waiting_room_enabled) {
    if (config.waiting_room_role_id) {
      const role = await guild.roles.fetch(config.waiting_room_role_id).catch(() => null);
      waitingRoomText = role ? `${role}` : '⚠️ Role deleted';
    } else {
      waitingRoomText = '✅ Enabled (auto-create)';
    }
  }

  const embed = new EmbedBuilder()
    .setColor(getStatusColor('info'))
    .setTitle('⚙️ Bot Protection Configuration')
    .setDescription(`Configuration for **${guild.name}**`)
    .addFields(
      {
        name: '🔐 Captcha Verification',
        value:
          `**Status:** ${config.captcha_enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
          `**On Join:** ${config.captcha_on_join ? '✅ Yes' : '❌ No'}\n` +
          `**Type:** ${config.captcha_type}\n` +
          `**Difficulty:** ${config.captcha_difficulty}\n` +
          `**Timeout:** ${config.captcha_timeout_minutes} min\n` +
          `**Max Attempts:** ${config.max_captcha_attempts}`,
        inline: false,
      },
      {
        name: '✅ Verified Role',
        value:
          `**Role:** ${verifiedRoleText}\n` +
          `**Auto-assign:** ${config.auto_assign_verified_role ? '✅ Yes' : '❌ No'}`,
        inline: false,
      },
      {
        name: '⏳ Waiting Room',
        value: waitingRoomText,
        inline: false,
      },
      {
        name: '🗑️ Member Pruning',
        value:
          `**Status:** ${config.prune_unverified_enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
          `**Timeout:** ${config.prune_timeout_hours} hours\n` +
          `**Send DM:** ${config.prune_send_dm ? '✅ Yes' : '❌ No'}`,
        inline: false,
      },
      {
        name: '📜 Server Rules',
        value: config.rules_enabled ? '✅ Enabled' : '❌ Disabled',
        inline: false,
      }
    )
    .setFooter({ text: 'Use /config to modify settings' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle rules configuration
 */
async function handleRulesConfig(
  interaction: ChatInputCommandInteraction,
  subcommand: string
): Promise<void> {
  const guildId = interaction.guildId!;
  const guild = interaction.guild!;

  switch (subcommand) {
    case 'add':
      await handleRulesAdd(interaction, guildId);
      break;
    case 'remove':
      await handleRulesRemove(interaction, guildId);
      break;
    case 'view':
      await handleRulesView(interaction, guildId);
      break;
    case 'clear':
      await handleRulesClear(interaction, guildId);
      break;
    case 'enable':
      await handleRulesEnable(interaction, guildId);
      break;
  }
}

/**
 * Add a server rule
 */
async function handleRulesAdd(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const ruleNumber = interaction.options.getInteger('number', true);
  const ruleText = interaction.options.getString('text', true);
  const emoji = interaction.options.getString('emoji', false);

  try {
    // Check if rule already exists
    const existing = await query(
      `SELECT * FROM guild_rules WHERE guild_id = $1 AND rule_number = $2`,
      [guildId, ruleNumber]
    );

    if (existing.rowCount > 0) {
      // Update existing rule
      await query(
        `UPDATE guild_rules
         SET rule_text = $1, emoji = $2, updated_at = NOW()
         WHERE guild_id = $3 AND rule_number = $4`,
        [ruleText, emoji, guildId, ruleNumber]
      );
    } else {
      // Insert new rule
      await query(
        `INSERT INTO guild_rules (guild_id, rule_number, rule_text, emoji)
         VALUES ($1, $2, $3, $4)`,
        [guildId, ruleNumber, ruleText, emoji]
      );
    }

    const embed = new EmbedBuilder()
      .setColor(getStatusColor('success'))
      .setTitle('✅ Rule Added')
      .setDescription(
        `**Rule ${ruleNumber}** has been ${existing.rowCount > 0 ? 'updated' : 'added'}:\n\n` +
        `${emoji ? emoji + ' ' : ''}${ruleText}`
      )
      .setFooter({ text: 'Rules will be shown to new members during verification' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info('Server rule added', {
      guild_id: guildId,
      rule_number: ruleNumber,
      admin_id: interaction.user.id,
    });
  } catch (error: any) {
    throw new Error(`Failed to add rule: ${error.message}`);
  }
}

/**
 * Remove a server rule
 */
async function handleRulesRemove(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const ruleNumber = interaction.options.getInteger('number', true);

  try {
    const result = await query(
      `DELETE FROM guild_rules
       WHERE guild_id = $1 AND rule_number = $2
       RETURNING rule_text`,
      [guildId, ruleNumber]
    );

    if (result.rowCount === 0) {
      const embed = new EmbedBuilder()
        .setColor(getStatusColor('warning'))
        .setTitle('⚠️ Rule Not Found')
        .setDescription(`No rule found with number **${ruleNumber}**.`)
        .setFooter({ text: 'Use /config rules view to see all rules' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(getStatusColor('success'))
      .setTitle('✅ Rule Removed')
      .setDescription(`**Rule ${ruleNumber}** has been removed.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info('Server rule removed', {
      guild_id: guildId,
      rule_number: ruleNumber,
      admin_id: interaction.user.id,
    });
  } catch (error: any) {
    throw new Error(`Failed to remove rule: ${error.message}`);
  }
}

/**
 * View all server rules
 */
async function handleRulesView(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  try {
    const result = await query(
      `SELECT * FROM guild_rules
       WHERE guild_id = $1 AND enabled = TRUE
       ORDER BY rule_number ASC`,
      [guildId]
    );

    if (result.rowCount === 0) {
      const embed = new EmbedBuilder()
        .setColor(getStatusColor('info'))
        .setTitle('📜 Server Rules')
        .setDescription(
          'No rules have been set up yet.\n\n' +
          'Add rules with `/config rules add`'
        )
        .setFooter({ text: 'You can add up to 5 rules' });

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const rulesText = result.rows
      .map(row => `${row.emoji ? row.emoji + ' ' : ''}**${row.rule_number}.** ${row.rule_text}`)
      .join('\n\n');

    const config = await query(
      `SELECT rules_enabled FROM guild_bot_protection_config WHERE guild_id = $1`,
      [guildId]
    );

    const rulesEnabled = config.rows[0]?.rules_enabled || false;

    const embed = new EmbedBuilder()
      .setColor(getStatusColor('info'))
      .setTitle('📜 Server Rules')
      .setDescription(rulesText)
      .addFields({
        name: 'Status',
        value: rulesEnabled ? '✅ Enabled (shown in verification)' : '❌ Disabled',
        inline: false,
      })
      .setFooter({ text: `${result.rowCount}/5 rules configured` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    throw new Error(`Failed to view rules: ${error.message}`);
  }
}

/**
 * Clear all server rules
 */
async function handleRulesClear(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  try {
    const result = await query(
      `DELETE FROM guild_rules WHERE guild_id = $1 RETURNING rule_number`,
      [guildId]
    );

    if (result.rowCount === 0) {
      const embed = new EmbedBuilder()
        .setColor(getStatusColor('info'))
        .setTitle('ℹ️ No Rules to Clear')
        .setDescription('No rules were found to clear.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(getStatusColor('success'))
      .setTitle('✅ Rules Cleared')
      .setDescription(`All **${result.rowCount}** rules have been cleared.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info('All server rules cleared', {
      guild_id: guildId,
      count: result.rowCount,
      admin_id: interaction.user.id,
    });
  } catch (error: any) {
    throw new Error(`Failed to clear rules: ${error.message}`);
  }
}

/**
 * Enable or disable rules display
 */
async function handleRulesEnable(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const enabled = interaction.options.getBoolean('enabled', true);

  try {
    await query(
      `UPDATE guild_bot_protection_config
       SET rules_enabled = $1, updated_at = NOW()
       WHERE guild_id = $2`,
      [enabled, guildId]
    );

    const embed = new EmbedBuilder()
      .setColor(getStatusColor('success'))
      .setTitle(enabled ? '✅ Rules Enabled' : '❌ Rules Disabled')
      .setDescription(
        enabled
          ? 'Server rules will now be displayed to new members during verification.'
          : 'Server rules will no longer be displayed during verification.'
      )
      .setFooter({ text: 'Add rules with /config rules add' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info('Rules display toggled', {
      guild_id: guildId,
      enabled,
      admin_id: interaction.user.id,
    });
  } catch (error: any) {
    throw new Error(`Failed to toggle rules: ${error.message}`);
  }
}

/**
 * Handle prune configuration
 */
async function handlePruneConfig(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId!;
  const enable = interaction.options.getBoolean('enable', false);
  const timeout = interaction.options.getInteger('timeout', false);
  const sendDm = interaction.options.getBoolean('send-dm', false);

  try {
    // If no options provided, show current config
    if (enable === null && timeout === null && sendDm === null) {
      await showPruneConfig(interaction, guildId);
      return;
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (enable !== null) {
      updates.push(`prune_unverified_enabled = $${paramCount++}`);
      values.push(enable);
    }

    if (timeout !== null) {
      updates.push(`prune_timeout_hours = $${paramCount++}`);
      values.push(timeout);
    }

    if (sendDm !== null) {
      updates.push(`prune_send_dm = $${paramCount++}`);
      values.push(sendDm);
    }

    updates.push(`updated_at = NOW()`);
    values.push(guildId);

    await query(
      `UPDATE guild_bot_protection_config
       SET ${updates.join(', ')}
       WHERE guild_id = $${paramCount}`,
      values
    );

    // Fetch updated config
    const configResult = await query(
      `SELECT prune_unverified_enabled, prune_timeout_hours, prune_send_dm
       FROM guild_bot_protection_config
       WHERE guild_id = $1`,
      [guildId]
    );

    const config = configResult.rows[0];

    const embed = new EmbedBuilder()
      .setColor(getStatusColor('success'))
      .setTitle('✅ Prune Configuration Updated')
      .setDescription(
        '**Current Settings:**\n\n' +
        `**Status:** ${config.prune_unverified_enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
        `**Timeout:** ${config.prune_timeout_hours} hours\n` +
        `**Send DM:** ${config.prune_send_dm ? '✅ Yes' : '❌ No'}\n\n` +
        (config.prune_unverified_enabled
          ? `Unverified members will be automatically removed after **${config.prune_timeout_hours} hours**.`
          : 'Auto-pruning is currently disabled.')
      )
      .setFooter({
        text: config.prune_unverified_enabled
          ? 'Members will receive a DM notification before removal'
          : 'Enable auto-pruning with /config prune enable:true',
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info('Prune configuration updated', {
      guild_id: guildId,
      enabled: enable,
      timeout,
      send_dm: sendDm,
      admin_id: interaction.user.id,
    });
  } catch (error: any) {
    throw new Error(`Failed to configure pruning: ${error.message}`);
  }
}

/**
 * Show current prune configuration
 */
async function showPruneConfig(
  interaction: ChatInputCommandInteraction,
  guildId: string
): Promise<void> {
  const result = await query(
    `SELECT prune_unverified_enabled, prune_timeout_hours, prune_send_dm
     FROM guild_bot_protection_config
     WHERE guild_id = $1`,
    [guildId]
  );

  const config = result.rows[0];

  const embed = new EmbedBuilder()
    .setColor(getStatusColor('info'))
    .setTitle('🗑️ Member Pruning Configuration')
    .setDescription(
      '**Current Settings:**\n\n' +
      `**Status:** ${config.prune_unverified_enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
      `**Timeout:** ${config.prune_timeout_hours} hours\n` +
      `**Send DM:** ${config.prune_send_dm ? '✅ Yes' : '❌ No'}\n\n` +
      (config.prune_unverified_enabled
        ? `Unverified members will be automatically removed after **${config.prune_timeout_hours} hours**.`
        : 'Auto-pruning is currently disabled.')
    )
    .addFields({
      name: 'How It Works',
      value:
        '1. Member joins the server\n' +
        '2. If they don\'t verify within the timeout period\n' +
        '3. They receive a DM notification (if enabled)\n' +
        '4. After grace period, they are removed from the server',
      inline: false,
    })
    .setFooter({ text: 'Use /config prune to modify settings' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
