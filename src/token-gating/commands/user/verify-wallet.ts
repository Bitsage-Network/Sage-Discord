/**
 * BitSage Discord Token-Gating - /verify-wallet Command
 *
 * Allows users to verify their Starknet wallet ownership.
 * Creates a verification session and sends a unique URL for web-based signing.
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from 'discord.js';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import { tokenGatingConfig } from '../../utils/config';
import { VerificationMethod, VerificationSession } from '../../types';
import * as EMOJI from '../../../utils/emojis';

export const data = new SlashCommandBuilder()
  .setName('verify-wallet')
  .setDescription('Verify your Starknet wallet to access token-gated roles')
  .addStringOption((option) =>
    option
      .setName('method')
      .setDescription('Verification method')
      .setRequired(false)
      .addChoices(
        { name: '🔐 Standard Signature (Default)', value: 'signature' },
        { name: '🎭 Privacy (ZK Proof)', value: 'zk_proof' },
        { name: '👻 Stealth Address', value: 'stealth' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const username = interaction.user.username;
    const method = (interaction.options.getString('method') || 'signature') as VerificationMethod;

    // Check if user already has an active verification
    const existingVerification = await query(
      `SELECT * FROM wallet_verifications
       WHERE user_id = $1 AND verified = TRUE
       ORDER BY verified_at DESC
       LIMIT 1`,
      [userId]
    );

    if (existingVerification.rowCount > 0) {
      const wallet = existingVerification.rows[0];
      const walletAddress = wallet.wallet_address;

      const alreadyVerifiedEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`${EMOJI.STATUS.SUCCESS} Wallet Already Verified`)
        .setDescription(
          `Your wallet is already verified!\\n\\n` +
            `**Connected Wallet:**\\n\`${walletAddress}\`\\n\\n` +
            `**Verified:** <t:${Math.floor(new Date(wallet.verified_at).getTime() / 1000)}:R>\\n` +
            `**Method:** ${formatMethod(wallet.verification_method)}`
        )
        .addFields({
          name: `${EMOJI.ACTIONS.HELP} Want to change wallets?`,
          value: 'Use `/disconnect-wallet` first, then verify again.',
          inline: false,
        })
        .setFooter({ text: 'BitSage Token-Gating • Starknet' })
        .setTimestamp();

      await interaction.editReply({ embeds: [alreadyVerifiedEmbed] });
      return;
    }

    // Check for active sessions (prevent spam)
    const activeSessions = await query(
      `SELECT COUNT(*) as count
       FROM verification_sessions
       WHERE user_id = $1 AND state = 'pending' AND expires_at > NOW()`,
      [userId]
    );

    if (parseInt(activeSessions.rows[0].count) >= tokenGatingConfig.session.max_active_per_user) {
      const tooManySessionsEmbed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle(`${EMOJI.STATUS.ERROR} Too Many Active Sessions`)
        .setDescription(
          `You already have ${tokenGatingConfig.session.max_active_per_user} active verification sessions.\\n\\n` +
            `Please complete or wait for them to expire before creating a new one.`
        )
        .setFooter({ text: `Sessions expire after ${tokenGatingConfig.session.expiry_minutes} minutes` })
        .setTimestamp();

      await interaction.editReply({ embeds: [tooManySessionsEmbed] });
      return;
    }

    // Check feature flags for privacy methods
    if (method === 'zk_proof' && !tokenGatingConfig.features.enable_zk_proofs) {
      const featureDisabledEmbed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle(`${EMOJI.STATUS.ERROR} Feature Not Enabled`)
        .setDescription(
          `ZK proof verification is not currently enabled on this server.\\n\\n` +
            `Please use standard signature verification instead.`
        )
        .setFooter({ text: 'Contact server admins for more info' })
        .setTimestamp();

      await interaction.editReply({ embeds: [featureDisabledEmbed] });
      return;
    }

    if (method === 'stealth' && !tokenGatingConfig.features.enable_stealth_addresses) {
      const featureDisabledEmbed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle(`${EMOJI.STATUS.ERROR} Feature Not Enabled`)
        .setDescription(
          `Stealth address verification is not currently enabled on this server.\\n\\n` +
            `Please use standard signature verification instead.`
        )
        .setFooter({ text: 'Contact server admins for more info' })
        .setTimestamp();

      await interaction.editReply({ embeds: [featureDisabledEmbed] });
      return;
    }

    // Create verification session
    const sessionId = uuidv4();
    const sessionToken = uuidv4();
    const challengeNonce = generateNonce();
    const challengeMessage = generateChallengeMessage(userId, username, challengeNonce, method);
    const expiresAt = new Date(Date.now() + tokenGatingConfig.session.expiry_minutes * 60 * 1000);

    await query(
      `INSERT INTO verification_sessions
       (id, user_id, state, verification_method, challenge_message, challenge_nonce, session_token, expires_at)
       VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7)`,
      [sessionId, userId, method, challengeMessage, challengeNonce, sessionToken, expiresAt]
    );

    // Generate verification URL
    const verificationUrl = `${tokenGatingConfig.wallet_signing_url}/verify?session=${sessionToken}`;

    // Create embed
    const verificationEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${EMOJI.ACTIONS.LINK} Verify Your Starknet Wallet`)
      .setDescription(
        `Click the button below to verify your wallet ownership.\\n\\n` +
          `**Verification Method:** ${formatMethod(method)}\\n` +
          `**Session ID:** \`${sessionId.slice(0, 8)}...\`\\n` +
          `**Expires:** <t:${Math.floor(expiresAt.getTime() / 1000)}:R>`
      )
      .addFields(
        {
          name: `${EMOJI.STATUS.INFO} What to Expect`,
          value:
            method === 'signature'
              ? '1️⃣ Connect your Starknet wallet (Argent X or Braavos)\\n' +
                '2️⃣ Sign a message to prove ownership\\n' +
                '3️⃣ Get verified and receive roles automatically!'
              : method === 'zk_proof'
              ? '1️⃣ Connect your Starknet wallet\\n' +
                '2️⃣ Generate a zero-knowledge proof of token balance\\n' +
                '3️⃣ Submit proof without revealing exact balance\\n' +
                '4️⃣ Get verified with full privacy!'
              : '1️⃣ Register or connect your stealth meta-address\\n' +
                '2️⃣ Prove you control the stealth address\\n' +
                '3️⃣ Get verified with maximum anonymity!',
          inline: false,
        },
        {
          name: '🛡️ Security Notice',
          value:
            '✅ You will NEVER be asked for your private keys\\n' +
            '✅ You will NEVER be asked to send funds\\n' +
            '✅ Only sign messages from the official BitSage page',
          inline: false,
        }
      )
      .setFooter({
        text: `Session expires in ${tokenGatingConfig.session.expiry_minutes} minutes • BitSage Token-Gating`,
      })
      .setTimestamp();

    // Create action buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Verify Wallet')
        .setStyle(ButtonStyle.Link)
        .setURL(verificationUrl)
        .setEmoji('🔐'),
      new ButtonBuilder()
        .setLabel('Help & FAQ')
        .setStyle(ButtonStyle.Link)
        .setURL('https://docs.bitsage.network/discord-bot/wallet-verification')
        .setEmoji('❓')
    );

    await interaction.editReply({
      embeds: [verificationEmbed],
      components: [row],
    });

    logger.info('Verification session created', {
      user_id: userId,
      username,
      session_id: sessionId,
      method,
      expires_at: expiresAt,
    });
  } catch (error: any) {
    logger.error('Failed to create verification session', {
      user_id: interaction.user.id,
      error: error.message,
      stack: error.stack,
    });

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(`${EMOJI.STATUS.ERROR} Verification Failed`)
      .setDescription(
        `Failed to create verification session. Please try again later.\\n\\n` +
          `If this problem persists, contact server administrators.`
      )
      .setFooter({ text: 'Error: ' + error.message })
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
  }
}

/**
 * Generate a unique nonce for challenge message
 */
function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * Generate challenge message for signing
 */
function generateChallengeMessage(
  userId: string,
  username: string,
  nonce: string,
  method: VerificationMethod
): string {
  const timestamp = Date.now();
  const domain = 'bitsage.network';

  return `BitSage Wallet Verification

Discord User: ${username}
Discord ID: ${userId}
Verification Method: ${method}
Timestamp: ${timestamp}
Nonce: ${nonce}

By signing this message, you confirm that you own this Starknet wallet and wish to link it to your Discord account for token-gated access.

⚠️ NEVER sign this message on an untrusted site!
✅ Only sign on: ${domain}

This signature will NOT initiate any transactions or cost gas fees.`;
}

/**
 * Format verification method for display
 */
function formatMethod(method: VerificationMethod | string): string {
  const methods: Record<string, string> = {
    signature: '🔐 Standard Signature',
    zk_proof: '🎭 Privacy (ZK Proof)',
    stealth: '👻 Stealth Address',
    legacy: '📜 Legacy Verification',
  };

  return methods[method] || method;
}
