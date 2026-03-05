import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { query, initializeDatabase } from '../utils/database';

/**
 * Unverify all users for testing
 * - Removes Verified role from all members
 * - Updates database to set verified = false
 */

async function main() {
  // Initialize database
  initializeDatabase(config.databaseUrl);

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
      logger.error('Verified role not found');
      process.exit(1);
    }

    logger.info('\n🔄 Unverifying All Users...');
    logger.info('=====================================\n');

    let removedCount = 0;
    let errorCount = 0;

    // Fetch all members
    await guild.members.fetch();

    // Loop through all members
    for (const [, member] of guild.members.cache) {
      // Skip bots
      if (member.user.bot) {
        continue;
      }

      // Check if member has Verified role
      if (member.roles.cache.has(verifiedRole.id)) {
        try {
          // Remove Verified role
          await member.roles.remove(verifiedRole);

          // Update database
          await query(
            `UPDATE discord_users
             SET verified = false, verified_at = NULL
             WHERE user_id = $1`,
            [member.user.id]
          );

          logger.info(`✅ Unverified: ${member.user.username} (${member.user.id})`);
          removedCount++;
        } catch (error) {
          logger.error(`❌ Failed to unverify ${member.user.username}:`, error);
          errorCount++;
        }
      }
    }

    logger.info('\n=====================================');
    logger.info(`✅ Users unverified: ${removedCount}`);
    if (errorCount > 0) {
      logger.warn(`❌ Errors: ${errorCount}`);
    }
    logger.info('=====================================\n');

    logger.info('✨ All users have been unverified!');
    logger.info('They can now go through the verification process again.');

    process.exit(0);
  });

  await client.login(config.token);
}

main().catch((error) => {
  logger.error('Failed to unverify users', error);
  process.exit(1);
});
