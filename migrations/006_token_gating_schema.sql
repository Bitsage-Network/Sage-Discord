-- Migration 006: Token-Gating System Schema
-- Date: 2026-01-02
-- Description: Complete database schema for Starknet-native token-gating with privacy features

-- ============================================================
-- WALLET VERIFICATIONS (Core Table)
-- ============================================================

CREATE TABLE IF NOT EXISTS wallet_verifications (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    verification_method TEXT NOT NULL CHECK (verification_method IN ('signature', 'stealth', 'zk_proof')),

    -- Standard signature verification
    signature TEXT,
    message TEXT,
    signed_at TIMESTAMPTZ,

    -- Stealth address verification
    stealth_meta_address TEXT,
    viewing_key_hash TEXT,

    -- ZK proof verification
    proof_data JSONB,
    proof_verified BOOLEAN DEFAULT FALSE,

    -- Verification status
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id, wallet_address)
);

-- Indexes for wallet_verifications
CREATE INDEX IF NOT EXISTS idx_wallet_verifications_user
    ON wallet_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_verifications_wallet
    ON wallet_verifications(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_verifications_verified
    ON wallet_verifications(verified) WHERE verified = TRUE;

COMMENT ON TABLE wallet_verifications IS 'Stores wallet ownership verifications for Discord users';
COMMENT ON COLUMN wallet_verifications.verification_method IS 'signature (standard), stealth (anonymous), zk_proof (privacy-preserving)';

-- ============================================================
-- TOKEN-GATING RULES
-- ============================================================

CREATE TABLE IF NOT EXISTS token_gating_rules (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    description TEXT,

    -- Rule type and requirements
    rule_type TEXT NOT NULL CHECK (rule_type IN ('token_balance', 'staked_amount', 'reputation', 'validator', 'worker')),
    requirements JSONB NOT NULL,

    -- Privacy settings
    privacy_enabled BOOLEAN DEFAULT FALSE,
    require_zk_proof BOOLEAN DEFAULT FALSE,
    allow_stealth_address BOOLEAN DEFAULT FALSE,

    -- Rule status
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,

    -- Audit
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for token_gating_rules
CREATE INDEX IF NOT EXISTS idx_token_gating_rules_guild
    ON token_gating_rules(guild_id);
CREATE INDEX IF NOT EXISTS idx_token_gating_rules_enabled
    ON token_gating_rules(enabled, priority DESC) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_token_gating_rules_type
    ON token_gating_rules(rule_type);

COMMENT ON TABLE token_gating_rules IS 'Defines token-gating rules for role assignment';
COMMENT ON COLUMN token_gating_rules.requirements IS 'JSON object with rule-specific requirements (e.g., {"min_balance": "1000", "include_staked": true})';

-- ============================================================
-- ROLE MAPPINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS role_mappings (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    rule_id INTEGER NOT NULL REFERENCES token_gating_rules(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,

    -- Auto-assignment settings
    auto_assign BOOLEAN DEFAULT TRUE,
    auto_remove BOOLEAN DEFAULT TRUE,
    recheck_interval INTEGER DEFAULT 3600, -- seconds
    last_recheck TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    UNIQUE(rule_id, role_id)
);

-- Indexes for role_mappings
CREATE INDEX IF NOT EXISTS idx_role_mappings_guild
    ON role_mappings(guild_id);
CREATE INDEX IF NOT EXISTS idx_role_mappings_rule
    ON role_mappings(rule_id);
CREATE INDEX IF NOT EXISTS idx_role_mappings_recheck
    ON role_mappings(last_recheck) WHERE auto_assign = TRUE OR auto_remove = TRUE;

COMMENT ON TABLE role_mappings IS 'Maps token-gating rules to Discord roles';

-- ============================================================
-- VERIFICATION SESSIONS (Web Wallet Flow)
-- ============================================================

CREATE TABLE IF NOT EXISTS verification_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,

    -- Session state
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'signed', 'verified', 'expired', 'failed')),
    verification_method TEXT NOT NULL,

    -- Challenge data
    challenge_message TEXT NOT NULL,
    challenge_nonce TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    callback_url TEXT,

    -- Response data
    wallet_address TEXT,
    signature TEXT,
    stealth_meta_address TEXT,
    zk_proof_data JSONB,

    -- Timestamps
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for verification_sessions
CREATE INDEX IF NOT EXISTS idx_verification_sessions_token
    ON verification_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_user
    ON verification_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_state
    ON verification_sessions(state, expires_at);

COMMENT ON TABLE verification_sessions IS 'Temporary sessions for web-based wallet verification';

-- ============================================================
-- ZK PROOF NULLIFIERS (Prevent Replay Attacks)
-- ============================================================

CREATE TABLE IF NOT EXISTS zk_proof_nullifiers (
    nullifier TEXT PRIMARY KEY,
    discord_id TEXT NOT NULL,
    starknet_address TEXT NOT NULL,
    threshold NUMERIC NOT NULL,

    -- Proof data
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    proof_data JSONB NOT NULL
);

-- Indexes for zk_proof_nullifiers
CREATE INDEX IF NOT EXISTS idx_zk_nullifiers_discord
    ON zk_proof_nullifiers(discord_id);
CREATE INDEX IF NOT EXISTS idx_zk_nullifiers_expires
    ON zk_proof_nullifiers(expires_at);

COMMENT ON TABLE zk_proof_nullifiers IS 'Prevents replay attacks on ZK proofs by tracking used nullifiers';

-- ============================================================
-- STEALTH ADDRESSES
-- ============================================================

CREATE TABLE IF NOT EXISTS stealth_addresses (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,

    -- Stealth address data
    stealth_meta_address TEXT NOT NULL UNIQUE,
    spending_pubkey TEXT NOT NULL,
    viewing_pubkey TEXT NOT NULL,

    -- Usage tracking
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for stealth_addresses
CREATE INDEX IF NOT EXISTS idx_stealth_addresses_user
    ON stealth_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_stealth_addresses_meta
    ON stealth_addresses(stealth_meta_address);

COMMENT ON TABLE stealth_addresses IS 'Stores user stealth addresses for privacy-preserving verification';

-- ============================================================
-- AUDITOR PERMISSIONS (Compliance)
-- ============================================================

CREATE TABLE IF NOT EXISTS auditor_permissions (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,

    -- Auditor info
    auditor_name TEXT NOT NULL,
    auditor_contact TEXT,
    auditor_pubkey TEXT NOT NULL UNIQUE,

    -- Permissions
    can_decrypt_balances BOOLEAN DEFAULT TRUE,
    can_view_addresses BOOLEAN DEFAULT FALSE,
    max_decrypt_per_day INTEGER DEFAULT 100,
    decrypts_today INTEGER DEFAULT 0,
    last_decrypt_reset TIMESTAMPTZ DEFAULT NOW(),

    -- Status
    enabled BOOLEAN DEFAULT TRUE,

    -- Audit trail
    granted_by TEXT NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for auditor_permissions
CREATE INDEX IF NOT EXISTS idx_auditor_permissions_guild
    ON auditor_permissions(guild_id);
CREATE INDEX IF NOT EXISTS idx_auditor_permissions_enabled
    ON auditor_permissions(enabled) WHERE enabled = TRUE;

COMMENT ON TABLE auditor_permissions IS 'Manages compliance auditor access to encrypted balance data';

-- ============================================================
-- AUDITOR DECRYPT LOG (Compliance Audit Trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS auditor_decrypt_log (
    id SERIAL PRIMARY KEY,
    auditor_id INTEGER NOT NULL REFERENCES auditor_permissions(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES discord_users(user_id) ON DELETE SET NULL,

    -- Decryption data
    encrypted_balance_hash TEXT NOT NULL,
    decrypted_amount TEXT NOT NULL,
    reason TEXT,

    decrypted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for auditor_decrypt_log
CREATE INDEX IF NOT EXISTS idx_auditor_decrypt_log_auditor
    ON auditor_decrypt_log(auditor_id);
CREATE INDEX IF NOT EXISTS idx_auditor_decrypt_log_user
    ON auditor_decrypt_log(user_id);
CREATE INDEX IF NOT EXISTS idx_auditor_decrypt_log_time
    ON auditor_decrypt_log(decrypted_at);

COMMENT ON TABLE auditor_decrypt_log IS 'Audit trail of all balance decryptions by compliance auditors';

-- ============================================================
-- USER RULE CACHE (Performance Optimization)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_rule_cache (
    user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
    rule_id INTEGER NOT NULL REFERENCES token_gating_rules(id) ON DELETE CASCADE,

    -- Cache data
    passes_rule BOOLEAN NOT NULL,
    cached_balance TEXT,
    cached_stake TEXT,
    cached_reputation INTEGER,

    -- Cache metadata
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (user_id, rule_id)
);

-- Indexes for user_rule_cache
CREATE INDEX IF NOT EXISTS idx_user_rule_cache_expires
    ON user_rule_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_rule_cache_user
    ON user_rule_cache(user_id);

COMMENT ON TABLE user_rule_cache IS 'Caches rule evaluation results to avoid excessive RPC calls';

-- ============================================================
-- BALANCE CACHE (3-Tier Caching)
-- ============================================================

CREATE TABLE IF NOT EXISTS balance_cache (
    starknet_address TEXT NOT NULL,
    token_address TEXT NOT NULL,

    -- Cached balance
    balance NUMERIC NOT NULL,

    -- Cache metadata
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (starknet_address, token_address)
);

-- Indexes for balance_cache
CREATE INDEX IF NOT EXISTS idx_balance_cache_expires
    ON balance_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_balance_cache_address
    ON balance_cache(starknet_address);

COMMENT ON TABLE balance_cache IS 'Caches on-chain balance queries to reduce RPC load';

-- ============================================================
-- CLEANUP FUNCTION (Auto-Delete Expired Data)
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_token_gating_data()
RETURNS void AS $$
BEGIN
    -- Delete expired sessions (30 days)
    DELETE FROM verification_sessions
    WHERE expires_at < NOW() - INTERVAL '30 days';

    -- Delete expired ZK proof nullifiers
    DELETE FROM zk_proof_nullifiers
    WHERE expires_at < NOW();

    -- Delete expired balance cache
    DELETE FROM balance_cache
    WHERE expires_at < NOW();

    -- Delete expired user rule cache
    DELETE FROM user_rule_cache
    WHERE expires_at < NOW();

    -- Reset auditor daily decrypt counters
    UPDATE auditor_permissions
    SET decrypts_today = 0, last_decrypt_reset = NOW()
    WHERE last_decrypt_reset < NOW() - INTERVAL '1 day';

END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_token_gating_data() IS 'Automatically cleans up expired token-gating data';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

-- Insert migration record
INSERT INTO schema_migrations (version, description, applied_at)
VALUES (
    '006',
    'Token-Gating System Schema',
    NOW()
) ON CONFLICT (version) DO NOTHING;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration 006 Complete: Token-Gating System Schema';
    RAISE NOTICE '   - 10 tables created';
    RAISE NOTICE '   - 23 indexes created';
    RAISE NOTICE '   - 1 cleanup function created';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Tables:';
    RAISE NOTICE '   1. wallet_verifications (signature, stealth, ZK proof)';
    RAISE NOTICE '   2. token_gating_rules (balance, stake, reputation, validator, worker)';
    RAISE NOTICE '   3. role_mappings (auto-assign/remove)';
    RAISE NOTICE '   4. verification_sessions (web wallet flow)';
    RAISE NOTICE '   5. zk_proof_nullifiers (replay prevention)';
    RAISE NOTICE '   6. stealth_addresses (privacy)';
    RAISE NOTICE '   7. auditor_permissions (compliance)';
    RAISE NOTICE '   8. auditor_decrypt_log (audit trail)';
    RAISE NOTICE '   9. user_rule_cache (performance)';
    RAISE NOTICE '   10. balance_cache (RPC optimization)';
END $$;
