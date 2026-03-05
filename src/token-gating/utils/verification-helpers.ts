/**
 * BitSage Discord Token-Gating - Verification Helpers
 *
 * Utility functions for wallet verification workflows.
 */

import { query } from '../../utils/database';
import { logger } from '../../utils/logger';
import {
  WalletVerification,
  VerificationSession,
  VerificationMethod,
  VerificationError,
} from '../types';
import crypto from 'crypto';

/**
 * Create a verification session
 */
export async function createVerificationSession(
  userId: string,
  method: VerificationMethod,
  expiryMinutes: number = 15
): Promise<VerificationSession> {
  try {
    // Generate unique session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const challengeNonce = crypto.randomBytes(16).toString('hex');

    // Generate challenge message
    const timestamp = Math.floor(Date.now() / 1000);
    const challengeMessage = `BitSage Wallet Verification\n` +
      `Discord ID: ${userId}\n` +
      `Nonce: ${challengeNonce}\n` +
      `Timestamp: ${timestamp}\n` +
      `Action: Verify wallet ownership\n\n` +
      `This signature will be used to link your Starknet wallet to your Discord account.\n` +
      `This is NOT a transaction and will NOT cost gas.`;

    // Insert session into database
    const result = await query<VerificationSession>(
      `INSERT INTO verification_sessions
       (user_id, state, verification_method, challenge_message, challenge_nonce, session_token, expires_at)
       VALUES ($1, 'pending', $2, $3, $4, $5, NOW() + INTERVAL '${expiryMinutes} minutes')
       RETURNING *`,
      [userId, method, challengeMessage, challengeNonce, sessionToken]
    );

    const session = result.rows[0];

    logger.info('Verification session created', {
      session_id: session.id,
      user_id: userId,
      method,
      expires_at: session.expires_at,
    });

    return session;
  } catch (error: any) {
    logger.error('Failed to create verification session', {
      user_id: userId,
      method,
      error: error.message,
    });

    throw new VerificationError(
      'Failed to create verification session',
      { userId, method, error: error.message }
    );
  }
}

/**
 * Get verification session by token
 */
export async function getVerificationSession(
  sessionToken: string
): Promise<VerificationSession | null> {
  try {
    const result = await query<VerificationSession>(
      `SELECT * FROM verification_sessions WHERE session_token = $1`,
      [sessionToken]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error: any) {
    logger.error('Failed to get verification session', {
      error: error.message,
    });
    return null;
  }
}

/**
 * Update verification session
 */
export async function updateVerificationSession(
  sessionId: string,
  updates: {
    state?: VerificationSession['state'];
    wallet_address?: string;
    signature?: string;
    stealth_meta_address?: string;
    zk_proof_data?: any;
  }
): Promise<void> {
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.state) {
      setClauses.push(`state = $${paramIndex++}`);
      values.push(updates.state);
    }

    if (updates.wallet_address) {
      setClauses.push(`wallet_address = $${paramIndex++}`);
      values.push(updates.wallet_address);
    }

    if (updates.signature) {
      setClauses.push(`signature = $${paramIndex++}`);
      values.push(updates.signature);
    }

    if (updates.stealth_meta_address) {
      setClauses.push(`stealth_meta_address = $${paramIndex++}`);
      values.push(updates.stealth_meta_address);
    }

    if (updates.zk_proof_data) {
      setClauses.push(`zk_proof_data = $${paramIndex++}`);
      values.push(JSON.stringify(updates.zk_proof_data));
    }

    if (setClauses.length === 0) {
      return;
    }

    values.push(sessionId);

    await query(
      `UPDATE verification_sessions
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}`,
      values
    );

    logger.debug('Verification session updated', {
      session_id: sessionId,
      updates: Object.keys(updates),
    });
  } catch (error: any) {
    logger.error('Failed to update verification session', {
      session_id: sessionId,
      error: error.message,
    });

    throw new VerificationError(
      'Failed to update verification session',
      { sessionId, error: error.message }
    );
  }
}

/**
 * Complete verification session
 */
export async function completeVerificationSession(
  sessionId: string
): Promise<void> {
  try {
    await query(
      `UPDATE verification_sessions
       SET state = 'verified', completed_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );

    logger.info('Verification session completed', { session_id: sessionId });
  } catch (error: any) {
    logger.error('Failed to complete verification session', {
      session_id: sessionId,
      error: error.message,
    });
  }
}

/**
 * Get or create wallet verification
 */
export async function getWalletVerification(
  userId: string
): Promise<WalletVerification | null> {
  try {
    const result = await query<WalletVerification>(
      `SELECT * FROM wallet_verifications
       WHERE user_id = $1 AND verified = TRUE
       ORDER BY verified_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error: any) {
    logger.error('Failed to get wallet verification', {
      user_id: userId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Create wallet verification
 */
export async function createWalletVerification(
  userId: string,
  walletAddress: string,
  method: VerificationMethod,
  signatureData?: {
    signature: string;
    message: string;
  }
): Promise<WalletVerification> {
  try {
    const result = await query<WalletVerification>(
      `INSERT INTO wallet_verifications
       (user_id, wallet_address, verification_method, signature, message, verified, verified_at, signed_at)
       VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
       ON CONFLICT (user_id, wallet_address)
       DO UPDATE SET
         verified = TRUE,
         verified_at = NOW(),
         signature = $4,
         message = $5,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        walletAddress,
        method,
        signatureData?.signature || null,
        signatureData?.message || null,
      ]
    );

    const verification = result.rows[0];

    logger.info('Wallet verification created', {
      user_id: userId,
      wallet_address: walletAddress,
      method,
    });

    return verification;
  } catch (error: any) {
    logger.error('Failed to create wallet verification', {
      user_id: userId,
      wallet_address: walletAddress,
      error: error.message,
    });

    throw new VerificationError(
      'Failed to create wallet verification',
      { userId, walletAddress, error: error.message }
    );
  }
}

/**
 * Delete wallet verification
 */
export async function deleteWalletVerification(userId: string): Promise<void> {
  try {
    await query(
      `DELETE FROM wallet_verifications WHERE user_id = $1`,
      [userId]
    );

    logger.info('Wallet verification deleted', { user_id: userId });
  } catch (error: any) {
    logger.error('Failed to delete wallet verification', {
      user_id: userId,
      error: error.message,
    });

    throw new VerificationError(
      'Failed to delete wallet verification',
      { userId, error: error.message }
    );
  }
}

/**
 * Check if user has active verification sessions
 */
export async function getActiveSessionsCount(userId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM verification_sessions
       WHERE user_id = $1 AND state IN ('pending', 'signed') AND expires_at > NOW()`,
      [userId]
    );

    return parseInt(result.rows[0].count);
  } catch (error: any) {
    logger.error('Failed to get active sessions count', {
      user_id: userId,
      error: error.message,
    });
    return 0;
  }
}

/**
 * Cleanup expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await query(
      `UPDATE verification_sessions
       SET state = 'expired'
       WHERE state IN ('pending', 'signed') AND expires_at < NOW()
       RETURNING id`
    );

    const count = result.rowCount;

    if (count > 0) {
      logger.info('Expired verification sessions cleaned up', { count });
    }

    return count;
  } catch (error: any) {
    logger.error('Failed to cleanup expired sessions', {
      error: error.message,
    });
    return 0;
  }
}

/**
 * Validate Starknet address format
 */
export function isValidStarknetAddress(address: string): boolean {
  // Starknet addresses are 66 characters (0x + 64 hex chars)
  // But can be shorter if leading zeros are omitted
  const pattern = /^0x[0-9a-fA-F]{1,64}$/;
  return pattern.test(address);
}

/**
 * Generate verification URL
 */
export function generateVerificationURL(
  baseURL: string,
  sessionToken: string
): string {
  return `${baseURL}/verify?session=${sessionToken}`;
}
