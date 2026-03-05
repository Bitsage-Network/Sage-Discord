/**
 * /disconnect-wallet command
 *
 * Removes wallet verification and revokes token-gated roles.
 */

import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import { Command } from '../types';
import { logger } from '../utils/logger';
import { getStatusColor } from '../utils/formatters';
import {
  getWalletVerification,
  deleteWalletVerification,
} from '../token-gating/utils/verification-helpers';
import { RuleMatcher } from '../token-gating/utils/rule-matcher';
import { TokenGatingModule } from '../token-gating';
import { query } from '../utils/database';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('disconnect-wallet')
    .setDescription('Disconnect your verified wallet and remove token-gated roles'),

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

      // Check if wallet is verified
      const verification = await getWalletVerification(userId);

      if (!verification) {
        const embed = new EmbedBuilder()
          .setColor(getStatusColor('warning'))
          .setTitle('⚠️ No Wallet Connected')
          .setDescription('You do not have a verified wallet to disconnect.')
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Get roles that will be removed
      const tokenGating = TokenGatingModule.getInstance();
      const ruleMatcher = new RuleMatcher(tokenGating.tokenService);
      const ruleResults = await ruleMatcher.evaluateUserRules(
        userId,
        verification.wallet_address,
        guildId
      );

      const rolesToRemove = ruleResults
        .filter(r => r.passes && r.role_name)
        .map(r => r.role_name!);

      // Create confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(getStatusColor('warning'))
        .setTitle('⚠️ Confirm Wallet Disconnection')
        .setDescription(
          `Are you sure you want to disconnect your wallet?\n\n` +
          `**Wallet:** \`${verification.wallet_address}\`\n\n` +
          `**This will:**\n` +
          `• Remove your wallet verification\n` +
          `• Revoke all token-gated roles\n` +
          `• Clear cached balances\n\n` +
          (rolesToRemove.length > 0
            ? `**Roles to be removed:**\n${rolesToRemove.map(r => `• ${r}`).join('\n')}`
            : '*(No roles will be affected)*')
        )
        .setFooter({ text: 'You can verify again at any time with /verify-wallet' })
        .setTimestamp();

      // Create confirmation buttons
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('disconnect_confirm')
          .setLabel('Yes, Disconnect')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId('disconnect_cancel')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❌')
      );

      const response = await interaction.editReply({
        embeds: [confirmEmbed],
        components: [row],
      });

      // Wait for confirmation
      try {
        const confirmation = await response.awaitMessageComponent({
          filter: (i) => i.user.id === interaction.user.id,
          componentType: ComponentType.Button,
          time: 30000, // 30 seconds
        });

        if (confirmation.customId === 'disconnect_cancel') {
          const cancelEmbed = new EmbedBuilder()
            .setColor(getStatusColor('info'))
            .setTitle('ℹ️ Cancelled')
            .setDescription('Wallet disconnection cancelled. Your wallet remains verified.')
            .setTimestamp();

          await confirmation.update({
            embeds: [cancelEmbed],
            components: [],
          });
          return;
        }

        // User confirmed - proceed with disconnection
        await confirmation.deferUpdate();

        // Delete wallet verification
        await deleteWalletVerification(userId);

        // Invalidate rule cache
        await ruleMatcher.invalidateUserCache(userId);

        // Invalidate balance cache
        await tokenGating.cacheService.invalidateBalance(
          verification.wallet_address,
          tokenGating.tokenService['config'].contracts.sage_token
        );

        // Remove token-gated roles
        const member = await interaction.guild!.members.fetch(userId);
        const roleMappings = await query(
          `SELECT DISTINCT rm.role_id, rm.role_name
           FROM role_mappings rm
           JOIN token_gating_rules tgr ON rm.rule_id = tgr.id
           WHERE tgr.guild_id = $1 AND rm.auto_remove = TRUE`,
          [guildId]
        );

        let rolesRemovedCount = 0;
        for (const mapping of roleMappings.rows) {
          const role = member.guild.roles.cache.get(mapping.role_id);
          if (role && member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
            rolesRemovedCount++;
            logger.info('Token-gated role removed', {
              user_id: userId,
              role: mapping.role_name,
            });
          }
        }

        // Success embed
        const successEmbed = new EmbedBuilder()
          .setColor(getStatusColor('success'))
          .setTitle('✅ Wallet Disconnected')
          .setDescription(
            `Your wallet has been successfully disconnected.\n\n` +
            `**Removed:**\n` +
            `• Wallet verification\n` +
            `• ${rolesRemovedCount} token-gated role(s)\n` +
            `• Cached balances\n\n` +
            `You can verify again anytime with \`/verify-wallet\`.`
          )
          .setTimestamp();

        await confirmation.editReply({
          embeds: [successEmbed],
          components: [],
        });

        logger.info('Wallet disconnected', {
          user_id: userId,
          wallet: verification.wallet_address,
          roles_removed: rolesRemovedCount,
        });
      } catch (error: any) {
        // Timeout or error
        if (error.message.includes('time')) {
          const timeoutEmbed = new EmbedBuilder()
            .setColor(getStatusColor('warning'))
            .setTitle('⏱️ Confirmation Timeout')
            .setDescription('Wallet disconnection cancelled due to timeout.')
            .setTimestamp();

          await interaction.editReply({
            embeds: [timeoutEmbed],
            components: [],
          });
        } else {
          throw error;
        }
      }
    } catch (error: any) {
      logger.error('Error executing disconnect-wallet command', {
        error: error.message,
        user_id: interaction.user.id,
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(getStatusColor('error'))
        .setTitle('❌ Error')
        .setDescription(
          'Failed to disconnect wallet.\n\n' +
          'Please try again in a few moments.'
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed], components: [] });
    }
  },
};
