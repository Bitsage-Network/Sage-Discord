import { GuildMember, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getOrCreateUser } from '../services/gamification-service';
import { logger } from '../utils/logger';
import * as EMOJI from '../utils/emojis';
import { handleMemberJoin } from '../bot-protection/events/member-join-handler';

/**
 * Handle new member join - send welcome DM and onboarding
 */
export async function handleGuildMemberAdd(member: GuildMember) {
  try {
    const userId = member.user.id;
    const username = member.user.username;

    // FIRST: Run bot protection (captcha, raid detection, lockdown check)
    await handleMemberJoin(member);

    // Create user in database for gamification
    await getOrCreateUser(userId, username);

    // Create welcome embed
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle(`${EMOJI.SOCIAL.WAVE} Welcome to BitSage Network!`)
      .setDescription(
        `Hey **${username}**! ${EMOJI.SOCIAL.PARTY}\n\n` +
        `Welcome to the **BitSage Network** - the future of decentralized computing!\n\n` +
        `We're building the next generation of compute infrastructure on Starknet, powered by zero-knowledge proofs and GPU acceleration.\n\n` +
        `**🎯 Your Onboarding Steps:**\n` +
        `1️⃣ Read the server rules in <#1456764014846677158>\n` +
        `2️⃣ Click the **✅ Verify** button in <#1456764014846677158>\n` +
        `3️⃣ Introduce yourself in <#1456764022102364221>\n` +
        `4️⃣ Start chatting to earn XP!\n` +
        `5️⃣ Claim your daily reward with \`/daily\`\n\n` +
        `**⚠️ IMPORTANT:** You must verify to access most channels!\n\n` +
        `**🎮 Gamification System:**\n` +
        `${EMOJI.PROGRESS.XP} Earn **5 XP per message** (60s cooldown)\n` +
        `${EMOJI.PROGRESS.TROPHY} Daily rewards with **streak bonuses**\n` +
        `${EMOJI.PROGRESS.LEVEL_UP} Level up to unlock **special roles**\n` +
        `${EMOJI.GAME.TARGET} Complete **quests** for exclusive rewards`
      )
      .addFields(
        {
          name: `${EMOJI.ACTIONS.LEARN} What is BitSage?`,
          value:
            `${EMOJI.STATUS.SUCCESS} Decentralized job distribution\n` +
            `${EMOJI.STATUS.SUCCESS} Zero-knowledge proofs (Stwo)\n` +
            `${EMOJI.STATUS.SUCCESS} GPU-accelerated proving\n` +
            `${EMOJI.STATUS.SUCCESS} Fair tokenomics (SAGE token)`,
          inline: true
        },
        {
          name: `${EMOJI.ACTIONS.HELP} Useful Links`,
          value:
            `[Website](https://bitsage.network)\n` +
            `[Docs](https://docs.bitsage.network)\n` +
            `[GitHub](https://github.com/bitsage-network)\n` +
            `[Twitter](https://twitter.com/bitsagenetwork)`,
          inline: true
        }
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setFooter({
        text: 'Welcome to the community! 🚀'
      })
      .setTimestamp();

    // Create action buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('View Server')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://discord.com/channels/${member.guild.id}`)
        .setEmoji('🏠'),
      new ButtonBuilder()
        .setCustomId('start_tour')
        .setLabel('Start Tour')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🚀')
    );

    // Send welcome DM
    try {
      await member.send({
        embeds: [welcomeEmbed],
        components: [row]
      });

      logger.info(`Welcome DM sent to ${username} (${userId})`);
    } catch (dmError) {
      // User has DMs disabled
      logger.warn(`Could not send welcome DM to ${username} (${userId})`);

      // Try to send in a welcome channel if configured
      const welcomeChannel = member.guild.channels.cache.find(
        (ch) => ch.name === 'welcome' || ch.name === 'general'
      );

      if (welcomeChannel && welcomeChannel.isTextBased()) {
        await welcomeChannel.send({
          content: `${EMOJI.SOCIAL.WAVE} Welcome ${member}!`,
          embeds: [welcomeEmbed]
        });
      }
    }

    // Also send a message in the server if there's a welcome channel
    const serverWelcomeChannel = member.guild.channels.cache.find(
      (ch) => ch.name === 'welcome' || ch.name === 'general'
    );

    if (serverWelcomeChannel && serverWelcomeChannel.isTextBased()) {
      const serverWelcomeEmbed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setDescription(
          `${EMOJI.SOCIAL.PARTY} **${member}** just joined the server! ` +
          `Welcome to BitSage Network! ${EMOJI.SOCIAL.WAVE}`
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: `We now have ${member.guild.memberCount} members!` })
        .setTimestamp();

      await serverWelcomeChannel.send({ embeds: [serverWelcomeEmbed] });
    }

    logger.info(`New member: ${username} (${userId}) joined ${member.guild.name}`);
  } catch (error) {
    logger.error('Error handling guild member add', {
      userId: member.user.id,
      error
    });
  }
}
