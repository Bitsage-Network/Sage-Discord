import { Client, GatewayIntentBits, EmbedBuilder, TextChannel } from 'discord.js';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { query, initializeDatabase } from '../utils/database';

/**
 * Update server statistics display
 *
 * Creates/updates an embed in a designated channel showing:
 * - Total members
 * - Online members
 * - Verified members
 * - Active bots
 * - Role distribution
 * - Region distribution
 * - Recent activity
 */

async function main() {
  // Initialize database
  initializeDatabase(config.databaseUrl);

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences
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

    // Find or create stats channel
    let statsChannel = guild.channels.cache.find(
      c => c.name === 'server-stats' && c.isTextBased()
    ) as TextChannel;

    if (!statsChannel) {
      logger.info('Stats channel not found, finding network-stats channel...');
      statsChannel = guild.channels.cache.find(
        c => c.name === 'network-stats' && c.isTextBased()
      ) as TextChannel;
    }

    if (!statsChannel) {
      logger.error('No stats channel found (looking for server-stats or network-stats)');
      process.exit(1);
    }

    logger.info('\n📊 Collecting Server Statistics...');
    logger.info('====================================\n');

    // Fetch all members
    await guild.members.fetch();

    // Calculate statistics
    const totalMembers = guild.memberCount;
    const botCount = guild.members.cache.filter(m => m.user.bot).size;
    const humanCount = totalMembers - botCount;

    const onlineMembers = guild.members.cache.filter(
      m => !m.user.bot && (m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle')
    ).size;

    // Get verified members count
    const verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
    const verifiedCount = verifiedRole ? guild.members.cache.filter(m => m.roles.cache.has(verifiedRole.id)).size : 0;

    // Role distribution
    const roleStats: { [key: string]: number } = {};
    const roleNames = ['Developer', 'Validator', 'Worker Node', 'Early Supporter', 'Investor/Trader'];

    roleNames.forEach(roleName => {
      const role = guild.roles.cache.find(r => r.name === roleName);
      if (role) {
        roleStats[roleName] = guild.members.cache.filter(m => m.roles.cache.has(role.id)).size;
      }
    });

    // Get database stats
    let totalXP = 0;
    let totalMessages = 0;
    let activeToday = 0;

    try {
      const xpResult = await query('SELECT SUM(xp) as total FROM discord_users');
      totalXP = parseInt(xpResult.rows[0]?.total || '0');

      const msgResult = await query('SELECT COUNT(*) as total FROM message_xp');
      totalMessages = parseInt(msgResult.rows[0]?.total || '0');

      const activeResult = await query(`
        SELECT COUNT(DISTINCT user_id) as count
        FROM message_xp
        WHERE last_xp_at > NOW() - INTERVAL '24 hours'
      `);
      activeToday = parseInt(activeResult.rows[0]?.count || '0');
    } catch (error) {
      logger.warn('Could not fetch database stats:', error);
    }

    // Create stats embed
    const statsEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('📊 BitSage Network - Server Statistics')
      .setDescription('Real-time server statistics and activity metrics')
      .addFields(
        {
          name: '👥 Members',
          value: `**Total:** ${totalMembers.toLocaleString()}\n**Humans:** ${humanCount.toLocaleString()}\n**Bots:** ${botCount}\n**Online:** ${onlineMembers.toLocaleString()}\n**Verified:** ${verifiedCount.toLocaleString()}`,
          inline: true
        },
        {
          name: '📈 Activity',
          value: `**Active Today:** ${activeToday.toLocaleString()}\n**Total Messages:** ${totalMessages.toLocaleString()}\n**Total XP Earned:** ${totalXP.toLocaleString()}\n**Avg XP/User:** ${Math.round(totalXP / Math.max(humanCount, 1))}`,
          inline: true
        },
        {
          name: '🔹 Roles',
          value: Object.entries(roleStats)
            .filter(([, count]) => count > 0)
            .map(([role, count]) => {
              const emoji =
                role === 'Developer' ? '💻' :
                role === 'Validator' ? '🖥️' :
                role === 'Worker Node' ? '⚙️' :
                role === 'Early Supporter' ? '💎' :
                role === 'Investor/Trader' ? '📊' : '👤';
              return `${emoji} **${role}:** ${count}`;
            })
            .join('\n') || 'No roles assigned yet',
          inline: false
        },
        {
          name: '🌍 Server Info',
          value: `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>\n**Channels:** ${guild.channels.cache.size}\n**Roles:** ${guild.roles.cache.size}\n**Boost Level:** ${guild.premiumTier}`,
          inline: true
        },
        {
          name: '🤖 Active Bots',
          value: guild.members.cache
            .filter(m => m.user.bot)
            .map(m => `• ${m.user.username}`)
            .slice(0, 5)
            .join('\n') || 'No bots',
          inline: true
        }
      )
      .setFooter({ text: `Last updated • Use /profile to check your stats` })
      .setTimestamp();

    // Post or update stats message
    try {
      const messages = await statsChannel.messages.fetch({ limit: 10 });
      const existingStatsMsg = messages.find(
        m => m.author.id === client.user?.id && m.embeds.length > 0 && m.embeds[0].title?.includes('Server Statistics')
      );

      if (existingStatsMsg) {
        await existingStatsMsg.edit({ embeds: [statsEmbed] });
        logger.info('✅ Updated existing stats message');
      } else {
        await statsChannel.send({ embeds: [statsEmbed] });
        logger.info('✅ Posted new stats message');
      }

      logger.info('\n====================================');
      logger.info('📊 Statistics Summary:');
      logger.info(`  Total Members: ${totalMembers}`);
      logger.info(`  Verified: ${verifiedCount}`);
      logger.info(`  Online: ${onlineMembers}`);
      logger.info(`  Active Today: ${activeToday}`);
      logger.info('====================================\n');

    } catch (error) {
      logger.error('Failed to post stats:', error);
    }

    process.exit(0);
  });

  await client.login(config.token);
}

main().catch((error) => {
  logger.error('Failed to update server stats', error);
  process.exit(1);
});
