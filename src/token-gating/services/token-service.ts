/**
 * BitSage Discord Token-Gating - Token Service
 *
 * Handles SAGE token balance queries with 3-tier caching.
 * Supports:
 * - Standard wallet balance
 * - Staked amount
 * - Total balance (wallet + staked)
 */

import { StarknetService } from './starknet-service';
import { CacheService } from './cache-service';
import { logger } from '../../utils/logger';
import { TokenGatingConfig, StarknetError } from '../types';
import ERC20_ABI from '../abis/erc20.json';

export class TokenService {
  private starknet: StarknetService;
  private cache: CacheService;
  private config: TokenGatingConfig;

  constructor(
    starknet: StarknetService,
    cache: CacheService,
    config: TokenGatingConfig
  ) {
    this.starknet = starknet;
    this.cache = cache;
    this.config = config;
  }

  /**
   * Get SAGE token balance (cached)
   */
  async getBalance(walletAddress: string): Promise<bigint> {
    const tokenAddress = this.config.contracts.sage_token;

    // Check cache first (3-tier lookup)
    const cached = await this.cache.getBalance(walletAddress, tokenAddress);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - query blockchain
    const balance = await this.queryBalanceFromChain(walletAddress, tokenAddress);

    // Update cache (TTL from config)
    await this.cache.setBalance(
      walletAddress,
      tokenAddress,
      balance,
      this.config.cache.balance_ttl
    );

    return balance;
  }

  /**
   * Get staked SAGE amount (cached)
   */
  async getStakedAmount(walletAddress: string): Promise<bigint> {
    const stakingContract = this.config.contracts.staking;
    const cacheKey = `stake:${walletAddress}`;

    // Check memory cache first
    const memCached = await this.cache.get<string>(cacheKey);
    if (memCached !== null) {
      return BigInt(memCached);
    }

    // Cache miss - query staking contract
    try {
      const result = await this.starknet.callContract(
        stakingContract,
        [], // TODO: Add staking contract ABI
        'get_stake',
        [walletAddress]
      );

      const stakedAmount = this.parseU256(result.result);

      // Update cache
      await this.cache.set(
        cacheKey,
        stakedAmount.toString(),
        this.config.cache.stake_ttl
      );

      logger.debug('Staked amount retrieved', {
        wallet: walletAddress,
        staked: stakedAmount.toString(),
      });

      return stakedAmount;
    } catch (error: any) {
      logger.error('Failed to get staked amount', {
        wallet: walletAddress,
        error: error.message,
      });

      // Return 0 on error (stake query is optional)
      return 0n;
    }
  }

  /**
   * Get total balance (wallet + staked)
   */
  async getTotalBalance(
    walletAddress: string,
    includeStaked: boolean = true
  ): Promise<bigint> {
    const walletBalance = await this.getBalance(walletAddress);

    if (!includeStaked) {
      return walletBalance;
    }

    const stakedAmount = await this.getStakedAmount(walletAddress);
    const total = walletBalance + stakedAmount;

    logger.debug('Total balance calculated', {
      wallet: walletAddress,
      wallet_balance: walletBalance.toString(),
      staked: stakedAmount.toString(),
      total: total.toString(),
    });

    return total;
  }

  /**
   * Get token metadata (name, symbol, decimals)
   */
  async getTokenMetadata(): Promise<{
    name: string;
    symbol: string;
    decimals: number;
  }> {
    const tokenAddress = this.config.contracts.sage_token;
    const cacheKey = `token:metadata:${tokenAddress}`;

    // Check cache (metadata rarely changes)
    const cached = await this.cache.get<any>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      // Query all metadata in parallel
      const [nameResult, symbolResult, decimalsResult] = await Promise.all([
        this.starknet.callContract(tokenAddress, ERC20_ABI, 'name'),
        this.starknet.callContract(tokenAddress, ERC20_ABI, 'symbol'),
        this.starknet.callContract(tokenAddress, ERC20_ABI, 'decimals'),
      ]);

      const metadata = {
        name: this.starknet.parseShortString(nameResult.result[0]),
        symbol: this.starknet.parseShortString(symbolResult.result[0]),
        decimals: parseInt(decimalsResult.result[0]),
      };

      // Cache for 24 hours (metadata rarely changes)
      await this.cache.set(cacheKey, metadata, 86400);

      return metadata;
    } catch (error: any) {
      logger.error('Failed to get token metadata', {
        token: tokenAddress,
        error: error.message,
      });

      // Return defaults on error
      return {
        name: 'SAGE',
        symbol: 'SAGE',
        decimals: 18,
      };
    }
  }

  /**
   * Get total supply of SAGE tokens
   */
  async getTotalSupply(): Promise<bigint> {
    const tokenAddress = this.config.contracts.sage_token;
    const cacheKey = `token:total_supply:${tokenAddress}`;

    // Check cache
    const cached = await this.cache.get<string>(cacheKey);
    if (cached !== null) {
      return BigInt(cached);
    }

    try {
      const result = await this.starknet.callContract(
        tokenAddress,
        ERC20_ABI,
        'totalSupply'
      );

      const totalSupply = this.parseU256(result.result);

      // Cache for 10 minutes
      await this.cache.set(cacheKey, totalSupply.toString(), 600);

      return totalSupply;
    } catch (error: any) {
      logger.error('Failed to get total supply', {
        token: tokenAddress,
        error: error.message,
      });

      throw new StarknetError(
        'Failed to get total supply',
        { token: tokenAddress, error: error.message }
      );
    }
  }

  /**
   * Format balance for display (with decimals)
   */
  formatBalance(balance: bigint, decimals: number = 18): string {
    const divisor = BigInt(10) ** BigInt(decimals);
    const integerPart = balance / divisor;
    const fractionalPart = balance % divisor;

    // Pad fractional part with leading zeros
    const fractionalStr = fractionalPart
      .toString()
      .padStart(decimals, '0')
      .replace(/0+$/, ''); // Remove trailing zeros

    if (fractionalStr === '') {
      return integerPart.toString();
    }

    return `${integerPart}.${fractionalStr}`;
  }

  /**
   * Parse balance from string (with decimals)
   */
  parseBalance(balanceStr: string, decimals: number = 18): bigint {
    const [integerPart, fractionalPart = '0'] = balanceStr.split('.');

    // Pad fractional part to decimals length
    const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);

    const integerValue = BigInt(integerPart) * (BigInt(10) ** BigInt(decimals));
    const fractionalValue = BigInt(paddedFractional);

    return integerValue + fractionalValue;
  }

  /**
   * Invalidate cache for a wallet address
   */
  async invalidateCache(walletAddress: string): Promise<void> {
    const tokenAddress = this.config.contracts.sage_token;

    await Promise.all([
      this.cache.invalidateBalance(walletAddress, tokenAddress),
      this.cache.delete(`stake:${walletAddress}`),
    ]);

    logger.info('Token cache invalidated', { wallet: walletAddress });
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * Query balance directly from blockchain (no cache)
   */
  private async queryBalanceFromChain(
    walletAddress: string,
    tokenAddress: string
  ): Promise<bigint> {
    try {
      const result = await this.starknet.callContract(
        tokenAddress,
        ERC20_ABI,
        'balanceOf',
        [walletAddress]
      );

      const balance = this.parseU256(result.result);

      logger.debug('Balance queried from chain', {
        wallet: walletAddress,
        token: tokenAddress,
        balance: balance.toString(),
      });

      return balance;
    } catch (error: any) {
      logger.error('Failed to query balance from chain', {
        wallet: walletAddress,
        token: tokenAddress,
        error: error.message,
      });

      throw new StarknetError(
        'Failed to query token balance',
        {
          wallet: walletAddress,
          token: tokenAddress,
          error: error.message,
        }
      );
    }
  }

  /**
   * Parse u256 from Starknet result (low, high format)
   */
  private parseU256(result: string[]): bigint {
    if (result.length < 2) {
      // Single value (backwards compatibility)
      return BigInt(result[0] || '0');
    }

    // u256 is returned as (low: u128, high: u128)
    const low = BigInt(result[0] || '0');
    const high = BigInt(result[1] || '0');

    // Combine: high * 2^128 + low
    return (high << 128n) + low;
  }
}
