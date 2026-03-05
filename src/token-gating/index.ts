/**
 * BitSage Discord Token-Gating Module
 *
 * Main entry point for the token-gating module.
 * Exports all services, types, and utilities.
 */

// Services
export { StarknetService } from './services/starknet-service';
export { CacheService } from './services/cache-service';
export { TokenService } from './services/token-service';
export { PrivacyService } from './services/privacy-service';
export { RuleEvaluator } from './services/rule-evaluator';
export { RuleGroupEvaluator } from './services/rule-group-evaluator';
export { VerificationService } from './services/verification-service';
export {
  VerificationScheduler,
  startVerificationScheduler,
  stopVerificationScheduler,
} from './services/verification-scheduler';

// Types
export * from './types';

// Utilities
export { getTokenGatingConfig, tokenGatingConfig } from './utils/config';
export { RuleMatcher } from './utils/rule-matcher';
export * from './utils/verification-helpers';

// Events
export { RoleSyncHandler, initializeRoleSyncHandler } from './events/role-sync-handler';

// Module initialization
import { Client } from 'discord.js';
import { StarknetService } from './services/starknet-service';
import { CacheService } from './services/cache-service';
import { TokenService } from './services/token-service';
import { PrivacyService } from './services/privacy-service';
import { RuleEvaluator } from './services/rule-evaluator';
import { RuleGroupEvaluator } from './services/rule-group-evaluator';
import { VerificationService } from './services/verification-service';
import { VerificationScheduler, startVerificationScheduler } from './services/verification-scheduler';
import { tokenGatingConfig } from './utils/config';
import { logger } from '../utils/logger';

/**
 * Token-gating module singleton instances
 */
export class TokenGatingModule {
  private static instance: TokenGatingModule;

  public readonly starknetService: StarknetService;
  public readonly cacheService: CacheService;
  public readonly tokenService: TokenService;
  public readonly privacyService: PrivacyService;
  public readonly ruleEvaluator: RuleEvaluator;
  public readonly ruleGroupEvaluator: RuleGroupEvaluator;
  public verificationService?: VerificationService;
  public verificationScheduler?: VerificationScheduler;

  private constructor() {
    logger.info('Initializing token-gating module...');

    // Initialize services
    this.starknetService = new StarknetService(tokenGatingConfig);
    this.cacheService = new CacheService();
    this.tokenService = new TokenService(
      this.starknetService,
      this.cacheService,
      tokenGatingConfig
    );
    this.privacyService = new PrivacyService();
    this.ruleEvaluator = new RuleEvaluator(
      this.starknetService,
      this.tokenService
    );
    this.ruleGroupEvaluator = new RuleGroupEvaluator(
      this.ruleEvaluator
    );

    logger.info('Token-gating module initialized successfully', {
      features: {
        zk_proofs: tokenGatingConfig.features.enable_zk_proofs,
        stealth_addresses: tokenGatingConfig.features.enable_stealth_addresses,
      },
    });
  }

  /**
   * Initialize verification services (requires Discord client)
   */
  initializeVerificationServices(client: Client): void {
    if (this.verificationService) {
      logger.warn('Verification services already initialized');
      return;
    }

    logger.info('Initializing verification services...');

    this.verificationService = new VerificationService(
      client,
      this.starknetService,
      this.ruleEvaluator,
      this.ruleGroupEvaluator
    );

    this.verificationScheduler = startVerificationScheduler(
      this.verificationService
    );

    logger.info('Verification services initialized and scheduler started');
  }

  /**
   * Shutdown verification scheduler
   */
  shutdownVerificationServices(): void {
    if (this.verificationScheduler) {
      this.verificationScheduler.stop();
      this.verificationScheduler = undefined;
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TokenGatingModule {
    if (!TokenGatingModule.instance) {
      TokenGatingModule.instance = new TokenGatingModule();
    }
    return TokenGatingModule.instance;
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    starknet: boolean;
    overall: boolean;
  }> {
    const starknetHealthy = await this.starknetService.healthCheck();

    return {
      starknet: starknetHealthy,
      overall: starknetHealthy,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheService.getStats();
  }
}

/**
 * Initialize and export singleton instance
 */
export function initializeTokenGating(): TokenGatingModule {
  return TokenGatingModule.getInstance();
}
