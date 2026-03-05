-- ============================================================
-- BitSage Discord Token-Gating Database Schema
-- Migration: 001_token_gating_schema.sql
-- Description: Core tables for wallet verification, token-gating rules,
--              privacy features (ZK proofs, stealth addresses), and caching
-- ============================================================

-- Enable UUID extension for session IDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE: wallet_verifications
-- Purpose: Core wallet verification data for Discord users
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_verifications (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    verification_method TEXT NOT NULL CHECK (verification_method IN ('signature', 'stealth', 'zk_proof', 'legacy')),

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

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, wallet_address)
);

COMMENT ON TABLE wallet_verifications IS 'Stores wallet ownership verifications for Discord users with support for standard signatures, stealth addresses, and ZK proofs';
COMMENT ON COLUMN wallet_verifications.verification_method IS 'Method used: signature (standard), stealth (anonymous), zk_proof (privacy-preserving), legacy (migrated from old schema)';

-- ============================================================
-- TABLE: token_gating_rules
-- Purpose: Admin-configured rules for conditional role assignment
-- ============================================================
CREATE TABLE IF NOT EXISTS token_gating_rules (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    rule_name TEXT NOT NULL,
    description TEXT,

    -- Rule type determines evaluation logic
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'token_balance',    -- Minimum SAGE token balance
        'staked_amount',    -- Minimum staked SAGE
        'reputation',       -- Minimum reputation score
        'validator',        -- Active validator node
        'worker'            -- Active worker node
    )),

    -- Requirements as JSON (flexible schema per rule type)
    -- Example: {"min_balance": "1000", "include_staked": true}
    requirements JSONB NOT NULL,

    -- Privacy settings
    privacy_enabled BOOLEAN DEFAULT FALSE,
    require_zk_proof BOOLEAN DEFAULT FALSE,
    allow_stealth_address BOOLEAN DEFAULT FALSE,

    -- Rule status
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0, -- Higher priority evaluated first

    -- Metadata
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE token_gating_rules IS 'Defines conditional rules for Discord role assignment based on blockchain state';
COMMENT ON COLUMN token_gating_rules.requirements IS 'JSON object with rule-specific requirements (e.g., {"min_balance": "1000"})';
COMMENT ON COLUMN token_gating_rules.priority IS 'Higher values evaluated first; allows tiered roles (e.g., Whale > Holder)';

-- ============================================================
-- TABLE: role_mappings
-- Purpose: Maps token-gating rules to Discord roles
-- ============================================================
CREATE TABLE IF NOT EXISTS role_mappings (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    rule_id INTEGER NOT NULL REFERENCES token_gating_rules(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,

    -- Auto-assignment settings
    auto_assign BOOLEAN DEFAULT TRUE,   -- Automatically assign role when rule passes
    auto_remove BOOLEAN DEFAULT TRUE,   -- Automatically remove role when rule fails

    -- Recheck interval (seconds)
    recheck_interval INTEGER DEFAULT 3600, -- 1 hour default
    last_recheck TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(rule_id, role_id)
);

COMMENT ON TABLE role_mappings IS 'Maps token-gating rules to Discord roles with auto-assignment settings';
COMMENT ON COLUMN role_mappings.recheck_interval IS 'How often to re-evaluate user eligibility for this role (in seconds)';

-- ============================================================
-- TABLE: verification_sessions
-- Purpose: Web-based wallet verification sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS verification_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,

    -- Session state
    state TEXT NOT NULL CHECK (state IN ('pending', 'signed', 'verified', 'expired', 'failed')),
    verification_method TEXT NOT NULL CHECK (verification_method IN ('signature', 'stealth', 'zk_proof')),

    -- Challenge data
    challenge_message TEXT NOT NULL,
    challenge_nonce TEXT NOT NULL UNIQUE,
    session_token TEXT UNIQUE NOT NULL,
    callback_url TEXT,

    -- Verification data (populated during verification)
    wallet_address TEXT,
    signature TEXT,
    stealth_meta_address TEXT,
    zk_proof_data JSONB,

    -- Session metadata
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

COMMENT ON TABLE verification_sessions IS 'Temporary sessions for web-based wallet verification flow (15-minute expiry)';
COMMENT ON COLUMN verification_sessions.challenge_nonce IS 'Unique nonce to prevent replay attacks';
COMMENT ON COLUMN verification_sessions.session_token IS 'Secure token for session identification';

-- ============================================================
-- TABLE: zk_proof_nullifiers
-- Purpose: Prevent ZK proof replay attacks
-- ============================================================
CREATE TABLE IF NOT EXISTS zk_proof_nullifiers (
    nullifier TEXT PRIMARY KEY,
    discord_id TEXT NOT NULL,
    starknet_address TEXT NOT NULL,
    threshold NUMERIC NOT NULL,

    -- Proof metadata
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    proof_data JSONB NOT NULL
);

COMMENT ON TABLE zk_proof_nullifiers IS 'Tracks used ZK proof nullifiers to prevent replay attacks';
COMMENT ON COLUMN zk_proof_nullifiers.nullifier IS 'Unique nullifier derived from proof (prevents double-use)';
COMMENT ON COLUMN zk_proof_nullifiers.threshold IS 'Minimum balance threshold proven by this ZK proof';

-- ============================================================
-- TABLE: stealth_addresses
-- Purpose: User-registered stealth meta-addresses
-- ============================================================
CREATE TABLE IF NOT EXISTS stealth_addresses (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,

    -- Stealth address components
    stealth_meta_address TEXT NOT NULL UNIQUE,
    spending_pubkey TEXT NOT NULL,
    viewing_pubkey TEXT NOT NULL,

    -- Usage tracking
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE stealth_addresses IS 'User-registered stealth meta-addresses for anonymous payment verification';
COMMENT ON COLUMN stealth_addresses.stealth_meta_address IS 'Public meta-address (spending_pubkey || viewing_pubkey)';

-- ============================================================
-- TABLE: auditor_permissions
-- Purpose: Compliance auditors authorized to decrypt balances
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

    -- Rate limiting
    max_decrypt_per_day INTEGER DEFAULT 100,
    decrypts_today INTEGER DEFAULT 0,
    last_decrypt_reset TIMESTAMPTZ DEFAULT NOW(),

    -- Status
    enabled BOOLEAN DEFAULT TRUE,
    granted_by TEXT NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE auditor_permissions IS 'Authorized compliance auditors who can decrypt encrypted balances for regulatory purposes';
COMMENT ON COLUMN auditor_permissions.auditor_pubkey IS 'Public key used for 3-party encryption (ElGamal)';

-- ============================================================
-- TABLE: auditor_decrypt_log
-- Purpose: Audit trail for all auditor decryption operations
-- ============================================================
CREATE TABLE IF NOT EXISTS auditor_decrypt_log (
    id SERIAL PRIMARY KEY,
    auditor_id INTEGER NOT NULL REFERENCES auditor_permissions(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES discord_users(user_id) ON DELETE SET NULL,

    -- Decryption details
    encrypted_balance_hash TEXT NOT NULL,
    decrypted_amount TEXT NOT NULL,
    reason TEXT,

    decrypted_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE auditor_decrypt_log IS 'Immutable audit log of all balance decryptions by authorized auditors';

-- ============================================================
-- TABLE: user_rule_cache
-- Purpose: Cache rule evaluation results to reduce RPC calls
-- ============================================================
CREATE TABLE IF NOT EXISTS user_rule_cache (
    user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
    rule_id INTEGER NOT NULL REFERENCES token_gating_rules(id) ON DELETE CASCADE,

    -- Cached result
    passes_rule BOOLEAN NOT NULL,

    -- Cached blockchain data
    cached_balance TEXT,
    cached_stake TEXT,
    cached_reputation INTEGER,

    -- Cache metadata
    checked_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (user_id, rule_id)
);

COMMENT ON TABLE user_rule_cache IS 'Caches rule evaluation results to avoid excessive blockchain RPC calls';
COMMENT ON COLUMN user_rule_cache.expires_at IS 'Cache expiry time (typically 1 hour)';

-- ============================================================
-- TABLE: balance_cache
-- Purpose: 3-tier caching - PostgreSQL layer (1-hour TTL)
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

COMMENT ON TABLE balance_cache IS 'Token balance cache (Layer 2 of 3-tier caching: Memory → PostgreSQL → RPC)';
COMMENT ON COLUMN balance_cache.balance IS 'Token balance as bigint (stored as numeric for precision)';

-- ============================================================
-- INDEXES
-- Purpose: Optimize query performance
-- ============================================================

-- wallet_verifications indexes
CREATE INDEX IF NOT EXISTS idx_wallet_verifications_user ON wallet_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_verifications_wallet ON wallet_verifications(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_verifications_verified ON wallet_verifications(verified) WHERE verified = TRUE;

-- token_gating_rules indexes
CREATE INDEX IF NOT EXISTS idx_token_gating_rules_guild ON token_gating_rules(guild_id);
CREATE INDEX IF NOT EXISTS idx_token_gating_rules_enabled ON token_gating_rules(enabled, priority DESC) WHERE enabled = TRUE;

-- role_mappings indexes
CREATE INDEX IF NOT EXISTS idx_role_mappings_guild ON role_mappings(guild_id);
CREATE INDEX IF NOT EXISTS idx_role_mappings_rule ON role_mappings(rule_id);

-- verification_sessions indexes
CREATE INDEX IF NOT EXISTS idx_verification_sessions_token ON verification_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_user ON verification_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_sessions_expires ON verification_sessions(expires_at);

-- zk_proof_nullifiers indexes
CREATE INDEX IF NOT EXISTS idx_zk_nullifiers_discord ON zk_proof_nullifiers(discord_id);
CREATE INDEX IF NOT EXISTS idx_zk_nullifiers_expires ON zk_proof_nullifiers(expires_at);

-- stealth_addresses indexes
CREATE INDEX IF NOT EXISTS idx_stealth_addresses_meta ON stealth_addresses(stealth_meta_address);
CREATE INDEX IF NOT EXISTS idx_stealth_addresses_user ON stealth_addresses(user_id);

-- auditor_permissions indexes
CREATE INDEX IF NOT EXISTS idx_auditor_permissions_guild ON auditor_permissions(guild_id);
CREATE INDEX IF NOT EXISTS idx_auditor_permissions_enabled ON auditor_permissions(enabled) WHERE enabled = TRUE;

-- user_rule_cache indexes
CREATE INDEX IF NOT EXISTS idx_user_rule_cache_expires ON user_rule_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_rule_cache_user ON user_rule_cache(user_id);

-- balance_cache indexes
CREATE INDEX IF NOT EXISTS idx_balance_cache_expires ON balance_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_balance_cache_address ON balance_cache(starknet_address);

-- ============================================================
-- FUNCTIONS
-- Purpose: Automated cleanup and maintenance
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating updated_at
CREATE TRIGGER update_wallet_verifications_updated_at BEFORE UPDATE ON wallet_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_token_gating_rules_updated_at BEFORE UPDATE ON token_gating_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup expired data (run daily via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
    -- Delete expired sessions (older than 30 days)
    DELETE FROM verification_sessions WHERE expires_at < NOW() - INTERVAL '30 days';

    -- Delete expired ZK proof nullifiers
    DELETE FROM zk_proof_nullifiers WHERE expires_at < NOW();

    -- Delete expired balance cache entries
    DELETE FROM balance_cache WHERE expires_at < NOW();

    -- Delete expired user rule cache entries
    DELETE FROM user_rule_cache WHERE expires_at < NOW();

    -- Reset daily auditor decrypt counts (if last reset was yesterday)
    UPDATE auditor_permissions
    SET decrypts_today = 0, last_decrypt_reset = NOW()
    WHERE last_decrypt_reset < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_data IS 'Removes expired sessions, nullifiers, and cache entries (should be run daily)';

-- ============================================================
-- MIGRATION: Link existing wallet data
-- Purpose: Migrate legacy wallet_address from discord_users table
-- ============================================================

-- Only run if discord_users table has wallet_address column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'discord_users'
        AND column_name = 'wallet_address'
    ) THEN
        INSERT INTO wallet_verifications (user_id, wallet_address, verification_method, verified, verified_at)
        SELECT
            user_id,
            wallet_address,
            'legacy' as verification_method,
            TRUE as verified,
            verified_at
        FROM discord_users
        WHERE wallet_address IS NOT NULL
        AND wallet_address != ''
        ON CONFLICT (user_id, wallet_address) DO NOTHING;

        RAISE NOTICE 'Migrated existing wallet addresses to wallet_verifications table';
    END IF;
END $$;

-- ============================================================
-- GRANTS (adjust based on your database user)
-- ============================================================

-- Grant permissions to bot user (change 'bitsage_bot' to your actual user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bitsage_bot;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bitsage_bot;

-- ============================================================
-- COMPLETION
-- ============================================================

SELECT
    'Token-gating schema migration completed successfully! ' ||
    'Created 9 tables, ' || COUNT(*) || ' indexes, and 2 functions.' as status
FROM pg_indexes
WHERE tablename IN (
    'wallet_verifications',
    'token_gating_rules',
    'role_mappings',
    'verification_sessions',
    'zk_proof_nullifiers',
    'stealth_addresses',
    'auditor_permissions',
    'auditor_decrypt_log',
    'user_rule_cache',
    'balance_cache'
);
