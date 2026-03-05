import {
  Interaction,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js';
import { logger } from '../utils/logger';
import { query } from '../utils/database';
import * as EMOJI from '../utils/emojis';

// Store onboarding progress for each user
interface OnboardingProgress {
  roles: string[];
  region: string;
  interests: string[];
  captchaCompleted: boolean;
  captchaAnswer?: string;
}

const onboardingProgress = new Map<string, OnboardingProgress>();

/**
 * Handle all interactions (buttons, select menus, etc.)
 */
export async function handleInteractionCreate(interaction: Interaction) {
  // Handle button interactions
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
  }

  // Handle select menu interactions
  if (interaction.isStringSelectMenu()) {
    await handleSelectMenuInteraction(interaction);
  }
}

async function handleButtonInteraction(interaction: any) {
  const { customId } = interaction;

  // ========== START VERIFICATION - STEP 1: ROLE SELECTION ==========
  if (customId === 'verify_user') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const member = interaction.member as GuildMember;
      const userId = interaction.user.id;

      // Check if already verified
      const verifiedRole = interaction.guild.roles.cache.find((r: any) => r.name === 'Verified');

      if (!verifiedRole) {
        await interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} Verified role not found. Please contact an administrator.`
        });
        return;
      }

      if (member.roles.cache.has(verifiedRole.id)) {
        await interaction.editReply({
          content: `${EMOJI.STATUS.SUCCESS} You are already verified!`
        });
        return;
      }

      // Initialize onboarding progress
      onboardingProgress.set(userId, {
        roles: [],
        region: '',
        interests: [],
        captchaCompleted: false
      });

      // Step 1: Role Selection
      const roleEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${EMOJI.PROGRESS.ROCKET} BitSage Verification - Step 1 of 4`)
        .setDescription(`
**Welcome to BitSage Network!**

Before you can access all channels, please complete the verification process.

**Step 1: Select Your Role(s)**

Choose one or more roles that describe you:

${EMOJI.NETWORK.COMPUTER} **Developer** - Building dApps or contributing code
${EMOJI.NETWORK.SERVER} **Validator** - Running validator nodes
${EMOJI.NETWORK.GEAR} **Worker Node** - Providing compute resources
${EMOJI.PROGRESS.GEM} **Early Supporter** - Early community member
${EMOJI.ACTIONS.CHART} **Investor/Trader** - Interested in SAGE token
${EMOJI.SOCIAL.PARTY} **Community Member** - Here to learn and participate

*You can select multiple roles from the dropdown below.*
        `)
        .setFooter({ text: 'Progress: Step 1 of 4 | Select your role(s) to continue' });

      const roleSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_roles')
          .setPlaceholder('Choose your role(s)...')
          .setMinValues(1)
          .setMaxValues(6)
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Developer')
              .setDescription('Building dApps or contributing to the codebase')
              .setValue('Developer')
              .setEmoji('💻'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Validator')
              .setDescription('Running validator nodes')
              .setValue('Validator')
              .setEmoji('🖥️'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Worker Node')
              .setDescription('Providing compute resources')
              .setValue('Worker Node')
              .setEmoji('⚙️'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Early Supporter')
              .setDescription('Here from the early days')
              .setValue('Early Supporter')
              .setEmoji('💎'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Investor/Trader')
              .setDescription('Interested in SAGE token')
              .setValue('Investor/Trader')
              .setEmoji('📊'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Community Member')
              .setDescription('Learning and participating')
              .setValue('Community Member')
              .setEmoji('🎉')
          )
      );

      await interaction.editReply({
        embeds: [roleEmbed],
        components: [roleSelect]
      });

    } catch (error) {
      logger.error('Error starting verification', error);

      await interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} Failed to start verification. Please try again or contact support.`
      });
    }
  }

  // ========== COMPLETE CAPTCHA AND VERIFY ==========
  if (customId.startsWith('captcha_')) {
    await interaction.deferUpdate();

    try {
      const userId = interaction.user.id;
      const progress = onboardingProgress.get(userId);

      if (!progress) {
        await interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} Verification session expired. Please start over.`,
          embeds: [],
          components: []
        });
        return;
      }

      const answer = customId.split('_')[1];
      const expectedAnswer = progress.captchaAnswer;

      if (answer !== expectedAnswer) {
        // Wrong answer
        const wrongEmbed = new EmbedBuilder()
          .setColor(0xff6b6b)
          .setTitle(`${EMOJI.STATUS.ERROR} Captcha Failed`)
          .setDescription(`
Incorrect answer! Please try again.

Click the "✅ Verify" button in <#1456764014846677158> to restart verification.
          `)
          .setFooter({ text: 'Verification cancelled' });

        await interaction.editReply({
          embeds: [wrongEmbed],
          components: []
        });

        onboardingProgress.delete(userId);
        return;
      }

      // Correct answer - proceed to complete verification
      progress.captchaCompleted = true;

      const finalEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`${EMOJI.PROGRESS.SPARKLES} Almost There!`)
        .setDescription(`
**Great! You've completed all verification steps.**

**Your Selections:**
• **Roles:** ${progress.roles.join(', ')}
• **Region:** ${progress.region}
• **Interests:** ${progress.interests.join(', ')}
• **Captcha:** ${EMOJI.STATUS.SUCCESS} Verified

Click the button below to complete verification and unlock all channels!

${EMOJI.PROGRESS.GEM} You'll receive **50 XP** as a welcome bonus!
        `)
        .setFooter({ text: 'Ready to join the community?' });

      const completeButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('complete_verification')
          .setLabel('✅ Complete Verification')
          .setStyle(ButtonStyle.Success)
      );

      await interaction.editReply({
        embeds: [finalEmbed],
        components: [completeButton]
      });

    } catch (error) {
      logger.error('Error processing captcha', error);
    }
  }

  // ========== FINAL STEP: COMPLETE VERIFICATION ==========
  if (customId === 'complete_verification') {
    await interaction.deferUpdate();

    try {
      const member = interaction.member as GuildMember;
      const userId = interaction.user.id;
      const username = interaction.user.username;

      const progress = onboardingProgress.get(userId);

      if (!progress || !progress.captchaCompleted) {
        await interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} Please complete all verification steps first.`,
          embeds: [],
          components: []
        });
        return;
      }

      // Check if already verified
      const verifiedRole = interaction.guild.roles.cache.find((r: any) => r.name === 'Verified');

      if (!verifiedRole) {
        await interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} Verified role not found. Please contact an administrator.`,
          embeds: [],
          components: []
        });
        return;
      }

      if (member.roles.cache.has(verifiedRole.id)) {
        await interaction.editReply({
          content: `${EMOJI.STATUS.SUCCESS} You are already verified!`,
          embeds: [],
          components: []
        });
        return;
      }

      // Add Verified role
      await member.roles.add(verifiedRole);

      // Add user-selected roles
      for (const roleName of progress.roles) {
        const role = interaction.guild.roles.cache.find((r: any) => r.name === roleName);
        if (role) {
          try {
            await member.roles.add(role);
          } catch (e) {
            logger.warn(`Could not add role ${roleName} to ${username}`);
          }
        }
      }

      // Update database
      await query(
        `UPDATE discord_users
         SET verified = true, verified_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      // Award verification XP
      await query(
        `UPDATE discord_users
         SET xp = xp + 50
         WHERE user_id = $1`,
        [userId]
      );

      // Create personalized welcome message
      let roleMessage = '';
      if (progress.roles.includes('Developer')) {
        roleMessage += `\n\n${EMOJI.NETWORK.COMPUTER} **For Developers:**\n• <#1456764053555908812> - Dev discussions\n• <#1456764056659558573> - Report bugs\n• <#1456764057330782209> - Suggest features`;
      }
      if (progress.roles.includes('Validator')) {
        roleMessage += `\n\n${EMOJI.NETWORK.SERVER} **For Validators:**\n• <#1456764030482907158> - Network stats\n• <#1456764037017636999> - Validator support\n• <#1456764032777457757> - Job updates`;
      }
      if (progress.roles.includes('Worker Node')) {
        roleMessage += `\n\n${EMOJI.NETWORK.GEAR} **For Worker Nodes:**\n• <#1456764037017636999> - Worker support\n• <#1456764032777457757> - Monitor jobs`;
      }

      // Success embed
      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`${EMOJI.STATUS.SUCCESS} Welcome to BitSage Network!`)
        .setDescription(`
**Congratulations, ${interaction.user}!**

${EMOJI.PROGRESS.CHECKMARK} Verification complete!
${EMOJI.PROGRESS.CHECKMARK} Earned **50 XP** bonus!
${EMOJI.PROGRESS.CHECKMARK} All channels unlocked!

**Your Profile:**
• **Roles:** ${progress.roles.join(', ')}
• **Region:** ${progress.region}
• **Interests:** ${progress.interests.join(', ')}
${roleMessage}

**Next Steps:**
1️⃣ Introduce yourself in <#1456764026263441481>
2️⃣ Check <#1456764022203486219> for quick info
3️⃣ Start chatting to earn XP!
4️⃣ Claim daily reward with \`/daily\`

**Pro Tips:**
${EMOJI.PROGRESS.SPARKLES} 5 XP per message (60s cooldown)
${EMOJI.PROGRESS.SPARKLES} Daily rewards give streak bonuses
${EMOJI.PROGRESS.SPARKLES} Level up to unlock special roles

Happy exploring! 🚀
        `)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setFooter({ text: 'Thanks for being part of BitSage!' })
        .setTimestamp();

      await interaction.editReply({
        embeds: [successEmbed],
        components: []
      });

      // Clean up
      onboardingProgress.delete(userId);

      logger.info(`User verified: ${username} (${userId}) - Roles: ${progress.roles.join(', ')}, Region: ${progress.region}, Interests: ${progress.interests.join(', ')}`);

    } catch (error) {
      logger.error('Error completing verification', error);

      await interaction.editReply({
        content: `${EMOJI.STATUS.ERROR} Failed to complete verification. Please try again or contact support.`,
        embeds: [],
        components: []
      });
    }
  }

  // ========== CANCEL VERIFICATION ==========
  if (customId === 'cancel_verify') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const userId = interaction.user.id;
    onboardingProgress.delete(userId);

    const cancelEmbed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(`${EMOJI.STATUS.INFO} Verification Cancelled`)
      .setDescription(`
No problem! Take your time to read the rules.

When you're ready, click **✅ Verify** in <#1456764014846677158> again.

Need help? Ask in <#1456764061319696640>
      `)
      .setFooter({ text: 'See you soon!' });

    await interaction.editReply({ embeds: [cancelEmbed] });
  }

  // ========== SERVER TOUR ==========
  if (customId === 'start_tour') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${EMOJI.PROGRESS.ROCKET} BitSage Server Tour`)
      .setDescription(`
**Here's a quick guide to navigate the server:**

📢 **INFORMATION**
• <#1456764013152178327> - Start here!
• <#1456764014846677158> - Read rules & verify
• <#1456764018478813256> - Official announcements
• <#1456764021368684739> - Development roadmap
• <#1456764022203486219> - FAQ

💬 **COMMUNITY**
• <#1456764024816668774> - Main chat
• <#1456764026263441481> - Introduce yourself
• <#1456764027597361163> - Fun & off-topic

⚡ **NETWORK**
• <#1456764030482907158> - Live stats
• <#1456764032777457757> - Job updates
• <#1456764037017636999> - Worker support

🎮 **GAMIFICATION**
• <#1456764045729333281> - Leaderboards
• <#1456764046845022210> - Achievements
• <#1456764048149581935> - Quests

💻 **DEVELOPMENT**
• <#1456764053555908812> - Dev discussions
• <#1456764056659558573> - Report bugs
• <#1456764057330782209> - Suggest features

🆘 **SUPPORT**
• <#1456764061319696640> - Ask questions
• <#1456764062338912370> - Open a ticket

**Pro Tips:**
${EMOJI.PROGRESS.SPARKLES} Earn XP by chatting
${EMOJI.PROGRESS.SPARKLES} Daily rewards for streaks
${EMOJI.PROGRESS.SPARKLES} Level up for special roles

Enjoy! 🎉
      `)
      .setFooter({ text: 'You can always ask in #help!' });

    await interaction.editReply({ embeds: [embed] });
  }
}

// ========== SELECT MENU INTERACTIONS ==========
async function handleSelectMenuInteraction(interaction: any) {
  const { customId, values } = interaction;
  const userId = interaction.user.id;

  // ========== STEP 2: REGION SELECTION ==========
  if (customId === 'select_roles') {
    await interaction.deferUpdate();

    try {
      const progress = onboardingProgress.get(userId);
      if (!progress) {
        await interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} Verification session expired. Please start over.`,
          embeds: [],
          components: []
        });
        return;
      }

      progress.roles = values;

      const regionEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${EMOJI.NETWORK.LINK} BitSage Verification - Step 2 of 4`)
        .setDescription(`
**Step 2: Select Your Region**

Choose your geographic region to help us:
• Recommend region-specific channels
• Schedule events at convenient times
• Connect you with nearby community members

Select your region from the dropdown below:
        `)
        .setFooter({ text: 'Progress: Step 2 of 4 | Selected roles: ' + values.join(', ') });

      const regionSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_region')
          .setPlaceholder('Choose your region...')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('North America')
              .setDescription('USA, Canada, Mexico')
              .setValue('North America')
              .setEmoji('🌎'),
            new StringSelectMenuOptionBuilder()
              .setLabel('South America')
              .setDescription('Brazil, Argentina, etc.')
              .setValue('South America')
              .setEmoji('🌎'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Europe')
              .setDescription('EU, UK, Russia')
              .setValue('Europe')
              .setEmoji('🌍'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Asia')
              .setDescription('China, Japan, India, etc.')
              .setValue('Asia')
              .setEmoji('🌏'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Africa')
              .setDescription('All African countries')
              .setValue('Africa')
              .setEmoji('🌍'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Oceania')
              .setDescription('Australia, New Zealand, Pacific')
              .setValue('Oceania')
              .setEmoji('🌏'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Middle East')
              .setDescription('UAE, Saudi Arabia, Israel, etc.')
              .setValue('Middle East')
              .setEmoji('🌍')
          )
      );

      await interaction.editReply({
        embeds: [regionEmbed],
        components: [regionSelect]
      });

    } catch (error) {
      logger.error('Error in role selection', error);
    }
  }

  // ========== STEP 3: INTERESTS SELECTION ==========
  if (customId === 'select_region') {
    await interaction.deferUpdate();

    try {
      const progress = onboardingProgress.get(userId);
      if (!progress) {
        await interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} Verification session expired. Please start over.`,
          embeds: [],
          components: []
        });
        return;
      }

      progress.region = values[0];

      const interestEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${EMOJI.PROGRESS.TARGET} BitSage Verification - Step 3 of 4`)
        .setDescription(`
**Step 3: Select Your Interests**

Choose topics you'd like to engage with:

${EMOJI.NETWORK.ZAP} **Zero-Knowledge Proofs** - STARK/SNARK tech
${EMOJI.ACTIONS.COIN} **Staking & Economics** - Tokenomics and rewards
${EMOJI.NETWORK.ROBOT} **AI & Compute** - Decentralized computing
${EMOJI.PROGRESS.TROPHY} **Governance** - DAO and decisions
${EMOJI.PROGRESS.GEM} **NFTs & Gaming** - Achievements
${EMOJI.NETWORK.LINK} **Partnerships** - Ecosystem collabs

*You can select multiple interests.*
        `)
        .setFooter({ text: `Progress: Step 3 of 4 | Region: ${progress.region}` });

      const interestSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_interests')
          .setPlaceholder('Choose your interests...')
          .setMinValues(1)
          .setMaxValues(6)
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('Zero-Knowledge Proofs')
              .setDescription('STARK/SNARK technology')
              .setValue('ZK Proofs')
              .setEmoji('⚡'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Staking & Economics')
              .setDescription('Tokenomics and rewards')
              .setValue('Staking')
              .setEmoji('🪙'),
            new StringSelectMenuOptionBuilder()
              .setLabel('AI & Compute')
              .setDescription('Decentralized AI computing')
              .setValue('AI Compute')
              .setEmoji('🤖'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Governance')
              .setDescription('DAO and community decisions')
              .setValue('Governance')
              .setEmoji('🏆'),
            new StringSelectMenuOptionBuilder()
              .setLabel('NFTs & Gaming')
              .setDescription('Achievements and gamification')
              .setValue('NFTs')
              .setEmoji('💎'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Partnerships')
              .setDescription('Ecosystem collaborations')
              .setValue('Partnerships')
              .setEmoji('🔗')
          )
      );

      await interaction.editReply({
        embeds: [interestEmbed],
        components: [interestSelect]
      });

    } catch (error) {
      logger.error('Error in region selection', error);
    }
  }

  // ========== STEP 4: CAPTCHA VERIFICATION ==========
  if (customId === 'select_interests') {
    await interaction.deferUpdate();

    try {
      const progress = onboardingProgress.get(userId);
      if (!progress) {
        await interaction.editReply({
          content: `${EMOJI.STATUS.ERROR} Verification session expired. Please start over.`,
          embeds: [],
          components: []
        });
        return;
      }

      progress.interests = values;

      // Generate simple captcha
      const num1 = Math.floor(Math.random() * 10) + 1;
      const num2 = Math.floor(Math.random() * 10) + 1;
      const correctAnswer = num1 + num2;
      progress.captchaAnswer = correctAnswer.toString();

      const captchaEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle(`${EMOJI.STATUS.WARNING} BitSage Verification - Step 4 of 4`)
        .setDescription(`
**Step 4: Security Verification**

To ensure you're human and prevent spam, please solve this simple math problem:

**What is ${num1} + ${num2}?**

Click the correct answer below:
        `)
        .setFooter({ text: 'Final step! Almost done...' });

      // Create 4 answer buttons
      const wrongAnswers = [
        correctAnswer - 1,
        correctAnswer + 1,
        correctAnswer + 2
      ].filter(n => n > 0 && n !== correctAnswer);

      const answers = [correctAnswer, ...wrongAnswers.slice(0, 2)]
        .sort(() => Math.random() - 0.5);

      const captchaButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...answers.map(ans =>
          new ButtonBuilder()
            .setCustomId(`captcha_${ans}`)
            .setLabel(ans.toString())
            .setStyle(ans === correctAnswer ? ButtonStyle.Success : ButtonStyle.Secondary)
        )
      );

      await interaction.editReply({
        embeds: [captchaEmbed],
        components: [captchaButtons]
      });

    } catch (error) {
      logger.error('Error in interest selection', error);
    }
  }
}
