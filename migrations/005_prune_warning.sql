-- ============================================================================
-- Migration 005: Add Prune Warning Tracking
-- ============================================================================
-- Description: Adds column to track if prune warning has been sent
-- Date: 2026-01-02
-- Author: BitSage Team

-- Add prune_warning_sent column to member_verification_status
ALTER TABLE member_verification_status
ADD COLUMN IF NOT EXISTS prune_warning_sent BOOLEAN DEFAULT FALSE;

-- Add index for efficient warning queries
CREATE INDEX IF NOT EXISTS idx_member_verification_warning
ON member_verification_status(prune_warning_sent)
WHERE is_verified = FALSE AND is_kicked = FALSE;

-- Add comment
COMMENT ON COLUMN member_verification_status.prune_warning_sent IS
'Tracks whether a warning DM was sent before auto-pruning';
