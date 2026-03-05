-- Migration 009: Reward Management System - Phase 2
-- Adds support for NFT Minting, Custom POAPs, and Webhooks
-- Extends Phase 1 with blockchain and external integration capabilities

-- ============================================================
-- 1. POAP CONTRACT TRACKING
-- ============================================================

-- Track deployed POAP contracts (one per campaign)
CREATE TABLE IF NOT EXISTS reward_poap_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
    contract_address VARCHAR(66) NOT NULL, -- Starknet address (0x...)
    contract_name VARCHAR(200) NOT NULL,
    contract_symbol VARCHAR(20) NOT NULL,
    is_soulbound BOOLEAN DEFAULT false,
    total_supply INTEGER DEFAULT 0,
    max_supply INTEGER,
    deployed_at TIMESTAMP DEFAULT NOW(),
    deployed_by VARCHAR(20), -- Discord user ID who created campaign
    deployment_tx_hash VARCHAR(66), -- Transaction hash of deployment
    metadata_uri TEXT, -- IPFS or HTTP URL for metadata
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_poap_contracts_campaign
    ON reward_poap_contracts(campaign_id);

CREATE INDEX IF NOT EXISTS idx_poap_contracts_address
    ON reward_poap_contracts(contract_address);

COMMENT ON TABLE reward_poap_contracts IS
    'Tracks custom ERC721 contracts deployed for POAP campaigns';
COMMENT ON COLUMN reward_poap_contracts.is_soulbound IS
    'If true, tokens cannot be transferred (except mint/burn)';
COMMENT ON COLUMN reward_poap_contracts.metadata_uri IS
    'Base URI for token metadata (e.g., ipfs://Qm.../metadata/)';

-- ============================================================
-- 2. NFT MINTING TRACKING
-- ============================================================

-- Track minted NFTs (for both external contracts and POAPs)
CREATE TABLE IF NOT EXISTS reward_nft_mints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES reward_claims(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
    discord_user_id VARCHAR(20) NOT NULL,
    wallet_address VARCHAR(66) NOT NULL, -- Recipient Starknet address
    contract_address VARCHAR(66) NOT NULL, -- NFT contract address
    token_id VARCHAR(100) NOT NULL, -- Token ID (can be large number)
    tx_hash VARCHAR(66), -- Minting transaction hash
    minted_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}', -- Token metadata (name, image, attributes)
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nft_mints_claim
    ON reward_nft_mints(claim_id);

CREATE INDEX IF NOT EXISTS idx_nft_mints_user
    ON reward_nft_mints(discord_user_id);

CREATE INDEX IF NOT EXISTS idx_nft_mints_contract_token
    ON reward_nft_mints(contract_address, token_id);

COMMENT ON TABLE reward_nft_mints IS
    'Tracks all NFT mints (both external contracts and POAPs)';
COMMENT ON COLUMN reward_nft_mints.token_id IS
    'String to support large numbers (Cairo felt252 max)';

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

CREATE INDEX IF NOT EXISTS idx_webhook_logs_campaign_success
    ON reward_webhook_logs(campaign_id, success);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_created
    ON reward_webhook_logs(created_at DESC);

COMMENT ON TABLE reward_webhook_logs IS
    'Audit log for all webhook calls (success and failures)';
COMMENT ON COLUMN reward_webhook_logs.response_time_ms IS
    'Time taken for webhook to respond (for monitoring)';

-- ============================================================
-- 4. WEBHOOK RATE LIMITING
-- ============================================================

-- Track webhook call rates per campaign
CREATE TABLE IF NOT EXISTS reward_webhook_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
    window_start TIMESTAMP NOT NULL,
    window_end TIMESTAMP NOT NULL,
    call_count INTEGER DEFAULT 0,
    max_calls_per_window INTEGER DEFAULT 100, -- Default: 100 calls per window
    window_duration_minutes INTEGER DEFAULT 60, -- Default: 1 hour window
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_campaign_window
    ON reward_webhook_rate_limits(campaign_id, window_end DESC);

COMMENT ON TABLE reward_webhook_rate_limits IS
    'Rate limiting for webhook campaigns (prevents abuse)';
COMMENT ON COLUMN reward_webhook_rate_limits.window_duration_minutes IS
    'Rolling window duration (e.g., 60 = hourly limit)';

-- ============================================================
-- 5. EXTEND REWARD TYPES ENUM (via constraint update)
-- ============================================================

-- Update reward_type constraint to include Phase 2 types
-- Note: PostgreSQL doesn't support ALTER TYPE for CHECK constraints,
-- so we drop and recreate if it exists

DO $$
BEGIN
    -- Drop existing constraint if exists
    ALTER TABLE reward_campaigns DROP CONSTRAINT IF EXISTS reward_campaigns_reward_type_check;

    -- Add new constraint with Phase 2 types
    ALTER TABLE reward_campaigns
        ADD CONSTRAINT reward_campaigns_reward_type_check
        CHECK (reward_type IN ('role', 'xp', 'access_grant', 'nft', 'poap', 'webhook'));
END $$;

-- Update comment with Phase 2 types
COMMENT ON COLUMN reward_campaigns.reward_type IS
    'Phase 1: role, xp, access_grant | Phase 2: nft, poap, webhook';

-- ============================================================
-- 6. UPDATE REWARD_CONFIG EXAMPLES (via comments)
-- ============================================================

-- Document expected reward_config structures for new types
COMMENT ON COLUMN reward_campaigns.reward_config IS
    'Type-specific configuration (JSONB):
    - role: {role_ids: ["123", "456"]}
    - xp: {xp_amount: 500}
    - access_grant: {channel_ids: ["123"], duration_hours: 24}
    - nft: {contract_address: "0x...", token_id_start: 1, token_id_end: 1000, auto_increment: true}
    - poap: {name: "Event Name", symbol: "EVENT", is_soulbound: true, image_url: "ipfs://..."}
    - webhook: {url: "https://...", method: "POST", headers: {...}, hmac_secret: "...", rate_limit: 100}';

-- ============================================================
-- 7. ADD STARKNET WALLET TRACKING
-- ============================================================

-- Extend discord_users to track Starknet wallet (if not already exists)
ALTER TABLE discord_users
    ADD COLUMN IF NOT EXISTS starknet_address VARCHAR(66),
    ADD COLUMN IF NOT EXISTS wallet_verified_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_discord_users_starknet
    ON discord_users(starknet_address)
    WHERE starknet_address IS NOT NULL;

COMMENT ON COLUMN discord_users.starknet_address IS
    'Verified Starknet wallet address for NFT/POAP rewards';

-- ============================================================
-- 8. ANALYTICS EVENTS FOR PHASE 2
-- ============================================================

-- Add event types for tracking (via comments)
COMMENT ON TABLE analytics_events IS
    'Event types include: reward_campaign_created, reward_campaign_updated, reward_claimed,
    reward_nft_minted, reward_poap_deployed, reward_webhook_called, reward_delivery_failed';

-- ============================================================
-- 9. SECURITY: HMAC SECRET STORAGE
-- ============================================================

-- Table to store webhook HMAC secrets securely (encrypted at rest)
CREATE TABLE IF NOT EXISTS reward_webhook_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES reward_campaigns(id) ON DELETE CASCADE,
    secret_hash VARCHAR(128) NOT NULL, -- bcrypt hash of HMAC secret
    secret_hint VARCHAR(50), -- Last 4 chars for admin reference
    created_at TIMESTAMP DEFAULT NOW(),
    rotated_at TIMESTAMP,
    UNIQUE(campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_secrets_campaign
    ON reward_webhook_secrets(campaign_id);

COMMENT ON TABLE reward_webhook_secrets IS
    'Stores HMAC secrets for webhook authentication (hashed for security)';
COMMENT ON COLUMN reward_webhook_secrets.secret_hint IS
    'Last 4 characters of secret for admin identification';

-- ============================================================
-- 10. GRANT PERMISSIONS
-- ============================================================

-- Grant permissions to application user (adjust username as needed)
-- GRANT ALL ON reward_poap_contracts TO bitsage;
-- GRANT ALL ON reward_nft_mints TO bitsage;
-- GRANT ALL ON reward_webhook_logs TO bitsage;
-- GRANT ALL ON reward_webhook_rate_limits TO bitsage;
-- GRANT ALL ON reward_webhook_secrets TO bitsage;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 009 complete: Reward Phase 2 (NFT, POAP, Webhook) installed';
    RAISE NOTICE 'New tables: reward_poap_contracts, reward_nft_mints, reward_webhook_logs, reward_webhook_rate_limits, reward_webhook_secrets';
    RAISE NOTICE 'New reward types: nft, poap, webhook';
END $$;
