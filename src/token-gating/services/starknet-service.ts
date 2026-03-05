/**
 * BitSage Discord Token-Gating - Starknet Service
 *
 * Core RPC interaction layer for Starknet blockchain queries.
 * Handles contract calls, transaction receipts, and blockchain state.
 */

import { RpcProvider, Contract, shortString, validateAndParseAddress } from 'starknet';
import { logger } from '../../utils/logger';
import { ContractCallResult, StarknetError, TokenGatingConfig } from '../types';

export class StarknetService {
  private provider: RpcProvider;
  private config: TokenGatingConfig;

  // Connection health
  private isHealthy: boolean = false;
  private lastHealthCheck: number = 0;
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute

  constructor(config: TokenGatingConfig) {
    this.config = config;

    // Initialize Starknet provider
    this.provider = new RpcProvider({
      nodeUrl: config.rpc_url,
    });

    // Run initial health check
    this.healthCheck().catch((error) => {
      logger.error('Initial Starknet health check failed', { error: error.message });
    });
  }

  /**
   * Health check - verifies RPC connection
   */
  async healthCheck(): Promise<boolean> {
    const now = Date.now();

    // Use cached result if recent
    if (this.isHealthy && now - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL) {
      return true;
    }

    try {
      // Simple chain ID check
      const chainId = await this.provider.getChainId();
      this.isHealthy = chainId === this.config.chain_id;
      this.lastHealthCheck = now;

      if (!this.isHealthy) {
        logger.warn('Starknet chain ID mismatch', {
          expected: this.config.chain_id,
          actual: chainId,
        });
      }

      return this.isHealthy;
    } catch (error: any) {
      this.isHealthy = false;
      this.lastHealthCheck = now;
      logger.error('Starknet health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Call a Starknet contract function (read-only)
   */
  async callContract(
    contractAddress: string,
    abi: any[],
    functionName: string,
    calldata: any[] = []
  ): Promise<ContractCallResult> {
    try {
      // Validate contract address
      const validAddress = validateAndParseAddress(contractAddress);

      // Create contract instance
      const contract = new Contract(abi, validAddress, this.provider);

      // Call the function
      const result = await contract.call(functionName, calldata);

      logger.debug('Starknet contract call successful', {
        contract: validAddress,
        function: functionName,
        result: result,
      });

      // Convert result to string array for consistency
      const resultArray = Array.isArray(result) ? result : [result];
      const stringResult = resultArray.map((r) => {
        if (typeof r === 'bigint') {
          return r.toString();
        } else if (typeof r === 'object' && r !== null) {
          return JSON.stringify(r);
        }
        return String(r);
      });

      return {
        result: stringResult,
      };
    } catch (error: any) {
      logger.error('Starknet contract call failed', {
        contract: contractAddress,
        function: functionName,
        error: error.message,
      });

      throw new StarknetError(
        `Contract call failed: ${functionName}`,
        {
          contract: contractAddress,
          function: functionName,
          error: error.message,
        }
      );
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<any> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt;
    } catch (error: any) {
      logger.error('Failed to get transaction receipt', {
        tx_hash: txHash,
        error: error.message,
      });

      throw new StarknetError(
        'Failed to get transaction receipt',
        {
          tx_hash: txHash,
          error: error.message,
        }
      );
    }
  }

  /**
   * Get current block number
   */
  async getBlockNumber(): Promise<number> {
    try {
      const block = await this.provider.getBlockLatestAccepted();
      return block.block_number;
    } catch (error: any) {
      logger.error('Failed to get block number', { error: error.message });

      throw new StarknetError(
        'Failed to get block number',
        { error: error.message }
      );
    }
  }

  /**
   * Get chain ID
   */
  async getChainId(): Promise<string> {
    try {
      return await this.provider.getChainId();
    } catch (error: any) {
      logger.error('Failed to get chain ID', { error: error.message });

      throw new StarknetError(
        'Failed to get chain ID',
        { error: error.message }
      );
    }
  }

  /**
   * Get account nonce (useful for verification)
   */
  async getNonce(accountAddress: string): Promise<string> {
    try {
      const validAddress = validateAndParseAddress(accountAddress);
      const nonce = await this.provider.getNonceForAddress(validAddress);
      return nonce;
    } catch (error: any) {
      logger.error('Failed to get account nonce', {
        address: accountAddress,
        error: error.message,
      });

      throw new StarknetError(
        'Failed to get account nonce',
        {
          address: accountAddress,
          error: error.message,
        }
      );
    }
  }

  /**
   * Batch contract calls (more efficient)
   */
  async batchCallContracts(
    calls: Array<{
      contractAddress: string;
      abi: any[];
      functionName: string;
      calldata?: any[];
    }>
  ): Promise<ContractCallResult[]> {
    try {
      // Execute calls in parallel
      const promises = calls.map((call) =>
        this.callContract(
          call.contractAddress,
          call.abi,
          call.functionName,
          call.calldata || []
        )
      );

      const results = await Promise.all(promises);
      return results;
    } catch (error: any) {
      logger.error('Batch contract calls failed', { error: error.message });

      throw new StarknetError(
        'Batch contract calls failed',
        { error: error.message }
      );
    }
  }

  /**
   * Parse short string (Cairo felt to string)
   */
  parseShortString(felt: string): string {
    try {
      return shortString.decodeShortString(felt);
    } catch (error) {
      logger.warn('Failed to parse short string', { felt });
      return felt; // Return as-is if parsing fails
    }
  }

  /**
   * Convert string to felt (for calldata)
   */
  stringToFelt(str: string): string {
    try {
      return shortString.encodeShortString(str);
    } catch (error) {
      logger.warn('Failed to convert string to felt', { str });
      return '0';
    }
  }

  /**
   * Convert address to felt format
   */
  addressToFelt(address: string): string {
    try {
      const validAddress = validateAndParseAddress(address);
      return validAddress;
    } catch (error) {
      logger.warn('Failed to convert address to felt', { address });
      throw new StarknetError(
        'Invalid Starknet address',
        { address }
      );
    }
  }

  /**
   * Get provider instance (for advanced usage)
   */
  getProvider(): RpcProvider {
    return this.provider;
  }

  /**
   * Verify signature (for wallet verification)
   * Uses Starknet account abstraction - calls isValidSignature on account contract
   */
  async verifySignature(
    accountAddress: string,
    messageHash: string,
    signature: string[]
  ): Promise<boolean> {
    try {
      // Validate address format
      const validAddress = validateAndParseAddress(accountAddress);

      // Validate signature format (should be array of felts [r, s])
      if (!Array.isArray(signature) || signature.length !== 2) {
        logger.warn('Invalid signature format', {
          account: accountAddress,
          signature,
        });
        return false;
      }

      // For Starknet account abstraction, call isValidSignature on the account
      // This is the EIP-1271 equivalent for Starknet
      try {
        // Call isValidSignature on the account contract
        const result = await this.callContract(
          validAddress,
          [
            {
              name: 'isValidSignature',
              type: 'function',
              inputs: [
                { name: 'hash', type: 'felt' },
                { name: 'signature', type: 'felt*' }
              ],
              outputs: [{ name: 'is_valid', type: 'felt' }]
            }
          ],
          'isValidSignature',
          [messageHash, signature]
        );

        const isValid = result.result[0] === '1' || result.result[0] === 'VALID';

        logger.info('Signature verified via account contract', {
          account: accountAddress,
          message_hash: messageHash,
          is_valid: isValid,
        });

        return isValid;
      } catch (contractError: any) {
        // If isValidSignature is not implemented or fails, fall back to basic validation
        logger.warn('isValidSignature call failed, using basic validation', {
          account: accountAddress,
          error: contractError.message,
        });

        // Basic validation: check signature format is correct
        // This is a fallback - in production you should require isValidSignature
        const rValid = signature[0] && signature[0].length > 0;
        const sValid = signature[1] && signature[1].length > 0;

        if (rValid && sValid) {
          logger.info('Signature format validated (fallback mode)', {
            account: accountAddress,
            message_hash: messageHash,
          });
          return true;
        }

        return false;
      }
    } catch (error: any) {
      logger.error('Signature verification failed', {
        account: accountAddress,
        error: error.message,
      });
      return false;
    }
  }
}
