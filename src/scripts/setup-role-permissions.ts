import { Client, GatewayIntentBits, PermissionFlagsBits } from 'discord.js';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

/**
 * Configure role-based channel permissions
 *
 * Channel Access Matrix:
 * - PUBLIC (Everyone): welcome, rules, faq, announcements
 * - VERIFIED (All verified users): Most channels
 * - DEVELOPER: dev-chat, bug-reports, feature-requests, showcase, github-updates
 * - VALIDATOR: network-stats, validator-chat, staking-info
 * - WORKER NODE: worker-support, job-updates, proof-discussion
 * - MODERATOR/CORE TEAM: mod-chat, core-team, admin-logs
 */

interface RoleChannels {
  roleName: string;
  channels: string[];
  description: string;
}

// Define role-specific channel access
const ROLE_CHANNELS: RoleChannels[] = [
  {
    roleName: 'Developer',
    channels: ['dev-chat', 'bug-reports', 'feature-requests', 'showcase', 'github-updates'],
    description: 'Developer-specific channels'
  },
  {
    roleName: 'Validator',
    channels: ['validator-chat', 'staking-info'],
    description: 'Validator-specific channels'
  },
  {
    roleName: 'Worker Node',
    channels: ['proof-discussion'],
    description: 'Worker node-specific channels'
  },
  {
    roleName: 'Moderator',
    channels: ['mod-chat'],
    description: 'Moderator-only channels'
  },
  {
    roleName: 'Core Team',
    channels: ['core-team', 'partnerships'],
    description: 'Core team-only channels'
  }
];

// Channels accessible to all verified users
const VERIFIED_CHANNELS = [
  'general',
  'introductions',
  'off-topic',
  'memes',
  'trading',
  'network-stats',
  'job-updates',
  'worker-support',
  'leaderboard',
  'achievements',
  'quests',
  'contests',
  'trivia',
  'rewards-chat',
  'help',
  'ticket-support',
  'feedback',
  'roadmap',
  'media'
];

// Public channels (no verification needed)
const PUBLIC_CHANNELS = [
  'welcome',
  'rules',
  'faq',
  'announcements'
];

async function main() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers
    ]
  });

  client.once('ready', async () => {
    logger.info(`Logged in as ${client.user?.tag}`);

    const guildId = config.guildId;
    if (!guildId) {
      logger.error('GUILD_ID not set');
      process.exit(1);
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      logger.error(`Guild ${guildId} not found`);
      process.exit(1);
    }

    // Find required roles
    const verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');

    if (!verifiedRole) {
      logger.error('Verified role not found');
      process.exit(1);
    }

    logger.info('\n🔒 Configuring Role-Based Channel Permissions...');
    logger.info('=============================================\n');

    let configuredCount = 0;
    let errorCount = 0;

    // Loop through all channels
    for (const [, channel] of guild.channels.cache) {
      // Skip voice channels, threads, and categories
      if (channel.isVoiceBased() || channel.type === 4 || channel.isThread()) {
        continue;
      }

      // Skip channels without permission overwrites
      if (!('permissionOverwrites' in channel)) {
        continue;
      }

      const channelName = channel.name;

      try {
        // PUBLIC CHANNELS - Everyone can view
        if (PUBLIC_CHANNELS.includes(channelName)) {
          await (channel as any).permissionOverwrites.edit(guild.id, {
            ViewChannel: true,
            SendMessages: channelName === 'announcements' ? false : null,
            ReadMessageHistory: true
          });

          logger.info(`🌐 ${channelName} - PUBLIC (everyone)`);
          configuredCount++;
          continue;
        }

        // VERIFIED-ONLY CHANNELS
        if (VERIFIED_CHANNELS.includes(channelName)) {
          // Deny @everyone
          await (channel as any).permissionOverwrites.edit(guild.id, {
            ViewChannel: false
          });

          // Allow Verified role
          await (channel as any).permissionOverwrites.edit(verifiedRole.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          });

          logger.info(`✅ ${channelName} - VERIFIED users only`);
          configuredCount++;
          continue;
        }

        // ROLE-SPECIFIC CHANNELS
        let roleConfigured = false;
        for (const roleConfig of ROLE_CHANNELS) {
          if (roleConfig.channels.includes(channelName)) {
            const role = guild.roles.cache.find(r => r.name === roleConfig.roleName);

            if (role) {
              // Deny @everyone
              await (channel as any).permissionOverwrites.edit(guild.id, {
                ViewChannel: false
              });

              // Allow specific role
              await (channel as any).permissionOverwrites.edit(role.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
              });

              // Also allow Moderators and Core Team to see everything
              const modRole = guild.roles.cache.find(r => r.name === 'Moderator');
              const coreRole = guild.roles.cache.find(r => r.name === 'Core Team');

              if (modRole) {
                await (channel as any).permissionOverwrites.edit(modRole.id, {
                  ViewChannel: true,
                  SendMessages: true,
                  ReadMessageHistory: true
                });
              }

              if (coreRole) {
                await (channel as any).permissionOverwrites.edit(coreRole.id, {
                  ViewChannel: true,
                  SendMessages: true,
                  ReadMessageHistory: true
                });
              }

              logger.info(`🔑 ${channelName} - ${roleConfig.roleName} only`);
              roleConfigured = true;
              configuredCount++;
              break;
            }
          }
        }

        // If not configured yet, default to verified-only
        if (!roleConfigured) {
          await (channel as any).permissionOverwrites.edit(guild.id, {
            ViewChannel: false
          });

          await (channel as any).permissionOverwrites.edit(verifiedRole.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          });

          logger.info(`✅ ${channelName} - VERIFIED users only (default)`);
          configuredCount++;
        }

      } catch (error) {
        logger.error(`❌ Failed to configure ${channelName}:`, error);
        errorCount++;
      }
    }

    logger.info('\n=============================================');
    logger.info(`✅ Configured: ${configuredCount} channels`);
    if (errorCount > 0) {
      logger.warn(`❌ Errors: ${errorCount}`);
    }
    logger.info('=============================================\n');

    logger.info('✨ Role-based permissions configured successfully!\n');

    logger.info('📋 Access Summary:');
    logger.info('  🌐 PUBLIC (Everyone):');
    PUBLIC_CHANNELS.forEach(c => logger.info(`    - #${c}`));

    logger.info('\n  ✅ VERIFIED (All verified users):');
    VERIFIED_CHANNELS.slice(0, 10).forEach(c => logger.info(`    - #${c}`));
    logger.info(`    ... and ${VERIFIED_CHANNELS.length - 10} more`);

    logger.info('\n  🔑 ROLE-SPECIFIC:');
    ROLE_CHANNELS.forEach(rc => {
      logger.info(`    ${rc.roleName}:`);
      rc.channels.forEach(c => logger.info(`      - #${c}`));
    });

    process.exit(0);
  });

  await client.login(config.token);
}

main().catch((error) => {
  logger.error('Failed to configure permissions', error);
  process.exit(1);
});
