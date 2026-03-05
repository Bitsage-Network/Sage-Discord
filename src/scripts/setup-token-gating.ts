import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

/**
 * Setup token-gated infrastructure for Collab.Land integration
 *
 * Creates roles and channels for:
 * 1. SAGE Holders (1000+ tokens)
 * 2. SAGE Whales (10,000+ tokens)
 * 3. Validator Operators (on-chain proof)
 * 4. Worker Node Operators (on-chain proof)
 */

interface TokenRole {
  name: string;
  color: number;
  hoist: boolean;
  description: string;
}

interface TokenChannel {
  name: string;
  type: ChannelType;
  category: string;
  topic: string;
  allowedRoles: string[];
}

const TOKEN_ROLES: TokenRole[] = [
  {
    name: 'SAGE Holder',
    color: 0xFFD700, // Gold
    hoist: true,
    description: 'Holds 1,000+ SAGE tokens'
  },
  {
    name: 'SAGE Whale',
    color: 0xFF1493, // Pink
    hoist: true,
    description: 'Holds 10,000+ SAGE tokens'
  },
  {
    name: 'Validator Operator',
    color: 0x00CED1, // Cyan
    hoist: true,
    description: 'Verified on-chain validator'
  },
  {
    name: 'Worker Operator',
    color: 0x9370DB, // Purple
    hoist: true,
    description: 'Verified worker node operator'
  }
];

const TOKEN_CHANNELS: TokenChannel[] = [
  // SAGE Holder channels
  {
    name: 'holders-only',
    type: ChannelType.GuildText,
    category: '💎 TOKEN HOLDERS',
    topic: '💰 Exclusive chat for SAGE token holders (1000+ tokens)',
    allowedRoles: ['SAGE Holder', 'SAGE Whale']
  },
  {
    name: 'holders-announcements',
    type: ChannelType.GuildText,
    category: '💎 TOKEN HOLDERS',
    topic: '📢 Important announcements for SAGE holders',
    allowedRoles: ['SAGE Holder', 'SAGE Whale']
  },
  {
    name: 'governance-discussion',
    type: ChannelType.GuildText,
    category: '💎 TOKEN HOLDERS',
    topic: '🏛️ Governance proposals and voting discussions',
    allowedRoles: ['SAGE Holder', 'SAGE Whale']
  },
  // SAGE Whale exclusive
  {
    name: 'whale-lounge',
    type: ChannelType.GuildText,
    category: '💎 TOKEN HOLDERS',
    topic: '🐋 Exclusive lounge for large SAGE holders (10,000+ tokens)',
    allowedRoles: ['SAGE Whale']
  },
  // Validator channels
  {
    name: 'validator-lounge',
    type: ChannelType.GuildText,
    category: '⚡ OPERATORS',
    topic: '🖥️ Exclusive chat for verified validator operators',
    allowedRoles: ['Validator Operator']
  },
  {
    name: 'validator-alerts',
    type: ChannelType.GuildText,
    category: '⚡ OPERATORS',
    topic: '🚨 Real-time alerts and notifications for validators',
    allowedRoles: ['Validator Operator']
  },
  // Worker channels
  {
    name: 'worker-lounge',
    type: ChannelType.GuildText,
    category: '⚡ OPERATORS',
    topic: '⚙️ Exclusive chat for verified worker node operators',
    allowedRoles: ['Worker Operator']
  },
  // Verification channel
  {
    name: 'verify-wallet',
    type: ChannelType.GuildText,
    category: '🔐 VERIFICATION',
    topic: '🔗 Connect your Starknet wallet to verify token holdings and node operations',
    allowedRoles: [] // Public, everyone can verify
  }
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

    logger.info('\n💎 Setting up Token-Gated Infrastructure...');
    logger.info('==============================================\n');

    // Create token-gated roles
    logger.info('📋 Creating Token-Gated Roles...\n');

    const createdRoles = new Map<string, string>();

    for (const roleConfig of TOKEN_ROLES) {
      let role = guild.roles.cache.find(r => r.name === roleConfig.name);

      if (role) {
        logger.info(`✓ Role "${roleConfig.name}" already exists`);
        createdRoles.set(roleConfig.name, role.id);
      } else {
        role = await guild.roles.create({
          name: roleConfig.name,
          color: roleConfig.color,
          hoist: roleConfig.hoist,
          reason: 'Token-gated role for Collab.Land'
        });
        logger.info(`✅ Created role: ${roleConfig.name} (${roleConfig.description})`);
        createdRoles.set(roleConfig.name, role.id);
      }
    }

    // Create categories and channels
    logger.info('\n📁 Creating Token-Gated Channels...\n');

    const categories = new Map<string, any>();

    for (const channelConfig of TOKEN_CHANNELS) {
      // Create category if it doesn't exist
      if (!categories.has(channelConfig.category)) {
        let category = guild.channels.cache.find(
          c => c.name === channelConfig.category && c.type === ChannelType.GuildCategory
        );

        if (!category) {
          category = await guild.channels.create({
            name: channelConfig.category,
            type: ChannelType.GuildCategory,
            reason: 'Token-gated category'
          });
          logger.info(`📂 Created category: ${channelConfig.category}`);
        }

        categories.set(channelConfig.category, category);
      }

      const category = categories.get(channelConfig.category);

      // Check if channel exists
      let channel = guild.channels.cache.find(
        c => c.name === channelConfig.name && c.type === channelConfig.type
      );

      if (!channel) {
        channel = await guild.channels.create({
          name: channelConfig.name,
          type: channelConfig.type,
          parent: category.id,
          topic: channelConfig.topic,
          reason: 'Token-gated channel'
        });

        logger.info(`✅ Created channel: #${channelConfig.name}`);
      } else {
        logger.info(`✓ Channel #${channelConfig.name} already exists`);
      }

      // Set permissions
      if ('permissionOverwrites' in channel) {
        // Deny @everyone by default
        await (channel as any).permissionOverwrites.edit(guild.id, {
          ViewChannel: channelConfig.allowedRoles.length === 0 ? true : false
        });

        // Allow specific roles
        for (const roleName of channelConfig.allowedRoles) {
          const roleId = createdRoles.get(roleName);
          if (roleId) {
            await (channel as any).permissionOverwrites.edit(roleId, {
              ViewChannel: true,
              SendMessages: true,
              ReadMessageHistory: true
            });
          }
        }

        // Always allow Moderator and Core Team
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

        const roleList = channelConfig.allowedRoles.length > 0
          ? channelConfig.allowedRoles.join(', ')
          : 'Everyone (Verification Channel)';
        logger.info(`  🔒 Permissions set for: ${roleList}`);
      }
    }

    logger.info('\n==============================================');
    logger.info('✅ Token-Gated Infrastructure Setup Complete!\n');

    logger.info('📊 Summary:');
    logger.info(`  Roles Created: ${TOKEN_ROLES.length}`);
    logger.info(`  Channels Created: ${TOKEN_CHANNELS.length}`);
    logger.info(`  Categories Created: ${categories.size}\n`);

    logger.info('🔑 Token-Gated Roles:');
    TOKEN_ROLES.forEach(r => logger.info(`  • ${r.name} - ${r.description}`));

    logger.info('\n📁 Token-Gated Channels:');
    logger.info('  💎 TOKEN HOLDERS:');
    logger.info('    • #holders-only - SAGE Holder + SAGE Whale');
    logger.info('    • #holders-announcements - SAGE Holder + SAGE Whale');
    logger.info('    • #governance-discussion - SAGE Holder + SAGE Whale');
    logger.info('    • #whale-lounge - SAGE Whale only');
    logger.info('  ⚡ OPERATORS:');
    logger.info('    • #validator-lounge - Validator Operator');
    logger.info('    • #validator-alerts - Validator Operator');
    logger.info('    • #worker-lounge - Worker Operator');
    logger.info('  🔐 VERIFICATION:');
    logger.info('    • #verify-wallet - Public (everyone)');

    logger.info('\n🔗 Next Steps:');
    logger.info('  1. Invite Collab.Land: https://collab.land');
    logger.info('  2. Follow the setup guide in COLLABLAND_SETUP.md');
    logger.info('  3. Configure token requirements for each role');
    logger.info('  4. Test wallet verification in #verify-wallet');

    process.exit(0);
  });

  await client.login(config.token);
}

main().catch((error) => {
  logger.error('Failed to setup token gating', error);
  process.exit(1);
});
