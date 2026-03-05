import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js';

// Command interface for slash commands
export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// BitSage API Response Types
export interface NetworkStats {
  total_workers: number;
  active_workers: number;
  total_jobs: number;
  completed_jobs: number;
  pending_jobs: number;
  failed_jobs: number;
  total_proofs_generated: number;
  network_uptime_seconds: number;
  average_job_duration_seconds: number;
}

export interface WorkerInfo {
  address: string;
  status: 'active' | 'inactive' | 'slashed';
  jobs_completed: number;
  total_earnings: string;
  reputation_score: number;
  gpu_model?: string;
  last_heartbeat?: string;
}

export interface JobInfo {
  job_id: string;
  worker_address: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  job_type: string;
  submitted_at: string;
  completed_at?: string;
  payment_amount: string;
  proof_hash?: string;
}

export interface WalletInfo {
  address: string;
  staked_amount: string;
  reputation_score: number;
  pending_rewards: string;
  total_earned: string;
  jobs_completed: number;
  is_worker: boolean;
  tier?: 'bronze' | 'silver' | 'gold' | 'diamond';
}

export interface RewardInfo {
  address: string;
  pending_rewards: string;
  claimed_rewards: string;
  next_claim_available_at?: string;
}

// Config interface
export interface BotConfig {
  token: string;
  applicationId: string;
  publicKey: string;
  clientId: string;
  guildId?: string;
  apiUrl: string;
  databaseUrl: string;
  starknetNetwork: string;
  starknetRpcUrl: string;
  globalCommands: boolean;
  logLevel: string;
  enableJobNotifications: boolean;
  enableNetworkStats: boolean;
  enableWalletCommands: boolean;
  jobNotificationChannelId?: string;
  networkStatsChannelId?: string;
  networkStatsUpdateInterval: number;
  jobPollInterval: number;
}
