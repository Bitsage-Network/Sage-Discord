-- Migration 006: Visual Requirement Builder
-- Adds support for complex nested rule structures with logic gates

-- ============================================================
-- Rule Groups (for nested logic)
-- ============================================================

CREATE TABLE IF NOT EXISTS rule_groups (
  id SERIAL PRIMARY KEY,
  guild_id UUID REFERENCES guilds(id) ON DELETE CASCADE,
  parent_group_id INTEGER REFERENCES rule_groups(id) ON DELETE CASCADE,
  logic_operator VARCHAR(10) NOT NULL DEFAULT 'AND', -- AND, OR, NOT
  name VARCHAR(255),
  description TEXT,
  position INTEGER DEFAULT 0, -- for ordering
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_rule_groups_guild ON rule_groups(guild_id);
CREATE INDEX idx_rule_groups_parent ON rule_groups(parent_group_id);

-- ============================================================
-- Group Conditions (individual requirements within groups)
-- ============================================================

CREATE TABLE IF NOT EXISTS group_conditions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES rule_groups(id) ON DELETE CASCADE,

  -- Reference to existing token_gating_rules OR inline condition
  rule_id INTEGER REFERENCES token_gating_rules(id) ON DELETE SET NULL,

  -- Inline condition (if not referencing existing rule)
  condition_type VARCHAR(50), -- token_balance, staked_amount, nft_holding, social_follow, etc.
  condition_data JSONB, -- flexible storage for any condition parameters

  -- Negation support
  negate BOOLEAN DEFAULT FALSE, -- NOT condition

  -- Ordering and metadata
  position INTEGER DEFAULT 0,
  label VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_group_conditions_group ON group_conditions(group_id);
CREATE INDEX idx_group_conditions_rule ON group_conditions(rule_id);

-- ============================================================
-- Rule Templates (pre-built configurations)
-- ============================================================

CREATE TABLE IF NOT EXISTS rule_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- defi, gaming, nft, social, developer
  icon VARCHAR(50), -- emoji or icon name

  -- Template structure (JSON representation of groups and conditions)
  structure JSONB NOT NULL,

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,

  -- Visibility
  is_public BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES guilds(id), -- NULL for system templates

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for categories and public templates
CREATE INDEX idx_rule_templates_category ON rule_templates(category);
CREATE INDEX idx_rule_templates_public ON rule_templates(is_public);

-- ============================================================
-- Group Role Assignments (which roles to assign when group passes)
-- ============================================================

CREATE TABLE IF NOT EXISTS group_role_assignments (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES rule_groups(id) ON DELETE CASCADE,
  role_id VARCHAR(100) NOT NULL, -- Discord role ID
  role_name VARCHAR(255) NOT NULL,
  auto_assign BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for group lookups
CREATE INDEX idx_group_role_assignments_group ON group_role_assignments(group_id);

-- ============================================================
-- Rule Evaluation Cache (for live preview)
-- ============================================================

CREATE TABLE IF NOT EXISTS rule_evaluation_cache (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES rule_groups(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL, -- Discord ID

  -- Evaluation results
  passes BOOLEAN NOT NULL,
  evaluation_data JSONB, -- detailed results per condition

  -- Cache metadata
  evaluated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- TTL for cache

  UNIQUE(group_id, user_id)
);

-- Index for fast lookups
CREATE INDEX idx_rule_evaluation_cache_group_user ON rule_evaluation_cache(group_id, user_id);
CREATE INDEX idx_rule_evaluation_cache_expires ON rule_evaluation_cache(expires_at);

-- ============================================================
-- Seed Data: System Templates
-- ============================================================

INSERT INTO rule_templates (name, description, category, icon, structure, is_public, created_by) VALUES

-- Template 1: Simple Token Holder
(
  'Token Holder',
  'Require holding a minimum amount of tokens',
  'defi',
  '💰',
  '{
    "type": "group",
    "operator": "AND",
    "conditions": [
      {
        "type": "token_balance",
        "params": {
          "min_balance": "1000000000000000000",
          "token_address": "",
          "include_staked": false
        }
      }
    ]
  }'::jsonb,
  TRUE,
  NULL
),

-- Template 2: Staker
(
  'Staker',
  'Require staking tokens',
  'defi',
  '🔒',
  '{
    "type": "group",
    "operator": "AND",
    "conditions": [
      {
        "type": "staked_amount",
        "params": {
          "min_stake": "5000000000000000000",
          "min_duration_days": 30
        }
      }
    ]
  }'::jsonb,
  TRUE,
  NULL
),

-- Template 3: Token Holder OR Staker
(
  'Token Holder OR Staker',
  'Flexible entry - hold tokens or stake',
  'defi',
  '⚖️',
  '{
    "type": "group",
    "operator": "OR",
    "conditions": [
      {
        "type": "token_balance",
        "params": {
          "min_balance": "1000000000000000000",
          "token_address": ""
        }
      },
      {
        "type": "staked_amount",
        "params": {
          "min_stake": "500000000000000000"
        }
      }
    ]
  }'::jsonb,
  TRUE,
  NULL
),

-- Template 4: High-Value Member (AND logic)
(
  'High-Value Member',
  'Hold tokens AND stake AND have reputation',
  'defi',
  '💎',
  '{
    "type": "group",
    "operator": "AND",
    "conditions": [
      {
        "type": "token_balance",
        "params": {
          "min_balance": "10000000000000000000"
        }
      },
      {
        "type": "staked_amount",
        "params": {
          "min_stake": "5000000000000000000"
        }
      },
      {
        "type": "reputation",
        "params": {
          "min_reputation": 100
        }
      }
    ]
  }'::jsonb,
  TRUE,
  NULL
),

-- Template 5: NFT Community
(
  'NFT Holder',
  'Require holding specific NFTs',
  'nft',
  '🖼️',
  '{
    "type": "group",
    "operator": "AND",
    "conditions": [
      {
        "type": "nft_holding",
        "params": {
          "contract_address": "",
          "min_count": 1
        }
      }
    ]
  }'::jsonb,
  TRUE,
  NULL
),

-- Template 6: Active Worker
(
  'Active Worker',
  'Require worker status and completed jobs',
  'work',
  '⚡',
  '{
    "type": "group",
    "operator": "AND",
    "conditions": [
      {
        "type": "worker",
        "params": {
          "is_active": true,
          "min_completed_jobs": 10
        }
      }
    ]
  }'::jsonb,
  TRUE,
  NULL
),

-- Template 7: Complex Multi-Tier
(
  'Multi-Tier Access',
  'Complex nested conditions with multiple paths',
  'advanced',
  '🏗️',
  '{
    "type": "group",
    "operator": "OR",
    "groups": [
      {
        "type": "group",
        "operator": "AND",
        "name": "Tier 1: Premium",
        "conditions": [
          {
            "type": "token_balance",
            "params": {
              "min_balance": "50000000000000000000"
            }
          },
          {
            "type": "staked_amount",
            "params": {
              "min_stake": "25000000000000000000"
            }
          }
        ]
      },
      {
        "type": "group",
        "operator": "AND",
        "name": "Tier 2: Active Contributor",
        "conditions": [
          {
            "type": "token_balance",
            "params": {
              "min_balance": "10000000000000000000"
            }
          },
          {
            "type": "reputation",
            "params": {
              "min_reputation": 500
            }
          }
        ]
      }
    ]
  }'::jsonb,
  TRUE,
  NULL
);

-- ============================================================
-- Functions for rule evaluation
-- ============================================================

-- Function to get all members who qualify for a rule group
CREATE OR REPLACE FUNCTION get_qualifying_members(
  p_group_id INTEGER,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  user_id VARCHAR(255),
  username VARCHAR(255),
  passes BOOLEAN,
  details JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    du.user_id,
    du.username,
    rec.passes,
    rec.evaluation_data
  FROM rule_evaluation_cache rec
  JOIN discord_users du ON rec.user_id = du.user_id
  WHERE rec.group_id = p_group_id
    AND rec.passes = TRUE
    AND (rec.expires_at IS NULL OR rec.expires_at > NOW())
  ORDER BY rec.evaluated_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to count qualifying members
CREATE OR REPLACE FUNCTION count_qualifying_members(p_group_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  member_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO member_count
  FROM rule_evaluation_cache
  WHERE group_id = p_group_id
    AND passes = TRUE
    AND (expires_at IS NULL OR expires_at > NOW());

  RETURN COALESCE(member_count, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE rule_groups IS 'Hierarchical rule groups with logic operators (AND/OR/NOT)';
COMMENT ON TABLE group_conditions IS 'Individual conditions within rule groups';
COMMENT ON TABLE rule_templates IS 'Pre-built rule templates for quick setup';
COMMENT ON TABLE group_role_assignments IS 'Discord roles to assign when group conditions pass';
COMMENT ON TABLE rule_evaluation_cache IS 'Cached evaluation results for live preview';

COMMENT ON COLUMN rule_groups.logic_operator IS 'Logic operator: AND (all must pass), OR (any must pass), NOT (none must pass)';
COMMENT ON COLUMN group_conditions.negate IS 'If TRUE, inverts the condition (NOT operator)';
COMMENT ON COLUMN group_conditions.condition_data IS 'Flexible JSONB storage for condition parameters';
