-- ============================================
-- Gamification Configuration Tables
-- ============================================
-- Allows admins to configure XP rates, level curves,
-- achievements, and quests without touching code

-- XP Configuration per Guild
CREATE TABLE IF NOT EXISTS gamification_config (
    id SERIAL PRIMARY KEY,
    guild_id UUID NOT NULL UNIQUE REFERENCES guilds(id) ON DELETE CASCADE,

    -- XP Rates
    message_xp INTEGER NOT NULL DEFAULT 5,
    message_cooldown_seconds INTEGER NOT NULL DEFAULT 60,
    daily_claim_base_xp INTEGER NOT NULL DEFAULT 50,
    streak_bonus_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.10,
    max_streak_multiplier DECIMAL(3,2) NOT NULL DEFAULT 2.00,

    -- Level Curve
    level_curve_type TEXT NOT NULL DEFAULT 'square_root', -- square_root, linear, exponential, custom
    level_curve_base INTEGER NOT NULL DEFAULT 100, -- Base XP per level
    level_curve_multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    level_curve_custom_formula TEXT, -- JSON array of [level, xp_required]

    -- Features
    level_up_announcement BOOLEAN NOT NULL DEFAULT TRUE,
    level_up_channel_id TEXT, -- Announce level-ups in specific channel
    level_up_dm BOOLEAN NOT NULL DEFAULT FALSE,
    achievements_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quests_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    daily_rewards_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    leaderboard_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Custom Achievements per Guild
CREATE TABLE IF NOT EXISTS gamification_achievements (
    id SERIAL PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,

    -- Achievement Info
    key TEXT NOT NULL, -- Unique key (e.g., 'chatterbox_100')
    name TEXT NOT NULL,
    description TEXT,
    emoji TEXT,
    icon_url TEXT, -- Custom icon URL

    -- Classification
    category TEXT NOT NULL, -- first_steps, network, social, special, custom
    rarity TEXT NOT NULL DEFAULT 'common', -- common, rare, epic, legendary
    hidden BOOLEAN NOT NULL DEFAULT FALSE, -- Hidden until earned

    -- Rewards
    xp_reward INTEGER NOT NULL DEFAULT 0,
    role_reward_id TEXT, -- Discord role to grant
    nft_reward_campaign_id TEXT, -- Link to reward campaign

    -- Requirements
    requirement_type TEXT NOT NULL, -- level, xp, messages, streak, reputation, custom
    requirement_value INTEGER NOT NULL,
    requirement_data JSONB, -- Additional requirement data

    -- Display Order
    position INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Stats
    earned_count INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(guild_id, key)
);

-- User Achievement Progress
CREATE TABLE IF NOT EXISTS gamification_user_achievements (
    user_id TEXT NOT NULL,
    achievement_id INTEGER NOT NULL REFERENCES gamification_achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT NOW(),

    PRIMARY KEY (user_id, achievement_id)
);

-- Quest Definitions per Guild
CREATE TABLE IF NOT EXISTS gamification_quests (
    id SERIAL PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,

    -- Quest Info
    title TEXT NOT NULL,
    description TEXT,
    emoji TEXT,

    -- Type
    quest_type TEXT NOT NULL, -- daily, weekly, monthly, one_time, tutorial

    -- Requirements
    requirement_type TEXT NOT NULL, -- messages, reputation, verify, complete_job, custom
    requirement_value INTEGER NOT NULL,
    requirement_data JSONB, -- Multi-step quests, custom data

    -- Rewards
    xp_reward INTEGER NOT NULL DEFAULT 0,
    role_reward_id TEXT,
    nft_reward_campaign_id TEXT,

    -- Schedule
    active BOOLEAN NOT NULL DEFAULT TRUE,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    reset_frequency TEXT, -- For recurring quests: daily, weekly, monthly

    -- Display
    position INTEGER NOT NULL DEFAULT 0,
    featured BOOLEAN NOT NULL DEFAULT FALSE,

    -- Stats
    completion_count INTEGER NOT NULL DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User Quest Progress
CREATE TABLE IF NOT EXISTS gamification_user_quests (
    user_id TEXT NOT NULL,
    quest_id INTEGER NOT NULL REFERENCES gamification_quests(id) ON DELETE CASCADE,

    -- Progress
    progress INTEGER NOT NULL DEFAULT 0, -- Current progress value
    completed BOOLEAN NOT NULL DEFAULT FALSE,

    -- Timestamps
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    last_progress_at TIMESTAMP DEFAULT NOW(),

    PRIMARY KEY (user_id, quest_id)
);

-- Level Rewards (role grants on level-up)
CREATE TABLE IF NOT EXISTS gamification_level_rewards (
    id SERIAL PRIMARY KEY,
    guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,

    -- Trigger
    level INTEGER NOT NULL,

    -- Rewards
    role_id TEXT, -- Discord role to grant
    xp_bonus INTEGER DEFAULT 0, -- Bonus XP award
    achievement_id INTEGER REFERENCES gamification_achievements(id) ON DELETE SET NULL,
    nft_reward_campaign_id TEXT, -- Link to reward campaign
    custom_message TEXT, -- Custom congrats message

    -- Metadata
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(guild_id, level)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gamification_config_guild ON gamification_config(guild_id);
CREATE INDEX IF NOT EXISTS idx_gamification_achievements_guild ON gamification_achievements(guild_id);
CREATE INDEX IF NOT EXISTS idx_gamification_achievements_category ON gamification_achievements(category, rarity);
CREATE INDEX IF NOT EXISTS idx_gamification_user_achievements_user ON gamification_user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_quests_guild ON gamification_quests(guild_id);
CREATE INDEX IF NOT EXISTS idx_gamification_quests_type ON gamification_quests(quest_type, active);
CREATE INDEX IF NOT EXISTS idx_gamification_user_quests_user ON gamification_user_quests(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_user_quests_completed ON gamification_user_quests(completed);
CREATE INDEX IF NOT EXISTS idx_gamification_level_rewards_guild ON gamification_level_rewards(guild_id, level);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_gamification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gamification_config_updated_at
    BEFORE UPDATE ON gamification_config
    FOR EACH ROW
    EXECUTE FUNCTION update_gamification_updated_at();

CREATE TRIGGER gamification_achievements_updated_at
    BEFORE UPDATE ON gamification_achievements
    FOR EACH ROW
    EXECUTE FUNCTION update_gamification_updated_at();

CREATE TRIGGER gamification_quests_updated_at
    BEFORE UPDATE ON gamification_quests
    FOR EACH ROW
    EXECUTE FUNCTION update_gamification_updated_at();
