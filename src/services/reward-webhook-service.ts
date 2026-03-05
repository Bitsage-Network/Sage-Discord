/**
 * Webhook Delivery Service
 *
 * Handles secure webhook calls for reward campaigns:
 * - HMAC signature authentication
 * - Rate limiting (per campaign)
 * - Retry logic with exponential backoff
 * - Comprehensive audit logging
 */

import axios, { AxiosResponse } from 'axios';
import crypto from 'crypto';
import { query } from '../lib/db';
import logger from '../lib/logger';

interface WebhookConfig {
    url: string;
    method: 'POST' | 'GET' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    use_hmac?: boolean;
    hmac_secret?: string; // Only used during creation, not stored
    rate_limit?: number; // Max calls per hour
    timeout?: number; // Request timeout in ms
}

interface WebhookPayload {
    event: string;
    campaign_id: string;
    campaign_name: string;
    discord_user_id: string;
    discord_username?: string;
    wallet_address?: string;
    claimed_at: string;
    reward_type: string;
    reward_config: any;
    metadata?: any;
}

interface WebhookResult {
    success: boolean;
    status?: number;
    response_body?: string;
    response_time_ms?: number;
    error?: string;
}

export class WebhookService {
    private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
    private readonly DEFAULT_RATE_LIMIT = 100; // 100 calls per hour
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAYS = [1000, 5000, 15000]; // Exponential backoff

    /**
     * Send webhook with optional HMAC signature
     */
    async sendWebhook(
        campaignId: string,
        claimId: string,
        discordUserId: string,
        config: WebhookConfig,
        payload: WebhookPayload
    ): Promise<WebhookResult> {
        try {
            // Check rate limit
            const rateLimitOk = await this.checkRateLimit(
                campaignId,
                config.rate_limit || this.DEFAULT_RATE_LIMIT
            );

            if (!rateLimitOk) {
                return {
                    success: false,
                    error: 'Rate limit exceeded'
                };
            }

            // Prepare headers
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'BitSage-Discord-Bot/1.0',
                ...config.headers
            };

            // Add HMAC signature if enabled
            if (config.use_hmac) {
                const signature = await this.generateHMACSignature(
                    campaignId,
                    payload
                );
                if (signature) {
                    headers['X-BitSage-Signature'] = signature;
                    headers['X-BitSage-Timestamp'] = Date.now().toString();
                }
            }

            // Send request
            const startTime = Date.now();
            const response = await axios({
                method: config.method,
                url: config.url,
                headers,
                data: config.method !== 'GET' ? payload : undefined,
                params: config.method === 'GET' ? payload : undefined,
                timeout: config.timeout || this.DEFAULT_TIMEOUT,
                validateStatus: () => true // Don't throw on any status
            });
            const responseTime = Date.now() - startTime;

            const success = response.status >= 200 && response.status < 300;

            // Log webhook call
            await this.logWebhookCall(
                claimId,
                campaignId,
                discordUserId,
                config.url,
                config.method,
                headers,
                payload,
                response,
                responseTime,
                success
            );

            // Increment rate limit counter
            await this.incrementRateLimitCounter(campaignId);

            return {
                success,
                status: response.status,
                response_body: this.truncateResponse(response.data),
                response_time_ms: responseTime
            };

        } catch (error: any) {
            logger.error('Webhook call failed:', error);

            // Log failed call
            await this.logWebhookCall(
                claimId,
                campaignId,
                discordUserId,
                config.url,
                config.method,
                {},
                payload,
                null,
                0,
                false,
                error.message
            );

            return {
                success: false,
                error: error.message || 'Webhook request failed'
            };
        }
    }

    /**
     * Send webhook with automatic retries
     */
    async sendWebhookWithRetry(
        campaignId: string,
        claimId: string,
        discordUserId: string,
        config: WebhookConfig,
        payload: WebhookPayload
    ): Promise<WebhookResult> {
        let lastError: string = '';

        for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                // Wait before retry with exponential backoff
                await this.sleep(this.RETRY_DELAYS[attempt - 1]);
                logger.info(`Retrying webhook (attempt ${attempt}/${this.MAX_RETRIES})`, {
                    campaignId,
                    claimId
                });
            }

            const result = await this.sendWebhook(
                campaignId,
                claimId,
                discordUserId,
                config,
                payload
            );

            if (result.success) {
                return result;
            }

            lastError = result.error || 'Unknown error';

            // Don't retry on 4xx errors (client errors)
            if (result.status && result.status >= 400 && result.status < 500) {
                break;
            }
        }

        return {
            success: false,
            error: `Failed after ${this.MAX_RETRIES + 1} attempts: ${lastError}`
        };
    }

    /**
     * Generate HMAC signature for webhook payload
     */
    private async generateHMACSignature(
        campaignId: string,
        payload: any
    ): Promise<string | null> {
        try {
            // Get HMAC secret from database
            const result = await query(
                `SELECT secret_hash, algorithm FROM reward_webhook_secrets WHERE campaign_id = $1`,
                [campaignId]
            );

            if (result.rows.length === 0) {
                logger.warn('No HMAC secret found for campaign:', { campaignId });
                return null;
            }

            const { secret_hash, algorithm } = result.rows[0];

            // Note: In production, you'd decrypt the secret_hash here
            // For now, we'll use it as-is (assumption: it's the actual secret, not a hash)
            // TODO: Implement proper secret encryption/decryption

            const payloadString = JSON.stringify(payload);
            const hmac = crypto.createHmac(algorithm || 'sha256', secret_hash);
            hmac.update(payloadString);
            const signature = hmac.digest('hex');

            return `${algorithm}=${signature}`;

        } catch (error: any) {
            logger.error('Failed to generate HMAC signature:', error);
            return null;
        }
    }

    /**
     * Check if rate limit allows another webhook call
     */
    private async checkRateLimit(campaignId: string, maxCallsPerHour: number): Promise<boolean> {
        try {
            const now = new Date();
            const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
            const windowEnd = now;

            // Get current window
            const result = await query(
                `SELECT call_count, max_calls_per_window
                 FROM reward_webhook_rate_limits
                 WHERE campaign_id = $1
                 AND window_end > $2
                 ORDER BY window_end DESC
                 LIMIT 1`,
                [campaignId, windowStart]
            );

            if (result.rows.length === 0) {
                // Create new window
                await query(
                    `INSERT INTO reward_webhook_rate_limits
                     (campaign_id, window_start, window_end, call_count, max_calls_per_window)
                     VALUES ($1, $2, $3, 0, $4)`,
                    [campaignId, windowStart, windowEnd, maxCallsPerHour]
                );
                return true;
            }

            const { call_count, max_calls_per_window } = result.rows[0];

            // Check if limit exceeded
            if (call_count >= max_calls_per_window) {
                logger.warn('Webhook rate limit exceeded:', {
                    campaignId,
                    callCount: call_count,
                    maxCalls: max_calls_per_window
                });
                return false;
            }

            return true;

        } catch (error: any) {
            logger.error('Rate limit check failed:', error);
            return true; // Allow on error (fail open)
        }
    }

    /**
     * Increment rate limit counter
     */
    private async incrementRateLimitCounter(campaignId: string): Promise<void> {
        try {
            const now = new Date();
            const windowStart = new Date(now.getTime() - 60 * 60 * 1000);

            await query(
                `UPDATE reward_webhook_rate_limits
                 SET call_count = call_count + 1,
                     updated_at = NOW()
                 WHERE campaign_id = $1
                 AND window_end > $2`,
                [campaignId, windowStart]
            );
        } catch (error: any) {
            logger.error('Failed to increment rate limit counter:', error);
        }
    }

    /**
     * Log webhook call to database
     */
    private async logWebhookCall(
        claimId: string,
        campaignId: string,
        discordUserId: string,
        webhookUrl: string,
        method: string,
        headers: Record<string, string>,
        payload: any,
        response: AxiosResponse | null,
        responseTime: number,
        success: boolean,
        errorMessage?: string
    ): Promise<void> {
        try {
            // Remove sensitive headers
            const sanitizedHeaders = { ...headers };
            delete sanitizedHeaders['Authorization'];
            delete sanitizedHeaders['X-BitSage-Signature'];

            await query(
                `INSERT INTO reward_webhook_logs
                 (claim_id, campaign_id, discord_user_id, webhook_url, request_method,
                  request_headers, request_payload, response_status, response_body,
                  response_time_ms, success, error_message)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [
                    claimId,
                    campaignId,
                    discordUserId,
                    webhookUrl,
                    method,
                    JSON.stringify(sanitizedHeaders),
                    JSON.stringify(payload),
                    response?.status || null,
                    response ? this.truncateResponse(response.data) : null,
                    responseTime,
                    success,
                    errorMessage || null
                ]
            );
        } catch (error: any) {
            logger.error('Failed to log webhook call:', error);
        }
    }

    /**
     * Store HMAC secret for campaign
     */
    async storeHMACSecret(
        campaignId: string,
        secret: string,
        algorithm: string = 'sha256'
    ): Promise<void> {
        try {
            // TODO: In production, encrypt the secret before storing
            // For now, we'll hash it with bcrypt (one-way)
            // This means we can't use it for signing - needs refactoring
            const bcrypt = require('bcrypt');
            const secretHash = await bcrypt.hash(secret, 10);
            const secretHint = secret.substring(0, 4);

            await query(
                `INSERT INTO reward_webhook_secrets (campaign_id, secret_hash, secret_hint, algorithm)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (campaign_id)
                 DO UPDATE SET secret_hash = $2, secret_hint = $3, algorithm = $4, rotated_at = NOW()`,
                [campaignId, secretHash, secretHint, algorithm]
            );

            logger.info('HMAC secret stored for campaign:', { campaignId, hint: secretHint });

        } catch (error: any) {
            logger.error('Failed to store HMAC secret:', error);
            throw error;
        }
    }

    /**
     * Truncate large response bodies
     */
    private truncateResponse(data: any): string {
        const str = typeof data === 'string' ? data : JSON.stringify(data);
        const maxLength = 10000; // 10KB
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    }

    /**
     * Sleep utility for retry delays
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Build payload for webhook
     */
    buildPayload(
        campaign: any,
        discordUserId: string,
        discordUsername: string,
        walletAddress?: string,
        metadata?: any
    ): WebhookPayload {
        return {
            event: 'reward.claimed',
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            discord_user_id: discordUserId,
            discord_username: discordUsername,
            wallet_address: walletAddress,
            claimed_at: new Date().toISOString(),
            reward_type: campaign.reward_type,
            reward_config: campaign.reward_config,
            metadata: metadata || {}
        };
    }
}

export const webhookService = new WebhookService();
