import { BotConfig } from '../types';
import { logger } from './logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate and export configuration
export function getConfig(): BotConfig {
  const requiredEnvVars = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_APPLICATION_ID',
    'DISCORD_CLIENT_ID',
    'BITSAGE_API_URL',
    'DATABASE_URL'
  ];

  // Check required environment variables
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    logger.error('Please copy .env.example to .env and fill in the required values');
    process.exit(1);
  }

  const config: BotConfig = {
    token: process.env.DISCORD_BOT_TOKEN!,
    applicationId: process.env.DISCORD_APPLICATION_ID!,
    publicKey: process.env.DISCORD_PUBLIC_KEY || '',
    clientId: process.env.DISCORD_CLIENT_ID!,
    guildId: process.env.GUILD_ID,
    apiUrl: process.env.BITSAGE_API_URL!,
    databaseUrl: process.env.DATABASE_URL!,
    starknetNetwork: process.env.STARKNET_NETWORK || 'sepolia',
    starknetRpcUrl: process.env.STARKNET_RPC_URL || 'https://rpc.starknet-testnet.lava.build',
    globalCommands: process.env.GLOBAL_COMMANDS === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
    enableJobNotifications: process.env.ENABLE_JOB_NOTIFICATIONS !== 'false',
    enableNetworkStats: process.env.ENABLE_NETWORK_STATS !== 'false',
    enableWalletCommands: process.env.ENABLE_WALLET_COMMANDS !== 'false',
    jobNotificationChannelId: process.env.JOB_NOTIFICATION_CHANNEL_ID,
    networkStatsChannelId: process.env.NETWORK_STATS_CHANNEL_ID,
    networkStatsUpdateInterval: parseInt(process.env.NETWORK_STATS_UPDATE_INTERVAL || '30', 10),
    jobPollInterval: parseInt(process.env.JOB_POLL_INTERVAL || '5', 10)
  };

  // Log configuration (without sensitive data)
  logger.info('Bot configuration loaded', {
    apiUrl: config.apiUrl,
    network: config.starknetNetwork,
    globalCommands: config.globalCommands,
    features: {
      jobNotifications: config.enableJobNotifications,
      networkStats: config.enableNetworkStats,
      walletCommands: config.enableWalletCommands
    }
  });

  return config;
}

export const config = getConfig();
