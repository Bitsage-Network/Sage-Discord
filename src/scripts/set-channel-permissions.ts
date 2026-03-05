import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

/**
 * Set channel permissions to restrict access for unverified users
 *
 * Public channels (visible to everyone):
 * - welcome
 * - rules
 * - faq
 * - announcements
 *
 * All other channels require the "Verified" role
 */

// Channels that should be visible to everyone (unverified users)
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

    // Find the Verified role
    const verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
    if (!verifiedRole) {
      logger.error('Verified role not found. Please run setup-server.ts first.');
      process.exit(1);
    }

    logger.info('\n🔒 Setting Channel Permissions...');
    logger.info('=====================================\n');

    let publicCount = 0;
    let restrictedCount = 0;
    let errorCount = 0;

    // Loop through all channels
    for (const [, channel] of guild.channels.cache) {
      // Skip voice channels, threads, and categories
      if (channel.isVoiceBased() || channel.type === 4 || channel.isThread()) {
        continue;
      }

      // Skip channels that don't have permissionOverwrites
      if (!('permissionOverwrites' in channel)) {
        continue;
      }

      const channelName = channel.name;
      const isPublic = PUBLIC_CHANNELS.includes(channelName);

      try {
        if (isPublic) {
          // Public channels - visible to @everyone
          await (channel as any).permissionOverwrites.edit(guild.id, {
            ViewChannel: true,
            SendMessages: channelName === 'announcements' ? false : null, // Announcements read-only
            ReadMessageHistory: true
          });

          logger.info(`✅ ${channelName} - Public (visible to everyone)`);
          publicCount++;
        } else {
          // Restricted channels - require Verified role
          // First, deny @everyone
          await (channel as any).permissionOverwrites.edit(guild.id, {
            ViewChannel: false
          });

          // Then, allow Verified role
          await (channel as any).permissionOverwrites.edit(verifiedRole.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
          });

          logger.info(`🔒 ${channelName} - Restricted (requires Verified role)`);
          restrictedCount++;
        }
      } catch (error) {
        logger.error(`❌ Failed to set permissions for ${channelName}:`, error);
        errorCount++;
      }
    }

    logger.info('\n=====================================');
    logger.info(`✅ Public channels: ${publicCount}`);
    logger.info(`🔒 Restricted channels: ${restrictedCount}`);
    if (errorCount > 0) {
      logger.warn(`❌ Errors: ${errorCount}`);
    }
    logger.info('=====================================\n');

    logger.info('✨ Channel permissions updated successfully!');
    logger.info('\nUnverified users can now only see:');
    PUBLIC_CHANNELS.forEach(name => logger.info(`  - #${name}`));
    logger.info('\nAll other channels require the "Verified" role.');

    process.exit(0);
  });

  await client.login(config.token);
}

main().catch((error) => {
  logger.error('Failed to set channel permissions', error);
  process.exit(1);
});
