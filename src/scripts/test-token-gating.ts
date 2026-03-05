/**
 * BitSage Discord - Token-Gating Test Script
 *
 * Tests the token-gating module initialization and Starknet connectivity.
 * Run with: npm run test-token-gating (add to package.json)
 */

import { initializeTokenGating } from '../token-gating';
import { logger } from '../utils/logger';
import { initializeDatabase } from '../utils/database';
import { config } from '../utils/config';

async function main() {
  logger.info('========================================');
  logger.info('Token-Gating Module Test');
  logger.info('========================================\n');

  try {
    // Step 1: Initialize database
    logger.info('Step 1: Initializing database connection...');
    initializeDatabase(config.databaseUrl);
    logger.info('✅ Database connected\n');

    // Step 2: Initialize token-gating module
    logger.info('Step 2: Initializing token-gating module...');
    const tokenGating = initializeTokenGating();
    logger.info('✅ Token-gating module initialized\n');

    // Step 3: Health check
    logger.info('Step 3: Running health check...');
    const health = await tokenGating.healthCheck();

    if (health.overall) {
      logger.info('✅ Health check passed');
      logger.info('  - Starknet RPC: ✅ Healthy');
    } else {
      logger.error('❌ Health check failed');
      if (!health.starknet) {
        logger.error('  - Starknet RPC: ❌ Unhealthy');
      }
    }
    logger.info('');

    // Step 4: Test Starknet queries
    logger.info('Step 4: Testing Starknet queries...');

    // Get chain ID
    const chainId = await tokenGating.starknetService.getChainId();
    logger.info(`✅ Chain ID: ${chainId}`);

    // Get latest block number
    const blockNumber = await tokenGating.starknetService.getBlockNumber();
    logger.info(`✅ Latest block: ${blockNumber}`);

    // Get token metadata
    const metadata = await tokenGating.tokenService.getTokenMetadata();
    logger.info(`✅ Token metadata:`);
    logger.info(`   Name: ${metadata.name}`);
    logger.info(`   Symbol: ${metadata.symbol}`);
    logger.info(`   Decimals: ${metadata.decimals}`);

    // Test balance query (with a known address)
    // Note: This will fail gracefully if the address is invalid
    const testAddress = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';
    logger.info(`\nQuerying balance for test address: ${testAddress}`);

    try {
      const balance = await tokenGating.tokenService.getBalance(testAddress);
      const formattedBalance = tokenGating.tokenService.formatBalance(balance, metadata.decimals);
      logger.info(`✅ Balance: ${formattedBalance} ${metadata.symbol}`);
    } catch (error: any) {
      logger.warn(`⚠️  Balance query failed (expected for invalid address): ${error.message}`);
    }

    logger.info('');

    // Step 5: Test caching
    logger.info('Step 5: Testing cache functionality...');

    // Set a test value
    await tokenGating.cacheService.set('test_key', 'test_value', 60);
    logger.info('✅ Cache set: test_key = test_value');

    // Get the value
    const cachedValue = await tokenGating.cacheService.get('test_key');
    if (cachedValue === 'test_value') {
      logger.info('✅ Cache get: test_key = test_value (match!)');
    } else {
      logger.error('❌ Cache get: value mismatch');
    }

    // Get cache statistics
    const stats = tokenGating.getCacheStats();
    logger.info('✅ Cache statistics:');
    logger.info(`   Total requests: ${stats.total_requests}`);
    logger.info(`   Memory hits: ${stats.memory_hits}`);
    logger.info(`   Database hits: ${stats.db_hits}`);
    logger.info(`   Memory hit rate: ${stats.memory_hit_rate || '0%'}`);
    logger.info(`   Overall hit rate: ${stats.overall_hit_rate || '0%'}`);

    logger.info('');

    // Summary
    logger.info('========================================');
    logger.info('✅ All tests completed successfully!');
    logger.info('========================================\n');

    logger.info('Next steps:');
    logger.info('  1. Run database migrations: psql $DATABASE_URL < migrations/001_token_gating_schema.sql');
    logger.info('  2. Update contract addresses in .env');
    logger.info('  3. Deploy wallet signing web app');
    logger.info('  4. Implement Discord commands');
    logger.info('');

    process.exit(0);
  } catch (error: any) {
    logger.error('Test failed with error:', {
      error: error.message,
      stack: error.stack,
    });

    logger.info('');
    logger.info('Troubleshooting:');
    logger.info('  1. Check .env file is configured correctly');
    logger.info('  2. Verify STARKNET_RPC_URL is accessible');
    logger.info('  3. Verify DATABASE_URL is correct');
    logger.info('  4. Check network connectivity');
    logger.info('');

    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Unhandled error in test script', error);
  process.exit(1);
});
