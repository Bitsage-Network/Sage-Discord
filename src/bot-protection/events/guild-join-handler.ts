/**
 * BitSage Discord Bot - Guild Join Handler
 *
 * Handles bot being added to new servers
 * Auto-creates verified role and initializes bot protection config
 */

import { Client, Guild, EmbedBuilder, TextChannel, ChannelType } from 'discord.js';
import { logger } from '../../utils/logger';
import { getStatusColor } from '../../utils/formatters';
import { query } from '../../utils/database';
import { getOrCreateVerifiedRole } from '../services/role-manager';

/**
 * Handle bot joining a new guild
 */
export async function handleGuildJoin(guild: Guild): Promise<void> {
  try {
    logger.info('Bot joined new guild', {
      guild_id: guild.id,
      guild_name: guild.name,
      member_count: guild.memberCount,
      owner_id: guild.ownerId,
    });

    // Initialize guild configuration
    await initializeGuildConfig(guild);

    // Auto-create verified role
    const verifiedRole = await getOrCreateVerifiedRole(guild);

    // Send welcome message to owner or system channel
    await sendWelcomeMessage(guild, verifiedRole?.id);

    logger.info('Guild initialization complete', {
      guild_id: guild.id,
      verified_role_id: verifiedRole?.id,
    });
  } catch (error: any) {
    logger.error('Error handling guild join', {
      error: error.message,
      guild_id: guild.id,
      guild_name: guild.name,
    });
  }
}

/**
 * Initialize guild configuration in database
 */
async function initializeGuildConfig(guild: Guild): Promise<void> {
  try {
    // Create guild config with default settings
    await query(
      `INSERT INTO guild_bot_protection_config (
        guild_id,
        captcha_enabled,
        captcha_on_join,
        captcha_type,
        captcha_difficulty,
        captcha_timeout_minutes,
        max_captcha_attempts,
        auto_create_verified_role,
        auto_assign_verified_role,
        waiting_room_enabled,
        prune_unverified_enabled,
        prune_timeout_hours,
        prune_send_dm,
        rules_enabled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (guild_id) DO NOTHING`,
      [
        guild.id,
        true,           // captcha_enabled
        true,           // captcha_on_join
        'random',       // captcha_type
        'medium',       // captcha_difficulty
        10,             // captcha_timeout_minutes
        3,              // max_captcha_attempts
        true,           // auto_create_verified_role
        true,           // auto_assign_verified_role
        false,          // waiting_room_enabled (off by default)
        false,          // prune_unverified_enabled (off by default)
        24,             // prune_timeout_hours
        true,           // prune_send_dm
        false,          // rules_enabled (off by default)
      ]
    );

    // Initialize lockdown status
    await query(
      `INSERT INTO guild_lockdown_status (guild_id, is_locked_down)
       VALUES ($1, FALSE)
       ON CONFLICT (guild_id) DO NOTHING`,
      [guild.id]
    );

    logger.info('Guild configuration initialized', {
      guild_id: guild.id,
    });
  } catch (error: any) {
    logger.error('Failed to initialize guild config', {
      error: error.message,
      guild_id: guild.id,
    });
    throw error;
  }
}

/**
 * Send welcome message to guild owner or system channel
 */
async function sendWelcomeMessage(guild: Guild, verifiedRoleId?: string): Promise<void> {
  try {
    const embed = new EmbedBuilder()
      .setColor(getStatusColor('success'))
      .setTitle('🎉 Welcome to BitSage!')
      .setDescription(
        `Thank you for adding BitSage to **${guild.name}**!\n\n` +
        `BitSage is a complete Discord bot with:\n` +
        `✅ **Token-Gating** - Starknet-native role management\n` +
        `✅ **Bot Protection** - Captcha verification for new members\n` +
        `✅ **Privacy Features** - Zero-knowledge proof verification\n` +
        `✅ **Raid Protection** - Auto-detect and prevent spam raids\n\n` +
        `**Getting Started:**`
      )
      .addFields(
        {
          name: '1️⃣ Configure Bot Protection',
          value: '```/config captcha enable:true```\nEnable captcha verification for new members',
          inline: false,
        },
        {
          name: '2️⃣ Set Up Verified Role',
          value: verifiedRoleId
            ? `✅ Auto-created **Verified** role (<@&${verifiedRoleId}>)\nUse \`/config verified-role\` to customize`
            : '```/config verified-role create```\nCreate a verified role for members',
          inline: false,
        },
        {
          name: '3️⃣ Optional: Waiting Room',
          value: '```/config waiting-room enable:true```\nKeep unverified members in a waiting room',
          inline: false,
        },
        {
          name: '4️⃣ Optional: Server Rules',
          value: '```/config rules add rule1:"Be respectful"```\nDisplay rules to new members (up to 5)',
          inline: false,
        },
        {
          name: '📚 Full Documentation',
          value: 'Use `/help` to see all commands',
          inline: false,
        }
      )
      .setFooter({ text: 'BitSage Complete Discord Bot' })
      .setTimestamp();

    // Try to send to system channel first
    let channel: TextChannel | null = null;

    if (guild.systemChannel && guild.systemChannel.type === ChannelType.GuildText) {
      channel = guild.systemChannel as TextChannel;
    } else {
      // Find first text channel bot can send messages to
      const textChannels = guild.channels.cache.filter(
        c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me!)?.has('SendMessages')
      );

      if (textChannels.size > 0) {
        channel = textChannels.first() as TextChannel;
      }
    }

    if (channel) {
      await channel.send({ embeds: [embed] });
      logger.info('Welcome message sent to channel', {
        guild_id: guild.id,
        channel_id: channel.id,
        channel_name: channel.name,
      });
    } else {
      // Send to owner via DM
      const owner = await guild.fetchOwner();
      await owner.send({ embeds: [embed] });
      logger.info('Welcome message sent to owner DM', {
        guild_id: guild.id,
        owner_id: owner.id,
      });
    }
  } catch (error: any) {
    logger.warn('Failed to send welcome message', {
      error: error.message,
      guild_id: guild.id,
    });
    // Don't throw - not critical
  }
}

/**
 * Handle bot being removed from a guild
 */
export async function handleGuildLeave(guild: Guild): Promise<void> {
  try {
    logger.info('Bot removed from guild', {
      guild_id: guild.id,
      guild_name: guild.name,
    });

    // Optional: Clean up guild data
    // For now, we'll keep the data in case they re-add the bot
  } catch (error: any) {
    logger.error('Error handling guild leave', {
      error: error.message,
      guild_id: guild.id,
    });
  }
}

/**
 * Register guild join/leave handlers with the Discord client
 */
export function registerGuildHandlers(client: Client): void {
  client.on('guildCreate', async (guild) => {
    await handleGuildJoin(guild);
  });

  client.on('guildDelete', async (guild) => {
    await handleGuildLeave(guild);
  });

  logger.info('Guild join/leave handlers registered');
}

export default {
  handleGuildJoin,
  handleGuildLeave,
  registerGuildHandlers,
};
