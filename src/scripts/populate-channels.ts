import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ChannelType
} from 'discord.js';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import * as EMOJI from '../utils/emojis';

/**
 * Populate Discord channels with initial content
 * Creates welcome messages, rules, announcements, verification, etc.
 */

interface ChannelContent {
  channelName: string;
  embeds: EmbedBuilder[];
  components?: ActionRowBuilder<ButtonBuilder>[];
}

const CHANNEL_CONTENT: ChannelContent[] = [
  // ==================== WELCOME CHANNEL ====================
  {
    channelName: 'welcome',
    embeds: [
      new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`${EMOJI.SOCIAL.WAVE} Welcome to BitSage Network!`)
        .setDescription(`
**The Future of Decentralized Computing is Here!**

BitSage Network is a revolutionary decentralized compute platform powered by:
${EMOJI.STATUS.SUCCESS} Zero-Knowledge Proofs (Stwo Prover)
${EMOJI.STATUS.SUCCESS} Starknet Blockchain
${EMOJI.STATUS.SUCCESS} GPU-Accelerated Proving
${EMOJI.STATUS.SUCCESS} Transparent Reputation System
${EMOJI.STATUS.SUCCESS} Fair Tokenomics (SAGE Token)

Whether you're a validator, developer, or community member - you're in the right place!
        `)
        .addFields(
          {
            name: `${EMOJI.PROGRESS.ROCKET} Get Started`,
            value: `
1️⃣ Read the rules in <#${config.guildId ? '1456764014846677158' : 'rules'}>
2️⃣ Complete verification
3️⃣ Introduce yourself in <#1456764022102364221>
4️⃣ Start earning XP by chatting!
5️⃣ Claim your daily reward with \`/daily\`
            `,
            inline: false
          },
          {
            name: `${EMOJI.ACTIONS.LEARN} Quick Links`,
            value: `
${EMOJI.NETWORK.LINK} [Website](https://bitsage.network)
${EMOJI.NETWORK.LINK} [Documentation](https://docs.bitsage.network)
${EMOJI.NETWORK.LINK} [GitHub](https://github.com/bitsage-network)
${EMOJI.NETWORK.LINK} [Twitter](https://twitter.com/bitsagenetwork)
            `,
            inline: true
          },
          {
            name: `${EMOJI.ACTIONS.HELP} Need Help?`,
            value: `
Visit <#1456764066608681021> for support
Create a ticket in <#1456764067581804574>
Check <#1456764020860047472> for common questions
            `,
            inline: true
          }
        )
        .setImage('https://via.placeholder.com/800x200/00ff88/000000?text=BitSage+Network')
        .setFooter({ text: 'Welcome aboard! 🚀' })
        .setTimestamp()
    ]
  },

  // ==================== RULES CHANNEL ====================
  {
    channelName: 'rules',
    embeds: [
      new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle(`${EMOJI.STATUS.WARNING} Server Rules & Guidelines`)
        .setDescription(`
**By participating in this server, you agree to follow these rules.**
Violations may result in warnings, mutes, kicks, or bans.
        `)
        .addFields(
          {
            name: '1️⃣ Be Respectful',
            value: 'Treat all members with respect. No harassment, hate speech, discrimination, or personal attacks.',
            inline: false
          },
          {
            name: '2️⃣ No Spam or Self-Promotion',
            value: 'Do not spam messages, links, or ads. No unsolicited DMs. Self-promotion requires moderator approval.',
            inline: false
          },
          {
            name: '3️⃣ English Primary Language',
            value: 'Keep conversations in English in public channels. Other languages allowed in designated channels.',
            inline: false
          },
          {
            name: '4️⃣ Use Appropriate Channels',
            value: 'Post in the correct channels. Read channel descriptions before posting.',
            inline: false
          },
          {
            name: '5️⃣ No NSFW Content',
            value: 'No NSFW, gore, or inappropriate content anywhere in the server.',
            inline: false
          },
          {
            name: '6️⃣ No Impersonation',
            value: 'Do not impersonate team members, moderators, bots, or other users.',
            inline: false
          },
          {
            name: '7️⃣ No Scams or Phishing',
            value: 'No scam links, phishing attempts, malware, or fraudulent schemes. Report suspicious activity immediately.',
            inline: false
          },
          {
            name: '8️⃣ Respect Privacy',
            value: 'Do not share personal information (yours or others). Do not dox or threaten members.',
            inline: false
          },
          {
            name: '9️⃣ Follow Discord ToS',
            value: 'All Discord Terms of Service and Community Guidelines apply here.',
            inline: false
          },
          {
            name: '🔟 Moderator Discretion',
            value: 'Moderators have final say in all matters. Respect their decisions.',
            inline: false
          }
        )
        .setFooter({ text: 'Rules last updated' })
        .setTimestamp(),

      new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`${EMOJI.STATUS.SUCCESS} Verification Required`)
        .setDescription(`
**To access all channels and participate in the community:**

${EMOJI.PROGRESS.CHECKMARK} Read and understand the rules above
${EMOJI.PROGRESS.CHECKMARK} Click the "✅ Verify" button below
${EMOJI.PROGRESS.CHECKMARK} Get the **Verified** role and unlock all channels!

**Benefits of verification:**
${EMOJI.PROGRESS.GEM} Access to all community channels
${EMOJI.PROGRESS.GEM} Ability to earn XP and level up
${EMOJI.PROGRESS.GEM} Participate in contests and giveaways
${EMOJI.PROGRESS.GEM} Vote in governance polls
${EMOJI.PROGRESS.GEM} Claim daily rewards

Click below to verify and join the community! 👇
        `)
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('verify_user')
          .setLabel('✅ Verify')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
      )
    ]
  },

  // ==================== ANNOUNCEMENTS CHANNEL ====================
  {
    channelName: 'announcements',
    embeds: [
      new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`${EMOJI.STATUS.ONLINE} BitSage Network Launch Announcement`)
        .setDescription(`
**🎉 Welcome to the Official BitSage Discord Server! 🎉**

We're thrilled to have you here as we build the future of decentralized computing!

**What is BitSage?**
BitSage Network is a cutting-edge platform that enables:
• Decentralized job distribution and execution
• Zero-knowledge proof generation using Stwo prover
• GPU-accelerated computation
• Transparent worker reputation and rewards
• Fair token economics with SAGE token

**Current Status: Beta Launch**
${EMOJI.PROGRESS.ROCKET} Testnet is LIVE on Starknet Sepolia
${EMOJI.PROGRESS.ROCKET} Worker nodes accepting jobs
${EMOJI.PROGRESS.ROCKET} Staking contracts deployed
${EMOJI.PROGRESS.ROCKET} Dashboard and API operational

**Coming Soon:**
${EMOJI.PROGRESS.TARGET} Mainnet launch
${EMOJI.PROGRESS.TARGET} SAGE token public sale
${EMOJI.PROGRESS.TARGET} Governance system
${EMOJI.PROGRESS.TARGET} Mobile app
${EMOJI.PROGRESS.TARGET} Additional proof systems

**Get Involved:**
• Join our discussions in <#1456764022102364221>
• Run a worker node and earn rewards
• Report bugs in <#1456764056831287407>
• Suggest features in <#1456764058991923251>

Let's build something amazing together! 🚀
        `)
        .setFooter({ text: 'BitSage Network • Decentralizing Compute' })
        .setTimestamp()
    ]
  },

  // ==================== ROADMAP CHANNEL ====================
  {
    channelName: 'roadmap',
    embeds: [
      new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`${EMOJI.PROGRESS.TARGET} BitSage Network Roadmap`)
        .setDescription('**Our journey to decentralize computing**')
        .addFields(
          {
            name: `${EMOJI.STATUS.SUCCESS} Q4 2024 - Foundation (COMPLETED)`,
            value: `
✅ Core protocol development
✅ Stwo prover integration
✅ Starknet smart contracts
✅ Basic coordinator implementation
✅ GPU acceleration framework
            `,
            inline: false
          },
          {
            name: `${EMOJI.STATUS.ONLINE} Q1 2026 - Testnet Launch (IN PROGRESS)`,
            value: `
🟢 Testnet deployment on Starknet Sepolia
🟢 Discord bot and community platform
🟢 Worker node software v1.0
🟢 Web dashboard
🟡 Reputation system testing
🟡 Staking mechanism testing
            `,
            inline: false
          },
          {
            name: `${EMOJI.PROGRESS.HOURGLASS} Q2 2026 - Mainnet Preparation`,
            value: `
⚪ Security audits (contracts + infrastructure)
⚪ Mainnet deployment
⚪ SAGE token generation event
⚪ Liquidity provision
⚪ CEX/DEX listings
⚪ Bug bounty program
            `,
            inline: false
          },
          {
            name: `${EMOJI.PROGRESS.ROCKET} Q3 2026 - Ecosystem Growth`,
            value: `
⚪ Governance system launch
⚪ DAO formation
⚪ Additional proof systems (Groth16, PLONK)
⚪ Cross-chain bridge development
⚪ Enterprise partnerships
⚪ Developer SDK and APIs
            `,
            inline: false
          },
          {
            name: `${EMOJI.PROGRESS.TARGET} Q4 2026 - Scale & Innovation`,
            value: `
⚪ Mobile applications
⚪ Advanced job scheduling
⚪ AI/ML workload support
⚪ Decentralized storage integration
⚪ Multi-chain expansion
⚪ Global worker network optimization
            `,
            inline: false
          }
        )
        .setFooter({ text: 'Roadmap is subject to change based on community feedback and market conditions' })
        .setTimestamp()
    ]
  },

  // ==================== FAQ CHANNEL ====================
  {
    channelName: 'faq',
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`${EMOJI.ACTIONS.HELP} Frequently Asked Questions`)
        .setDescription('**Common questions about BitSage Network**')
        .addFields(
          {
            name: '❓ What is BitSage Network?',
            value: 'BitSage is a decentralized compute network that enables distributed job execution with zero-knowledge proofs, powered by Starknet blockchain and GPU acceleration.',
            inline: false
          },
          {
            name: '💰 What is the SAGE token?',
            value: 'SAGE is the native utility token used for payments, staking, governance, and rewards within the BitSage ecosystem.',
            inline: false
          },
          {
            name: '🖥️ How do I become a worker node?',
            value: 'Check <#1456764035176325171> for setup instructions. You\'ll need a GPU, stake SAGE tokens, and run our worker node software.',
            inline: false
          },
          {
            name: '🎮 How does the gamification system work?',
            value: 'Earn XP by chatting, helping others, completing quests, and participating in events. Level up to unlock roles and rewards! Use `/profile` and `/daily` commands.',
            inline: false
          },
          {
            name: '🔐 How are proofs verified?',
            value: 'We use the Stwo prover for ZK-STARK proof generation, verified on-chain via Starknet smart contracts.',
            inline: false
          },
          {
            name: '💎 When is the token sale?',
            value: 'SAGE token details will be announced in <#1456764018478813256>. Follow our social media for updates.',
            inline: false
          },
          {
            name: '🐛 How do I report bugs?',
            value: 'Report bugs in <#1456764056831287407> with detailed reproduction steps, logs, and screenshots.',
            inline: false
          },
          {
            name: '🤝 How can I contribute?',
            value: 'Contribute code on GitHub, improve docs, help community members, test features, or suggest improvements in <#1456764058991923251>.',
            inline: false
          }
        )
        .setFooter({ text: 'Have more questions? Ask in #help!' })
    ]
  },

  // ==================== LEADERBOARD CHANNEL ====================
  {
    channelName: 'leaderboard',
    embeds: [
      new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`${EMOJI.PROGRESS.TROPHY} BitSage Leaderboards`)
        .setDescription(`
**Compete with the community and earn your place at the top!**

${EMOJI.PROGRESS.FIRST} **Top 3 each week receive:**
• Exclusive role
• Bonus SAGE tokens (when launched)
• Special recognition in announcements

**Leaderboard Categories:**
🏆 **XP Leaderboard** - Most active community members
🔥 **Daily Streak** - Longest consecutive daily claim streaks
⭐ **Reputation** - Most helpful community members
💼 **Network Contributors** - Top validators and workers

Use \`/profile\` to check your stats!
Leaderboards update in real-time.
        `)
        .setFooter({ text: 'Keep chatting and claiming daily rewards to climb the ranks!' })
    ]
  },

  // ==================== GENERAL CHANNEL ====================
  {
    channelName: 'general',
    embeds: [
      new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${EMOJI.SOCIAL.SPEECH} Welcome to General Chat!`)
        .setDescription(`
**This is the main hub for all BitSage discussions!**

${EMOJI.ACTIONS.CHAT} **What to discuss here:**
• General BitSage topics
• Network updates and news
• Questions and answers
• Community discussions
• Collaborations and ideas

${EMOJI.STATUS.IDLE} **Please keep off-topic to** <#1456764024681119764>

${EMOJI.PROGRESS.SPARKLES} **Earn XP by chatting!**
Every message earns you 5 XP (60 second cooldown)
Level up to unlock special roles!

Let's build something amazing together! 🚀
        `)
    ]
  }
];

async function populateChannels(client: Client) {
  logger.info('Starting channel population...');

  const guildId = config.guildId;
  if (!guildId) {
    logger.error('GUILD_ID not set');
    return;
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    logger.error(`Guild ${guildId} not found`);
    return;
  }

  for (const content of CHANNEL_CONTENT) {
    try {
      // Find channel by name
      const channel = guild.channels.cache.find(
        ch => ch.name === content.channelName && ch.type === ChannelType.GuildText
      ) as TextChannel;

      if (!channel) {
        logger.warn(`Channel not found: ${content.channelName}`);
        continue;
      }

      // Check if channel already has messages
      const messages = await channel.messages.fetch({ limit: 10 });
      if (messages.size > 0) {
        logger.info(`Channel ${content.channelName} already has messages, skipping...`);
        continue;
      }

      // Send embeds
      for (const embed of content.embeds) {
        await channel.send({
          embeds: [embed],
          components: content.components || []
        });
      }

      logger.info(`✅ Populated channel: ${content.channelName}`);

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      logger.error(`Failed to populate channel: ${content.channelName}`, error);
    }
  }

  logger.info('✅ Channel population complete!');
}

async function main() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages
    ]
  });

  client.once('ready', async () => {
    logger.info(`Logged in as ${client.user?.tag}`);

    try {
      await populateChannels(client);
    } catch (error) {
      logger.error('Error populating channels', error);
    }

    process.exit(0);
  });

  await client.login(config.token);
}

main().catch((error) => {
  logger.error('Failed to run channel population', error);
  process.exit(1);
});
