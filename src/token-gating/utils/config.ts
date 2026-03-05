/**
 * BitSage Discord Token-Gating - Configuration Loader
 *
 * Loads and validates token-gating configuration from environment variables.
 * Extends the existing Discord bot configuration.
 */

import { logger } from '../../utils/logger';
import { TokenGatingConfig } from '../types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Get token-gating configuration from environment
 */
export function getTokenGatingConfig(): TokenGatingConfig {
  // Required configuration
  const requiredVars = [
    'STARKNET_RPC_URL',
    'TG_SAGE_TOKEN_ADDRESS',
  ];

  // Check required variables
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error(`Missing required token-gating environment variables: ${missingVars.join(', ')}`);
    logger.error('Please update your .env file with token-gating configuration');
    process.exit(1);
  }

  // Build configuration object
  const config: TokenGatingConfig = {
    // Starknet configuration
    rpc_url: process.env.STARKNET_RPC_URL!,
    chain_id: getChainId(process.env.STARKNET_NETWORK || 'sepolia'),

    // Contract addresses (Sepolia Testnet - Deployed Dec 31, 2025)
    contracts: {
      // Core
      sage_token: process.env.TG_SAGE_TOKEN_ADDRESS!,
      staking: process.env.TG_STAKING_CONTRACT_ADDRESS || '0x0',
      reputation_manager: process.env.TG_REPUTATION_MANAGER_ADDRESS || '0x0',

      // Privacy Layer (Obelysk)
      privacy_router: process.env.TG_PRIVACY_ROUTER_ADDRESS || '0x0',
      privacy_pools: process.env.TG_PRIVACY_POOLS_ADDRESS || '0x0',
      mixing_router: process.env.TG_MIXING_ROUTER_ADDRESS || '0x0',
      confidential_swap: process.env.TG_CONFIDENTIAL_SWAP_ADDRESS || '0x0',
      worker_privacy: process.env.TG_WORKER_PRIVACY_ADDRESS || '0x0',

      // Registries
      validator_registry: process.env.TG_VALIDATOR_REGISTRY_ADDRESS || '0x0',
      prover_registry: process.env.TG_PROVER_REGISTRY_ADDRESS || '0x0',
      address_registry: process.env.TG_ADDRESS_REGISTRY_ADDRESS || '0x0',

      // Proof Verification
      proof_verifier: process.env.TG_PROOF_VERIFIER_ADDRESS || '0x0',
      stwo_verifier: process.env.TG_STWO_VERIFIER_ADDRESS || '0x0',
      batch_verifier: process.env.TG_BATCH_VERIFIER_ADDRESS || '0x0',

      // Job Management
      job_manager: process.env.TG_JOB_MANAGER_ADDRESS || '0x0',
      cdc_pool: process.env.TG_CDC_POOL_ADDRESS || '0x0',
    },

    // Web app configuration
    wallet_signing_url: process.env.WALLET_SIGNING_PAGE_URL || 'http://localhost:3000',

    // Feature flags
    features: {
      enable_zk_proofs: process.env.TG_ENABLE_ZK_PROOFS === 'true',
      enable_stealth_addresses: process.env.TG_ENABLE_STEALTH_ADDRESSES === 'true',
      enable_auditor_support: process.env.TG_ENABLE_AUDITOR_SUPPORT === 'true',
    },

    // Cache TTLs (seconds)
    cache: {
      balance_ttl: parseInt(process.env.TG_CACHE_TTL_BALANCE || '300', 10),
      reputation_ttl: parseInt(process.env.TG_CACHE_TTL_REPUTATION || '600', 10),
      stake_ttl: parseInt(process.env.TG_CACHE_TTL_STAKE || '300', 10),
      rule_cache_ttl: parseInt(process.env.TG_CACHE_TTL_RULE || '3600', 10),
    },

    // Role sync
    role_sync: {
      interval: parseInt(process.env.TG_ROLE_SYNC_INTERVAL || '3600', 10),
      enabled: process.env.TG_ENABLE_AUTO_ROLE_SYNC !== 'false',
    },

    // Session configuration
    session: {
      expiry_minutes: parseInt(process.env.TG_SESSION_EXPIRY_MINUTES || '15', 10),
      max_active_per_user: parseInt(process.env.TG_MAX_ACTIVE_SESSIONS_PER_USER || '3', 10),
    },

    // Security
    security: {
      max_verification_attempts: parseInt(process.env.TG_MAX_VERIFICATION_ATTEMPTS || '5', 10),
      verification_cooldown_minutes: parseInt(process.env.TG_VERIFICATION_COOLDOWN_MINUTES || '10', 10),
    },
  };

  // Validate contract addresses
  validateContractAddresses(config.contracts);

  // Log configuration (without sensitive data)
  logger.info('Token-gating configuration loaded', {
    rpc_url: config.rpc_url,
    chain_id: config.chain_id,
    sage_token: config.contracts.sage_token,
    wallet_signing_url: config.wallet_signing_url,
    features: config.features,
    cache_ttls: config.cache,
    role_sync: config.role_sync,
  });

  return config;
}

/**
 * Get Starknet chain ID from network name
 */
function getChainId(network: string): string {
  const chainIds: Record<string, string> = {
    'mainnet': 'SN_MAIN',
    'sepolia': 'SN_SEPOLIA',
    'goerli': 'SN_GOERLI',
  };

  return chainIds[network.toLowerCase()] || 'SN_SEPOLIA';
}

/**
 * Validate contract addresses format
 */
function validateContractAddresses(contracts: TokenGatingConfig['contracts']): void {
  const addressPattern = /^0x[0-9a-fA-F]{1,64}$/;

  // Validate SAGE token address (required)
  if (!addressPattern.test(contracts.sage_token)) {
    logger.error('Invalid SAGE token contract address', {
      address: contracts.sage_token,
    });
    throw new Error('Invalid SAGE token contract address format');
  }

  // Warn about unset optional contracts
  const optionalContracts = [
    'staking',
    'reputation_manager',
    'privacy_router',
    'validator_registry',
    'worker_registry',
    'stealth_registry',
  ] as const;

  for (const contractName of optionalContracts) {
    const address = contracts[contractName];
    if (address === '0x0' || address === '0x' || !address) {
      logger.warn(`Optional contract not configured: ${contractName}`, {
        contract: contractName,
        note: 'Some token-gating features may not work',
      });
    } else if (!addressPattern.test(address)) {
      logger.error(`Invalid contract address for ${contractName}`, {
        address,
      });
      throw new Error(`Invalid contract address format: ${contractName}`);
    }
  }
}

/**
 * Export singleton instance
 */
export const tokenGatingConfig = getTokenGatingConfig();
