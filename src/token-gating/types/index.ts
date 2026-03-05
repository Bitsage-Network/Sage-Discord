/**
 * BitSage Discord Token-Gating - Type Definitions
 *
 * Core TypeScript types for token-gating system
 */

// ============================================================
// Verification Types
// ============================================================

export type VerificationMethod = 'signature' | 'stealth' | 'zk_proof' | 'legacy';

export interface WalletVerification {
  id: number;
  user_id: string;
  wallet_address: string;
  verification_method: VerificationMethod;

  // Standard signature verification
  signature?: string;
  message?: string;
  signed_at?: Date;

  // Stealth address verification
  stealth_meta_address?: string;
  viewing_key_hash?: string;

  // ZK proof verification
  proof_data?: ZKBalanceProof;
  proof_verified?: boolean;

  // Verification status
  verified: boolean;
  verified_at?: Date;
  expires_at?: Date;

  created_at: Date;
  updated_at: Date;
}

export interface VerificationSession {
  id: string; // UUID
  user_id: string;
  state: 'pending' | 'signed' | 'verified' | 'expired' | 'failed';
  verification_method: VerificationMethod;

  challenge_message: string;
  challenge_nonce: string;
  session_token: string;
  callback_url?: string;

  wallet_address?: string;
  signature?: string;
  stealth_meta_address?: string;
  zk_proof_data?: ZKBalanceProof;

  expires_at: Date;
  created_at: Date;
  completed_at?: Date;
}

// ============================================================
// Token-Gating Rule Types
// ============================================================

export type RuleType = 'token_balance' | 'staked_amount' | 'reputation' | 'validator' | 'worker';

export interface TokenGatingRule {
  id: number;
  guild_id: string;
  rule_name: string;
  description?: string;
  rule_type: RuleType;
  requirements: RuleRequirements;

  // Privacy settings
  privacy_enabled: boolean;
  require_zk_proof: boolean;
  allow_stealth_address: boolean;

  enabled: boolean;
  priority: number;

  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export type RuleRequirements =
  | TokenBalanceRequirements
  | StakedAmountRequirements
  | ReputationRequirements
  | ValidatorRequirements
  | WorkerRequirements;

export interface TokenBalanceRequirements {
  min_balance: string; // BigInt as string
  include_staked?: boolean;
  token_address?: string; // Defaults to SAGE token
}

export interface StakedAmountRequirements {
  min_amount: string; // BigInt as string
  staking_contract?: string;
}

export interface ReputationRequirements {
  min_score: number; // 0-1000
  min_level?: number; // 1-5
  min_jobs_completed?: number;
}

export interface ValidatorRequirements {
  must_be_active: boolean;
  min_epoch?: number;
}

export interface WorkerRequirements {
  must_be_active: boolean;
  min_tier?: number; // GPU tier
}

export interface RoleMapping {
  id: number;
  guild_id: string;
  rule_id: number;
  role_id: string;
  role_name: string;

  auto_assign: boolean;
  auto_remove: boolean;
  recheck_interval: number; // seconds
  last_recheck?: Date;

  created_at: Date;
}

export interface RuleResult {
  rule_id: number;
  rule_name: string;
  passes: boolean;
  role_id?: string;
  role_name?: string;
  cached_data?: {
    balance?: string;
    stake?: string;
    reputation?: number;
  };
}

// ============================================================
// Privacy Types (Obelysk Integration)
// ============================================================

export interface ZKBalanceProof {
  starknet_address: string;
  discord_id: string;
  threshold: string; // Minimum balance to prove (as string)
  timestamp: number; // Unix timestamp
  nullifier: string; // Unique nullifier to prevent replay

  // Proof components (from Obelysk ElGamal)
  encrypted_balance: EncryptedBalance;
  schnorr_proof: SchnorrProof;
  range_proof: RangeProof;

  // Optional AE hint for fast verification
  ae_hint?: AEHint;

  // User signature over proof data
  signature: string;
}

export interface EncryptedBalance {
  c1: string; // ElGamal ciphertext part 1 (point on curve)
  c2: string; // ElGamal ciphertext part 2 (point on curve)
  public_key: string; // Encryption public key
}

export interface SchnorrProof {
  commitment: string; // Commitment (R point)
  challenge: string; // Challenge (c scalar)
  response: string; // Response (s scalar)
}

export interface RangeProof {
  proof_type: 'bulletproof' | 'simple_range';
  proof_data: string; // Serialized proof
  commitment: string; // Pedersen commitment to balance
}

export interface AEHint {
  hint_point: string; // Point on curve for fast verification
  hint_scalar: string;
}

export interface StealthMetaAddress {
  spending_pubkey: string;
  viewing_pubkey: string;
  meta_address: string; // Concatenation of both keys
}

export interface StealthAnnouncement {
  ephemeral_pubkey: string;
  stealth_address: string;
  view_tag: number; // 1-byte tag for fast scanning
  encrypted_amount?: string; // Optional encrypted amount
  block_number: number;
  tx_hash: string;
}

export interface StealthVerificationResult {
  eligible: boolean;
  announcement_count: number;
  total_amount?: string; // If amounts are public
  stealth_addresses: string[];
}

// ============================================================
// Starknet Contract Types
// ============================================================

export interface ContractCallResult {
  result: string[];
  block_hash?: string;
  block_number?: number;
}

export interface ValidatorInfo {
  starknet_address: string;
  is_active: boolean;
  stake: string;
  epoch: number;
  reputation_score: number;
}

export interface WorkerInfo {
  starknet_address: string;
  is_active: boolean;
  gpu_tier: number;
  jobs_completed: number;
  reputation_score: number;
}

export interface ReputationInfo {
  score: number; // 0-1000
  level: number; // 1-5
  jobs_completed: number;
  total_earnings: string;
  last_updated: Date;
}

// ============================================================
// Cache Types
// ============================================================

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expires_at: number;
}

export interface BalanceCache {
  starknet_address: string;
  token_address: string;
  balance: string;
  checked_at: Date;
  expires_at: Date;
}

export interface UserRuleCache {
  user_id: string;
  rule_id: number;
  passes_rule: boolean;
  cached_balance?: string;
  cached_stake?: string;
  cached_reputation?: number;
  checked_at: Date;
  expires_at: Date;
}

// ============================================================
// Auditor Types
// ============================================================

export interface AuditorPermission {
  id: number;
  guild_id: string;
  auditor_name: string;
  auditor_contact?: string;
  auditor_pubkey: string;

  can_decrypt_balances: boolean;
  can_view_addresses: boolean;

  max_decrypt_per_day: number;
  decrypts_today: number;
  last_decrypt_reset: Date;

  enabled: boolean;
  granted_by: string;
  granted_at: Date;
  expires_at?: Date;

  created_at: Date;
}

export interface DecryptionLog {
  id: number;
  auditor_id: number;
  user_id?: string;
  encrypted_balance_hash: string;
  decrypted_amount: string;
  reason?: string;
  decrypted_at: Date;
}

// ============================================================
// Service Configuration Types
// ============================================================

export interface TokenGatingConfig {
  // Starknet configuration
  rpc_url: string;
  chain_id: string;

  // Contract addresses (Sepolia Testnet - Deployed Dec 31, 2025)
  contracts: {
    // Core
    sage_token: string;
    staking: string;
    reputation_manager: string;

    // Privacy Layer (Obelysk)
    privacy_router: string;
    privacy_pools: string;
    mixing_router: string;
    confidential_swap: string;
    worker_privacy: string;

    // Registries
    validator_registry: string;
    prover_registry: string;
    address_registry: string;

    // Proof Verification
    proof_verifier: string;
    stwo_verifier: string;
    batch_verifier: string;

    // Job Management
    job_manager: string;
    cdc_pool: string;
  };

  // Web app configuration
  wallet_signing_url: string;

  // Feature flags
  features: {
    enable_zk_proofs: boolean;
    enable_stealth_addresses: boolean;
    enable_auditor_support: boolean;
  };

  // Cache TTLs (seconds)
  cache: {
    balance_ttl: number;
    reputation_ttl: number;
    stake_ttl: number;
    rule_cache_ttl: number;
  };

  // Role sync
  role_sync: {
    interval: number; // seconds
    enabled: boolean;
  };

  // Session configuration
  session: {
    expiry_minutes: number;
    max_active_per_user: number;
  };

  // Security
  security: {
    max_verification_attempts: number;
    verification_cooldown_minutes: number;
  };
}

// ============================================================
// API Response Types
// ============================================================

export interface VerificationResponse {
  success: boolean;
  message: string;
  verification?: WalletVerification;
  roles_assigned?: string[];
  errors?: string[];
}

export interface RuleEvaluationResponse {
  user_id: string;
  wallet_address: string;
  rules_passed: RuleResult[];
  rules_failed: RuleResult[];
  roles_to_assign: string[];
  roles_to_remove: string[];
}

// ============================================================
// Error Types
// ============================================================

export class TokenGatingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'TokenGatingError';
  }
}

export class VerificationError extends TokenGatingError {
  constructor(message: string, details?: any) {
    super(message, 'VERIFICATION_ERROR', details);
    this.name = 'VerificationError';
  }
}

export class ProofVerificationError extends TokenGatingError {
  constructor(message: string, details?: any) {
    super(message, 'PROOF_VERIFICATION_ERROR', details);
    this.name = 'ProofVerificationError';
  }
}

export class StarknetError extends TokenGatingError {
  constructor(message: string, details?: any) {
    super(message, 'STARKNET_ERROR', details);
    this.name = 'StarknetError';
  }
}
