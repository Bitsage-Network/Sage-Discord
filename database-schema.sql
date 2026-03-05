-- BitSage Discord Bot - Advanced Features Database Schema
-- PostgreSQL Schema for Gamification, Onboarding, and User Management

-- ============================================================================
-- USERS & PROFILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS discord_users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    discriminator TEXT,
    wallet_address TEXT UNIQUE,
    language TEXT DEFAULT 'en',

    -- Gamification
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    total_messages INTEGER DEFAULT 0,

    -- Streaks & Engagement
    daily_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_daily_claim TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,

    -- Reputation
    reputation INTEGER DEFAULT 0,
    helpful_votes INTEGER DEFAULT 0,

    -- Status
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discord_users_wallet ON discord_users(wallet_address);
CREATE INDEX idx_discord_users_xp ON discord_users(xp DESC);
CREATE INDEX idx_discord_users_level ON discord_users(level DESC);

-- ============================================================================
-- ACHIEVEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    emoji TEXT,
    category TEXT, -- first_steps, network, social, special
    xp_reward INTEGER DEFAULT 0,
    rarity TEXT, -- common, rare, epic, legendary
    hidden BOOLEAN DEFAULT FALSE,
    requirement_type TEXT, -- messages, jobs, streak, etc
    requirement_value INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
    user_id TEXT REFERENCES discord_users(user_id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_earned ON user_achievements(earned_at DESC);

-- ============================================================================
-- QUESTS & CHALLENGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS quests (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    emoji TEXT,
    quest_type TEXT, -- daily, weekly, one_time, tutorial
    xp_reward INTEGER DEFAULT 0,

    -- Requirements
    requirement_type TEXT, -- messages, jobs, verify, invite
    requirement_value INTEGER,
    requirement_data JSONB, -- additional requirements

    -- Availability
    active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_quests (
    user_id TEXT REFERENCES discord_users(user_id) ON DELETE CASCADE,
    quest_id INTEGER REFERENCES quests(id) ON DELETE CASCADE,
    progress INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, quest_id)
);

CREATE INDEX idx_user_quests_user ON user_quests(user_id);
CREATE INDEX idx_user_quests_active ON user_quests(user_id, completed) WHERE completed = FALSE;

-- ============================================================================
-- MESSAGE XP & ACTIVITY
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_xp (
    user_id TEXT REFERENCES discord_users(user_id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    message_count INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    last_xp_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, channel_id)
);

CREATE INDEX idx_message_xp_user ON message_xp(user_id);

-- ============================================================================
-- REPUTATION & VOTING
-- ============================================================================

CREATE TABLE IF NOT EXISTS message_votes (
    message_id TEXT PRIMARY KEY,
    author_id TEXT REFERENCES discord_users(user_id) ON DELETE CASCADE,
    channel_id TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_votes (
    voter_id TEXT NOT NULL,
    message_id TEXT REFERENCES message_votes(message_id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL, -- upvote, downvote
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (voter_id, message_id)
);

-- ============================================================================
-- ONBOARDING
-- ============================================================================

CREATE TABLE IF NOT EXISTS onboarding_progress (
    user_id TEXT REFERENCES discord_users(user_id) ON DELETE CASCADE PRIMARY KEY,
    current_step INTEGER DEFAULT 0,
    steps_completed INTEGER[] DEFAULT '{}',
    role_selections TEXT[] DEFAULT '{}',
    skipped BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- TRANSLATIONS & LANGUAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_language_preferences (
    user_id TEXT REFERENCES discord_users(user_id) ON DELETE CASCADE PRIMARY KEY,
    language_code TEXT NOT NULL,
    auto_translate BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INTERACTIVE FEATURES
-- ============================================================================

CREATE TABLE IF NOT EXISTS polls (
    id SERIAL PRIMARY KEY,
    message_id TEXT UNIQUE,
    channel_id TEXT NOT NULL,
    creator_id TEXT REFERENCES discord_users(user_id),
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- [{id: 1, text: "...", votes: 0}]
    active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    option_id INTEGER NOT NULL,
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (poll_id, user_id)
);

CREATE TABLE IF NOT EXISTS trivia_sessions (
    id SERIAL PRIMARY KEY,
    channel_id TEXT NOT NULL,
    host_id TEXT REFERENCES discord_users(user_id),
    category TEXT,
    active BOOLEAN DEFAULT TRUE,
    current_question INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 10,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS trivia_scores (
    session_id INTEGER REFERENCES trivia_sessions(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES discord_users(user_id),
    correct_answers INTEGER DEFAULT 0,
    total_answered INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    PRIMARY KEY (session_id, user_id)
);

-- ============================================================================
-- DAILY REWARDS & STREAKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_claims (
    user_id TEXT REFERENCES discord_users(user_id) ON DELETE CASCADE,
    claim_date DATE NOT NULL,
    xp_earned INTEGER,
    streak_day INTEGER,
    bonus_applied BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, claim_date)
);

CREATE INDEX idx_daily_claims_user ON daily_claims(user_id, claim_date DESC);

-- ============================================================================
-- SERVER CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS server_config (
    guild_id TEXT PRIMARY KEY,
    welcome_channel_id TEXT,
    verify_channel_id TEXT,
    rules_channel_id TEXT,
    stats_channel_id TEXT,
    announcement_channel_id TEXT,

    -- Role IDs
    verified_role_id TEXT,
    worker_role_id TEXT,
    moderator_role_id TEXT,

    -- Features
    gamification_enabled BOOLEAN DEFAULT TRUE,
    auto_onboarding BOOLEAN DEFAULT TRUE,
    ai_responses BOOLEAN DEFAULT TRUE,

    setup_completed BOOLEAN DEFAULT FALSE,
    setup_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_discord_users_updated_at BEFORE UPDATE
    ON discord_users FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Calculate level from XP
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Level formula: sqrt(XP / 100)
    -- Level 1 = 0 XP, Level 2 = 100 XP, Level 10 = 10,000 XP, etc.
    RETURN FLOOR(SQRT(xp / 100.0)) + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- INITIAL DATA - ACHIEVEMENTS
-- ============================================================================

INSERT INTO achievements (key, name, description, emoji, category, xp_reward, rarity, requirement_type, requirement_value)
VALUES
    -- First Steps
    ('first_message', 'First Message', 'Send your first message', '💬', 'first_steps', 10, 'common', 'messages', 1),
    ('getting_started', 'Getting Started', 'Complete the onboarding', '🎬', 'first_steps', 50, 'common', 'onboarding', 1),
    ('verified', 'Verified', 'Link your Starknet wallet', '✅', 'first_steps', 100, 'common', 'verify', 1),
    ('first_job', 'First Job', 'Complete your first proof job', '🏆', 'network', 200, 'rare', 'jobs', 1),

    -- Social
    ('chatterbox', 'Chatterbox', 'Send 100 messages', '💭', 'social', 100, 'common', 'messages', 100),
    ('conversationalist', 'Conversationalist', 'Send 1000 messages', '🗣️', 'social', 500, 'rare', 'messages', 1000),
    ('community_star', 'Community Star', 'Send 5000 messages', '🌟', 'social', 2000, 'epic', 'messages', 5000),
    ('helper', 'Helper', 'Get 50 helpful votes', '🤝', 'social', 300, 'rare', 'helpful_votes', 50),

    -- Network
    ('worker', 'Active Worker', 'Register as a worker', '🤖', 'network', 150, 'common', 'worker_status', 1),
    ('productive', 'Productive', 'Complete 10 jobs', '⚡', 'network', 300, 'rare', 'jobs', 10),
    ('powerhouse', 'Powerhouse', 'Complete 100 jobs', '💪', 'network', 1500, 'epic', 'jobs', 100),
    ('legend', 'Legend', 'Complete 1000 jobs', '👑', 'network', 10000, 'legendary', 'jobs', 1000),

    -- Staking
    ('bronze_hand', 'Bronze Hand', 'Stake 100+ SAGE', '🥉', 'network', 50, 'common', 'stake', 100),
    ('silver_hand', 'Silver Hand', 'Stake 1,000+ SAGE', '🥈', 'network', 200, 'rare', 'stake', 1000),
    ('gold_hand', 'Gold Hand', 'Stake 5,000+ SAGE', '🥇', 'network', 1000, 'epic', 'stake', 5000),
    ('diamond_hand', 'Diamond Hand', 'Stake 10,000+ SAGE', '💎', 'network', 5000, 'legendary', 'stake', 10000),

    -- Streaks
    ('consistent', 'Consistent', '7 day streak', '🔥', 'special', 200, 'common', 'streak', 7),
    ('dedicated', 'Dedicated', '30 day streak', '🔥', 'special', 1000, 'rare', 'streak', 30),
    ('unstoppable', 'Unstoppable', '100 day streak', '🔥', 'special', 5000, 'epic', 'streak', 100),

    -- Special
    ('early_adopter', 'Early Adopter', 'Joined in the first month', '🌅', 'special', 500, 'rare', 'early', 1),
    ('recruiter', 'Recruiter', 'Invite 10 verified users', '👥', 'special', 1000, 'epic', 'referrals', 10)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- INITIAL DATA - QUESTS
-- ============================================================================

INSERT INTO quests (title, description, emoji, quest_type, xp_reward, requirement_type, requirement_value, active)
VALUES
    -- Tutorial Quests
    ('Introduce Yourself', 'Post an introduction in #general', '👋', 'tutorial', 100, 'message_in_channel', 1, TRUE),
    ('Read the Rules', 'Read and react to the rules', '📜', 'tutorial', 50, 'read_rules', 1, TRUE),
    ('Verify Your Wallet', 'Link your Starknet wallet', '🔐', 'tutorial', 200, 'verify', 1, TRUE),

    -- Daily Quests
    ('Daily Login', 'Claim your daily reward', '📅', 'daily', 50, 'daily_claim', 1, TRUE),
    ('Daily Chat', 'Send 10 messages today', '💬', 'daily', 25, 'messages', 10, TRUE),

    -- Weekly Quests
    ('Weekly Contributor', 'Send 100 messages this week', '📊', 'weekly', 200, 'messages', 100, TRUE),
    ('Weekly Helper', 'Get 5 helpful votes this week', '⭐', 'weekly', 150, 'helpful_votes', 5, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- VIEWS FOR LEADERBOARDS
-- ============================================================================

CREATE OR REPLACE VIEW leaderboard_xp AS
SELECT
    user_id,
    username,
    xp,
    level,
    ROW_NUMBER() OVER (ORDER BY xp DESC) as rank
FROM discord_users
WHERE xp > 0
ORDER BY xp DESC
LIMIT 100;

CREATE OR REPLACE VIEW leaderboard_streak AS
SELECT
    user_id,
    username,
    daily_streak,
    longest_streak,
    ROW_NUMBER() OVER (ORDER BY daily_streak DESC, longest_streak DESC) as rank
FROM discord_users
WHERE daily_streak > 0
ORDER BY daily_streak DESC, longest_streak DESC
LIMIT 100;

CREATE OR REPLACE VIEW leaderboard_reputation AS
SELECT
    user_id,
    username,
    reputation,
    helpful_votes,
    ROW_NUMBER() OVER (ORDER BY reputation DESC) as rank
FROM discord_users
WHERE reputation > 0
ORDER BY reputation DESC
LIMIT 100;
