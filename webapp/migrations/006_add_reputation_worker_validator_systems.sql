-- ============================================================
-- Migration 006: Add Reputation, Worker, and Validator Systems
-- ============================================================

-- ============================================================
-- REPUTATION SYSTEM
-- ============================================================

-- User reputation tracking
CREATE TABLE IF NOT EXISTS user_reputation (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  reputation_points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, guild_id)
);

CREATE INDEX idx_user_reputation_user ON user_reputation(user_id);
CREATE INDEX idx_user_reputation_guild ON user_reputation(guild_id);
CREATE INDEX idx_user_reputation_points ON user_reputation(reputation_points DESC);

-- Reputation transactions (log all point changes)
CREATE TABLE IF NOT EXISTS reputation_transactions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'earned', 'spent', 'admin_adjustment'
  reason VARCHAR(500),
  source VARCHAR(100), -- 'message', 'reaction', 'quest', 'manual', etc.
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reputation_transactions_user ON reputation_transactions(user_id);
CREATE INDEX idx_reputation_transactions_guild ON reputation_transactions(guild_id);
CREATE INDEX idx_reputation_transactions_created ON reputation_transactions(created_at DESC);

-- Reputation rewards configuration
CREATE TABLE IF NOT EXISTS reputation_rewards (
  id SERIAL PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- 'message_sent', 'reaction_received', 'voice_minute', etc.
  points INTEGER NOT NULL,
  cooldown_seconds INTEGER DEFAULT 0,
  max_per_day INTEGER,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guild_id, action_type)
);

CREATE INDEX idx_reputation_rewards_guild ON reputation_rewards(guild_id);

-- ============================================================
-- WORKER SYSTEM
-- ============================================================

-- Worker profiles
CREATE TABLE IF NOT EXISTS worker_profiles (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  worker_type VARCHAR(50), -- 'ai', 'data', 'compute', etc.
  skill_level INTEGER DEFAULT 1,
  total_jobs_completed INTEGER DEFAULT 0,
  total_jobs_failed INTEGER DEFAULT 0,
  total_rewards_earned VARCHAR(100) DEFAULT '0',
  average_rating DECIMAL(3,2) DEFAULT 0.00,
  last_active TIMESTAMP,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, guild_id)
);

CREATE INDEX idx_worker_profiles_user ON worker_profiles(user_id);
CREATE INDEX idx_worker_profiles_guild ON worker_profiles(guild_id);
CREATE INDEX idx_worker_profiles_active ON worker_profiles(is_active, guild_id);

-- Worker job history
CREATE TABLE IF NOT EXISTS worker_jobs (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  job_type VARCHAR(50) NOT NULL,
  job_id VARCHAR(255),
  status VARCHAR(20) NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'
  difficulty INTEGER DEFAULT 1,
  reward_amount VARCHAR(100),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  rating INTEGER, -- 1-5 stars
  feedback TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_worker_jobs_worker ON worker_jobs(worker_id);
CREATE INDEX idx_worker_jobs_status ON worker_jobs(status);
CREATE INDEX idx_worker_jobs_created ON worker_jobs(created_at DESC);

-- Worker skills and certifications
CREATE TABLE IF NOT EXISTS worker_skills (
  id SERIAL PRIMARY KEY,
  worker_id INTEGER NOT NULL REFERENCES worker_profiles(id) ON DELETE CASCADE,
  skill_name VARCHAR(100) NOT NULL,
  proficiency_level INTEGER DEFAULT 1, -- 1-10
  jobs_completed INTEGER DEFAULT 0,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(worker_id, skill_name)
);

CREATE INDEX idx_worker_skills_worker ON worker_skills(worker_id);

-- ============================================================
-- VALIDATOR SYSTEM
-- ============================================================

-- Validator profiles
CREATE TABLE IF NOT EXISTS validator_profiles (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  validator_type VARCHAR(50), -- 'consensus', 'oracle', 'governance', etc.
  stake_amount VARCHAR(100) DEFAULT '0',
  total_validations INTEGER DEFAULT 0,
  successful_validations INTEGER DEFAULT 0,
  failed_validations INTEGER DEFAULT 0,
  uptime_percentage DECIMAL(5,2) DEFAULT 100.00,
  last_validation TIMESTAMP,
  last_heartbeat TIMESTAMP,
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, guild_id)
);

CREATE INDEX idx_validator_profiles_user ON validator_profiles(user_id);
CREATE INDEX idx_validator_profiles_guild ON validator_profiles(guild_id);
CREATE INDEX idx_validator_profiles_active ON validator_profiles(is_active, guild_id);

-- Validator uptime tracking
CREATE TABLE IF NOT EXISTS validator_uptime (
  id SERIAL PRIMARY KEY,
  validator_id INTEGER NOT NULL REFERENCES validator_profiles(id) ON DELETE CASCADE,
  timestamp TIMESTAMP NOT NULL,
  is_online BOOLEAN NOT NULL,
  block_height BIGINT,
  response_time_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_validator_uptime_validator ON validator_uptime(validator_id);
CREATE INDEX idx_validator_uptime_timestamp ON validator_uptime(timestamp DESC);

-- Validator validation history
CREATE TABLE IF NOT EXISTS validator_validations (
  id SERIAL PRIMARY KEY,
  validator_id INTEGER NOT NULL REFERENCES validator_profiles(id) ON DELETE CASCADE,
  validation_type VARCHAR(50) NOT NULL,
  transaction_hash VARCHAR(255),
  was_successful BOOLEAN NOT NULL,
  reward_amount VARCHAR(100),
  gas_used VARCHAR(100),
  validated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_validator_validations_validator ON validator_validations(validator_id);
CREATE INDEX idx_validator_validations_timestamp ON validator_validations(validated_at DESC);

-- Validator slashing events
CREATE TABLE IF NOT EXISTS validator_slashes (
  id SERIAL PRIMARY KEY,
  validator_id INTEGER NOT NULL REFERENCES validator_profiles(id) ON DELETE CASCADE,
  slash_reason VARCHAR(255) NOT NULL,
  slash_amount VARCHAR(100) NOT NULL,
  slashed_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_validator_slashes_validator ON validator_slashes(validator_id);

-- ============================================================
-- STAKING CONFIGURATION
-- ============================================================

-- Staking contracts configuration per guild
CREATE TABLE IF NOT EXISTS staking_contracts (
  id SERIAL PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  contract_address VARCHAR(255) NOT NULL,
  contract_name VARCHAR(100),
  token_address VARCHAR(255) NOT NULL,
  min_stake_amount VARCHAR(100) DEFAULT '0',
  lock_period_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_staking_contracts_guild ON staking_contracts(guild_id);
CREATE INDEX idx_staking_contracts_active ON staking_contracts(is_active);

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

-- Grant permissions to webapp user (adjust username as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_db_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_db_user;

-- ============================================================
-- INITIAL DATA (Optional)
-- ============================================================

-- Default reputation rewards for new guilds can be inserted via application logic
-- Example rewards structure:
-- INSERT INTO reputation_rewards (guild_id, action_type, points, cooldown_seconds, max_per_day) VALUES
-- (..., 'message_sent', 1, 60, 100),
-- (..., 'reaction_received', 2, 0, 50),
-- (..., 'voice_minute', 5, 0, NULL);
