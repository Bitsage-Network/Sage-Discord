/**
 * BitSage Discord Bot - Bot Protection Types
 *
 * Type definitions for captcha verification, raid protection, and member management
 */

// ============================================================
// Captcha Types
// ============================================================

export type CaptchaType = 'number' | 'text' | 'image';
export type CaptchaDifficulty = 'easy' | 'medium' | 'hard';
export type CaptchaStatus = 'pending' | 'passed' | 'failed' | 'expired';
export type CaptchaTrigger = 'auto_join' | 'manual' | 'raid_protection';

export interface CaptchaChallenge {
  type: CaptchaType;
  challenge: string;
  answer: string;
  difficulty: CaptchaDifficulty;
}

export interface NumberCaptcha extends CaptchaChallenge {
  type: 'number';
  challenge: string; // e.g., "What is 7 + 3?"
  answer: string; // e.g., "10"
  equation: string; // e.g., "7 + 3"
}

export interface TextCaptcha extends CaptchaChallenge {
  type: 'text';
  challenge: string; // e.g., "What color is the sky?"
  answer: string; // e.g., "blue"
  alternatives: string[]; // e.g., ["blue", "light blue", "sky blue"]
}

export interface ImageCaptcha extends CaptchaChallenge {
  type: 'image';
  challenge: string; // e.g., "Click all squares containing a car"
  answer: string; // Grid positions as JSON
  imageBuffer: Buffer; // Generated image
  imageUrl?: string; // Discord attachment URL
}

export interface CaptchaVerification {
  id: number;
  guild_id: string;
  user_id: string;

  captcha_type: CaptchaType;
  challenge: string;
  correct_answer: string;
  user_answer?: string;

  status: CaptchaStatus;
  attempts: number;
  max_attempts: number;

  created_at: Date;
  expires_at: Date;
  verified_at?: Date;

  triggered_by?: CaptchaTrigger;
  ip_address?: string;
}

// ============================================================
// Guild Configuration
// ============================================================

export interface GuildBotProtectionConfig {
  guild_id: string;

  // Captcha settings
  captcha_enabled: boolean;
  captcha_on_join: boolean;
  captcha_type: CaptchaType | 'random';
  captcha_difficulty: CaptchaDifficulty;
  captcha_timeout_minutes: number;
  max_captcha_attempts: number;

  // Verified role
  verified_role_id?: string;
  verified_role_name: string;
  auto_create_verified_role: boolean;
  auto_assign_verified_role: boolean;

  // Waiting room
  waiting_room_enabled: boolean;
  waiting_room_role_id?: string;
  waiting_room_channel_id?: string;

  // Member pruning
  prune_unverified_enabled: boolean;
  prune_timeout_hours: number;
  prune_send_dm: boolean;

  // Rules
  rules_enabled: boolean;
  rules_text?: string;
  rules_channel_id?: string;
  require_rules_acceptance: boolean;

  created_at: Date;
  updated_at: Date;
}

// ============================================================
// Server Rules
// ============================================================

export interface GuildRule {
  id: number;
  guild_id: string;
  rule_number: number; // 1-5
  rule_text: string;
  emoji?: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================================
// Member Verification
// ============================================================

export type VerificationMethod = 'captcha' | 'wallet' | 'manual' | 'imported';

export interface MemberVerificationStatus {
  guild_id: string;
  user_id: string;

  is_verified: boolean;
  verification_method?: VerificationMethod;
  verified_at?: Date;
  verified_by?: string; // Admin user ID

  joined_at: Date;
  first_message_at?: Date;

  is_suspicious: boolean;
  suspicious_reasons?: string[];
  is_kicked: boolean;
  kick_reason?: string;
  kicked_at?: Date;

  account_created_at?: Date;
  has_avatar: boolean;
  has_nitro: boolean;

  created_at: Date;
  updated_at: Date;
}

// ============================================================
// Raid Protection
// ============================================================

export interface JoinRateEvent {
  id: number;
  guild_id: string;
  user_id: string;
  joined_at: Date;

  account_created_at?: Date;
  has_avatar: boolean;
  has_default_avatar: boolean;
  username: string;
  discriminator: string;
}

export interface RaidDetectionResult {
  is_raid: boolean;
  join_rate: number; // Joins per minute
  suspicious_count: number;
  total_joins: number;
  time_window_minutes: number;
  reasons: string[];
}

// ============================================================
// Audit Logs
// ============================================================

export type SecurityEventType =
  | 'captcha_passed'
  | 'captcha_failed'
  | 'member_verified'
  | 'member_kicked'
  | 'member_pruned'
  | 'raid_detected'
  | 'lockdown_enabled'
  | 'lockdown_disabled'
  | 'config_changed'
  | 'manual_verification'
  | 'rules_updated';

export interface SecurityAuditLog {
  id: number;
  guild_id: string;

  event_type: SecurityEventType;
  event_description: string;

  user_id?: string;
  username?: string;

  actor_id?: string;
  actor_username?: string;

  metadata?: Record<string, any>;

  created_at: Date;
}

// ============================================================
// Lockdown
// ============================================================

export type LockdownType = 'manual' | 'auto_raid' | 'scheduled';

export interface GuildLockdownStatus {
  guild_id: string;
  is_locked_down: boolean;
  lockdown_reason?: string;
  lockdown_type?: LockdownType;

  block_new_joins: boolean;
  require_captcha: boolean;
  mute_new_members: boolean;

  locked_down_at?: Date;
  locked_down_by?: string;
  unlock_at?: Date;
  unlocked_at?: Date;

  created_at: Date;
  updated_at: Date;
}

// ============================================================
// Service Responses
// ============================================================

export interface CaptchaGenerationResult {
  success: boolean;
  captcha?: CaptchaChallenge;
  verification_id?: number;
  error?: string;
}

export interface CaptchaVerificationResult {
  success: boolean;
  passed: boolean;
  attempts_remaining: number;
  message: string;
  should_kick?: boolean;
}

export interface MemberVerificationResult {
  is_verified: boolean;
  verification_method?: VerificationMethod;
  verified_at?: Date;
  should_grant_roles: boolean;
  roles_to_grant: string[];
  roles_to_remove: string[];
}

// ============================================================
// Configuration Options
// ============================================================

export interface CaptchaOptions {
  type?: CaptchaType | 'random';
  difficulty?: CaptchaDifficulty;
  timeout_minutes?: number;
  max_attempts?: number;
}

export interface RulesConfig {
  rules: Array<{
    number: number;
    text: string;
    emoji?: string;
  }>;
  channel_id?: string;
  require_acceptance: boolean;
}

export interface PruneConfig {
  enabled: boolean;
  timeout_hours: number;
  send_dm: boolean;
  dry_run?: boolean;
}

// ============================================================
// Exports
// ============================================================

export default {
  // Type guards can be added here
};
