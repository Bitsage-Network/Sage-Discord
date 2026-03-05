/**
 * BitSage Discord Token-Gating - Cache Service
 *
 * Three-tier caching strategy to optimize RPC calls:
 * - Layer 1: In-memory (Map) - 5 minute TTL, <1ms access
 * - Layer 2: PostgreSQL - 1 hour TTL, ~10ms access
 * - Layer 3: RPC call - Fresh data, ~200ms access
 */

import { query } from '../../utils/database';
import { logger } from '../../utils/logger';
import { CacheEntry, BalanceCache } from '../types';

export class CacheService {
  // Layer 1: In-memory cache
  private memoryCache: Map<string, CacheEntry<any>> = new Map();

  // TTL configuration (milliseconds)
  private readonly MEMORY_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly DB_TTL = 60 * 60 * 1000; // 1 hour

  // Cache statistics
  private stats = {
    memory_hits: 0,
    memory_misses: 0,
    db_hits: 0,
    db_misses: 0,
    total_requests: 0,
  };

  constructor() {
    // Start periodic cleanup of expired memory cache entries
    this.startCleanupScheduler();
  }

  /**
   * Get value from cache (3-tier lookup)
   */
  async get<T>(key: string): Promise<T | null> {
    this.stats.total_requests++;

    // Layer 1: Check in-memory cache
    const memCached = this.getFromMemory<T>(key);
    if (memCached !== null) {
      this.stats.memory_hits++;
      logger.debug('Cache hit (memory)', { key, ttl: 'memory' });
      return memCached;
    }
    this.stats.memory_misses++;

    // Layer 2: Check PostgreSQL cache
    const dbCached = await this.getFromDatabase<T>(key);
    if (dbCached !== null) {
      this.stats.db_hits++;
      // Promote to memory cache
      this.setInMemory(key, dbCached, this.MEMORY_TTL);
      logger.debug('Cache hit (database)', { key, ttl: 'database' });
      return dbCached;
    }
    this.stats.db_misses++;

    logger.debug('Cache miss', { key });
    return null;
  }

  /**
   * Set value in cache (updates all layers)
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    const ttlMs = ttlSeconds * 1000;

    // Set in memory cache
    this.setInMemory(key, value, ttlMs);

    // Set in database cache (generic key-value)
    await this.setInDatabase(key, value, ttlSeconds);

    logger.debug('Cache set', { key, ttl: ttlSeconds });
  }

  /**
   * Delete value from cache (all layers)
   */
  async delete(key: string): Promise<void> {
    // Delete from memory
    this.memoryCache.delete(key);

    // Delete from database (generic cache table)
    try {
      await query(
        `DELETE FROM balance_cache WHERE starknet_address || ':' || token_address = $1`,
        [key]
      );
    } catch (error: any) {
      logger.warn('Failed to delete from database cache', {
        key,
        error: error.message,
      });
    }

    logger.debug('Cache deleted', { key });
  }

  /**
   * Clear all cache (memory only, database cleanup handled by SQL function)
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    logger.info('Memory cache cleared');
  }

  /**
   * Get balance from cache (specialized method)
   */
  async getBalance(
    starknetAddress: string,
    tokenAddress: string
  ): Promise<bigint | null> {
    try {
      const result = await query<BalanceCache>(
        `SELECT balance, expires_at FROM balance_cache
         WHERE starknet_address = $1 AND token_address = $2 AND expires_at > NOW()`,
        [starknetAddress, tokenAddress]
      );

      if (result.rowCount === 0) {
        return null;
      }

      const balance = BigInt(result.rows[0].balance);

      // Promote to memory cache
      const memKey = `balance:${starknetAddress}:${tokenAddress}`;
      this.setInMemory(memKey, balance.toString(), this.MEMORY_TTL);

      return balance;
    } catch (error: any) {
      logger.error('Failed to get balance from cache', {
        address: starknetAddress,
        token: tokenAddress,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Set balance in cache (specialized method)
   */
  async setBalance(
    starknetAddress: string,
    tokenAddress: string,
    balance: bigint,
    ttlSeconds: number = 300
  ): Promise<void> {
    try {
      // Set in memory cache
      const memKey = `balance:${starknetAddress}:${tokenAddress}`;
      this.setInMemory(memKey, balance.toString(), ttlSeconds * 1000);

      // Set in database cache
      await query(
        `INSERT INTO balance_cache (starknet_address, token_address, balance, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '${ttlSeconds} seconds')
         ON CONFLICT (starknet_address, token_address)
         DO UPDATE SET
           balance = $3,
           checked_at = NOW(),
           expires_at = NOW() + INTERVAL '${ttlSeconds} seconds'`,
        [starknetAddress, tokenAddress, balance.toString()]
      );

      logger.debug('Balance cached', {
        address: starknetAddress,
        token: tokenAddress,
        balance: balance.toString(),
        ttl: ttlSeconds,
      });
    } catch (error: any) {
      logger.error('Failed to set balance in cache', {
        address: starknetAddress,
        token: tokenAddress,
        error: error.message,
      });
    }
  }

  /**
   * Invalidate balance cache for an address
   */
  async invalidateBalance(
    starknetAddress: string,
    tokenAddress: string
  ): Promise<void> {
    // Delete from memory
    const memKey = `balance:${starknetAddress}:${tokenAddress}`;
    this.memoryCache.delete(memKey);

    // Delete from database
    try {
      await query(
        `DELETE FROM balance_cache
         WHERE starknet_address = $1 AND token_address = $2`,
        [starknetAddress, tokenAddress]
      );

      logger.debug('Balance cache invalidated', {
        address: starknetAddress,
        token: tokenAddress,
      });
    } catch (error: any) {
      logger.warn('Failed to invalidate balance cache', {
        address: starknetAddress,
        token: tokenAddress,
        error: error.message,
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): typeof this.stats {
    const total = this.stats.total_requests;
    const memHitRate = total > 0 ? (this.stats.memory_hits / total) * 100 : 0;
    const dbHitRate = total > 0 ? (this.stats.db_hits / total) * 100 : 0;
    const overallHitRate = total > 0 ? ((this.stats.memory_hits + this.stats.db_hits) / total) * 100 : 0;

    return {
      ...this.stats,
      memory_hit_rate: memHitRate.toFixed(2) + '%',
      db_hit_rate: dbHitRate.toFixed(2) + '%',
      overall_hit_rate: overallHitRate.toFixed(2) + '%',
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      memory_hits: 0,
      memory_misses: 0,
      db_hits: 0,
      db_misses: 0,
      total_requests: 0,
    };
  }

  // ============================================================
  // Private Methods
  // ============================================================

  /**
   * Get from memory cache (Layer 1)
   */
  private getFromMemory<T>(key: string): T | null {
    const cached = this.memoryCache.get(key);

    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expires_at) {
      this.memoryCache.delete(key);
      return null;
    }

    return cached.value as T;
  }

  /**
   * Set in memory cache (Layer 1)
   */
  private setInMemory(key: string, value: any, ttlMs: number): void {
    this.memoryCache.set(key, {
      value,
      timestamp: Date.now(),
      expires_at: Date.now() + ttlMs,
    });
  }

  /**
   * Get from database cache (Layer 2)
   */
  private async getFromDatabase<T>(key: string): Promise<T | null> {
    try {
      // For generic cache, we'd need a generic_cache table
      // For now, we only support balance cache which has its own table
      return null;
    } catch (error: any) {
      logger.warn('Failed to get from database cache', {
        key,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Set in database cache (Layer 2)
   */
  private async setInDatabase(
    key: string,
    value: any,
    ttlSeconds: number
  ): Promise<void> {
    try {
      // For generic cache, we'd need a generic_cache table
      // For now, we only support balance cache which uses specialized method
      // This is a placeholder for future generic caching
    } catch (error: any) {
      logger.warn('Failed to set in database cache', {
        key,
        error: error.message,
      });
    }
  }

  /**
   * Start periodic cleanup of expired memory cache entries
   */
  private startCleanupScheduler(): void {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.memoryCache.entries()) {
        if (now > entry.expires_at) {
          this.memoryCache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        logger.debug('Memory cache cleanup', {
          cleaned,
          remaining: this.memoryCache.size,
        });
      }
    }, 60000); // Run every minute
  }
}
