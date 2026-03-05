/**
 * BitSage Discord Token-Gating - Verification Scheduler
 *
 * Polls for newly verified users and assigns Discord roles.
 * Runs every 5 minutes to check the wallet_verifications table.
 */

import { VerificationService } from './verification-service';
import { logger } from '../../utils/logger';

export class VerificationScheduler {
  private verificationService: VerificationService;
  private interval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor(verificationService: VerificationService) {
    this.verificationService = verificationService;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.interval) {
      logger.warn('Verification scheduler already running');
      return;
    }

    logger.info('Starting verification scheduler', {
      interval_ms: this.POLL_INTERVAL,
    });

    // Run immediately on start
    this.poll();

    // Then run every 5 minutes
    this.interval = setInterval(() => {
      this.poll();
    }, this.POLL_INTERVAL);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Verification scheduler stopped');
    }
  }

  /**
   * Poll for verified users
   */
  private async poll(): Promise<void> {
    try {
      logger.debug('Polling for verified users...');
      await this.verificationService.pollVerifiedUsers();
    } catch (error: any) {
      logger.error('Verification poll failed', { error: error.message });
    }
  }
}

/**
 * Initialize and start the verification scheduler
 */
export function startVerificationScheduler(
  verificationService: VerificationService
): VerificationScheduler {
  const scheduler = new VerificationScheduler(verificationService);
  scheduler.start();
  return scheduler;
}

/**
 * Stop the verification scheduler
 */
export function stopVerificationScheduler(
  scheduler: VerificationScheduler
): void {
  scheduler.stop();
}
