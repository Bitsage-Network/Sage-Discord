-- Migration 008: Reward Management System
-- Extends existing reward_campaigns and reward_claims tables for Phase 1
-- Adds support for Discord roles, XP/Points, and Access Grants

-- ============================================================
-- 1. EXTEND reward_campaigns
-- ============================================================

-- Add new columns for trigger types and eligibility
ALTER TABLE reward_campaigns
  ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(50) DEFAULT 'manual'
    CHECK (trigger_type IN ('manual', 'rule_pass', 'scheduled')),
  ADD COLUMN IF NOT EXISTS trigger_config JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_claim BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cooldown_hours INTEGER DEFAULT 0
    CHECK (cooldown_hours >= 0),
  ADD COLUMN IF NOT EXISTS rule_group_id INTEGER REFERENCES rule_groups(id) ON DELETE SET NULL;

-- Add index for rule group lookups
CREATE INDEX IF NOT EXISTS idx_reward_campaigns_rule_group
  ON reward_campaigns(rule_group_id);

-- Add index for trigger type
CREATE INDEX IF NOT EXISTS idx_reward_campaigns_trigger
  ON reward_campaigns(trigger_type) WHERE status = 'active';

-- Update comments
COMMENT ON COLUMN reward_campaigns.reward_type IS
  'Phase 1: role, xp, access_grant | Phase 2: nft, poap, webhook';
COMMENT ON COLUMN reward_campaigns.trigger_type IS
  'manual: User claims via /rewards claim | rule_pass: Auto-trigger when user passes rule | scheduled: Cron-based delivery';
COMMENT ON COLUMN reward_campaigns.trigger_config IS
  'For scheduled: {cron: "0 0 * * *", timezone: "UTC"} | For rule_pass: {notify_on_eligible: true}';
COMMENT ON COLUMN reward_campaigns.auto_claim IS
  'If true and trigger_type=rule_pass, automatically deliver reward without user claim';
COMMENT ON COLUMN reward_campaigns.cooldown_hours IS
  'Minimum hours between claims (0 = one-time claim only)';
COMMENT ON COLUMN reward_campaigns.rule_group_id IS
  'Optional link to rule group for automatic eligibility checking';

-- ============================================================
-- 2. EXTEND reward_claims
-- ============================================================

-- Add new columns for delivery tracking
ALTER TABLE reward_claims
  ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(50) DEFAULT 'manual'
    CHECK (delivery_method IN ('manual', 'automatic', 'scheduled')),
  ADD COLUMN IF NOT EXISTS delivery_details JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS retries INTEGER DEFAULT 0;

-- Add index for failed claims (for retry logic)
CREATE INDEX IF NOT EXISTS idx_reward_claims_failed
  ON reward_claims(status) WHERE status = 'failed';

-- Update comments
COMMENT ON COLUMN reward_claims.delivery_method IS
  'manual: User claimed via command | automatic: Auto-delivered on rule pass | scheduled: Cron-triggered';
COMMENT ON COLUMN reward_claims.delivery_details IS
  'What was delivered: {role_ids: [...], xp_amount: 500, channel_ids: [...]}';
COMMENT ON COLUMN reward_claims.error_message IS
  'Error message if delivery failed';
COMMENT ON COLUMN reward_claims.retries IS
  'Number of retry attempts (max 3)';

-- ============================================================
-- 3. CREATE reward_eligibility (NEW)
-- ============================================================

CREATE TABLE IF NOT EXISTS reward_eligibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES reward_campaigns(id) ON DELETE CASCADE,
    discord_user_id VARCHAR(20) NOT NULL,
    eligible BOOLEAN DEFAULT true,
    last_checked TIMESTAMP DEFAULT NOW(),
    eligibility_data JSONB,
    UNIQUE(campaign_id, discord_user_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_reward_eligibility_campaign
  ON reward_eligibility(campaign_id);

CREATE INDEX IF NOT EXISTS idx_reward_eligibility_user
  ON reward_eligibility(discord_user_id);

CREATE INDEX IF NOT EXISTS idx_reward_eligibility_eligible
  ON reward_eligibility(campaign_id, eligible) WHERE eligible = true;

-- Comment
COMMENT ON TABLE reward_eligibility IS
  'Cache of who is eligible for each campaign (refreshed periodically to avoid constant rule re-evaluation)';
COMMENT ON COLUMN reward_eligibility.eligibility_data IS
  'Why eligible: {rule_group_passed: true, level: 10, xp: 5000, ...}';

-- ============================================================
-- 4. CREATE reward_delivery_queue (NEW)
-- ============================================================

CREATE TABLE IF NOT EXISTS reward_delivery_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES reward_campaigns(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES reward_claims(id) ON DELETE CASCADE,
    discord_user_id VARCHAR(20) NOT NULL,
    priority INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending'
      CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    scheduled_for TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for scheduler
CREATE INDEX IF NOT EXISTS idx_reward_delivery_queue_status
  ON reward_delivery_queue(status);

CREATE INDEX IF NOT EXISTS idx_reward_delivery_queue_scheduled
  ON reward_delivery_queue(scheduled_for, priority DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_reward_delivery_queue_campaign
  ON reward_delivery_queue(campaign_id);

-- Comment
COMMENT ON TABLE reward_delivery_queue IS
  'Queue for async reward delivery with retry support. Polled by reward-scheduler every 30 seconds.';
COMMENT ON COLUMN reward_delivery_queue.priority IS
  'Higher = more urgent. Manual claims = 10, automatic = 0';
COMMENT ON COLUMN reward_delivery_queue.scheduled_for IS
  'When to process (allows delayed delivery for scheduled rewards)';

-- ============================================================
-- 5. FUNCTIONS for queue management
-- ============================================================

-- Function to get pending queue items
CREATE OR REPLACE FUNCTION get_pending_reward_deliveries(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  queue_id UUID,
  campaign_id UUID,
  claim_id UUID,
  discord_user_id VARCHAR(20),
  priority INTEGER,
  scheduled_for TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.campaign_id,
    q.claim_id,
    q.discord_user_id,
    q.priority,
    q.scheduled_for
  FROM reward_delivery_queue q
  WHERE q.status = 'pending'
    AND q.scheduled_for <= NOW()
  ORDER BY q.priority DESC, q.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to count eligible users for a campaign
CREATE OR REPLACE FUNCTION count_eligible_users(p_campaign_id UUID)
RETURNS INTEGER AS $$
DECLARE
  eligible_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO eligible_count
  FROM reward_eligibility
  WHERE campaign_id = p_campaign_id
    AND eligible = true;

  RETURN COALESCE(eligible_count, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. INDEXES for performance
-- ============================================================

-- Composite index for active campaigns with rule groups
CREATE INDEX IF NOT EXISTS idx_reward_campaigns_active_rule_group
  ON reward_campaigns(status, rule_group_id)
  WHERE status = 'active' AND rule_group_id IS NOT NULL;

-- Index for claim lookup by user and campaign
CREATE INDEX IF NOT EXISTS idx_reward_claims_user_campaign
  ON reward_claims(discord_user_id, campaign_id);

-- ============================================================
-- 7. UPDATE existing reward_campaigns comment
-- ============================================================

COMMENT ON TABLE reward_campaigns IS
  'Reward campaigns for guilds. Phase 1: Discord roles, XP/Points, Channel access. Phase 2: NFTs, POAPs, Webhooks';

-- ============================================================
-- VERIFICATION: Check all tables exist
-- ============================================================

DO $$
BEGIN
  -- Verify extended columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reward_campaigns' AND column_name = 'trigger_type'
  ) THEN
    RAISE EXCEPTION 'Migration failed: reward_campaigns.trigger_type not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reward_claims' AND column_name = 'delivery_method'
  ) THEN
    RAISE EXCEPTION 'Migration failed: reward_claims.delivery_method not created';
  END IF;

  -- Verify new tables exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'reward_eligibility'
  ) THEN
    RAISE EXCEPTION 'Migration failed: reward_eligibility table not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'reward_delivery_queue'
  ) THEN
    RAISE EXCEPTION 'Migration failed: reward_delivery_queue table not created';
  END IF;

  RAISE NOTICE 'Migration 008 completed successfully!';
END $$;
