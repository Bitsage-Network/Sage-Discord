-- Migration 007: Webapp Guild Management Tables
-- Description: Add tables for the Sage Realms webapp to manage guilds, pages, subscriptions, analytics, and rewards

-- Guilds/Communities
CREATE TABLE guilds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,

    -- Social links
    twitter_url TEXT,
    discord_guild_id VARCHAR(20) UNIQUE, -- Links to Discord server
    website_url TEXT,

    -- Settings
    is_public BOOLEAN DEFAULT true,
    theme JSONB DEFAULT '{"primaryColor": "#10b981", "darkMode": true}',

    -- Owner
    owner_discord_id VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_guilds_discord_guild_id ON guilds(discord_guild_id);
CREATE INDEX idx_guilds_owner ON guilds(owner_discord_id);
CREATE INDEX idx_guilds_slug ON guilds(slug);

-- Guild pages (multi-page support)
CREATE TABLE guild_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE,
    slug VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content JSONB,  -- TipTap/Novel JSON content
    icon TEXT,
    order_index INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(guild_id, slug)
);

CREATE INDEX idx_guild_pages_guild ON guild_pages(guild_id);
CREATE INDEX idx_guild_pages_published ON guild_pages(is_published);

-- Guild members
CREATE TABLE guild_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE,
    discord_user_id VARCHAR(20) NOT NULL REFERENCES discord_users(user_id),
    joined_at TIMESTAMP DEFAULT NOW(),
    is_admin BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verification_completed_at TIMESTAMP,
    UNIQUE(guild_id, discord_user_id)
);

CREATE INDEX idx_guild_members_guild ON guild_members(guild_id);
CREATE INDEX idx_guild_members_user ON guild_members(discord_user_id);
CREATE INDEX idx_guild_members_verified ON guild_members(is_verified);

-- Link existing token_gating_rules to guilds table
ALTER TABLE token_gating_rules
ADD COLUMN guild_ref_id UUID REFERENCES guilds(id) ON DELETE CASCADE;

CREATE INDEX idx_token_gating_rules_guild_ref ON token_gating_rules(guild_ref_id);

-- Subscription plans
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE UNIQUE,
    plan_tier VARCHAR(50) NOT NULL DEFAULT 'free',
    verified_member_limit INTEGER DEFAULT 100,
    features JSONB DEFAULT '["basic_token_gating"]',

    -- Stripe integration
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_guild ON subscriptions(guild_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- Analytics events
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,  -- member_join, verification_complete, role_assigned, etc.
    event_data JSONB,
    user_id VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_guild ON analytics_events(guild_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at);
CREATE INDEX idx_analytics_events_guild_created ON analytics_events(guild_id, created_at);

-- Reward campaigns
CREATE TABLE reward_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    reward_type VARCHAR(50),  -- airdrop, nft, role, xp
    reward_config JSONB,  -- Amount, contract address, etc.

    -- Scheduling
    start_date TIMESTAMP,
    end_date TIMESTAMP,

    -- Eligibility
    eligibility_requirements JSONB,  -- Link to requirement groups

    -- Tracking
    claimed_count INTEGER DEFAULT 0,
    max_claims INTEGER,
    status VARCHAR(50) DEFAULT 'draft',  -- draft, active, completed, canceled

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reward_campaigns_guild ON reward_campaigns(guild_id);
CREATE INDEX idx_reward_campaigns_status ON reward_campaigns(status);
CREATE INDEX idx_reward_campaigns_dates ON reward_campaigns(start_date, end_date);

-- Reward claims
CREATE TABLE reward_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES reward_campaigns(id) ON DELETE CASCADE,
    discord_user_id VARCHAR(20) NOT NULL,
    claimed_at TIMESTAMP DEFAULT NOW(),
    transaction_hash TEXT,  -- Starknet tx hash
    status VARCHAR(50) DEFAULT 'pending',  -- pending, completed, failed
    UNIQUE(campaign_id, discord_user_id)
);

CREATE INDEX idx_reward_claims_campaign ON reward_claims(campaign_id);
CREATE INDEX idx_reward_claims_user ON reward_claims(discord_user_id);
CREATE INDEX idx_reward_claims_status ON reward_claims(status);

-- Triggers for updated_at
CREATE TRIGGER update_guilds_updated_at BEFORE UPDATE ON guilds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guild_pages_updated_at BEFORE UPDATE ON guild_pages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reward_campaigns_updated_at BEFORE UPDATE ON reward_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE guilds IS 'Community/guild information managed through the webapp';
COMMENT ON TABLE guild_pages IS 'Custom pages created for each guild (home, about, rules, etc.)';
COMMENT ON TABLE guild_members IS 'Members of each guild with admin and verification status';
COMMENT ON TABLE subscriptions IS 'Subscription plans and billing information per guild';
COMMENT ON TABLE analytics_events IS 'Analytics event tracking for guild insights';
COMMENT ON TABLE reward_campaigns IS 'Reward campaigns for token airdrops and incentives';
COMMENT ON TABLE reward_claims IS 'Individual reward claims by users';
