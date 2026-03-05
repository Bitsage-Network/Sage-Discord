-- Migration 009: Reward Management System - Phase 2
-- Adds support for NFT Minting and Webhooks
-- Leverages existing BitSage Starknet contracts (achievement_nft.cairo)
-- Does NOT deploy new contracts - reuses existing infrastructure

-- ============================================================
-- 1. NFT CONTRACT CONFIGURATION
-- ============================================================

-- Track NFT contract configurations for campaigns
-- Supports:
-- 1. BitSage achievement_nft.cairo (soulbound POAPs)
-- 2. Any external ERC721 contract (transferable NFTs)
CREATE TABLE IF NOT EXISTS reward_nft_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
    contract_address VARCHAR(66) NOT NULL, -- Starknet ERC721 contract address
    contract_type VARCHAR(50) DEFAULT 'external'
        CHECK (contract_type IN ('achievement_nft', 'external')),
    achievement_type SMALLINT, -- For achievement_nft: 100+ for Discord rewards
    token_id_counter INTEGER DEFAULT 0, -- Auto-increment for minting
    token_id_start INTEGER, -- Range start (optional)
    token_id_end INTEGER, -- Range end (optional)
    metadata_uri TEXT, -- Token metadata URI or base URI
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_nft_configs_campaign
    ON reward_nft_configs(campaign_id);

CREATE INDEX IF NOT EXISTS idx_nft_configs_contract
    ON reward_nft_configs(contract_address);

COMMENT ON TABLE reward_nft_configs IS
    'NFT configuration per campaign - uses existing Starknet contracts';
COMMENT ON COLUMN reward_nft_configs.contract_type IS
    'achievement_nft: Uses BitSage achievement_nft.cairo (soulbound, types 100+) | external: Any ERC721 with admin minter access';
COMMENT ON COLUMN reward_nft_configs.achievement_type IS
    'For achievement_nft: 100-199 Discord rewards, 200+ custom events';
COMMENT ON COLUMN reward_nft_configs.token_id_counter IS
    'Auto-incremented for each mint (for external contracts)';

-- ============================================================
-- 2. NFT MINT TRACKING
-- ============================================================

-- Track all NFT mints (both achievement_nft and external contracts)
CREATE TABLE IF NOT EXISTS reward_nft_mints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES reward_claims(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
    discord_user_id VARCHAR(20) NOT NULL,
    wallet_address VARCHAR(66) NOT NULL, -- Recipient Starknet wallet
    contract_address VARCHAR(66) NOT NULL, -- NFT contract address
    token_id VARCHAR(100) NOT NULL, -- Token ID (string for large numbers)
    tx_hash VARCHAR(66), -- Minting transaction hash
    minted_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}', -- Token metadata snapshot
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_mints_claim
    ON reward_nft_mints(claim_id);

CREATE INDEX IF NOT EXISTS idx_nft_mints_user
    ON reward_nft_mints(discord_user_id);

CREATE INDEX IF NOT EXISTS idx_nft_mints_wallet
    ON reward_nft_mints(wallet_address);

CREATE INDEX IF NOT EXISTS idx_nft_mints_contract_token
    ON reward_nft_mints(contract_address, token_id);

COMMENT ON TABLE reward_nft_mints IS
    'Audit log of all NFT mints across all campaigns';
COMMENT ON COLUMN reward_nft_mints.token_id IS
    'String to support large numbers (Cairo felt252 max: 2^251)';

-- ============================================================
-- 3. WEBHOOK DELIVERY LOGS
-- ============================================================

-- Track webhook calls for audit and debugging
CREATE TABLE IF NOT EXISTS reward_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES reward_claims(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
    discord_user_id VARCHAR(20) NOT NULL,
    webhook_url TEXT NOT NULL,
    request_method VARCHAR(10) DEFAULT 'POST',
    request_headers JSONB DEFAULT '{}',
    request_payload JSONB DEFAULT '{}',
    response_status INTEGER,
    response_body TEXT,
    response_time_ms INTEGER, -- Response time in milliseconds
    success BOOLEAN DEFAULT false,
    error_message TEXT,
    retries INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_claim
    ON reward_webhook_logs(claim_id);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_campaign
    ON reward_webhook_logs(campaign_id);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_success
    ON reward_webhook_logs(campaign_id, success);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created
    ON reward_webhook_logs(created_at DESC);

COMMENT ON TABLE reward_webhook_logs IS
    'Audit log for all webhook calls (success and failures)';
COMMENT ON COLUMN reward_webhook_logs.response_time_ms IS
    'Time taken for webhook to respond (for monitoring)';
COMMENT ON COLUMN reward_webhook_logs.request_headers IS
    'Headers sent (excluding sensitive Authorization)';

-- ============================================================
-- 4. WEBHOOK RATE LIMITING
-- ============================================================

-- Track webhook call rates per campaign (prevent abuse)
CREATE TABLE IF NOT EXISTS reward_webhook_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
    window_start TIMESTAMP NOT NULL,
    window_end TIMESTAMP NOT NULL,
    call_count INTEGER DEFAULT 0,
    max_calls_per_window INTEGER DEFAULT 100,
    window_duration_minutes INTEGER DEFAULT 60, -- 1 hour window
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_campaign_window
    ON reward_webhook_rate_limits(campaign_id, window_end DESC);

COMMENT ON TABLE reward_webhook_rate_limits IS
    'Rate limiting for webhook campaigns (rolling window)';
COMMENT ON COLUMN reward_webhook_rate_limits.max_calls_per_window IS
    'Default: 100 calls per hour (adjustable per campaign)';

-- ============================================================
-- 5. WEBHOOK HMAC SECRETS
-- ============================================================

-- Store HMAC secrets for webhook authentication
-- Secrets are hashed (bcrypt) and never stored in plaintext
CREATE TABLE IF NOT EXISTS reward_webhook_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
    secret_hash VARCHAR(128) NOT NULL, -- bcrypt hash of HMAC secret
    secret_hint VARCHAR(8), -- First 4 chars for admin reference
    algorithm VARCHAR(20) DEFAULT 'sha256', -- HMAC algorithm
    created_at TIMESTAMP DEFAULT NOW(),
    rotated_at TIMESTAMP,
    UNIQUE(campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_secrets_campaign
    ON reward_webhook_secrets(campaign_id);

COMMENT ON TABLE reward_webhook_secrets IS
    'Stores HMAC secrets for webhook authentication (hashed)';
COMMENT ON COLUMN reward_webhook_secrets.secret_hint IS
    'First 4 characters of secret for admin identification (not security)';

-- ============================================================
-- 6. EXTEND REWARD TYPES
-- ============================================================

-- Update reward_type constraint to include Phase 2 types
DO $$
BEGIN
    -- Drop existing constraint if exists
    ALTER TABLE reward_campaigns DROP CONSTRAINT IF EXISTS reward_campaigns_reward_type_check;

    -- Add new constraint with Phase 2 types
    ALTER TABLE reward_campaigns
        ADD CONSTRAINT reward_campaigns_reward_type_check
        CHECK (reward_type IN ('role', 'xp', 'access_grant', 'nft', 'poap', 'webhook'));
END $$;

-- Update comments
COMMENT ON COLUMN reward_campaigns.reward_type IS
    'Phase 1: role, xp, access_grant | Phase 2: nft (transferable), poap (soulbound), webhook';

-- ============================================================
-- 7. UPDATE REWARD_CONFIG DOCUMENTATION
-- ============================================================

COMMENT ON COLUMN reward_campaigns.reward_config IS
    'Type-specific configuration (JSONB):
    - role: {role_ids: ["123", "456"]}
    - xp: {xp_amount: 500}
    - access_grant: {channel_ids: ["123"], duration_hours: 24}
    - nft: {contract_address: "0x...", metadata_uri: "ipfs://...", auto_increment: true}
    - poap: {contract_address: "0x...", achievement_type: 100, metadata_uri: "ipfs://..."}
    - webhook: {url: "https://...", method: "POST", headers: {...}, use_hmac: true, rate_limit: 100}';

-- ============================================================
-- 8. STARKNET WALLET TRACKING
-- ============================================================

-- Extend discord_users to track verified Starknet wallet
ALTER TABLE discord_users
    ADD COLUMN IF NOT EXISTS starknet_address VARCHAR(66),
    ADD COLUMN IF NOT EXISTS wallet_verified_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_discord_users_starknet
    ON discord_users(starknet_address)
    WHERE starknet_address IS NOT NULL;

COMMENT ON COLUMN discord_users.starknet_address IS
    'Verified Starknet wallet address for NFT/POAP rewards (from /verify command)';

-- ============================================================
-- 9. ANALYTICS EVENTS
-- ============================================================

COMMENT ON TABLE analytics_events IS
    'Event types: reward_campaign_created, reward_campaign_updated, reward_claimed,
    reward_nft_minted, reward_poap_minted, reward_webhook_called, reward_delivery_failed';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE 'Migration 009 complete: Reward Phase 2 (NFT, POAP, Webhook)';
    RAISE NOTICE 'New tables: reward_nft_configs, reward_nft_mints, reward_webhook_logs, reward_webhook_rate_limits, reward_webhook_secrets';
    RAISE NOTICE 'New reward types: nft (transferable), poap (soulbound via achievement_nft.cairo), webhook';
    RAISE NOTICE 'Leverages existing BitSage Starknet contracts - no new deployments needed';
    RAISE NOTICE 'Achievement types 100+ reserved for Discord rewards in achievement_nft.cairo';
END $$;
