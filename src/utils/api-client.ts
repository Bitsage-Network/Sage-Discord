import axios, { AxiosInstance } from 'axios';
import { NetworkStats, WorkerInfo, JobInfo, WalletInfo, RewardInfo } from '../types';
import { logger } from './logger';
import { config } from './config';

/**
 * BitSage API Client
 * Communicates with the BitSage Rust coordinator API
 */
class BitSageAPIClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('API Request Error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('API Response Error', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get network statistics
   */
  async getNetworkStats(): Promise<NetworkStats> {
    try {
      const response = await this.client.get<NetworkStats>('/api/network/stats');
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch network stats', error);
      throw new Error('Unable to fetch network statistics. Please try again later.');
    }
  }

  /**
   * Get all workers
   */
  async getWorkers(): Promise<WorkerInfo[]> {
    try {
      const response = await this.client.get<WorkerInfo[]>('/api/workers');
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch workers', error);
      throw new Error('Unable to fetch workers. Please try again later.');
    }
  }

  /**
   * Get worker by address
   */
  async getWorker(address: string): Promise<WorkerInfo> {
    try {
      const response = await this.client.get<WorkerInfo>(`/api/workers/${address}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch worker ${address}`, error);
      throw new Error('Unable to fetch worker information. Please check the address and try again.');
    }
  }

  /**
   * Get recent jobs
   */
  async getJobs(limit: number = 10): Promise<JobInfo[]> {
    try {
      const response = await this.client.get<JobInfo[]>('/api/jobs', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch jobs', error);
      throw new Error('Unable to fetch jobs. Please try again later.');
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<JobInfo> {
    try {
      const response = await this.client.get<JobInfo>(`/api/jobs/${jobId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch job ${jobId}`, error);
      throw new Error('Unable to fetch job information. Please check the job ID and try again.');
    }
  }

  /**
   * Get wallet/validator status
   */
  async getWalletInfo(address: string): Promise<WalletInfo> {
    try {
      const response = await this.client.get<WalletInfo>('/api/validator/status', {
        headers: {
          'X-Wallet-Address': address
        }
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch wallet info for ${address}`, error);
      throw new Error('Unable to fetch wallet information. Please check the address and try again.');
    }
  }

  /**
   * Get rewards information
   */
  async getRewards(address: string): Promise<RewardInfo> {
    try {
      const response = await this.client.get<RewardInfo>('/api/validator/rewards', {
        headers: {
          'X-Wallet-Address': address
        }
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch rewards for ${address}`, error);
      throw new Error('Unable to fetch rewards information. Please try again later.');
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch (error) {
      logger.warn('API health check failed', error);
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new BitSageAPIClient(config.apiUrl);
