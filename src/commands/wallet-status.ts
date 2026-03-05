/**
 * /wallet-status command
 *
 * Shows user's wallet verification status and eligible roles.
 */

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../types';
import { logger } from '../utils/logger';
import { getStatusColor } from '../utils/formatters';
import { getWalletVerification } from '../token-gating/utils/verification-helpers';
import { TokenGatingModule } from '../token-gating';
import { RuleMatcher } from '../token-gating/utils/rule-matcher';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('wallet-status')
    .setDescription('Check your wallet verification status and eligible roles'),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const userId = interaction.user.id;
      const guildId = interaction.guildId;

      if (!guildId) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('error'))
          .setTitle('❌ Server Required')
          .setDescription('This command can only be used in a server.')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Check verification status
      const verification = await getWalletVerification(userId);

      if (!verification) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('warning'))
          .setTitle('⚠️ Wallet Not Verified')
          .setDescription(
            'You have not verified your Starknet wallet yet.\n\n' +
            'Use `/verify-wallet` to verify your wallet and unlock token-gated roles.'
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Get token-gating module
      const tokenGating = TokenGatingModule.getInstance();
      const ruleMatcher = new RuleMatcher(tokenGating.tokenService);

      // Evaluate rules
      const ruleResults = await ruleMatcher.evaluateUserRules(
        userId,
        verification.wallet_address,
        guildId
      );

      // Separate passed and failed rules
      const passedRules = ruleResults.filter(r => r.passes && r.role_name);
      const failedRules = ruleResults.filter(r => !r.passes && r.role_name);

      // Get token balance for display
      let balanceInfo = '';
      try {
        const balance = await tokenGating.tokenService.getBalance(verification.wallet_address);
        const metadata = await tokenGating.tokenService.getTokenMetadata();
        const formattedBalance = tokenGating.tokenService.formatBalance(balance, metadata.decimals);
        balanceInfo = `**${metadata.symbol} Balance:** ${formattedBalance}`;
      } catch (error: any) {
        logger.warn('Failed to get balance for wallet-status', {
          error: error.message,
        });
        balanceInfo = '*Balance unavailable*';
      }

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(getStatusColor('success'))
        .setTitle('✅ Wallet Verified')
        .setDescription(
          `**Wallet:** \`${verification.wallet_address}\`\n` +
          `**Method:** ${verification.verification_method}\n` +
          `**Verified:** <t:${Math.floor(new Date(verification.verified_at!).getTime() / 1000)}:R>\n\n` +
          balanceInfo
        );

      // Add eligible roles
      if (passedRules.length > 0) {
        const rolesList = passedRules
          .map(r => `✅ ${r.role_name} (${r.rule_name})`)
          .join('\n');

        embed.addFields({
          name: `🎭 Eligible Roles (${passedRules.length})`,
          value: rolesList,
          inline: false,
        });
      } else {
        embed.addFields({
          name: '🎭 Eligible Roles',
          value: '*No roles available based on current balance*',
          inline: false,
        });
      }

      // Add requirements not met (if any)
      if (failedRules.length > 0 && failedRules.length <= 3) {
        const requirementsList = failedRules
          .map(r => `❌ ${r.role_name} (${r.rule_name})`)
          .join('\n');

        embed.addFields({
          name: '📋 Requirements Not Met',
          value: requirementsList,
          inline: false,
        });
      }

      embed.setFooter({ text: 'Roles are automatically synced every hour' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      logger.info('Wallet status checked', {
        user_id: userId,
        wallet: verification.wallet_address,
        passed_rules: passedRules.length,
        failed_rules: failedRules.length,
      });
    } catch (error: any) {
      logger.error('Error executing wallet-status command', {
        error: error.message,
        user_id: interaction.user.id,
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Error')
        .setDescription(
          'Failed to retrieve wallet status.\n\n' +
          'Please try again in a few moments.'
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
