/**
 * /verify-wallet command
 *
 * Initiates wallet verification flow.
 * Sends a unique verification URL where users can sign with their Starknet wallet.
 */

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Command } from '../types';
import { logger } from '../utils/logger';
import { getStatusColor } from '../utils/formatters';
import {
  createVerificationSession,
  getActiveSessionsCount,
  generateVerificationURL,
  getWalletVerification,
} from '../token-gating/utils/verification-helpers';
import { tokenGatingConfig } from '../token-gating/utils/config';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('verify-wallet')
    .setDescription('Verify your Starknet wallet to unlock token-gated roles')
    .addStringOption(option =>
      option
        .setName('method')
        .setDescription('Verification method')
        .setRequired(false)
        .addChoices(
          { name: '🖊️ Signature (Standard)', value: 'signature' },
          { name: '🔒 ZK Proof (Privacy)', value: 'zk_proof' },
          { name: '👻 Stealth Address (Anonymous)', value: 'stealth' }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userId = interaction.user.id;
      const method = (interaction.options.getString('method') || 'signature') as 'signature' | 'zk_proof' | 'stealth';

      // Check if user already verified
      const existingVerification = await getWalletVerification(userId);
      if (existingVerification) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('info'))
          .setTitle('✅ Already Verified')
          .setDescription(
            `Your wallet is already verified!\n\n` +
            `**Wallet:** \`${existingVerification.wallet_address}\`\n` +
            `**Method:** ${existingVerification.verification_method}\n` +
            `**Verified:** <t:${Math.floor(new Date(existingVerification.verified_at!).getTime() / 1000)}:R>\n\n` +
            `Use \`/wallet-status\` to see your eligible roles.\n` +
            `Use \`/disconnect-wallet\` to unlink and verify a different wallet.`
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Check if privacy methods are enabled
      if (method === 'zk_proof' && !tokenGatingConfig.features.enable_zk_proofs) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('error'))
          .setTitle('❌ ZK Proofs Not Enabled')
          .setDescription(
            'Zero-knowledge proof verification is currently disabled.\n\n' +
            'Please use standard signature verification instead.'
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (method === 'stealth' && !tokenGatingConfig.features.enable_stealth_addresses) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('error'))
          .setTitle('❌ Stealth Addresses Not Enabled')
          .setDescription(
            'Stealth address verification is currently disabled.\n\n' +
            'Please use standard signature verification instead.'
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Check active sessions limit
      const activeSessions = await getActiveSessionsCount(userId);
      if (activeSessions >= tokenGatingConfig.session.max_active_per_user) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('warning'))
          .setTitle('⚠️ Too Many Active Sessions')
          .setDescription(
            `You have ${activeSessions} active verification sessions.\n\n` +
            `Please complete or wait for your existing sessions to expire before starting a new one.`
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Create verification session
      const session = await createVerificationSession(
        userId,
        method,
        tokenGatingConfig.session.expiry_minutes
      );

      // Generate verification URL
      const verificationURL = generateVerificationURL(
        tokenGatingConfig.wallet_signing_url,
        session.session_token
      );

      // Privacy information based on method
      let privacyInfo = '';
      switch (method) {
        case 'signature':
          privacyInfo = '**Privacy Level:** 🔓 Standard\nYour wallet address and balance will be visible to server admins.';
          break;
        case 'zk_proof':
          privacyInfo = '**Privacy Level:** 🔒 High\nProves you hold enough tokens WITHOUT revealing your exact balance.';
          break;
        case 'stealth':
          privacyInfo = '**Privacy Level:** 👻 Maximum\nVerifies payments to stealth addresses without revealing your identity.';
          break;
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(getStatusColor('success'))
        .setTitle('🔗 Verify Your Wallet')
        .setDescription(
          `Click the button below to verify your Starknet wallet.\n\n` +
          `${privacyInfo}\n\n` +
          `**⏱️ Session expires:** <t:${Math.floor(new Date(session.expires_at).getTime() / 1000)}:R>\n\n` +
          `**Security Notice:**\n` +
          `• You will be asked to **sign a message** (NOT a transaction)\n` +
          `• This will **NOT cost any gas fees**\n` +
          `• Only connect your wallet on the official verification page\n` +
          `• Never share your private key or seed phrase`
        )
        .setFooter({ text: 'Verification link expires in 15 minutes' })
        .setTimestamp();

      // Create button
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Verify Wallet')
          .setStyle(ButtonStyle.Link)
          .setURL(verificationURL)
          .setEmoji('🔗')
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      logger.info('Verification session created for user', {
        user_id: userId,
        session_id: session.id,
        method,
        expires_at: session.expires_at,
      });
    } catch (error: any) {
      logger.error('Error executing verify-wallet command', {
        error: error.message,
        user_id: interaction.user.id,
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Verification Failed')
        .setDescription(
          'Failed to create verification session.\n\n' +
          'Please try again in a few moments. If the problem persists, contact support.'
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
