/**
 * BitSage Discord Token-Gating - /disconnect-wallet Command
 *
 * Allows users to disconnect their verified wallet and remove token-gated roles.
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
  GuildMember,
} from 'discord.js';
import { query } from '../../../utils/database';
import { logger } from '../../../utils/logger';
import * as EMOJI from '../../../utils/emojis';

export const data = new SlashCommandBuilder()
  .setName('disconnect-wallet')
  .setDescription('Disconnect your verified Starknet wallet and remove token-gated roles');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.user.id;
    const member = interaction.member as GuildMember;

    // Check if user has a verified wallet
    const verificationResult = await query(
      `SELECT * FROM wallet_verifications
       WHERE user_id = $1 AND verified = TRUE
       ORDER BY verified_at DESC
       LIMIT 1`,
      [userId]
    );

    if (verificationResult.rowCount === 0) {
      const notVerifiedEmbed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle(`${EMOJI.STATUS.ERROR} No Wallet Connected`)
        .setDescription(
          `You don't have a verified wallet to disconnect.\\n\\n` +
            `Use \`/verify-wallet\` to connect a Starknet wallet.`
        )
        .setFooter({ text: 'BitSage Token-Gating • Starknet' })
        .setTimestamp();

      await interaction.editReply({ embeds: [notVerifiedEmbed] });
      return;
    }

    const verification = verificationResult.rows[0];
    const walletAddress = verification.wallet_address;

    // Get token-gated roles the user currently has
    const rolesResult = await query(
      `SELECT DISTINCT rm.role_id, rm.role_name
       FROM role_mappings rm
       JOIN token_gating_rules tgr ON rm.rule_id = tgr.id
       WHERE rm.guild_id = $1 AND tgr.enabled = TRUE`,
      [interaction.guildId]
    );

    const tokenGatedRoles = rolesResult.rows
      .filter((r: any) => member.roles.cache.has(r.role_id))
      .map((r: any) => {
        const role = member.guild.roles.cache.get(r.role_id);
        return role ? role.toString() : `@${r.role_name}`;
      });

    // Create confirmation embed
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle(`${EMOJI.STATUS.WARNING} Confirm Wallet Disconnection`)
      .setDescription(
        `Are you sure you want to disconnect your wallet?\\n\\n` +
          `**Connected Wallet:**\\n\`${walletAddress}\``
      )
      .addFields({
        name: `${EMOJI.STATUS.INFO} What will happen:`,
        value:
          '❌ Your wallet verification will be removed\\n' +
          `${
            tokenGatedRoles.length > 0
              ? `❌ You will lose ${tokenGatedRoles.length} token-gated role(s):\\n${tokenGatedRoles.join(', ')}`
              : '✅ You do not currently have any token-gated roles'
          }\\n` +
          '✅ You can re-verify with a different wallet anytime',
        inline: false,
      })
      .setFooter({ text: 'This action is reversible - you can verify again' })
      .setTimestamp();

    // Create confirmation buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_disconnect')
        .setLabel('Yes, Disconnect')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌'),
      new ButtonBuilder()
        .setCustomId('cancel_disconnect')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('↩️')
    );

    const response = await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row],
    });

    // Wait for button interaction
    try {
      const confirmation = await response.awaitMessageComponent({
        componentType: ComponentType.Button,
        time: 30000, // 30 seconds
        filter: (i) => i.user.id === userId,
      });

      if (confirmation.customId === 'cancel_disconnect') {
        const cancelledEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`${EMOJI.STATUS.INFO} Disconnection Cancelled`)
          .setDescription('Your wallet remains connected. No changes were made.')
          .setFooter({ text: 'BitSage Token-Gating • Starknet' })
          .setTimestamp();

        await confirmation.update({
          embeds: [cancelledEmbed],
          components: [],
        });

        return;
      }

      // User confirmed - proceed with disconnection
      await confirmation.deferUpdate();

      // Remove wallet verification
      await query(
        `DELETE FROM wallet_verifications
         WHERE user_id = $1`,
        [userId]
      );

      // Remove cached rules
      await query(
        `DELETE FROM user_rule_cache
         WHERE user_id = $1`,
        [userId]
      );

      // Remove token-gated roles
      const rolesRemoved: string[] = [];
      for (const roleRow of rolesResult.rows) {
        const role = member.guild.roles.cache.get(roleRow.role_id);
        if (role && member.roles.cache.has(role.id)) {
          try {
            await member.roles.remove(role);
            rolesRemoved.push(role.name);
          } catch (error: any) {
            logger.error('Failed to remove role during wallet disconnect', {
              user_id: userId,
              role_id: role.id,
              error: error.message,
            });
          }
        }
      }

      // Success embed
      const successEmbed = new EmbedBuilder()
        .setColor(0x00ff88)
        .setTitle(`${EMOJI.STATUS.SUCCESS} Wallet Disconnected`)
        .setDescription(
          `Your wallet has been successfully disconnected.\\n\\n` +
            `**Removed Wallet:** \`${walletAddress}\``
        )
        .addFields({
          name: `${EMOJI.STATUS.INFO} What happened:`,
          value:
            '✅ Wallet verification removed\\n' +
            '✅ Verification cache cleared\\n' +
            `${rolesRemoved.length > 0 ? `✅ Removed ${rolesRemoved.length} role(s): ${rolesRemoved.join(', ')}` : '✅ No roles to remove'}`,
          inline: false,
        })
        .addFields({
          name: `${EMOJI.ACTIONS.HELP} Want to reconnect?`,
          value: 'Use `/verify-wallet` to verify with a new wallet anytime!',
          inline: false,
        })
        .setFooter({ text: 'BitSage Token-Gating • Starknet' })
        .setTimestamp();

      await confirmation.editReply({
        embeds: [successEmbed],
        components: [],
      });

      logger.info('Wallet disconnected', {
        user_id: userId,
        wallet_address: walletAddress,
        roles_removed: rolesRemoved.length,
        roles: rolesRemoved,
      });
    } catch (error: any) {
      // Timeout or error during confirmation
      const timeoutEmbed = new EmbedBuilder()
        .setColor(0xff6b6b)
        .setTitle(`${EMOJI.STATUS.ERROR} Confirmation Timeout`)
        .setDescription(
          'You did not respond in time. No changes were made.\\n\\n' +
            'Run `/disconnect-wallet` again if you still want to disconnect.'
        )
        .setFooter({ text: 'Timeout after 30 seconds' })
        .setTimestamp();

      await interaction.editReply({
        embeds: [timeoutEmbed],
        components: [],
      });
    }
  } catch (error: any) {
    logger.error('Failed to disconnect wallet', {
      user_id: interaction.user.id,
      error: error.message,
      stack: error.stack,
    });

    const errorEmbed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle(`${EMOJI.STATUS.ERROR} Disconnection Failed`)
      .setDescription(
        `Failed to disconnect wallet. Please try again later.\\n\\n` +
          `If this problem persists, contact server administrators.`
      )
      .setFooter({ text: 'Error: ' + error.message })
      .setTimestamp();

    await interaction.editReply({ embeds: [errorEmbed], components: [] }).catch(() => {});
  }
}
