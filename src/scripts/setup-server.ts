import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, Guild } from 'discord.js';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

/**
 * Complete Discord Server Setup Script
 * Creates channels, categories, roles, and permissions for BitSage Network
 */

interface ChannelConfig {
  name: string;
  type: ChannelType;
  topic?: string;
  nsfw?: boolean;
  rateLimitPerUser?: number;
  position?: number;
}

interface CategoryConfig {
  name: string;
  position?: number;
  channels: ChannelConfig[];
}

const SERVER_STRUCTURE: CategoryConfig[] = [
  {
    name: '📢 INFORMATION',
    position: 0,
    channels: [
      {
        name: 'welcome',
        type: ChannelType.GuildText,
        topic: '👋 Welcome to BitSage Network! Start here for onboarding and server rules.',
        rateLimitPerUser: 60
      },
      {
        name: 'rules',
        type: ChannelType.GuildText,
        topic: '📜 Server rules and community guidelines. Read before participating!',
        rateLimitPerUser: 60
      },
      {
        name: 'announcements',
        type: ChannelType.GuildText,
        topic: '📣 Official BitSage Network announcements and updates',
        rateLimitPerUser: 60
      },
      {
        name: 'roadmap',
        type: ChannelType.GuildText,
        topic: '🗺️ Project roadmap, milestones, and development progress',
        rateLimitPerUser: 60
      },
      {
        name: 'faq',
        type: ChannelType.GuildText,
        topic: '❓ Frequently Asked Questions about BitSage Network',
        rateLimitPerUser: 30
      }
    ]
  },
  {
    name: '💬 GENERAL',
    position: 1,
    channels: [
      {
        name: 'general',
        type: ChannelType.GuildText,
        topic: '💭 General discussion about BitSage and decentralized computing'
      },
      {
        name: 'introductions',
        type: ChannelType.GuildText,
        topic: '👋 Introduce yourself to the community!'
      },
      {
        name: 'off-topic',
        type: ChannelType.GuildText,
        topic: '🎲 Random discussions, memes, and off-topic chat'
      },
      {
        name: 'general-voice',
        type: ChannelType.GuildVoice
      }
    ]
  },
  {
    name: '⚡ NETWORK',
    position: 2,
    channels: [
      {
        name: 'network-stats',
        type: ChannelType.GuildText,
        topic: '📊 Real-time BitSage Network statistics and metrics',
        rateLimitPerUser: 10
      },
      {
        name: 'job-updates',
        type: ChannelType.GuildText,
        topic: '🔄 Automated job completion notifications and network activity',
        rateLimitPerUser: 5
      },
      {
        name: 'validator-chat',
        type: ChannelType.GuildText,
        topic: '🔐 Discussion for validators and node operators'
      },
      {
        name: 'worker-support',
        type: ChannelType.GuildText,
        topic: '🛠️ Help and support for setting up and running worker nodes'
      },
      {
        name: 'proof-discussion',
        type: ChannelType.GuildText,
        topic: '🧮 ZK proofs, Stwo prover, and cryptography discussions'
      }
    ]
  },
  {
    name: '💰 REWARDS & STAKING',
    position: 3,
    channels: [
      {
        name: 'staking-info',
        type: ChannelType.GuildText,
        topic: '💎 SAGE token staking information, rewards, and strategies',
        rateLimitPerUser: 30
      },
      {
        name: 'rewards-chat',
        type: ChannelType.GuildText,
        topic: '🎁 Discuss rewards, earnings, and token economics'
      },
      {
        name: 'trading',
        type: ChannelType.GuildText,
        topic: '📈 SAGE token price discussion, market analysis, and trading',
        nsfw: false
      },
      {
        name: 'partnerships',
        type: ChannelType.GuildText,
        topic: '🤝 Partnership opportunities and collaboration discussions'
      }
    ]
  },
  {
    name: '🎮 GAMIFICATION',
    position: 4,
    channels: [
      {
        name: 'leaderboard',
        type: ChannelType.GuildText,
        topic: '🏆 XP leaderboards, top contributors, and ranking system',
        rateLimitPerUser: 30
      },
      {
        name: 'achievements',
        type: ChannelType.GuildText,
        topic: '🎖️ Achievement unlocks and milestone celebrations'
      },
      {
        name: 'quests',
        type: ChannelType.GuildText,
        topic: '📜 Active quests, challenges, and community events'
      },
      {
        name: 'trivia',
        type: ChannelType.GuildText,
        topic: '🧠 Trivia games, quizzes, and knowledge challenges'
      },
      {
        name: 'contests',
        type: ChannelType.GuildText,
        topic: '🎯 Community contests, competitions, and giveaways'
      }
    ]
  },
  {
    name: '💻 DEVELOPMENT',
    position: 5,
    channels: [
      {
        name: 'dev-chat',
        type: ChannelType.GuildText,
        topic: '👨‍💻 Development discussion, code reviews, and technical talk'
      },
      {
        name: 'github-updates',
        type: ChannelType.GuildText,
        topic: '🔔 Automated GitHub commits, PRs, and repository updates',
        rateLimitPerUser: 5
      },
      {
        name: 'bug-reports',
        type: ChannelType.GuildText,
        topic: '🐛 Report bugs, issues, and technical problems'
      },
      {
        name: 'feature-requests',
        type: ChannelType.GuildText,
        topic: '💡 Suggest new features and improvements'
      },
      {
        name: 'dev-voice',
        type: ChannelType.GuildVoice
      }
    ]
  },
  {
    name: '🆘 SUPPORT',
    position: 6,
    channels: [
      {
        name: 'help',
        type: ChannelType.GuildText,
        topic: '❓ Get help with BitSage platform, commands, and features'
      },
      {
        name: 'ticket-support',
        type: ChannelType.GuildText,
        topic: '🎫 Create support tickets for technical assistance'
      },
      {
        name: 'feedback',
        type: ChannelType.GuildText,
        topic: '📝 Share your feedback, suggestions, and ideas'
      }
    ]
  },
  {
    name: '🎨 COMMUNITY',
    position: 7,
    channels: [
      {
        name: 'media',
        type: ChannelType.GuildText,
        topic: '📸 Share images, videos, and creative content'
      },
      {
        name: 'memes',
        type: ChannelType.GuildText,
        topic: '😂 Memes, jokes, and funny content'
      },
      {
        name: 'showcase',
        type: ChannelType.GuildText,
        topic: '🌟 Showcase your projects, builds, and achievements'
      },
      {
        name: 'community-voice',
        type: ChannelType.GuildVoice
      },
      {
        name: 'music',
        type: ChannelType.GuildVoice
      }
    ]
  },
  {
    name: '🔒 PRIVATE',
    position: 8,
    channels: [
      {
        name: 'mod-chat',
        type: ChannelType.GuildText,
        topic: '🛡️ Moderator-only chat and coordination'
      },
      {
        name: 'admin-logs',
        type: ChannelType.GuildText,
        topic: '📋 Automated moderation and admin action logs'
      },
      {
        name: 'core-team',
        type: ChannelType.GuildText,
        topic: '👑 Core team private discussions'
      }
    ]
  }
];

const ROLES_CONFIG = [
  {
    name: 'Core Team',
    color: 0xff0000, // Red
    hoist: true,
    permissions: [PermissionFlagsBits.Administrator]
  },
  {
    name: 'Moderator',
    color: 0x00ff00, // Green
    hoist: true,
    permissions: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageNicknames,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers
    ]
  },
  {
    name: 'Validator',
    color: 0x9b59b6, // Purple
    hoist: true,
    permissions: []
  },
  {
    name: 'Worker Node',
    color: 0x3498db, // Blue
    hoist: true,
    permissions: []
  },
  {
    name: 'Developer',
    color: 0xe67e22, // Orange
    hoist: true,
    permissions: []
  },
  {
    name: 'Early Supporter',
    color: 0xf1c40f, // Gold
    hoist: true,
    permissions: []
  },
  {
    name: 'Verified',
    color: 0x2ecc71, // Light Green
    hoist: false,
    permissions: []
  },
  // Level-based roles
  {
    name: 'Level 10',
    color: 0xc0c0c0, // Silver
    hoist: false,
    permissions: []
  },
  {
    name: 'Level 25',
    color: 0xffd700, // Gold
    hoist: false,
    permissions: []
  },
  {
    name: 'Level 50',
    color: 0x00ffff, // Cyan
    hoist: false,
    permissions: []
  },
  {
    name: 'Level 100',
    color: 0xff00ff, // Magenta
    hoist: false,
    permissions: []
  }
];

async function setupRoles(guild: Guild) {
  logger.info('Setting up roles...');

  const createdRoles = new Map<string, string>();

  for (const roleConfig of ROLES_CONFIG) {
    // Check if role already exists
    const existingRole = guild.roles.cache.find(r => r.name === roleConfig.name);

    if (existingRole) {
      logger.info(`Role already exists: ${roleConfig.name}`);
      createdRoles.set(roleConfig.name, existingRole.id);
      continue;
    }

    try {
      const role = await guild.roles.create({
        name: roleConfig.name,
        color: roleConfig.color,
        hoist: roleConfig.hoist,
        permissions: roleConfig.permissions,
        mentionable: true
      });

      createdRoles.set(roleConfig.name, role.id);
      logger.info(`✅ Created role: ${roleConfig.name}`);
    } catch (error) {
      logger.error(`Failed to create role: ${roleConfig.name}`, error);
    }
  }

  return createdRoles;
}

async function setupChannels(guild: Guild, roles: Map<string, string>) {
  logger.info('Setting up channels and categories...');

  const channelIds = new Map<string, string>();

  for (const categoryConfig of SERVER_STRUCTURE) {
    // Check if category already exists
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name === categoryConfig.name
    );

    if (!category) {
      try {
        category = await guild.channels.create({
          name: categoryConfig.name,
          type: ChannelType.GuildCategory,
          position: categoryConfig.position
        });
        logger.info(`✅ Created category: ${categoryConfig.name}`);
      } catch (error) {
        logger.error(`Failed to create category: ${categoryConfig.name}`, error);
        continue;
      }
    } else {
      logger.info(`Category already exists: ${categoryConfig.name}`);
    }

    // Set up permissions for private channels
    if (categoryConfig.name.includes('PRIVATE') && category && 'permissionOverwrites' in category) {
      const modRoleId = roles.get('Moderator');
      const coreTeamRoleId = roles.get('Core Team');

      await (category as any).permissionOverwrites.edit(guild.id, {
        ViewChannel: false
      });

      if (modRoleId) {
        await (category as any).permissionOverwrites.edit(modRoleId, {
          ViewChannel: true
        });
      }

      if (coreTeamRoleId) {
        await (category as any).permissionOverwrites.edit(coreTeamRoleId, {
          ViewChannel: true,
          ManageChannels: true
        });
      }
    }

    // Create channels in category
    for (const channelConfig of categoryConfig.channels) {
      // Check if channel already exists
      const existingChannel = guild.channels.cache.find(
        c => c.name === channelConfig.name && c.parentId === category.id
      );

      if (existingChannel) {
        logger.info(`Channel already exists: ${channelConfig.name}`);
        channelIds.set(channelConfig.name, existingChannel.id);
        continue;
      }

      try {
        const channel = await guild.channels.create({
          name: channelConfig.name,
          type: channelConfig.type as any,
          topic: channelConfig.topic,
          nsfw: channelConfig.nsfw || false,
          rateLimitPerUser: channelConfig.rateLimitPerUser || 0,
          parent: category.id,
          position: channelConfig.position
        });

        channelIds.set(channelConfig.name, channel.id);
        logger.info(`✅ Created channel: ${channelConfig.name}`);

        // Set up special permissions for certain channels
        if (channelConfig.name === 'announcements' || channelConfig.name === 'rules') {
          // Only moderators and core team can send messages
          await channel.permissionOverwrites.edit(guild.id, {
            SendMessages: false
          });

          const modRoleId = roles.get('Moderator');
          const coreTeamRoleId = roles.get('Core Team');

          if (modRoleId) {
            await channel.permissionOverwrites.edit(modRoleId, {
              SendMessages: true
            });
          }

          if (coreTeamRoleId) {
            await channel.permissionOverwrites.edit(coreTeamRoleId, {
              SendMessages: true
            });
          }
        }

        // Read-only for automated channels
        if (channelConfig.name === 'network-stats' ||
            channelConfig.name === 'job-updates' ||
            channelConfig.name === 'github-updates' ||
            channelConfig.name === 'admin-logs') {
          await channel.permissionOverwrites.edit(guild.id, {
            SendMessages: false
          });

          // Bot can send messages
          const botMember = guild.members.me;
          if (botMember) {
            await channel.permissionOverwrites.edit(botMember.id, {
              SendMessages: true
            });
          }
        }

      } catch (error) {
        logger.error(`Failed to create channel: ${channelConfig.name}`, error);
      }
    }
  }

  return channelIds;
}

async function updateEnvWithChannelIds(channelIds: Map<string, string>) {
  logger.info('Updating .env with channel IDs...');

  const envUpdates = [
    `JOB_NOTIFICATION_CHANNEL_ID=${channelIds.get('job-updates') || ''}`,
    `NETWORK_STATS_CHANNEL_ID=${channelIds.get('network-stats') || ''}`,
    `WELCOME_CHANNEL_ID=${channelIds.get('welcome') || ''}`,
    `RULES_CHANNEL_ID=${channelIds.get('rules') || ''}`,
    `ANNOUNCEMENTS_CHANNEL_ID=${channelIds.get('announcements') || ''}`,
    `LEADERBOARD_CHANNEL_ID=${channelIds.get('leaderboard') || ''}`,
    `ACHIEVEMENTS_CHANNEL_ID=${channelIds.get('achievements') || ''}`,
    `GITHUB_UPDATES_CHANNEL_ID=${channelIds.get('github-updates') || ''}`,
    `ADMIN_LOGS_CHANNEL_ID=${channelIds.get('admin-logs') || ''}`
  ];

  logger.info('\n📝 Add these to your .env file:');
  logger.info('=====================================');
  envUpdates.forEach(update => logger.info(update));
  logger.info('=====================================\n');
}

async function main() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers
    ]
  });

  client.once('ready', async () => {
    logger.info(`Logged in as ${client.user?.tag}`);

    const guildId = config.guildId;
    if (!guildId) {
      logger.error('GUILD_ID not set in .env');
      process.exit(1);
    }

    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      logger.error(`Guild ${guildId} not found`);
      process.exit(1);
    }

    logger.info(`Setting up server: ${guild.name}`);
    logger.info('=====================================\n');

    try {
      // Step 1: Create roles
      const roles = await setupRoles(guild);
      logger.info(`\n✅ Created ${roles.size} roles\n`);

      // Step 2: Create channels and categories
      const channelIds = await setupChannels(guild, roles);
      logger.info(`\n✅ Created ${channelIds.size} channels\n`);

      // Step 3: Print channel IDs for .env
      await updateEnvWithChannelIds(channelIds);

      logger.info('\n🎉 Server setup complete!');
      logger.info('=====================================\n');

    } catch (error) {
      logger.error('Error during server setup', error);
    }

    process.exit(0);
  });

  await client.login(config.token);
}

main().catch((error) => {
  logger.error('Failed to run server setup', error);
  process.exit(1);
});
