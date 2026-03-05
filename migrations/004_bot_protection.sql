-- ============================================================================
-- Migration 004: Bot Protection & Captcha Verification
-- ============================================================================
-- Description: Adds captcha verification, verified roles, and member management
-- Date: 2026-01-02
-- Author: BitSage Team

-- ============================================================================
-- Captcha Verifications
-- ============================================================================

-- Captcha verification attempts
CREATE TABLE IF NOT EXISTS captcha_verifications (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,

    -- Captcha details
    captcha_type TEXT NOT NULL CHECK (captcha_type IN ('number', 'text', 'image')),
    challenge TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    user_answer TEXT,

    -- Verification status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'expired')),
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,

    -- Metadata
    triggered_by TEXT CHECK (triggered_by IN ('auto_join', 'manual', 'raid_protection')),
    ip_address TEXT,

    UNIQUE(guild_id, user_id, created_at)
);

CREATE INDEX idx_captcha_verifications_guild_user ON captcha_verifications(guild_id, user_id);
CREATE INDEX idx_captcha_verifications_status ON captcha_verifications(status);
CREATE INDEX idx_captcha_verifications_expires ON captcha_verifications(expires_at);

-- ============================================================================
-- Guild Configuration
-- ============================================================================

-- Bot protection settings per guild
CREATE TABLE IF NOT EXISTS guild_bot_protection_config (
    guild_id TEXT PRIMARY KEY,

    -- Captcha settings
    captcha_enabled BOOLEAN DEFAULT TRUE,
    captcha_on_join BOOLEAN DEFAULT TRUE,
    captcha_type TEXT DEFAULT 'number' CHECK (captcha_type IN ('number', 'text', 'image', 'random')),
    captcha_difficulty TEXT DEFAULT 'medium' CHECK (captcha_difficulty IN ('easy', 'medium', 'hard')),
    captcha_timeout_minutes INT DEFAULT 10,
    max_captcha_attempts INT DEFAULT 3,

    -- Verified role
    verified_role_id TEXT,
    verified_role_name TEXT DEFAULT 'Verified',
    auto_create_verified_role BOOLEAN DEFAULT TRUE,
    auto_assign_verified_role BOOLEAN DEFAULT TRUE,

    -- Waiting room
    waiting_room_enabled BOOLEAN DEFAULT FALSE,
    waiting_room_role_id TEXT,
    waiting_room_channel_id TEXT,

    -- Member pruning
    prune_unverified_enabled BOOLEAN DEFAULT FALSE,
    prune_timeout_hours INT DEFAULT 24,
    prune_send_dm BOOLEAN DEFAULT TRUE,

    -- Rules
    rules_enabled BOOLEAN DEFAULT FALSE,
    rules_text TEXT,
    rules_channel_id TEXT,
    require_rules_acceptance BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Server Rules
-- ============================================================================

-- Up to 5 customizable rules per guild
CREATE TABLE IF NOT EXISTS guild_rules (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    rule_number INT NOT NULL CHECK (rule_number >= 1 AND rule_number <= 5),
    rule_text TEXT NOT NULL,
    emoji TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(guild_id, rule_number)
);

CREATE INDEX idx_guild_rules_guild ON guild_rules(guild_id);

-- ============================================================================
-- Member Verification Status
-- ============================================================================

-- Track verification status for each member
CREATE TABLE IF NOT EXISTS member_verification_status (
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,

    -- Verification status
    is_verified BOOLEAN DEFAULT FALSE,
    verification_method TEXT CHECK (verification_method IN ('captcha', 'wallet', 'manual', 'imported')),
    verified_at TIMESTAMPTZ,
    verified_by TEXT, -- User ID of admin who manually verified (if manual)

    -- Join tracking
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    first_message_at TIMESTAMPTZ,

    -- Flags
    is_suspicious BOOLEAN DEFAULT FALSE,
    suspicious_reasons TEXT[],
    is_kicked BOOLEAN DEFAULT FALSE,
    kick_reason TEXT,
    kicked_at TIMESTAMPTZ,

    -- Metadata
    account_created_at TIMESTAMPTZ,
    has_avatar BOOLEAN,
    has_nitro BOOLEAN,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX idx_member_verification_guild ON member_verification_status(guild_id);
CREATE INDEX idx_member_verification_status ON member_verification_status(is_verified);
CREATE INDEX idx_member_verification_suspicious ON member_verification_status(is_suspicious);

-- ============================================================================
-- Raid Protection Events
-- ============================================================================

-- Track join rate for raid detection
CREATE TABLE IF NOT EXISTS join_rate_events (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),

    -- User metadata (for pattern detection)
    account_created_at TIMESTAMPTZ,
    has_avatar BOOLEAN,
    has_default_avatar BOOLEAN,
    username TEXT,
    discriminator TEXT
);

CREATE INDEX idx_join_rate_events_guild ON join_rate_events(guild_id);
CREATE INDEX idx_join_rate_events_time ON join_rate_events(joined_at);

-- ============================================================================
-- Audit Logs
-- ============================================================================

-- Comprehensive audit logging for security events
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,

    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN (
        'captcha_passed',
        'captcha_failed',
        'member_verified',
        'member_kicked',
        'member_pruned',
        'raid_detected',
        'lockdown_enabled',
        'lockdown_disabled',
        'config_changed',
        'manual_verification',
        'rules_updated'
    )),
    event_description TEXT NOT NULL,

    -- Target user (if applicable)
    user_id TEXT,
    username TEXT,

    -- Actor (who triggered the action)
    actor_id TEXT,
    actor_username TEXT,

    -- Metadata
    metadata JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_audit_logs_guild ON security_audit_logs(guild_id);
CREATE INDEX idx_security_audit_logs_event_type ON security_audit_logs(event_type);
CREATE INDEX idx_security_audit_logs_user ON security_audit_logs(user_id);
CREATE INDEX idx_security_audit_logs_time ON security_audit_logs(created_at);

-- ============================================================================
-- Lockdown Status
-- ============================================================================

-- Track server lockdown status
CREATE TABLE IF NOT EXISTS guild_lockdown_status (
    guild_id TEXT PRIMARY KEY,
    is_locked_down BOOLEAN DEFAULT FALSE,
    lockdown_reason TEXT,
    lockdown_type TEXT CHECK (lockdown_type IN ('manual', 'auto_raid', 'scheduled')),

    -- Lockdown settings
    block_new_joins BOOLEAN DEFAULT TRUE,
    require_captcha BOOLEAN DEFAULT TRUE,
    mute_new_members BOOLEAN DEFAULT FALSE,

    -- Timing
    locked_down_at TIMESTAMPTZ,
    locked_down_by TEXT, -- User ID of admin who triggered lockdown
    unlock_at TIMESTAMPTZ, -- Scheduled unlock time (if applicable)
    unlocked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Functions
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_guild_bot_protection_config_updated_at
    BEFORE UPDATE ON guild_bot_protection_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guild_rules_updated_at
    BEFORE UPDATE ON guild_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_member_verification_status_updated_at
    BEFORE UPDATE ON member_verification_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guild_lockdown_status_updated_at
    BEFORE UPDATE ON guild_lockdown_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Cleanup Functions
-- ============================================================================

-- Delete expired captcha verifications
CREATE OR REPLACE FUNCTION cleanup_expired_captchas()
RETURNS void AS $$
BEGIN
    DELETE FROM captcha_verifications
    WHERE expires_at < NOW() - INTERVAL '7 days'
    AND status IN ('expired', 'failed');
END;
$$ LANGUAGE plpgsql;

-- Clean old join rate events (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_join_events()
RETURNS void AS $$
BEGIN
    DELETE FROM join_rate_events
    WHERE joined_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Clean old audit logs (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM security_audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Initial Data
-- ============================================================================

-- Insert default config for existing guilds
INSERT INTO guild_bot_protection_config (guild_id)
SELECT DISTINCT guild_id FROM server_config
ON CONFLICT (guild_id) DO NOTHING;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE captcha_verifications IS 'Stores captcha challenges and verification attempts';
COMMENT ON TABLE guild_bot_protection_config IS 'Bot protection configuration per guild';
COMMENT ON TABLE guild_rules IS 'Customizable server rules (up to 5 per guild)';
COMMENT ON TABLE member_verification_status IS 'Tracks verification status for each member';
COMMENT ON TABLE join_rate_events IS 'Tracks member joins for raid detection';
COMMENT ON TABLE security_audit_logs IS 'Comprehensive security event logging';
COMMENT ON TABLE guild_lockdown_status IS 'Server lockdown status and settings';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Log migration
DO $$
BEGIN
    RAISE NOTICE 'Migration 004: Bot Protection & Captcha Verification - COMPLETE';
    RAISE NOTICE 'Tables created: 7';
    RAISE NOTICE 'Indexes created: 15';
    RAISE NOTICE 'Functions created: 4';
END $$;
