/**
 * Starknet Integration for Webapp
 *
 * Provides RPC integration for:
 * - Signature verification
 * - Token balance checking
 * - Rule evaluation
 */

import { RpcProvider, hash, validateAndParseAddress } from 'starknet';

// ERC20 ABI (minimal - just balanceOf)
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'felt' }],
    outputs: [{ name: 'balance', type: 'Uint256' }],
    stateMutability: 'view',
  },
];

// Initialize RPC provider
const provider = new RpcProvider({
  nodeUrl: process.env.STARKNET_RPC_URL || 'https://starknet-mainnet.public.blastapi.io',
});

/**
 * Verify Starknet signature
 */
export async function verifyStarknetSignature(
  accountAddress: string,
  messageHash: string,
  signature: string[]
): Promise<boolean> {
  try {
    const validAddress = validateAndParseAddress(accountAddress);

    // Validate signature format
    if (!Array.isArray(signature) || signature.length !== 2) {
      console.warn('Invalid signature format', { signature });
      return false;
    }

    // For Starknet account abstraction, we'd call isValidSignature
    // For now, we'll do basic validation
    // TODO: Implement isValidSignature call to account contract

    // Basic validation: check signature components exist
    const rValid = Boolean(signature[0] && signature[0].length > 0);
    const sValid = Boolean(signature[1] && signature[1].length > 0);

    return rValid && sValid;
  } catch (error) {
    console.error('Signature verification failed', error);
    return false;
  }
}

/**
 * Get token balance from Starknet
 */
export async function getTokenBalance(
  walletAddress: string,
  tokenAddress: string
): Promise<bigint> {
  try {
    const validWalletAddress = validateAndParseAddress(walletAddress);
    const validTokenAddress = validateAndParseAddress(tokenAddress);

    // Call balanceOf directly using provider
    const result = await provider.callContract({
      contractAddress: validTokenAddress,
      entrypoint: 'balanceOf',
      calldata: [validWalletAddress],
    });

    // Result is a Uint256 (low, high)
    const balance = parseU256(result);

    console.log('Token balance retrieved', {
      wallet: walletAddress,
      token: tokenAddress,
      balance: balance.toString(),
    });

    return balance;
  } catch (error) {
    console.error('Failed to get token balance', error);
    return BigInt(0);
  }
}

/**
 * Evaluate token_balance rule
 */
export async function evaluateTokenBalanceRule(
  walletAddress: string,
  requirements: any
): Promise<{ passes: boolean; balance: string; reason: string }> {
  try {
    const { min_balance, token_address } = requirements;

    if (!token_address) {
      return {
        passes: false,
        balance: '0',
        reason: 'No token address specified',
      };
    }

    const balance = await getTokenBalance(walletAddress, token_address);
    const minBalance = BigInt(min_balance);
    const passes = balance >= minBalance;

    return {
      passes,
      balance: balance.toString(),
      reason: passes
        ? 'Balance requirement met'
        : `Insufficient balance: ${balance.toString()} < ${minBalance.toString()}`,
    };
  } catch (error: any) {
    return {
      passes: false,
      balance: '0',
      reason: `Evaluation failed: ${error.message}`,
    };
  }
}

/**
 * Evaluate staked_amount rule (placeholder - requires staking contract)
 */
export async function evaluateStakedAmountRule(
  walletAddress: string,
  requirements: any
): Promise<{ passes: boolean; stake: string; reason: string }> {
  // TODO: Implement staking contract integration
  return {
    passes: false,
    stake: '0',
    reason: 'Staking evaluation not yet implemented',
  };
}

/**
 * Parse u256 from Starknet result (low, high format)
 */
function parseU256(result: any): bigint {
  if (typeof result === 'bigint') {
    return result;
  }

  if (typeof result === 'object' && result !== null) {
    // Handle {low: bigint, high: bigint} format
    const low = BigInt(result.low || result[0] || 0);
    const high = BigInt(result.high || result[1] || 0);
    return (high << BigInt(128)) + low;
  }

  return BigInt(result || 0);
}

/**
 * Compute message hash for verification
 */
export function computeMessageHash(message: string): string {
  try {
    return hash.computeHashOnElements([message]);
  } catch (error) {
    console.error('Failed to compute message hash', error);
    return '';
  }
}

// ============================================================
// RULE GROUP CONDITION EVALUATION
// ============================================================

export interface ConditionEvaluationResult {
  passes: boolean;
  actual_value?: any;
  expected_value?: any;
  reason: string;
  cached_data?: any;
}

/**
 * Evaluate a single condition from a rule group
 */
export async function evaluateCondition(
  walletAddress: string,
  conditionType: string,
  conditionData: any,
  userId?: string
): Promise<ConditionEvaluationResult> {
  try {
    switch (conditionType) {
      case 'token_balance':
        return await evaluateTokenBalanceCondition(walletAddress, conditionData);

      case 'staked_amount':
        return await evaluateStakedAmountCondition(walletAddress, conditionData);

      case 'nft_holding':
        return await evaluateNFTHoldingCondition(walletAddress, conditionData);

      case 'reputation':
        return await evaluateReputationCondition(userId, conditionData);

      case 'worker':
        return await evaluateWorkerCondition(userId, conditionData);

      case 'validator':
        return await evaluateValidatorCondition(userId, conditionData);

      default:
        return {
          passes: false,
          reason: `Unknown condition type: ${conditionType}`,
        };
    }
  } catch (error: any) {
    console.error(`Condition evaluation failed for ${conditionType}:`, error);
    return {
      passes: false,
      reason: `Evaluation error: ${error.message}`,
    };
  }
}

/**
 * Evaluate token_balance condition
 */
async function evaluateTokenBalanceCondition(
  walletAddress: string,
  data: any
): Promise<ConditionEvaluationResult> {
  const { min_balance, token_address, include_staked } = data;

  if (!token_address) {
    return {
      passes: false,
      reason: 'No token address specified',
    };
  }

  if (!min_balance) {
    return {
      passes: false,
      reason: 'No minimum balance specified',
    };
  }

  try {
    const balance = await getTokenBalance(walletAddress, token_address);
    const minBalance = BigInt(min_balance);

    // TODO: If include_staked is true, add staked balance
    // For now, just use wallet balance

    const passes = balance >= minBalance;

    return {
      passes,
      actual_value: balance.toString(),
      expected_value: minBalance.toString(),
      reason: passes
        ? `Balance requirement met: ${balance.toString()} >= ${minBalance.toString()}`
        : `Insufficient balance: ${balance.toString()} < ${minBalance.toString()}`,
      cached_data: { balance: balance.toString() },
    };
  } catch (error: any) {
    return {
      passes: false,
      reason: `Failed to check balance: ${error.message}`,
    };
  }
}

/**
 * Evaluate staked_amount condition
 */
async function evaluateStakedAmountCondition(
  walletAddress: string,
  data: any
): Promise<ConditionEvaluationResult> {
  const { min_stake, min_duration_days, staking_contract_address, guild_id } = data;

  if (!min_stake) {
    return {
      passes: false,
      reason: 'No minimum stake amount specified',
    };
  }

  try {
    let contractAddress = staking_contract_address;

    // If no contract address provided, try to get from guild config
    if (!contractAddress && guild_id) {
      const { query } = await import('./db');
      const result = await query(
        `SELECT contract_address FROM staking_contracts
         WHERE guild_id = $1 AND is_active = TRUE
         LIMIT 1`,
        [guild_id]
      );

      if (result.rows.length > 0) {
        contractAddress = result.rows[0].contract_address;
      }
    }

    if (!contractAddress) {
      return {
        passes: false,
        actual_value: '0',
        expected_value: min_stake,
        reason: 'No staking contract configured',
        cached_data: { stake: '0', duration_days: 0 },
      };
    }

    // Call staking contract to get user's stake
    // Assuming staking contract has a getStake(address) or balanceOf(address) function
    const result = await provider.callContract({
      contractAddress: validateAndParseAddress(contractAddress),
      entrypoint: 'getStake', // or 'balanceOf' depending on contract
      calldata: [validateAndParseAddress(walletAddress)],
    });

    // Parse stake amount (assuming Uint256 format)
    const stakeAmount = parseU256(result);
    const minStake = BigInt(min_stake);

    // TODO: Check stake duration if min_duration_days is specified
    // This would require additional contract call like getStakeDuration(address)
    const passes = stakeAmount >= minStake;

    return {
      passes,
      actual_value: stakeAmount.toString(),
      expected_value: minStake.toString(),
      reason: passes
        ? `Stake requirement met: ${stakeAmount.toString()} >= ${minStake.toString()}`
        : `Insufficient stake: ${stakeAmount.toString()} < ${minStake.toString()}`,
      cached_data: {
        stake: stakeAmount.toString(),
        duration_days: 0, // TODO: Implement duration check
        contract_address: contractAddress,
      },
    };
  } catch (error: any) {
    console.error('Staking evaluation error:', error);
    return {
      passes: false,
      actual_value: '0',
      expected_value: min_stake,
      reason: `Failed to check staked amount: ${error.message}`,
      cached_data: { stake: '0', duration_days: 0 },
    };
  }
}

/**
 * Evaluate nft_holding condition
 */
async function evaluateNFTHoldingCondition(
  walletAddress: string,
  data: any
): Promise<ConditionEvaluationResult> {
  const { contract_address, min_count = 1, token_id } = data;

  if (!contract_address) {
    return {
      passes: false,
      reason: 'No NFT contract address specified',
    };
  }

  try {
    // For ERC721: call balanceOf
    // For ERC1155: call balanceOf with token_id
    const result = await provider.callContract({
      contractAddress: validateAndParseAddress(contract_address),
      entrypoint: 'balanceOf',
      calldata: token_id
        ? [validateAndParseAddress(walletAddress), token_id]
        : [validateAndParseAddress(walletAddress)],
    });

    const nftCount = parseU256(result);
    const minCount = BigInt(min_count);
    const passes = nftCount >= minCount;

    return {
      passes,
      actual_value: nftCount.toString(),
      expected_value: minCount.toString(),
      reason: passes
        ? `NFT requirement met: owns ${nftCount.toString()} NFT(s)`
        : `Insufficient NFTs: ${nftCount.toString()} < ${minCount.toString()}`,
      cached_data: { nft_count: nftCount.toString() },
    };
  } catch (error: any) {
    return {
      passes: false,
      reason: `Failed to check NFT balance: ${error.message}`,
    };
  }
}

/**
 * Evaluate reputation condition
 */
async function evaluateReputationCondition(
  userId: string | undefined,
  data: any
): Promise<ConditionEvaluationResult> {
  const { min_reputation, guild_id } = data;

  if (!userId) {
    return {
      passes: false,
      reason: 'User ID required for reputation check',
    };
  }

  if (!min_reputation) {
    return {
      passes: false,
      reason: 'No minimum reputation specified',
    };
  }

  try {
    // Import query function for database access
    const { query } = await import('./db');

    // Query user reputation from database
    const result = await query(
      `SELECT reputation_points, level, total_earned, last_updated
       FROM user_reputation
       WHERE user_id = $1 ${guild_id ? 'AND guild_id = $2' : ''}
       LIMIT 1`,
      guild_id ? [userId, guild_id] : [userId]
    );

    const reputation = result.rows[0]?.reputation_points || 0;
    const minReputation = parseInt(min_reputation);
    const passes = reputation >= minReputation;

    return {
      passes,
      actual_value: reputation,
      expected_value: minReputation,
      reason: passes
        ? `Reputation requirement met: ${reputation} >= ${minReputation}`
        : `Insufficient reputation: ${reputation} < ${minReputation}`,
      cached_data: {
        reputation,
        level: result.rows[0]?.level || 1,
        total_earned: result.rows[0]?.total_earned || 0,
      },
    };
  } catch (error: any) {
    console.error('Reputation evaluation error:', error);
    return {
      passes: false,
      actual_value: 0,
      expected_value: min_reputation,
      reason: `Failed to check reputation: ${error.message}`,
      cached_data: { reputation: 0 },
    };
  }
}

/**
 * Evaluate worker condition
 */
async function evaluateWorkerCondition(
  userId: string | undefined,
  data: any
): Promise<ConditionEvaluationResult> {
  const { is_active, min_completed_jobs, guild_id, worker_type, min_skill_level } = data;

  if (!userId) {
    return {
      passes: false,
      reason: 'User ID required for worker status check',
    };
  }

  try {
    // Import query function for database access
    const { query } = await import('./db');

    // Query worker profile from database
    const result = await query(
      `SELECT is_active, total_jobs_completed, worker_type, skill_level, average_rating, last_active
       FROM worker_profiles
       WHERE user_id = $1 ${guild_id ? 'AND guild_id = $2' : ''}
       LIMIT 1`,
      guild_id ? [userId, guild_id] : [userId]
    );

    if (result.rows.length === 0) {
      return {
        passes: false,
        actual_value: { is_active: false, completed_jobs: 0 },
        expected_value: { is_active, min_completed_jobs },
        reason: 'User is not registered as a worker',
        cached_data: { is_active: false, completed_jobs: 0 },
      };
    }

    const worker = result.rows[0];
    let passes = true;
    const reasons = [];

    // Check if worker is active (if required)
    if (is_active && !worker.is_active) {
      passes = false;
      reasons.push('Worker is not active');
    }

    // Check minimum completed jobs
    if (min_completed_jobs && worker.total_jobs_completed < min_completed_jobs) {
      passes = false;
      reasons.push(
        `Insufficient completed jobs: ${worker.total_jobs_completed} < ${min_completed_jobs}`
      );
    }

    // Check worker type (if specified)
    if (worker_type && worker.worker_type !== worker_type) {
      passes = false;
      reasons.push(`Worker type mismatch: ${worker.worker_type} != ${worker_type}`);
    }

    // Check skill level (if specified)
    if (min_skill_level && worker.skill_level < min_skill_level) {
      passes = false;
      reasons.push(`Insufficient skill level: ${worker.skill_level} < ${min_skill_level}`);
    }

    return {
      passes,
      actual_value: {
        is_active: worker.is_active,
        completed_jobs: worker.total_jobs_completed,
        worker_type: worker.worker_type,
        skill_level: worker.skill_level,
        average_rating: parseFloat(worker.average_rating),
      },
      expected_value: { is_active, min_completed_jobs, worker_type, min_skill_level },
      reason: passes
        ? 'Worker requirements met'
        : reasons.join('; '),
      cached_data: {
        is_active: worker.is_active,
        completed_jobs: worker.total_jobs_completed,
        skill_level: worker.skill_level,
        last_active: worker.last_active,
      },
    };
  } catch (error: any) {
    console.error('Worker evaluation error:', error);
    return {
      passes: false,
      actual_value: { is_active: false, completed_jobs: 0 },
      expected_value: { is_active, min_completed_jobs },
      reason: `Failed to check worker status: ${error.message}`,
      cached_data: { is_active: false, completed_jobs: 0 },
    };
  }
}

/**
 * Evaluate validator condition
 */
async function evaluateValidatorCondition(
  userId: string | undefined,
  data: any
): Promise<ConditionEvaluationResult> {
  const { is_active, min_uptime, guild_id, validator_type, min_validations, min_stake } = data;

  if (!userId) {
    return {
      passes: false,
      reason: 'User ID required for validator status check',
    };
  }

  try {
    // Import query function for database access
    const { query } = await import('./db');

    // Query validator profile from database
    const result = await query(
      `SELECT is_active, uptime_percentage, total_validations, successful_validations,
              validator_type, stake_amount, last_validation, last_heartbeat
       FROM validator_profiles
       WHERE user_id = $1 ${guild_id ? 'AND guild_id = $2' : ''}
       LIMIT 1`,
      guild_id ? [userId, guild_id] : [userId]
    );

    if (result.rows.length === 0) {
      return {
        passes: false,
        actual_value: { is_active: false, uptime: 0 },
        expected_value: { is_active, min_uptime },
        reason: 'User is not registered as a validator',
        cached_data: { is_active: false, uptime: 0 },
      };
    }

    const validator = result.rows[0];
    let passes = true;
    const reasons = [];

    // Check if validator is active (if required)
    if (is_active && !validator.is_active) {
      passes = false;
      reasons.push('Validator is not active');
    }

    // Check minimum uptime
    if (min_uptime && parseFloat(validator.uptime_percentage) < min_uptime) {
      passes = false;
      reasons.push(
        `Insufficient uptime: ${validator.uptime_percentage}% < ${min_uptime}%`
      );
    }

    // Check validator type (if specified)
    if (validator_type && validator.validator_type !== validator_type) {
      passes = false;
      reasons.push(`Validator type mismatch: ${validator.validator_type} != ${validator_type}`);
    }

    // Check minimum validations (if specified)
    if (min_validations && validator.successful_validations < min_validations) {
      passes = false;
      reasons.push(
        `Insufficient validations: ${validator.successful_validations} < ${min_validations}`
      );
    }

    // Check minimum stake (if specified)
    if (min_stake && BigInt(validator.stake_amount) < BigInt(min_stake)) {
      passes = false;
      reasons.push(
        `Insufficient stake: ${validator.stake_amount} < ${min_stake}`
      );
    }

    return {
      passes,
      actual_value: {
        is_active: validator.is_active,
        uptime: parseFloat(validator.uptime_percentage),
        total_validations: validator.total_validations,
        successful_validations: validator.successful_validations,
        validator_type: validator.validator_type,
        stake_amount: validator.stake_amount,
      },
      expected_value: { is_active, min_uptime, validator_type, min_validations, min_stake },
      reason: passes
        ? 'Validator requirements met'
        : reasons.join('; '),
      cached_data: {
        is_active: validator.is_active,
        uptime: parseFloat(validator.uptime_percentage),
        validations: validator.successful_validations,
        last_validation: validator.last_validation,
        last_heartbeat: validator.last_heartbeat,
      },
    };
  } catch (error: any) {
    console.error('Validator evaluation error:', error);
    return {
      passes: false,
      actual_value: { is_active: false, uptime: 0 },
      expected_value: { is_active, min_uptime },
      reason: `Failed to check validator status: ${error.message}`,
      cached_data: { is_active: false, uptime: 0 },
    };
  }
}
