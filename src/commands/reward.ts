import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../types';
import { query } from '../utils/database';
import { logger } from '../utils/logger';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('reward')
    .setDescription('Manage and claim reward campaigns')
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('View available reward campaigns in this server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('claim')
        .setDescription('Claim a reward campaign')
        .addStringOption(option =>
          option
            .setName('campaign')
            .setDescription('Name of the campaign to claim')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('View your reward claim history in this server')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'list':
        await handleList(interaction);
        break;
      case 'claim':
        await handleClaim(interaction);
        break;
      case 'status':
        await handleStatus(interaction);
        break;
      default:
        await interaction.reply({
          content: '❌ Unknown subcommand',
          ephemeral: true,
        });
    }
  },
};

/**
 * Handle /reward list - shows available campaigns
 */
async function handleList(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (!guildId) {
      await interaction.editReply({
        content: '❌ This command can only be used in a server.',
      });
      return;
    }

    // Get guild info from database
    const guildResult = await query(
      `SELECT id, name FROM guilds WHERE discord_guild_id = $1`,
      [guildId]
    );

    if (guildResult.rows.length === 0) {
      await interaction.editReply({
        content: '❌ This server is not registered in the reward system.',
      });
      return;
    }

    const dbGuildId = guildResult.rows[0].id;
    const guildName = guildResult.rows[0].name;

    // Fetch active campaigns
    const campaignsResult = await query(
      `SELECT * FROM reward_campaigns
       WHERE guild_id = $1 AND status = 'active'
       ORDER BY created_at DESC`,
      [dbGuildId]
    );

    if (campaignsResult.rows.length === 0) {
      await interaction.editReply({
        content: '📭 No reward campaigns are currently available in this server.',
      });
      return;
    }

    // Check which campaigns user has claimed
    const claimsResult = await query(
      `SELECT campaign_id, status, claimed_at
       FROM reward_claims
       WHERE discord_user_id = $1`,
      [userId]
    );

    const claimedCampaigns = new Map(
      claimsResult.rows.map(row => [row.campaign_id, row])
    );

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle(`🎁 Reward Campaigns - ${guildName}`)
      .setColor('#10b981')
      .setDescription('Use `/reward claim [campaign]` to claim a reward!')
      .setTimestamp();

    for (const campaign of campaignsResult.rows) {
      const claim = claimedCampaigns.get(campaign.id);
      const claimed = !!claim;

      let statusEmoji = '🔓';
      let statusText = 'Available';

      if (claimed) {
        if (claim.status === 'completed') {
          statusEmoji = '✅';
          statusText = `Claimed on ${new Date(claim.claimed_at).toLocaleDateString()}`;
        } else if (claim.status === 'pending') {
          statusEmoji = '⏳';
          statusText = 'Processing...';
        } else if (claim.status === 'failed') {
          statusEmoji = '❌';
          statusText = 'Failed (contact admin)';
        }
      }

      let fieldValue = `**Type:** ${formatRewardType(campaign.reward_type)}\n`;
      fieldValue += `**Status:** ${statusEmoji} ${statusText}\n`;

      if (campaign.description) {
        fieldValue += `**Info:** ${campaign.description}\n`;
      }

      if (campaign.max_claims) {
        fieldValue += `**Claims:** ${campaign.claimed_count}/${campaign.max_claims}`;
      }

      embed.addFields({
        name: campaign.name,
        value: fieldValue,
        inline: false,
      });
    }

    embed.setFooter({ text: `${campaignsResult.rows.length} campaign(s) available` });

    await interaction.editReply({ embeds: [embed] });

    logger.info('Reward list command executed', {
      guild_id: guildId,
      user_id: userId,
      campaign_count: campaignsResult.rows.length,
    });
  } catch (error: any) {
    logger.error('Reward list command failed', { error: error.message });

    await interaction.editReply({
      content: '❌ Failed to fetch reward campaigns. Please try again later.',
    });
  }
}

/**
 * Handle /reward claim - claims a campaign
 */
async function handleClaim(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const campaignName = interaction.options.getString('campaign', true);

    if (!guildId) {
      await interaction.editReply({
        content: '❌ This command can only be used in a server.',
      });
      return;
    }

    // Get guild info from database
    const guildResult = await query(
      `SELECT id FROM guilds WHERE discord_guild_id = $1`,
      [guildId]
    );

    if (guildResult.rows.length === 0) {
      await interaction.editReply({
        content: '❌ This server is not registered in the reward system.',
      });
      return;
    }

    const dbGuildId = guildResult.rows[0].id;

    // Find campaign by name (case-insensitive)
    const campaignResult = await query(
      `SELECT * FROM reward_campaigns
       WHERE guild_id = $1 AND LOWER(name) = LOWER($2) AND status = 'active'`,
      [dbGuildId, campaignName]
    );

    if (campaignResult.rows.length === 0) {
      await interaction.editReply({
        content: `❌ Campaign "${campaignName}" not found or not active.\n\nUse \`/reward list\` to see available campaigns.`,
      });
      return;
    }

    const campaign = campaignResult.rows[0];

    // Check eligibility using reward eligibility service
    const eligibilityService = (global as any).rewardEligibilityService;

    if (!eligibilityService) {
      await interaction.editReply({
        content: '❌ Reward system is not initialized. Please contact a server admin.',
      });
      return;
    }

    const eligibility = await eligibilityService.checkEligibility(campaign.id, userId);

    if (!eligibility.eligible) {
      await interaction.editReply({
        content: `❌ You are not eligible for this reward.\n\n**Reason:** ${eligibility.reason}`,
      });
      return;
    }

    // Create claim using reward scheduler
    const scheduler = (global as any).rewardScheduler;

    if (!scheduler) {
      await interaction.editReply({
        content: '❌ Reward system is not initialized. Please contact a server admin.',
      });
      return;
    }

    const claimId = await scheduler.createClaimAndQueue(
      campaign.id,
      userId,
      'manual',
      10 // High priority for manual claims
    );

    if (!claimId) {
      await interaction.editReply({
        content: '❌ You have already claimed this reward or it has reached maximum claims.',
      });
      return;
    }

    // Success!
    const embed = new EmbedBuilder()
      .setTitle('✅ Reward Claimed!')
      .setColor('#10b981')
      .setDescription(
        `Your claim for **${campaign.name}** has been queued for delivery.\n\n` +
        `You'll receive a DM shortly with details about your reward.`
      )
      .addFields({
        name: 'Reward Type',
        value: formatRewardType(campaign.reward_type),
        inline: true,
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    logger.info('Reward claim command executed', {
      guild_id: guildId,
      user_id: userId,
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      claim_id: claimId,
    });
  } catch (error: any) {
    logger.error('Reward claim command failed', { error: error.message });

    if (error.message.includes('unique') || error.code === '23505') {
      await interaction.editReply({
        content: '❌ You have already claimed this reward.',
      });
    } else {
      await interaction.editReply({
        content: '❌ Failed to claim reward. Please try again later.',
      });
    }
  }
}

/**
 * Handle /reward status - shows user's claim history
 */
async function handleStatus(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (!guildId) {
      await interaction.editReply({
        content: '❌ This command can only be used in a server.',
      });
      return;
    }

    // Get guild info from database
    const guildResult = await query(
      `SELECT id, name FROM guilds WHERE discord_guild_id = $1`,
      [guildId]
    );

    if (guildResult.rows.length === 0) {
      await interaction.editReply({
        content: '❌ This server is not registered in the reward system.',
      });
      return;
    }

    const dbGuildId = guildResult.rows[0].id;
    const guildName = guildResult.rows[0].name;

    // Fetch user's claims
    const claimsResult = await query(
      `SELECT
         rc.id,
         rc.campaign_id,
         rc.status,
         rc.claimed_at,
         rc.delivery_details,
         rw.name as campaign_name,
         rw.reward_type
       FROM reward_claims rc
       JOIN reward_campaigns rw ON rc.campaign_id = rw.id
       WHERE rc.discord_user_id = $1 AND rw.guild_id = $2
       ORDER BY rc.claimed_at DESC
       LIMIT 10`,
      [userId, dbGuildId]
    );

    if (claimsResult.rows.length === 0) {
      await interaction.editReply({
        content: '📭 You haven\'t claimed any rewards in this server yet.\n\nUse `/reward list` to see available campaigns!',
      });
      return;
    }

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle(`🎁 Your Reward Claims - ${guildName}`)
      .setColor('#3b82f6')
      .setDescription(`Showing your ${claimsResult.rows.length} most recent claims`)
      .setTimestamp();

    for (const claim of claimsResult.rows) {
      let statusEmoji = '⏳';
      let statusText = 'Processing';

      if (claim.status === 'completed') {
        statusEmoji = '✅';
        statusText = 'Delivered';
      } else if (claim.status === 'failed') {
        statusEmoji = '❌';
        statusText = 'Failed';
      }

      let fieldValue = `**Type:** ${formatRewardType(claim.reward_type)}\n`;
      fieldValue += `**Status:** ${statusEmoji} ${statusText}\n`;
      fieldValue += `**Claimed:** ${new Date(claim.claimed_at).toLocaleString()}`;

      embed.addFields({
        name: claim.campaign_name,
        value: fieldValue,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });

    logger.info('Reward status command executed', {
      guild_id: guildId,
      user_id: userId,
      claims_count: claimsResult.rows.length,
    });
  } catch (error: any) {
    logger.error('Reward status command failed', { error: error.message });

    await interaction.editReply({
      content: '❌ Failed to fetch your reward history. Please try again later.',
    });
  }
}

/**
 * Format reward type for display
 */
function formatRewardType(rewardType: string): string {
  switch (rewardType) {
    case 'role':
      return '👥 Discord Role(s)';
    case 'xp':
      return '⭐ XP/Points';
    case 'access_grant':
      return '🔓 Channel Access';
    case 'nft':
      return '🖼️ NFT';
    case 'poap':
      return '🎫 POAP Badge';
    case 'webhook':
      return '🔗 Custom Reward';
    default:
      return rewardType;
  }
}
