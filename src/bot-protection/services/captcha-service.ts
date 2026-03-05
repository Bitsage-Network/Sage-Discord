/**
 * BitSage Discord Bot - Captcha Service
 *
 * Generates and validates different types of captchas:
 * - Number captchas (math problems)
 * - Text captchas (challenge questions)
 * - Image captchas (visual puzzles)
 */

import { query } from '../../utils/database';
import { logger } from '../../utils/logger';
import type {
  CaptchaType,
  CaptchaDifficulty,
  CaptchaTrigger,
  CaptchaChallenge,
  NumberCaptcha,
  TextCaptcha,
  ImageCaptcha,
  CaptchaVerification,
  CaptchaGenerationResult,
  CaptchaVerificationResult,
} from '../types';

// ============================================================
// Number Captcha Generation
// ============================================================

/**
 * Generate a random math problem based on difficulty
 */
export function generateNumberCaptcha(difficulty: CaptchaDifficulty = 'medium'): NumberCaptcha {
  let num1: number, num2: number, operation: string, answer: number, equation: string, challenge: string;

  switch (difficulty) {
    case 'easy':
      // Single-digit addition
      num1 = Math.floor(Math.random() * 10);
      num2 = Math.floor(Math.random() * 10);
      operation = '+';
      answer = num1 + num2;
      equation = `${num1} ${operation} ${num2}`;
      challenge = `What is ${equation}?`;
      break;

    case 'medium':
      // Two-digit addition or subtraction
      num1 = Math.floor(Math.random() * 50) + 10;
      num2 = Math.floor(Math.random() * 50) + 1;
      operation = Math.random() > 0.5 ? '+' : '-';

      if (operation === '+') {
        answer = num1 + num2;
      } else {
        answer = num1 - num2;
      }

      equation = `${num1} ${operation} ${num2}`;
      challenge = `What is ${equation}?`;
      break;

    case 'hard':
      // Multiplication or mixed operations
      const useMultiplication = Math.random() > 0.5;

      if (useMultiplication) {
        num1 = Math.floor(Math.random() * 12) + 2;
        num2 = Math.floor(Math.random() * 12) + 2;
        operation = '×';
        answer = num1 * num2;
        equation = `${num1} ${operation} ${num2}`;
        challenge = `What is ${equation}?`;
      } else {
        // Mixed: (a + b) - c
        num1 = Math.floor(Math.random() * 20) + 10;
        num2 = Math.floor(Math.random() * 20) + 5;
        const num3 = Math.floor(Math.random() * 10) + 1;
        answer = (num1 + num2) - num3;
        equation = `(${num1} + ${num2}) - ${num3}`;
        challenge = `What is ${equation}?`;
      }
      break;
  }

  return {
    type: 'number',
    challenge,
    answer: answer.toString(),
    equation,
    difficulty,
  };
}

// ============================================================
// Text Captcha Generation
// ============================================================

interface TextCaptchaTemplate {
  challenge: string;
  answer: string;
  alternatives: string[];
}

const TEXT_CAPTCHA_POOL: Record<CaptchaDifficulty, TextCaptchaTemplate[]> = {
  easy: [
    {
      challenge: 'What color is the sky on a clear day?',
      answer: 'blue',
      alternatives: ['blue', 'light blue', 'sky blue'],
    },
    {
      challenge: 'How many days are in a week?',
      answer: '7',
      alternatives: ['7', 'seven'],
    },
    {
      challenge: 'What is the opposite of hot?',
      answer: 'cold',
      alternatives: ['cold', 'cool'],
    },
    {
      challenge: 'What animal says "meow"?',
      answer: 'cat',
      alternatives: ['cat', 'cats', 'kitty', 'kitten'],
    },
    {
      challenge: 'What do bees make?',
      answer: 'honey',
      alternatives: ['honey'],
    },
    {
      challenge: 'What color are most leaves?',
      answer: 'green',
      alternatives: ['green'],
    },
  ],
  medium: [
    {
      challenge: 'What is the capital of France?',
      answer: 'paris',
      alternatives: ['paris'],
    },
    {
      challenge: 'How many continents are there on Earth?',
      answer: '7',
      alternatives: ['7', 'seven'],
    },
    {
      challenge: 'What is H2O commonly known as?',
      answer: 'water',
      alternatives: ['water'],
    },
    {
      challenge: 'Which planet is known as the Red Planet?',
      answer: 'mars',
      alternatives: ['mars'],
    },
    {
      challenge: 'What is the largest ocean on Earth?',
      answer: 'pacific',
      alternatives: ['pacific', 'pacific ocean'],
    },
    {
      challenge: 'What metal is liquid at room temperature?',
      answer: 'mercury',
      alternatives: ['mercury'],
    },
  ],
  hard: [
    {
      challenge: 'What is the chemical symbol for gold?',
      answer: 'au',
      alternatives: ['au'],
    },
    {
      challenge: 'In what year did World War II end?',
      answer: '1945',
      alternatives: ['1945'],
    },
    {
      challenge: 'What is the speed of light in vacuum? (in km/s)',
      answer: '299792',
      alternatives: ['299792', '300000', '~300000'],
    },
    {
      challenge: 'Who wrote "Romeo and Juliet"?',
      answer: 'shakespeare',
      alternatives: ['shakespeare', 'william shakespeare'],
    },
    {
      challenge: 'What is the square root of 144?',
      answer: '12',
      alternatives: ['12', 'twelve'],
    },
  ],
};

/**
 * Generate a random text-based question
 */
export function generateTextCaptcha(difficulty: CaptchaDifficulty = 'medium'): TextCaptcha {
  const pool = TEXT_CAPTCHA_POOL[difficulty];
  const template = pool[Math.floor(Math.random() * pool.length)];

  return {
    type: 'text',
    challenge: template.challenge,
    answer: template.answer.toLowerCase(),
    alternatives: template.alternatives.map(a => a.toLowerCase()),
    difficulty,
  };
}

// ============================================================
// Image Captcha Generation
// ============================================================

/**
 * Generate an image-based captcha
 *
 * NOTE: This is a placeholder for MVP. Full implementation requires:
 * - Canvas library (node-canvas or similar)
 * - Image generation with distortion
 * - Grid-based challenges (click the squares)
 *
 * For now, returns a text-based representation
 */
export function generateImageCaptcha(difficulty: CaptchaDifficulty = 'medium'): ImageCaptcha {
  // Placeholder: In production, this would generate an actual image
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();

  return {
    type: 'image',
    challenge: `Enter the code shown in the image: ${code}`,
    answer: code,
    difficulty,
    imageBuffer: Buffer.from(''), // Placeholder
  };
}

// ============================================================
// Captcha Generation (Main Function)
// ============================================================

/**
 * Generate a captcha challenge and store it in database
 */
export async function createCaptchaChallenge(
  guildId: string,
  userId: string,
  options: {
    type?: CaptchaType | 'random';
    difficulty?: CaptchaDifficulty;
    timeout_minutes?: number;
    max_attempts?: number;
    triggered_by?: CaptchaTrigger;
  } = {}
): Promise<CaptchaGenerationResult> {
  try {
    const {
      type = 'random',
      difficulty = 'medium',
      timeout_minutes = 10,
      max_attempts = 3,
      triggered_by = 'manual',
    } = options;

    // Determine captcha type
    const captchaType: CaptchaType =
      type === 'random'
        ? (['number', 'text'] as CaptchaType[])[Math.floor(Math.random() * 2)]
        : (type as CaptchaType);

    // Generate captcha based on type
    let captcha: CaptchaChallenge;

    switch (captchaType) {
      case 'number':
        captcha = generateNumberCaptcha(difficulty);
        break;
      case 'text':
        captcha = generateTextCaptcha(difficulty);
        break;
      case 'image':
        captcha = generateImageCaptcha(difficulty);
        break;
    }

    // Calculate expiry
    const expiresAt = new Date(Date.now() + timeout_minutes * 60 * 1000);

    // Store in database
    const result = await query(
      `INSERT INTO captcha_verifications (
        guild_id, user_id, captcha_type, challenge, correct_answer,
        max_attempts, expires_at, triggered_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        guildId,
        userId,
        captcha.type,
        captcha.challenge,
        captcha.answer,
        max_attempts,
        expiresAt,
        triggered_by,
      ]
    );

    const verificationId = result.rows[0].id;

    logger.info('Captcha challenge created', {
      guild_id: guildId,
      user_id: userId,
      verification_id: verificationId,
      type: captcha.type,
      difficulty,
      triggered_by,
    });

    return {
      success: true,
      captcha,
      verification_id: verificationId,
    };
  } catch (error: any) {
    logger.error('Failed to create captcha challenge', {
      error: error.message,
      guild_id: guildId,
      user_id: userId,
    });

    return {
      success: false,
      error: error.message || 'Failed to create captcha',
    };
  }
}

// ============================================================
// Captcha Verification
// ============================================================

/**
 * Verify user's answer to a captcha challenge
 */
export async function verifyCaptchaAnswer(
  verificationId: number,
  userAnswer: string
): Promise<CaptchaVerificationResult> {
  try {
    // Fetch verification record
    const result = await query(
      `SELECT * FROM captcha_verifications WHERE id = $1`,
      [verificationId]
    );

    if (result.rowCount === 0) {
      return {
        success: false,
        passed: false,
        attempts_remaining: 0,
        message: 'Captcha verification not found',
      };
    }

    const verification: CaptchaVerification = result.rows[0];

    // Check if expired
    if (new Date(verification.expires_at) < new Date()) {
      await query(
        `UPDATE captcha_verifications SET status = 'expired' WHERE id = $1`,
        [verificationId]
      );

      return {
        success: false,
        passed: false,
        attempts_remaining: 0,
        message: 'Captcha has expired. Please request a new one.',
      };
    }

    // Check if already completed
    if (verification.status === 'passed') {
      return {
        success: true,
        passed: true,
        attempts_remaining: verification.max_attempts - verification.attempts,
        message: 'Captcha already passed',
      };
    }

    if (verification.status === 'failed') {
      return {
        success: false,
        passed: false,
        attempts_remaining: 0,
        message: 'Captcha verification failed (too many attempts)',
        should_kick: true,
      };
    }

    // Normalize answer
    const normalizedUserAnswer = userAnswer.toLowerCase().trim();
    const normalizedCorrectAnswer = verification.correct_answer.toLowerCase().trim();

    // Check answer
    const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;

    // For text captchas, check alternatives
    if (!isCorrect && verification.captcha_type === 'text') {
      // Try to parse alternatives from challenge (stored as JSON in some cases)
      // For now, we'll accept close matches
      const alternatives = [normalizedCorrectAnswer];
      if (alternatives.includes(normalizedUserAnswer)) {
        // Accepted
      }
    }

    // Update attempts
    const newAttempts = verification.attempts + 1;
    const attemptsRemaining = verification.max_attempts - newAttempts;

    if (isCorrect) {
      // Passed!
      await query(
        `UPDATE captcha_verifications
         SET status = 'passed', user_answer = $1, attempts = $2, verified_at = NOW()
         WHERE id = $3`,
        [userAnswer, newAttempts, verificationId]
      );

      logger.info('Captcha verification passed', {
        verification_id: verificationId,
        user_id: verification.user_id,
        guild_id: verification.guild_id,
        attempts: newAttempts,
      });

      return {
        success: true,
        passed: true,
        attempts_remaining: attemptsRemaining,
        message: '✅ Captcha verified! You are now a verified member.',
      };
    } else {
      // Wrong answer
      if (attemptsRemaining <= 0) {
        // Failed - no more attempts
        await query(
          `UPDATE captcha_verifications
           SET status = 'failed', user_answer = $1, attempts = $2
           WHERE id = $3`,
          [userAnswer, newAttempts, verificationId]
        );

        logger.warn('Captcha verification failed (max attempts)', {
          verification_id: verificationId,
          user_id: verification.user_id,
          guild_id: verification.guild_id,
          attempts: newAttempts,
        });

        return {
          success: false,
          passed: false,
          attempts_remaining: 0,
          message: '❌ Incorrect answer. Maximum attempts reached. You will be kicked from the server.',
          should_kick: true,
        };
      } else {
        // Wrong, but has more attempts
        await query(
          `UPDATE captcha_verifications
           SET user_answer = $1, attempts = $2
           WHERE id = $3`,
          [userAnswer, newAttempts, verificationId]
        );

        return {
          success: true,
          passed: false,
          attempts_remaining: attemptsRemaining,
          message: `❌ Incorrect answer. You have ${attemptsRemaining} attempt(s) remaining.`,
        };
      }
    }
  } catch (error: any) {
    logger.error('Failed to verify captcha answer', {
      error: error.message,
      verification_id: verificationId,
    });

    return {
      success: false,
      passed: false,
      attempts_remaining: 0,
      message: 'Failed to verify captcha. Please try again.',
    };
  }
}

// ============================================================
// Get Active Captcha
// ============================================================

/**
 * Get user's active captcha verification (if any)
 */
export async function getActiveCaptcha(
  guildId: string,
  userId: string
): Promise<CaptchaVerification | null> {
  try {
    const result = await query(
      `SELECT * FROM captcha_verifications
       WHERE guild_id = $1 AND user_id = $2
       AND status = 'pending' AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [guildId, userId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error: any) {
    logger.error('Failed to get active captcha', {
      error: error.message,
      guild_id: guildId,
      user_id: userId,
    });
    return null;
  }
}

// ============================================================
// Exports
// ============================================================

export default {
  generateNumberCaptcha,
  generateTextCaptcha,
  generateImageCaptcha,
  createCaptchaChallenge,
  verifyCaptchaAnswer,
  getActiveCaptcha,
};
