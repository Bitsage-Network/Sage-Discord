import { z } from "zod"

// ============================================================
// RULE TYPE ENUMS
// ============================================================

export const RuleTypeEnum = z.enum([
  "token_balance",
  "staked_amount",
  "reputation",
  "validator",
  "worker",
])

export type RuleType = z.infer<typeof RuleTypeEnum>

export const VerificationMethodEnum = z.enum([
  "signature",
  "stealth",
  "zk_proof",
])

export type VerificationMethod = z.infer<typeof VerificationMethodEnum>

// ============================================================
// REQUIREMENTS SCHEMAS (Type-Specific)
// ============================================================

// Token Balance Requirements
export const TokenBalanceRequirementsSchema = z.object({
  min_balance: z.string().min(1, "Minimum balance is required"),
  token_address: z.string().optional(),
  include_staked: z.boolean().optional().default(false),
})

export type TokenBalanceRequirements = z.infer<typeof TokenBalanceRequirementsSchema>

// Staked Amount Requirements
export const StakedAmountRequirementsSchema = z.object({
  min_staked: z.string().min(1, "Minimum staked amount is required"),
  min_stake_duration: z.number().int().positive().optional(), // in days
  include_rewards: z.boolean().optional().default(false),
})

export type StakedAmountRequirements = z.infer<typeof StakedAmountRequirementsSchema>

// Reputation Requirements
export const ReputationRequirementsSchema = z.object({
  min_reputation: z.number().int().min(0, "Reputation must be non-negative"),
  min_level: z.number().int().min(0).optional(),
})

export type ReputationRequirements = z.infer<typeof ReputationRequirementsSchema>

// Validator Requirements
export const ValidatorRequirementsSchema = z.object({
  must_be_active: z.boolean().default(true),
  min_stake: z.string().optional(),
  min_uptime_percent: z.number().min(0).max(100).optional(),
})

export type ValidatorRequirements = z.infer<typeof ValidatorRequirementsSchema>

// Worker Requirements
export const WorkerRequirementsSchema = z.object({
  must_be_active: z.boolean().default(true),
  min_jobs_completed: z.number().int().min(0).optional(),
  min_success_rate: z.number().min(0).max(100).optional(),
})

export type WorkerRequirements = z.infer<typeof WorkerRequirementsSchema>

// Unified Requirements Schema (discriminated union)
export const RequirementsSchema = z.union([
  TokenBalanceRequirementsSchema,
  StakedAmountRequirementsSchema,
  ReputationRequirementsSchema,
  ValidatorRequirementsSchema,
  WorkerRequirementsSchema,
])

export type Requirements = z.infer<typeof RequirementsSchema>

// ============================================================
// TOKEN-GATING RULE SCHEMAS
// ============================================================

// Base Rule Schema (for database)
export const TokenGatingRuleSchema = z.object({
  id: z.number().int().positive(),
  guild_id: z.string().min(1),
  rule_name: z.string().min(1, "Rule name is required").max(100),
  description: z.string().max(500).nullable().optional(),
  rule_type: RuleTypeEnum,
  requirements: z.record(z.any()), // JSONB - will be validated separately
  privacy_enabled: z.boolean().default(false),
  require_zk_proof: z.boolean().default(false),
  allow_stealth_address: z.boolean().default(false),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(0),
  created_by: z.string().nullable().optional(),
  created_at: z.string().or(z.date()).optional(),
  updated_at: z.string().or(z.date()).optional(),
})

export type TokenGatingRule = z.infer<typeof TokenGatingRuleSchema>

// Create Rule Schema (API input)
export const CreateTokenGatingRuleSchema = z.object({
  rule_name: z.string().min(1, "Rule name is required").max(100),
  description: z.string().max(500).optional(),
  rule_type: RuleTypeEnum,
  requirements: z.record(z.any()), // Will be validated based on rule_type
  privacy_enabled: z.boolean().default(false),
  require_zk_proof: z.boolean().default(false),
  allow_stealth_address: z.boolean().default(false),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
  roles: z.array(z.object({
    role_id: z.string().min(1),
    role_name: z.string().min(1),
    auto_assign: z.boolean().default(true),
    auto_remove: z.boolean().default(true),
  })).min(1, "At least one role is required"),
})

export type CreateTokenGatingRuleInput = z.infer<typeof CreateTokenGatingRuleSchema>

// Update Rule Schema (API input - partial)
export const UpdateTokenGatingRuleSchema = z.object({
  rule_name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  requirements: z.record(z.any()).optional(),
  privacy_enabled: z.boolean().optional(),
  require_zk_proof: z.boolean().optional(),
  allow_stealth_address: z.boolean().optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  roles: z.array(z.object({
    role_id: z.string().min(1),
    role_name: z.string().min(1),
    auto_assign: z.boolean().default(true),
    auto_remove: z.boolean().default(true),
  })).optional(),
})

export type UpdateTokenGatingRuleInput = z.infer<typeof UpdateTokenGatingRuleSchema>

// ============================================================
// ROLE MAPPING SCHEMAS
// ============================================================

export const RoleMappingSchema = z.object({
  id: z.number().int().positive(),
  guild_id: z.string().min(1),
  rule_id: z.number().int().positive(),
  role_id: z.string().min(1),
  role_name: z.string().min(1),
  auto_assign: z.boolean().default(true),
  auto_remove: z.boolean().default(true),
  recheck_interval: z.number().int().positive().default(3600), // seconds
  last_recheck: z.string().or(z.date()).nullable().optional(),
  created_at: z.string().or(z.date()).optional(),
})

export type RoleMapping = z.infer<typeof RoleMappingSchema>

// ============================================================
// DISCORD ROLE SCHEMA
// ============================================================

export const DiscordRoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.number(),
  position: z.number(),
  managed: z.boolean(),
  mentionable: z.boolean(),
})

export type DiscordRole = z.infer<typeof DiscordRoleSchema>

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Validates requirements based on rule type
 */
export function validateRequirements(ruleType: RuleType, requirements: any): boolean {
  try {
    switch (ruleType) {
      case "token_balance":
        TokenBalanceRequirementsSchema.parse(requirements)
        return true
      case "staked_amount":
        StakedAmountRequirementsSchema.parse(requirements)
        return true
      case "reputation":
        ReputationRequirementsSchema.parse(requirements)
        return true
      case "validator":
        ValidatorRequirementsSchema.parse(requirements)
        return true
      case "worker":
        WorkerRequirementsSchema.parse(requirements)
        return true
      default:
        return false
    }
  } catch (error) {
    return false
  }
}

/**
 * Get requirements schema for a specific rule type
 */
export function getRequirementsSchema(ruleType: RuleType) {
  switch (ruleType) {
    case "token_balance":
      return TokenBalanceRequirementsSchema
    case "staked_amount":
      return StakedAmountRequirementsSchema
    case "reputation":
      return ReputationRequirementsSchema
    case "validator":
      return ValidatorRequirementsSchema
    case "worker":
      return WorkerRequirementsSchema
    default:
      throw new Error(`Unknown rule type: ${ruleType}`)
  }
}

/**
 * Get default requirements for a rule type
 */
export function getDefaultRequirements(ruleType: RuleType): Requirements {
  switch (ruleType) {
    case "token_balance":
      return { min_balance: "1000", include_staked: false }
    case "staked_amount":
      return { min_staked: "1000", include_rewards: false }
    case "reputation":
      return { min_reputation: 100 }
    case "validator":
      return { must_be_active: true }
    case "worker":
      return { must_be_active: true }
  }
}

/**
 * Get friendly display name for rule type
 */
export function getRuleTypeDisplayName(ruleType: RuleType): string {
  switch (ruleType) {
    case "token_balance":
      return "Token Balance"
    case "staked_amount":
      return "Staked Amount"
    case "reputation":
      return "Reputation Score"
    case "validator":
      return "Active Validator"
    case "worker":
      return "Active Worker"
  }
}

/**
 * Get description for rule type
 */
export function getRuleTypeDescription(ruleType: RuleType): string {
  switch (ruleType) {
    case "token_balance":
      return "Require users to hold a minimum amount of tokens"
    case "staked_amount":
      return "Require users to have tokens staked for a minimum duration"
    case "reputation":
      return "Require users to have a minimum reputation score or level"
    case "validator":
      return "Require users to be active validators on the network"
    case "worker":
      return "Require users to be active worker nodes"
  }
}

// ============================================================
// REWARD CAMPAIGN SCHEMAS
// ============================================================

export const RewardTypeEnum = z.enum([
  "role",           // Phase 1: Discord role(s)
  "xp",             // Phase 1: XP/Points
  "access_grant",   // Phase 1: Channel access
  "nft",            // Phase 2: NFT minting
  "poap",           // Phase 2: POAP distribution
  "webhook",        // Phase 2: Custom webhooks
])

export type RewardType = z.infer<typeof RewardTypeEnum>

export const TriggerTypeEnum = z.enum([
  "manual",      // User claims via /reward claim
  "rule_pass",   // Auto-trigger when user passes rule
  "scheduled",   // Cron-based delivery
])

export type TriggerType = z.infer<typeof TriggerTypeEnum>

// Create Reward Campaign Schema
export const CreateRewardCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required").max(200),
  description: z.string().max(500).optional(),
  reward_type: RewardTypeEnum,
  reward_config: z.record(z.any()), // Type-specific config (role_ids, xp_amount, etc.)
  trigger_type: TriggerTypeEnum,
  trigger_config: z.record(z.any()).optional(),
  auto_claim: z.boolean().default(false),
  rule_group_id: z.string().uuid().optional().nullable(),
  eligibility_requirements: z.record(z.any()).optional(),
  max_claims: z.number().int().positive().optional().nullable(),
  cooldown_hours: z.number().int().min(0).default(0),
  start_date: z.string().datetime().optional().nullable(),
  end_date: z.string().datetime().optional().nullable(),
})

export type CreateRewardCampaign = z.infer<typeof CreateRewardCampaignSchema>

// Update Reward Campaign Schema (all fields optional)
export const UpdateRewardCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  reward_type: RewardTypeEnum.optional(),
  reward_config: z.record(z.any()).optional(),
  trigger_type: TriggerTypeEnum.optional(),
  trigger_config: z.record(z.any()).optional(),
  auto_claim: z.boolean().optional(),
  rule_group_id: z.string().uuid().optional().nullable(),
  eligibility_requirements: z.record(z.any()).optional(),
  max_claims: z.number().int().positive().optional().nullable(),
  cooldown_hours: z.number().int().min(0).optional(),
  start_date: z.string().datetime().optional().nullable(),
  end_date: z.string().datetime().optional().nullable(),
  status: z.enum(["active", "paused", "ended", "draft"]).optional(),
})

export type UpdateRewardCampaign = z.infer<typeof UpdateRewardCampaignSchema>

/**
 * Get description for reward type
 */
export function getRewardTypeDescription(rewardType: RewardType): string {
  switch (rewardType) {
    case "role":
      return "Assign Discord role(s) to users"
    case "xp":
      return "Award XP/Points to boost user progression"
    case "access_grant":
      return "Grant temporary or permanent channel access"
    case "nft":
      return "Mint NFT to user's wallet"
    case "poap":
      return "Distribute POAP badge for participation"
    case "webhook":
      return "Trigger custom webhook with user data"
  }
}

/**
 * Get description for trigger type
 */
export function getTriggerTypeDescription(triggerType: TriggerType): string {
  switch (triggerType) {
    case "manual":
      return "Users must manually claim via /reward claim"
    case "rule_pass":
      return "Automatically triggered when user passes requirements"
    case "scheduled":
      return "Delivered at specific times (cron schedule)"
  }
}
