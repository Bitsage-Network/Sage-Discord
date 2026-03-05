/**
 * BitSage Discord Token-Gating - /wallet-status Command
 *
 * Shows user's wallet verification status and eligible roles.
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
} from 'discord.js';
import { query } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import * as EMOJI from '../../../utils/emojis';
import { tokenGatingConfig } from '../../utils/config';

export const data = new SlashCommandBuilder()
  .setName('wallet-status')
  .setDescription('Check your wallet verification status and token-gated roles');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const member = interaction.member as GuildMember;

    // Get wallet verification
    const verificationResult = await query(
      `SELECT * FROM wallet_verifications
       WHERE user_id = $1 AND verified = TRUE
       ORDER BY verified_at DESC
       LIMIT 1`,
      [userId]
    );

    // Not verified
    if (verificationResult.rowCount === 0) {
      const notVerifiedEmbed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle(`${EMOJI.STATUS.ERROR} Wallet Not Verified`)
        .setDescription(
          `You haven't verified a Starknet wallet yet.\\n\\n` +
            `Use \`/verify-wallet\` to connect your wallet and access token-gated roles!`
        )
        .addFields({
          name: `${EMOJI.ACTIONS.HELP} Why verify?`,
          value:
            '✅ Access exclusive token-holder roles\\n' +
            '✅ Participate in governance\\n' +
            '✅ Unlock special channels and perks',
          inline: false,
        })
        .setFooter({ text: 'BitSage Token-Gating • Starknet' })
        .setTimestamp();

      await interaction.editReply({ embeds: [notVerifiedEmbed] });
      return;
    }

    const verification = verificationResult.rows[0];
    const walletAddress = verification.wallet_address;
    const verifiedAt = new Date(verification.verified_at);

    // Get token-gating rules for this server
    const rulesResult = await query(
      `SELECT tgr.*, rm.role_id, rm.role_name
       FROM token_gating_rules tgr
       LEFT JOIN role_mappings rm ON tgr.id = rm.rule_id AND rm.guild_id = $1
       WHERE tgr.guild_id = $1 AND tgr.enabled = TRUE
       ORDER BY tgr.priority DESC`,
      [interaction.guildId]
    );

    // Get user's rule cache (if exists)
    const cacheResult = await query(
      `SELECT * FROM user_rule_cache
       WHERE user_id = $1 AND expires_at > NOW()`,
      [userId]
    );

    const cachedRules = new Map(
      cacheResult.rows.map((row: any) => [row.rule_id, row])
    );

    // Build status embed
    const statusEmbed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle(`${EMOJI.STATUS.SUCCESS} Wallet Verification Status`)
      .setDescription(
        `**Connected Wallet:**\\n\`${walletAddress}\`\\n\\n` +
          `**Verified:** <t:${Math.floor(verifiedAt.getTime() / 1000)}:R>\\n` +
          `**Method:** ${formatMethod(verification.verification_method)}`
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: 'BitSage Token-Gating • Starknet' })
      .setTimestamp();

    if (rulesResult.rowCount === 0) {
      statusEmbed.addFields({
        name: `${EMOJI.STATUS.INFO} No Token-Gating Rules`,
        value: 'This server has not configured any token-gating rules yet.',
        inline: false,
      });
    } else {
      // Separate passing and failing rules
      const passingRules: any[] = [];
      const failingRules: any[] = [];
      const uncheckedRules: any[] = [];

      for (const rule of rulesResult.rows) {
        const cache = cachedRules.get(rule.id);

        if (cache) {
          if (cache.passes_rule) {
            passingRules.push({
              ...rule,
              cached_balance: cache.cached_balance,
              cached_stake: cache.cached_stake,
              cached_reputation: cache.cached_reputation,
            });
          } else {
            failingRules.push(rule);
          }
        } else {
          uncheckedRules.push(rule);
        }
      }

      // Add passing rules
      if (passingRules.length > 0) {
        const passingText = passingRules
          .map((rule) => {
            const role = member.guild.roles.cache.get(rule.role_id);
            const roleMention = role ? role.toString() : `@${rule.role_name}`;
            const hasRole = member.roles.cache.has(rule.role_id);

            return `${hasRole ? '✅' : '⏳'} **${rule.rule_name}** → ${roleMention}`;
          })
          .join('\\n');

        statusEmbed.addFields({
          name: `${EMOJI.PROGRESS.TROPHY} Eligible Roles (${passingRules.length})`,
          value: passingText,
          inline: false,
        });
      }

      // Add failing rules
      if (failingRules.length > 0) {
        const failingText = failingRules
          .map((rule) => {
            const requirements = JSON.parse(rule.requirements);
            let req = '';

            if (rule.rule_type === 'token_balance') {
              req = `Min: ${formatBalance(requirements.min_balance)} SAGE`;
            } else if (rule.rule_type === 'staked_amount') {
              req = `Min: ${formatBalance(requirements.min_amount)} SAGE`;
            } else if (rule.rule_type === 'reputation') {
              req = `Min score: ${requirements.min_score}`;
            }

            return `❌ **${rule.rule_name}** - ${req}`;
          })
          .join('\\n');

        statusEmbed.addFields({
          name: `${EMOJI.STATUS.ERROR} Not Eligible (${failingRules.length})`,
          value: failingText.substring(0, 1024),
          inline: false,
        });
      }

      // Add unchecked rules
      if (uncheckedRules.length > 0) {
        statusEmbed.addFields({
          name: `${EMOJI.STATUS.INFO} Pending Check (${uncheckedRules.length})`,
          value: `${uncheckedRules.length} rule(s) haven't been checked yet. Roles will be assigned automatically within ${tokenGatingConfig.role_sync.interval / 60} minutes.`,
          inline: false,
        });
      }
    }

    // Add disconnect option
    statusEmbed.addFields({
      name: `${EMOJI.ACTIONS.HELP} Manage Wallet`,
      value:
        '**Change wallet:** Use `/disconnect-wallet` then `/verify-wallet`\\n' +
        '**Update roles:** Roles auto-sync every hour',
      inline: false,
    });

    await interaction.editReply({ embeds: [statusEmbed] });

    logger.info('Wallet status checked', {
      user_id: userId,
      wallet_address: walletAddress,
      rules_count: rulesResult.rowCount,
    });
  } catch (error: any) {
    logger.error('Failed to check wallet status', {
      user_id: interaction.user.id,
      error: error.message,
      stack: error.stack,
    });

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(`${EMOJI.STATUS.ERROR} Status Check Failed`)
      .setDescription(
        `Failed to retrieve wallet status. Please try again later.\\n\\n` +
          `If this problem persists, contact server administrators.`
      )
      .setFooter({ text: 'Error: ' + error.message })
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
  }
}

/**
 * Format verification method for display
 */
function formatMethod(method: string): string {
  const methods: Record<string, string> = {
    signature: '🔐 Standard Signature',
    zk_proof: '🎭 Privacy (ZK Proof)',
    stealth: '👻 Stealth Address',
    legacy: '📜 Legacy Verification',
  };

  return methods[method] || method;
}

/**
 * Format balance for display (assumes 18 decimals like ERC20)
 */
function formatBalance(balance: string): string {
  const bn = BigInt(balance);
  const decimals = 18n;
  const divisor = 10n ** decimals;

  const whole = bn / divisor;
  const fraction = bn % divisor;

  // Show 2 decimal places
  const fractionStr = fraction.toString().padStart(Number(decimals), '0');
  const fractionTrimmed = fractionStr.slice(0, 2);

  if (whole === 0n && fraction === 0n) {
    return '0';
  }

  if (fraction === 0n) {
    return whole.toLocaleString();
  }

  return `${whole.toLocaleString()}.${fractionTrimmed}`;
}
