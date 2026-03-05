/**
 * NFT/POAP Minting Service
 *
 * Handles minting of:
 * 1. Soulbound POAPs via BitSage achievement_nft.cairo contract
 * 2. Transferable NFTs via any external ERC721 contract
 *
 * Leverages existing Starknet infrastructure - no new contract deployment needed.
 */

import { Contract, CallData, RpcProvider, Account, uint256 } from 'starknet';
import { query } from '../lib/db';
import logger from '../lib/logger';

// Achievement NFT ABI (simplified - only what we need)
const ACHIEVEMENT_NFT_ABI = [
    {
        name: 'mint_achievement',
        type: 'function',
        inputs: [
            { name: 'to', type: 'core::starknet::contract_address::ContractAddress' },
            { name: 'token_id', type: 'core::integer::u256' },
            {
                name: 'metadata',
                type: 'achievement_nft::AchievementMetadata',
                members: [
                    { name: 'achievement_type', type: 'core::integer::u8' },
                    { name: 'worker_id', type: 'core::felt252' },
                    { name: 'earned_at', type: 'core::integer::u64' },
                    { name: 'reward_amount', type: 'core::integer::u256' }
                ]
            }
        ],
        outputs: [],
        state_mutability: 'external'
    }
];

// External ERC721 ABI (standard mint function)
const ERC721_MINT_ABI = [
    {
        name: 'mint',
        type: 'function',
        inputs: [
            { name: 'to', type: 'core::starknet::contract_address::ContractAddress' },
            { name: 'token_id', type: 'core::integer::u256' }
        ],
        outputs: [],
        state_mutability: 'external'
    },
    {
        name: 'safe_mint',
        type: 'function',
        inputs: [
            { name: 'to', type: 'core::starknet::contract_address::ContractAddress' },
            { name: 'token_id', type: 'core::integer::u256' }
        ],
        outputs: [],
        state_mutability: 'external'
    }
];

interface NFTConfig {
    id: string;
    campaign_id: string;
    contract_address: string;
    contract_type: 'achievement_nft' | 'external';
    achievement_type?: number;
    token_id_counter: number;
    token_id_start?: number;
    token_id_end?: number;
    metadata_uri?: string;
}

interface MintResult {
    success: boolean;
    token_id?: string;
    tx_hash?: string;
    error?: string;
}

export class NFTMintingService {
    private provider: RpcProvider;
    private account?: Account;
    private networkName: string;

    constructor() {
        // Initialize Starknet provider based on environment
        const rpcUrl = process.env.STARKNET_RPC_URL || 'https://api.cartridge.gg/x/starknet/sepolia';
        this.networkName = process.env.STARKNET_NETWORK || 'sepolia';

        this.provider = new RpcProvider({ nodeUrl: rpcUrl });

        // Initialize account if private key is provided
        const privateKey = process.env.STARKNET_PRIVATE_KEY;
        const accountAddress = process.env.STARKNET_ACCOUNT_ADDRESS;

        if (privateKey && accountAddress) {
            this.account = new Account(this.provider, accountAddress, privateKey);
            logger.info('NFT minting service initialized with account:', { accountAddress });
        } else {
            logger.warn('NFT minting service initialized without account - read-only mode');
        }
    }

    /**
     * Mint a POAP (soulbound) via achievement_nft.cairo contract
     */
    async mintPOAP(
        campaignId: string,
        discordUserId: string,
        walletAddress: string,
        achievementType: number
    ): Promise<MintResult> {
        try {
            if (!this.account) {
                throw new Error('No Starknet account configured for minting');
            }

            // Get NFT config
            const config = await this.getNFTConfig(campaignId);
            if (!config || config.contract_type !== 'achievement_nft') {
                throw new Error('Campaign not configured for POAP minting');
            }

            // Achievement type must be 100+ for Discord rewards
            if (achievementType < 100) {
                throw new Error('Achievement type for Discord rewards must be 100 or greater');
            }

            // Check if user already has this achievement
            const existingMint = await query(
                `SELECT id FROM reward_nft_mints
                 WHERE campaign_id = $1
                 AND discord_user_id = $2`,
                [campaignId, discordUserId]
            );

            if (existingMint.rows.length > 0) {
                return {
                    success: false,
                    error: 'User already claimed this POAP'
                };
            }

            // Get next token ID
            const tokenId = await this.getNextTokenId(config);

            // Prepare metadata
            const metadata = {
                achievement_type: achievementType,
                worker_id: this.discordIdToFelt(discordUserId),
                earned_at: Math.floor(Date.now() / 1000),
                reward_amount: uint256.bnToUint256(0) // No SAGE reward for Discord POAPs
            };

            // Initialize contract
            const contract = new Contract(
                ACHIEVEMENT_NFT_ABI,
                config.contract_address,
                this.provider
            );
            contract.connect(this.account);

            // Call mint_achievement
            const call = contract.populate('mint_achievement', [
                walletAddress,
                uint256.bnToUint256(tokenId),
                metadata
            ]);

            const tx = await this.account.execute(call);
            logger.info('POAP mint transaction submitted:', {
                txHash: tx.transaction_hash,
                tokenId,
                achievementType
            });

            // Wait for transaction (optional - can be async)
            // await this.provider.waitForTransaction(tx.transaction_hash);

            return {
                success: true,
                token_id: tokenId.toString(),
                tx_hash: tx.transaction_hash
            };

        } catch (error: any) {
            logger.error('POAP minting failed:', error);
            return {
                success: false,
                error: error.message || 'POAP minting failed'
            };
        }
    }

    /**
     * Mint a transferable NFT via external ERC721 contract
     */
    async mintNFT(
        campaignId: string,
        discordUserId: string,
        walletAddress: string
    ): Promise<MintResult> {
        try {
            if (!this.account) {
                throw new Error('No Starknet account configured for minting');
            }

            // Get NFT config
            const config = await this.getNFTConfig(campaignId);
            if (!config || config.contract_type !== 'external') {
                throw new Error('Campaign not configured for NFT minting');
            }

            // Get next token ID
            const tokenId = await this.getNextTokenId(config);

            // Check if token ID is within range (if specified)
            if (config.token_id_start && config.token_id_end) {
                if (tokenId < config.token_id_start || tokenId > config.token_id_end) {
                    return {
                        success: false,
                        error: 'Token ID allocation exhausted'
                    };
                }
            }

            // Initialize contract
            const contract = new Contract(
                ERC721_MINT_ABI,
                config.contract_address,
                this.provider
            );
            contract.connect(this.account);

            // Try safe_mint first, fall back to mint
            let call;
            try {
                call = contract.populate('safe_mint', [
                    walletAddress,
                    uint256.bnToUint256(tokenId)
                ]);
            } catch {
                call = contract.populate('mint', [
                    walletAddress,
                    uint256.bnToUint256(tokenId)
                ]);
            }

            const tx = await this.account.execute(call);
            logger.info('NFT mint transaction submitted:', {
                txHash: tx.transaction_hash,
                tokenId
            });

            return {
                success: true,
                token_id: tokenId.toString(),
                tx_hash: tx.transaction_hash
            };

        } catch (error: any) {
            logger.error('NFT minting failed:', error);
            return {
                success: false,
                error: error.message || 'NFT minting failed'
            };
        }
    }

    /**
     * Get NFT configuration for a campaign
     */
    private async getNFTConfig(campaignId: string): Promise<NFTConfig | null> {
        const result = await query(
            `SELECT * FROM reward_nft_configs WHERE campaign_id = $1`,
            [campaignId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0] as NFTConfig;
    }

    /**
     * Get next available token ID and increment counter
     */
    private async getNextTokenId(config: NFTConfig): Promise<number> {
        // Start from token_id_start if specified, otherwise use counter
        const nextId = config.token_id_start
            ? config.token_id_start + config.token_id_counter
            : config.token_id_counter + 1;

        // Increment counter in database
        await query(
            `UPDATE reward_nft_configs
             SET token_id_counter = token_id_counter + 1,
                 updated_at = NOW()
             WHERE id = $1`,
            [config.id]
        );

        return nextId;
    }

    /**
     * Convert Discord user ID to Cairo felt252 (for worker_id in achievement metadata)
     */
    private discordIdToFelt(discordId: string): string {
        // Convert Discord snowflake ID to felt252
        // Discord IDs are 64-bit, felt252 supports up to 2^251
        // We can safely use the ID directly as a felt
        return BigInt(discordId).toString();
    }

    /**
     * Record NFT mint in database
     */
    async recordMint(
        claimId: string,
        campaignId: string,
        discordUserId: string,
        walletAddress: string,
        contractAddress: string,
        tokenId: string,
        txHash: string,
        metadata: any = {}
    ): Promise<void> {
        await query(
            `INSERT INTO reward_nft_mints
             (claim_id, campaign_id, discord_user_id, wallet_address, contract_address, token_id, tx_hash, metadata)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [claimId, campaignId, discordUserId, walletAddress, contractAddress, tokenId, txHash, JSON.stringify(metadata)]
        );

        logger.info('NFT mint recorded:', { claimId, tokenId, txHash });
    }

    /**
     * Get user's Starknet wallet address
     */
    async getUserWallet(discordUserId: string): Promise<string | null> {
        const result = await query(
            `SELECT starknet_address FROM discord_users WHERE user_id = $1`,
            [discordUserId]
        );

        if (result.rows.length === 0 || !result.rows[0].starknet_address) {
            return null;
        }

        return result.rows[0].starknet_address;
    }

    /**
     * Verify transaction on Starknet
     */
    async verifyTransaction(txHash: string): Promise<boolean> {
        try {
            const receipt = await this.provider.getTransactionReceipt(txHash);
            return receipt.execution_status === 'SUCCEEDED';
        } catch (error) {
            logger.error('Failed to verify transaction:', error);
            return false;
        }
    }

    /**
     * Get explorer URL for transaction
     */
    getExplorerUrl(txHash: string): string {
        const baseUrls: Record<string, string> = {
            mainnet: 'https://starkscan.co',
            sepolia: 'https://sepolia.starkscan.co',
            devnet: 'http://localhost:5050'
        };

        const baseUrl = baseUrls[this.networkName] || baseUrls.sepolia;
        return `${baseUrl}/tx/${txHash}`;
    }
}

export const nftMintingService = new NFTMintingService();
