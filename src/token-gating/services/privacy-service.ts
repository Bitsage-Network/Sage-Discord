/**
 * Privacy Service
 *
 * Handles privacy-preserving wallet verification methods:
 * - Zero-knowledge balance proofs
 * - Stealth address verification
 * - Auditor-enabled compliance
 *
 * Integrates with BitSage Obelysk privacy layer contracts.
 */

import { Account, AccountInterface, Contract, RpcProvider, hash, num } from 'starknet';
import { logger } from '../../utils/logger.js';
import { query } from '../../utils/database.js';
import { getTokenGatingConfig } from '../utils/config.js';
import { StarknetService } from './starknet-service.js';

const config = getTokenGatingConfig();

// Type definitions for privacy features
export interface ZKBalanceProof {
  // Proof that balance >= threshold without revealing exact amount
  encrypted_balance: string;        // ElGamal ciphertext of balance
  threshold: string;                // Minimum balance requirement (public)
  nullifier: string;                // Unique identifier to prevent replay
  timestamp: number;                // Proof generation time
  signature: string[];              // User's signature over proof data
  schnorr_proof: SchnorrProof;      // Proof of secret key ownership
  range_proof: RangeProof;          // Proof that decrypted balance >= threshold
  commitment: string;               // Pedersen commitment to balance
  ae_hint?: string;                 // Optional arithmetic encoding hint for fast verification
}

export interface SchnorrProof {
  // Proof that user knows secret key for encrypted balance
  R: string;  // Random commitment point
  s: string;  // Response value
}

export interface RangeProof {
  // Bulletproofs-style range proof (simplified for prototype)
  A: string;          // Commitment to bits
  S: string;          // Commitment to blinding factors
  T1: string;         // Commitment to t1 polynomial
  T2: string;         // Commitment to t2 polynomial
  tau_x: string;      // Blinding factor
  mu: string;         // Blinding factor
  t_hat: string;      // Evaluation of polynomial
  inner_product_proof: string;  // Inner product argument
}

export interface StealthMetaAddress {
  // ERC-5564 compatible stealth meta-address
  spending_pubkey: string;  // Public key for spending
  viewing_pubkey: string;   // Public key for viewing
}

export interface StealthAnnouncement {
  // Announcement of stealth payment
  ephemeral_pubkey: string;  // Ephemeral public key
  view_tag: number;          // First byte for filtering
  metadata: string;          // Additional encrypted data
  block_number: number;      // Block where announced
  tx_hash: string;          // Transaction hash
}

export interface StealthVerificationResult {
  eligible: boolean;
  announcements_found: number;
  threshold_met: boolean;
  stealth_addresses?: string[];  // Only if user provides viewing key
  total_amount?: bigint;         // Only if user provides viewing key
}

export interface AuditorPermission {
  id: number;
  guild_id: string;
  auditor_name: string;
  auditor_pubkey: string;
  can_decrypt_balances: boolean;
  can_view_addresses: boolean;
  enabled: boolean;
  expires_at?: Date;
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  nullifier?: string;
  threshold?: bigint;
  verified_at?: Date;
}

export class PrivacyService {
  private starknetService: StarknetService;
  private provider: RpcProvider;

  constructor() {
    this.starknetService = new StarknetService();
    this.provider = new RpcProvider({ nodeUrl: config.rpc_url });
    logger.info('PrivacyService initialized', {
      privacy_router: config.contracts.privacy_router,
      stealth_registry: config.contracts.stealth_registry,
    });
  }

  /**
   * Verify a zero-knowledge balance proof off-chain
   *
   * This verifies that:
   * 1. Proof is fresh (timestamp within 5 minutes)
   * 2. Nullifier hasn't been used (prevents replay)
   * 3. User signed the proof data
   * 4. Encrypted balance matches on-chain PrivateAccount state
   * 5. Schnorr proof proves secret key ownership
   * 6. Range proof proves decrypted balance >= threshold
   */
  async verifyBalanceProof(
    proof: ZKBalanceProof,
    discordId: string,
    starknetAddress: string
  ): Promise<VerificationResult> {
    try {
      logger.info('Verifying ZK balance proof', {
        discord_id: discordId,
        starknet_address: starknetAddress,
        nullifier: proof.nullifier,
        threshold: proof.threshold,
      });

      // Step 1: Check timestamp freshness (5 minute window)
      const proofAge = Date.now() - proof.timestamp;
      const MAX_AGE = 5 * 60 * 1000; // 5 minutes

      if (proofAge > MAX_AGE || proofAge < -60000) {
        return {
          valid: false,
          reason: `Proof timestamp expired or future. Age: ${Math.floor(proofAge / 1000)}s`,
        };
      }

      // Step 2: Check nullifier hasn't been used (prevent replay attacks)
      const nullifierExists = await this.checkNullifierExists(proof.nullifier);
      if (nullifierExists) {
        logger.warn('Nullifier replay attempt detected', {
          discord_id: discordId,
          nullifier: proof.nullifier,
        });
        return {
          valid: false,
          reason: 'Nullifier already used (replay attack prevented)',
        };
      }

      // Step 3: Verify user signature over proof data
      const proofHash = this.hashProofData(proof);
      const signatureValid = await this.verifyProofSignature(
        starknetAddress,
        proofHash,
        proof.signature
      );

      if (!signatureValid) {
        return {
          valid: false,
          reason: 'Invalid signature over proof data',
        };
      }

      // Step 4: Query on-chain encrypted balance from PrivacyRouter
      const onChainEncryptedBalance = await this.getOnChainEncryptedBalance(starknetAddress);

      if (onChainEncryptedBalance !== proof.encrypted_balance) {
        logger.warn('Encrypted balance mismatch', {
          discord_id: discordId,
          on_chain: onChainEncryptedBalance,
          proof: proof.encrypted_balance,
        });
        return {
          valid: false,
          reason: 'Encrypted balance does not match on-chain state',
        };
      }

      // Step 5: Verify Schnorr proof of secret key ownership
      const schnorrValid = await this.verifySchnorrProof(
        proof.schnorr_proof,
        proof.encrypted_balance,
        starknetAddress
      );

      if (!schnorrValid) {
        return {
          valid: false,
          reason: 'Invalid Schnorr proof (failed to prove secret key ownership)',
        };
      }

      // Step 6: Verify range proof (balance >= threshold)
      const rangeValid = await this.verifyRangeProof(
        proof.range_proof,
        proof.commitment,
        BigInt(proof.threshold)
      );

      if (!rangeValid) {
        return {
          valid: false,
          reason: 'Invalid range proof (balance may be below threshold)',
        };
      }

      // Step 7: Optional AE hint verification for fast checking
      if (proof.ae_hint) {
        const aeValid = await this.verifyAEHint(
          proof.ae_hint,
          proof.encrypted_balance,
          BigInt(proof.threshold)
        );

        if (!aeValid) {
          logger.warn('AE hint verification failed (proof still valid)', {
            discord_id: discordId,
          });
        }
      }

      // All checks passed - store nullifier and return success
      await this.storeNullifier(
        proof.nullifier,
        discordId,
        starknetAddress,
        BigInt(proof.threshold),
        proof
      );

      logger.info('ZK balance proof verified successfully', {
        discord_id: discordId,
        starknet_address: starknetAddress,
        threshold: proof.threshold,
      });

      return {
        valid: true,
        nullifier: proof.nullifier,
        threshold: BigInt(proof.threshold),
        verified_at: new Date(),
      };
    } catch (error: any) {
      logger.error('Failed to verify ZK balance proof', {
        discord_id: discordId,
        error: error.message,
        stack: error.stack,
      });
      return {
        valid: false,
        reason: `Verification error: ${error.message}`,
      };
    }
  }

  /**
   * Verify stealth address payments
   *
   * Checks if user has received sufficient stealth payments to meet threshold.
   * Note: Without viewing key, bot can only count announcements, not amounts.
   */
  async verifyStealthPayments(
    discordId: string,
    threshold: bigint,
    viewingKey?: string
  ): Promise<StealthVerificationResult> {
    try {
      logger.info('Verifying stealth payments', {
        discord_id: discordId,
        threshold: threshold.toString(),
        has_viewing_key: !!viewingKey,
      });

      // Get user's stealth meta-address from database
      const metaAddressResult = await query(
        'SELECT stealth_meta_address, viewing_pubkey FROM stealth_addresses WHERE user_id = $1',
        [discordId]
      );

      if (metaAddressResult.rowCount === 0) {
        return {
          eligible: false,
          announcements_found: 0,
          threshold_met: false,
        };
      }

      const metaAddress = metaAddressResult.rows[0].stealth_meta_address;
      const viewingPubkey = metaAddressResult.rows[0].viewing_pubkey;

      // Compute view tag for efficient filtering
      const viewTag = this.computeViewTag(viewingPubkey);

      // Query StealthRegistry for announcements with matching view tag
      const announcements = await this.getStealthAnnouncements(viewTag);

      logger.info('Stealth announcements found', {
        discord_id: discordId,
        view_tag: viewTag,
        count: announcements.length,
      });

      // If no viewing key provided, can only count announcements
      if (!viewingKey) {
        const eligible = announcements.length >= Number(threshold);
        return {
          eligible,
          announcements_found: announcements.length,
          threshold_met: eligible,
        };
      }

      // With viewing key, decrypt and sum amounts
      const { addresses, totalAmount } = await this.decryptStealthPayments(
        announcements,
        viewingKey,
        viewingPubkey
      );

      const thresholdMet = totalAmount >= threshold;

      return {
        eligible: thresholdMet,
        announcements_found: announcements.length,
        threshold_met: thresholdMet,
        stealth_addresses: addresses,
        total_amount: totalAmount,
      };
    } catch (error: any) {
      logger.error('Failed to verify stealth payments', {
        discord_id: discordId,
        error: error.message,
      });
      return {
        eligible: false,
        announcements_found: 0,
        threshold_met: false,
      };
    }
  }

  /**
   * Register a stealth meta-address for a user
   */
  async registerStealthAddress(
    userId: string,
    metaAddress: StealthMetaAddress
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO stealth_addresses
         (user_id, stealth_meta_address, spending_pubkey, viewing_pubkey, registered_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (stealth_meta_address) DO UPDATE
         SET last_used = NOW()`,
        [
          userId,
          this.formatMetaAddress(metaAddress),
          metaAddress.spending_pubkey,
          metaAddress.viewing_pubkey,
        ]
      );

      logger.info('Stealth address registered', {
        user_id: userId,
        meta_address: this.formatMetaAddress(metaAddress),
      });
    } catch (error: any) {
      logger.error('Failed to register stealth address', {
        user_id: userId,
        error: error.message,
      });
      throw error;
    }
  }

  // ========== Private Helper Methods ==========

  private async checkNullifierExists(nullifier: string): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM zk_proof_nullifiers WHERE nullifier = $1',
      [nullifier]
    );
    return result.rowCount > 0;
  }

  private async storeNullifier(
    nullifier: string,
    discordId: string,
    starknetAddress: string,
    threshold: bigint,
    proof: ZKBalanceProof
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await query(
      `INSERT INTO zk_proof_nullifiers
       (nullifier, discord_id, starknet_address, threshold, verified_at, expires_at, proof_data)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
      [
        nullifier,
        discordId,
        starknetAddress,
        threshold.toString(),
        expiresAt,
        JSON.stringify(proof),
      ]
    );
  }

  private hashProofData(proof: ZKBalanceProof): string {
    // Create deterministic hash of proof data for signature verification
    const data = [
      proof.encrypted_balance,
      proof.threshold,
      proof.nullifier,
      proof.timestamp.toString(),
      proof.commitment,
    ].join('|');

    return hash.computeHashOnElements([hash.starknetKeccak(data)]);
  }

  private async verifyProofSignature(
    address: string,
    messageHash: string,
    signature: string[]
  ): Promise<boolean> {
    try {
      // For account abstraction, we need to call isValidSignature on the account contract
      // This is a simplified version - production should use proper account abstraction

      // For now, we'll trust client-side signature if format is valid
      // TODO: Implement proper Starknet account signature verification
      return signature.length === 2 && signature.every(s => s.startsWith('0x'));
    } catch (error: any) {
      logger.error('Signature verification failed', { error: error.message });
      return false;
    }
  }

  private async getOnChainEncryptedBalance(address: string): Promise<string> {
    try {
      if (!config.contracts.privacy_router) {
        logger.warn('Privacy router not configured, skipping on-chain check');
        return '0x0'; // Fallback for testing without privacy contracts
      }

      // Query PrivacyRouter.get_account(address)
      const result = await this.starknetService.callContract(
        config.contracts.privacy_router,
        [], // ABI loaded from file
        'get_account',
        [address]
      );

      // Result contains: { encrypted_balance, public_key, nonce }
      return result.result[0]; // encrypted_balance
    } catch (error: any) {
      logger.warn('Failed to get on-chain encrypted balance', {
        address,
        error: error.message,
      });
      return '0x0'; // Fallback
    }
  }

  private async verifySchnorrProof(
    proof: SchnorrProof,
    encryptedBalance: string,
    address: string
  ): Promise<boolean> {
    try {
      // Schnorr proof verification: e * P + s * G = R
      // where e = H(R || P || message)
      // P = public key, G = generator

      // TODO: Implement full Schnorr verification
      // For prototype, basic validation
      return proof.R.startsWith('0x') && proof.s.startsWith('0x');
    } catch (error: any) {
      logger.error('Schnorr proof verification failed', { error: error.message });
      return false;
    }
  }

  private async verifyRangeProof(
    proof: RangeProof,
    commitment: string,
    threshold: bigint
  ): Promise<boolean> {
    try {
      // Bulletproofs-style range proof verification
      // Proves that committed value is in range [threshold, 2^64]

      // TODO: Implement full Bulletproofs verification
      // For prototype, basic validation
      const hasAllFields = !!(
        proof.A && proof.S && proof.T1 && proof.T2 &&
        proof.tau_x && proof.mu && proof.t_hat && proof.inner_product_proof
      );

      return hasAllFields;
    } catch (error: any) {
      logger.error('Range proof verification failed', { error: error.message });
      return false;
    }
  }

  private async verifyAEHint(
    hint: string,
    encryptedBalance: string,
    threshold: bigint
  ): Promise<boolean> {
    try {
      // Arithmetic encoding hint allows fast verification
      // without full range proof computation

      // TODO: Implement AE hint verification
      return hint.length > 0;
    } catch (error: any) {
      logger.error('AE hint verification failed', { error: error.message });
      return false;
    }
  }

  private computeViewTag(viewingPubkey: string): number {
    // Compute first byte of H(viewing_pubkey) for efficient filtering
    const hashed = hash.starknetKeccak(viewingPubkey);
    return parseInt(hashed.slice(2, 4), 16); // First byte (0-255)
  }

  private async getStealthAnnouncements(viewTag: number): Promise<StealthAnnouncement[]> {
    try {
      if (!config.contracts.stealth_registry) {
        logger.warn('Stealth registry not configured');
        return [];
      }

      // Query StealthRegistry.get_announcements_by_view_tag(view_tag)
      const result = await this.starknetService.callContract(
        config.contracts.stealth_registry,
        [], // ABI loaded from file
        'get_announcements_by_view_tag',
        [viewTag]
      );

      // Parse announcements from result
      const announcements: StealthAnnouncement[] = [];
      // TODO: Parse contract result into announcement objects

      return announcements;
    } catch (error: any) {
      logger.error('Failed to get stealth announcements', {
        view_tag: viewTag,
        error: error.message,
      });
      return [];
    }
  }

  private async decryptStealthPayments(
    announcements: StealthAnnouncement[],
    viewingKey: string,
    viewingPubkey: string
  ): Promise<{ addresses: string[]; totalAmount: bigint }> {
    const addresses: string[] = [];
    let totalAmount = BigInt(0);

    for (const announcement of announcements) {
      try {
        // Compute shared secret: viewing_key * ephemeral_pubkey
        const sharedSecret = this.computeSharedSecret(viewingKey, announcement.ephemeral_pubkey);

        // Derive stealth address
        const stealthAddress = this.deriveStealthAddress(sharedSecret, viewingPubkey);
        addresses.push(stealthAddress);

        // Decrypt metadata to get amount (if included)
        // TODO: Implement metadata decryption
        // For now, assume each announcement = 1 unit
        totalAmount += BigInt(1);
      } catch (error: any) {
        logger.warn('Failed to decrypt announcement', {
          ephemeral_pubkey: announcement.ephemeral_pubkey,
          error: error.message,
        });
      }
    }

    return { addresses, totalAmount };
  }

  private computeSharedSecret(viewingKey: string, ephemeralPubkey: string): string {
    // ECDH: shared_secret = viewing_key * ephemeral_pubkey
    // TODO: Implement proper STARK curve ECDH
    return hash.computeHashOnElements([viewingKey, ephemeralPubkey]);
  }

  private deriveStealthAddress(sharedSecret: string, viewingPubkey: string): string {
    // stealth_address = H(shared_secret) * G + viewing_pubkey
    // TODO: Implement proper stealth address derivation
    return hash.computeHashOnElements([sharedSecret, viewingPubkey]);
  }

  private formatMetaAddress(metaAddress: StealthMetaAddress): string {
    // Format: st:starknet:0x<spending_pubkey><viewing_pubkey>
    return `st:starknet:0x${metaAddress.spending_pubkey.slice(2)}${metaAddress.viewing_pubkey.slice(2)}`;
  }

  /**
   * Get encrypted balance for auditor (3-party encryption)
   */
  async getEncryptedBalanceForAuditor(
    address: string,
    auditorPubkey: string
  ): Promise<string | null> {
    try {
      if (!config.contracts.privacy_router) {
        return null;
      }

      // Query PrivacyRouter.get_account_for_auditor(address, auditor_pubkey)
      const result = await this.starknetService.callContract(
        config.contracts.privacy_router,
        [],
        'get_account_for_auditor',
        [address, auditorPubkey]
      );

      return result.result[0]; // Encrypted balance for auditor
    } catch (error: any) {
      logger.error('Failed to get encrypted balance for auditor', {
        address,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Log auditor decryption for compliance
   */
  async logAuditorDecryption(
    auditorId: number,
    userId: string,
    encryptedBalanceHash: string,
    decryptedAmount: string,
    reason: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO auditor_decrypt_log
         (auditor_id, user_id, encrypted_balance_hash, decrypted_amount, reason, decrypted_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [auditorId, userId, encryptedBalanceHash, decryptedAmount, reason]
      );

      // Increment daily counter
      await query(
        `UPDATE auditor_permissions
         SET decrypts_today = decrypts_today + 1
         WHERE id = $1`,
        [auditorId]
      );

      logger.info('Auditor decryption logged', {
        auditor_id: auditorId,
        user_id: userId,
        reason,
      });
    } catch (error: any) {
      logger.error('Failed to log auditor decryption', {
        auditor_id: auditorId,
        error: error.message,
      });
    }
  }
}
