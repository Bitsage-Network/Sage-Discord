/**
 * BitSage Discord Bot - Member Join Handler
 *
 * Automatically triggers captcha verification when new members join
 * Also tracks join rate for raid detection
 */

import { Client, GuildMember, EmbedBuilder, PartialGuildMember } from 'discord.js';
import { logger } from '../../utils/logger';
import { getStatusColor } from '../../utils/formatters';
import { createCaptchaChallenge } from '../services/captcha-service';
import { query } from '../../utils/database';
import {
  recordJoinEvent,
  analyzeRaidRisk,
  enableLockdown,
  sendRaidAlert,
  isLockdownActive,
} from '../services/raid-protection-service';

/**
 * Handle new member joins
 */
export async function handleMemberJoin(member: GuildMember | PartialGuildMember): Promise<void> {
  try {
    // Fetch full member if partial
    if (member.partial) {
      member = await member.fetch();
    }

    const guildId = member.guild.id;
    const userId = member.id;

    // Track join event for raid detection
    await recordJoinEvent(member as GuildMember);

    // Check for lockdown
    const isLocked = await isLockdownActive(guildId);
    if (isLocked) {
      logger.info('Member join blocked - server in lockdown', {
        guild_id: guildId,
        user_id: userId,
        username: member.user.tag,
      });

      // Kick member immediately (server is in lockdown)
      try {
        await member.send(
          `Sorry, **${member.guild.name}** is currently in lockdown mode due to security concerns. ` +
          `Please try joining again later.`
        );
      } catch (error) {
        // DM might fail, continue with kick
      }

      await member.kick('Server is in lockdown mode');
      return;
    }

    // Analyze raid risk after each join
    const raidRisk = await analyzeRaidRisk(guildId);

    // Auto-lockdown if high confidence raid detected
    if (raidRisk.should_lockdown) {
      logger.warn('Auto-lockdown triggered - raid detected', {
        guild_id: guildId,
        confidence: raidRisk.confidence,
        join_rate: raidRisk.join_rate,
      });

      await enableLockdown(
        member.guild,
        `Auto-lockdown: Raid detected (${(raidRisk.confidence * 100).toFixed(0)}% confidence)`,
        'system'
      );

      // Send raid alert to admins
      await sendRaidAlert(member.guild, raidRisk, true);

      // Kick this member as part of lockdown
      try {
        await member.send(
          `Sorry, **${member.guild.name}** has been automatically locked down due to detected raid activity. ` +
          `Please try joining again later when the lockdown is lifted.`
        );
      } catch (error) {
        // DM might fail, continue with kick
      }

      await member.kick('Auto-lockdown activated (raid detected)');
      return;
    }

    // Send alert if raid suspected but below auto-lockdown threshold
    if (raidRisk.is_raid && !raidRisk.should_lockdown) {
      await sendRaidAlert(member.guild, raidRisk, false);
    }

    // Get guild bot protection config
    const configResult = await query(
      `SELECT * FROM guild_bot_protection_config WHERE guild_id = $1`,
      [guildId]
    );

    if (configResult.rowCount === 0) {
      // No config - create default
      await query(
        `INSERT INTO guild_bot_protection_config (guild_id)
         VALUES ($1)
         ON CONFLICT (guild_id) DO NOTHING`,
        [guildId]
      );

      // Config not enabled yet - skip verification
      return;
    }

    const config = configResult.rows[0];

    // Check if captcha on join is enabled
    if (!config.captcha_enabled || !config.captcha_on_join) {
      logger.debug('Captcha on join disabled', {
        guild_id: guildId,
        user_id: userId,
      });
      return;
    }

    // Skip if member is a bot (unless specifically configured)
    if (member.user.bot) {
      return;
    }

    // Check if server is in lockdown
    const lockdownResult = await query(
      `SELECT * FROM guild_lockdown_status WHERE guild_id = $1 AND is_locked_down = TRUE`,
      [guildId]
    );

    const isLockdown = lockdownResult.rowCount > 0;

    // Assign waiting room role if configured
    if (config.waiting_room_enabled && config.waiting_room_role_id) {
      try {
        const waitingRoomRole = await member.guild.roles.fetch(config.waiting_room_role_id);
        if (waitingRoomRole) {
          await member.roles.add(waitingRoomRole);
          logger.info('Assigned waiting room role', {
            guild_id: guildId,
            user_id: userId,
            role_id: config.waiting_room_role_id,
          });
        }
      } catch (roleError: any) {
        logger.error('Failed to assign waiting room role', {
          error: roleError.message,
          guild_id: guildId,
          user_id: userId,
        });
      }
    }

    // Create member verification status
    const accountAge = Date.now() - member.user.createdTimestamp;
    const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
    const isSuspicious = accountAgeDays < 7 || !member.user.avatar;

    await query(
      `INSERT INTO member_verification_status (
        guild_id, user_id, joined_at, account_created_at,
        has_avatar, is_suspicious, suspicious_reasons
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6)
      ON CONFLICT (guild_id, user_id) DO UPDATE
      SET joined_at = NOW(),
          account_created_at = $3,
          has_avatar = $4,
          is_suspicious = $5,
          suspicious_reasons = $6,
          updated_at = NOW()`,
      [
        guildId,
        userId,
        member.user.createdAt,
        member.user.avatar !== null,
        isSuspicious,
        isSuspicious ? ['new_account', 'no_avatar'].filter(r =>
          (r === 'new_account' && accountAgeDays < 7) ||
          (r === 'no_avatar' && !member.user.avatar)
        ) : null,
      ]
    );

    // Generate captcha challenge
    const captchaType = config.captcha_type === 'random'
      ? (Math.random() > 0.5 ? 'number' : 'text')
      : config.captcha_type;

    const result = await createCaptchaChallenge(guildId, userId, {
      type: captchaType,
      difficulty: config.captcha_difficulty,
      timeout_minutes: config.captcha_timeout_minutes,
      max_attempts: config.max_captcha_attempts,
      triggered_by: isLockdown ? 'raid_protection' : 'auto_join',
    });

    if (!result.success || !result.captcha) {
      logger.error('Failed to create auto-join captcha', {
        guild_id: guildId,
        user_id: userId,
        error: result.error,
      });
      return;
    }

    // Build welcome message with captcha
    const embed = new EmbedBuilder()
      .setColor(getStatusColor('info'))
      .setTitle(`🔐 Welcome to ${member.guild.name}!`)
      .setDescription(
        `To gain access to the server, please complete the verification challenge below.\n\n` +
        `This helps us keep the community safe from spam and bots. 🛡️`
      )
      .addFields(
        {
          name: '📝 Challenge',
          value: `\`\`\`${result.captcha.challenge}\`\`\``,
          inline: false,
        },
        {
          name: '⏱️ Time Limit',
          value: `${config.captcha_timeout_minutes} minutes`,
          inline: true,
        },
        {
          name: '🎯 Attempts',
          value: `${config.max_captcha_attempts}`,
          inline: true,
        }
      )
      .setFooter({ text: 'Reply to this message with your answer' })
      .setTimestamp();

    // Add rules if configured
    if (config.rules_enabled) {
      const rulesResult = await query(
        `SELECT rule_number, rule_text, emoji FROM guild_rules
         WHERE guild_id = $1 AND enabled = TRUE
         ORDER BY rule_number ASC`,
        [guildId]
      );

      if (rulesResult.rowCount > 0) {
        const rulesText = rulesResult.rows
          .map(row => `${row.emoji ? row.emoji + ' ' : ''}**${row.rule_number}.** ${row.rule_text}`)
          .join('\n');

        embed.addFields({
          name: '📜 Server Rules',
          value: rulesText.substring(0, 1024), // Discord embed field limit
          inline: false,
        });
      }
    }

    // Send DM
    try {
      await member.send({ embeds: [embed] });

      logger.info('Auto-join captcha sent', {
        guild_id: guildId,
        user_id: userId,
        username: member.user.tag,
        verification_id: result.verification_id,
        type: result.captcha.type,
        is_lockdown: isLockdown,
        is_suspicious: isSuspicious,
      });
    } catch (dmError: any) {
      // Failed to send DM
      logger.warn('Failed to send auto-join captcha DM', {
        guild_id: guildId,
        user_id: userId,
        username: member.user.tag,
        error: dmError.message,
      });

      // If DMs are disabled, we might want to:
      // 1. Send message in a verification channel
      // 2. Kick immediately
      // 3. Do nothing and hope they enable DMs

      // For now, we'll mark them as unverified and they'll get pruned if pruning is enabled
    }
  } catch (error: any) {
    logger.error('Error handling member join', {
      error: error.message,
      guild_id: member.guild.id,
      user_id: member.id,
    });
  }
}


/**
 * Register the member join handler with the Discord client
 */
export function registerMemberJoinHandler(client: Client): void {
  client.on('guildMemberAdd', async (member) => {
    await handleMemberJoin(member);
  });

  logger.info('Member join handler registered (auto-captcha)');
}

export default {
  handleMemberJoin,
  registerMemberJoinHandler,
};
