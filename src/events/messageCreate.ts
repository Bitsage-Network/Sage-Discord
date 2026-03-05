import { Message, EmbedBuilder } from 'discord.js';
import { awardMessageXP } from '../services/gamification-service';
import { logger } from '../utils/logger';
import * as EMOJI from '../utils/emojis';
import { handleCaptchaDM } from '../bot-protection/events/captcha-dm-handler';

/**
 * Handle message creation - award XP and handle captcha DMs
 */
export async function handleMessageCreate(message: Message) {
  // Ignore bots
  if (message.author.bot) return;

  // Handle DMs for captcha verification
  if (!message.guild) {
    await handleCaptchaDM(message);
    return;
  }

  try {
    const userId = message.author.id;
    const username = message.author.username;
    const channelId = message.channel.id;

    // Award XP for message
    const result = await awardMessageXP(userId, username, channelId);

    // If no XP awarded (cooldown), return
    if (!result) return;

    // If leveled up, send congratulations
    if (result.leveled_up) {
      const embed = new EmbedBuilder()
        .setColor(0xffd700) // Gold
        .setTitle(`${EMOJI.PROGRESS.LEVEL_UP} Level Up!`)
        .setDescription(
          `**${message.author}** just reached **Level ${result.new_level}!** ${EMOJI.celebrationMessage('level_up')}`
        )
        .addFields({
          name: `${EMOJI.PROGRESS.XP} Total XP`,
          value: `${result.new_total_xp.toLocaleString()} XP`,
          inline: true
        })
        .setThumbnail(message.author.displayAvatarURL())
        .setFooter({ text: 'Keep chatting to level up!' })
        .setTimestamp();

      // Send level up message in the same channel
      if (message.channel && 'send' in message.channel) {
        await (message.channel as any).send({ embeds: [embed] });
      }

      logger.info(
        `Level up: ${username} (${userId}) reached level ${result.new_level}`
      );
    }
  } catch (error) {
    logger.error('Error handling message for XP', {
      userId: message.author.id,
      error
    });
    // Don't throw - we don't want to break the bot if XP system fails
  }
}
