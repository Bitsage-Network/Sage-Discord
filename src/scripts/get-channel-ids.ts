import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

/**
 * Get all channel IDs for the server
 */

async function main() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
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

    logger.info(`\n📋 Channel IDs for ${guild.name}:`);
    logger.info('=====================================\n');

    guild.channels.cache
      .sort((a, b) => ((a as any).position || 0) - ((b as any).position || 0))
      .forEach(channel => {
        const parent = channel.parent ? ` (${channel.parent.name})` : '';
        logger.info(`${channel.name}${parent}: ${channel.id}`);
      });

    logger.info('\n=====================================\n');
    process.exit(0);
  });

  await client.login(config.token);
}

main().catch((error) => {
  logger.error('Failed to get channel IDs', error);
  process.exit(1);
});
