# Reward Management System - Testing Guide

## Overview

This guide will walk you through testing all aspects of the Reward Management System (Phase 1).

## Prerequisites

1. **Database Migration Applied**
   ```bash
   docker exec -i bitsage-postgres psql -U bitsage bitsage < migrations/008_reward_management.sql
   ```

2. **Services Running**
   - PostgreSQL database
   - Next.js webapp (`npm run dev` in webapp/)
   - Discord bot (`npm run dev` in root)

3. **Test Guild Setup**
   - A Discord server with the bot installed
   - Guild registered in the webapp
   - At least one user with verified wallet (for rule-based rewards)

---

## Test Checklist

### ✅ Backend Services

#### 1. Bot Initialization
```bash
# Start the bot and verify reward services initialize
npm run dev
```

**Expected output:**
```
✅ Token-gating services initialized
✅ Reward management services initialized
✅ Bot is ready! Logged in as YourBot#1234
```

#### 2. Database Tables
```sql
-- Verify all tables exist
\dt reward*

-- Expected output:
-- reward_campaigns
-- reward_claims
-- reward_eligibility
-- reward_delivery_queue
```

#### 3. Reward Delivery Service Test
Test role delivery (requires Discord server):
1. Create a campaign manually in database
2. Trigger delivery via reward scheduler
3. Verify role is assigned in Discord

---

### ✅ Bot Commands

#### 1. `/reward list`
**Steps:**
1. Run `/reward list` in Discord
2. Verify it shows available campaigns
3. Verify claimed vs available status

**Expected result:**
- Shows campaign name, type, claim count
- Displays "Available" or "Claimed" status
- Empty state message if no campaigns

#### 2. `/reward claim [campaign]`
**Test Case 1: Successful Claim**
1. Create eligible campaign in webapp
2. Run `/reward claim [campaign-name]`
3. Verify success message
4. Check reward is delivered (role, XP, or access)

**Expected result:**
```
✅ Reward claimed successfully!
You've received: [Reward details]
```

**Test Case 2: Already Claimed**
1. Claim the same campaign again
2. Verify error message

**Expected result:**
```
❌ You've already claimed this reward!
Cooldown: One-time only
```

**Test Case 3: Not Eligible**
1. Create campaign with requirements (min level 10)
2. User with level < 10 tries to claim
3. Verify error message

**Expected result:**
```
❌ You don't meet the eligibility requirements
Requirements:
• Level 10+ (you have: 5)
```

#### 3. `/reward status`
**Steps:**
1. Run `/reward status`
2. Verify it shows claim history

**Expected result:**
- List of claimed rewards
- Claim dates
- Reward types

---

### ✅ Webapp API Routes

#### 1. List Campaigns
**Endpoint:** `GET /api/guilds/[id]/rewards`

```bash
curl http://localhost:3000/api/guilds/YOUR_GUILD_ID/rewards \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

**Expected response:**
```json
{
  "success": true,
  "campaigns": [
    {
      "id": "uuid",
      "name": "Early Supporter",
      "reward_type": "role",
      "status": "active",
      "total_claims": 15,
      "successful_claims": 14
    }
  ],
  "count": 1
}
```

#### 2. Create Campaign
**Endpoint:** `POST /api/guilds/[id]/rewards`

```bash
curl -X POST http://localhost:3000/api/guilds/YOUR_GUILD_ID/rewards \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{
    "name": "Test XP Reward",
    "description": "500 XP for testing",
    "reward_type": "xp",
    "reward_config": {"xp_amount": 500},
    "trigger_type": "manual",
    "cooldown_hours": 0
  }'
```

**Expected response:**
```json
{
  "success": true,
  "campaign": {
    "id": "uuid",
    "name": "Test XP Reward",
    "status": "active"
  }
}
```

#### 3. Update Campaign
**Endpoint:** `PATCH /api/guilds/[id]/rewards/[campaignId]`

```bash
curl -X PATCH http://localhost:3000/api/guilds/YOUR_GUILD_ID/rewards/CAMPAIGN_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{"status": "paused"}'
```

#### 4. Delete Campaign
**Endpoint:** `DELETE /api/guilds/[id]/rewards/[campaignId]`

```bash
curl -X DELETE http://localhost:3000/api/guilds/YOUR_GUILD_ID/rewards/CAMPAIGN_ID \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

#### 5. View Claims
**Endpoint:** `GET /api/guilds/[id]/rewards/[campaignId]/claims`

```bash
curl http://localhost:3000/api/guilds/YOUR_GUILD_ID/rewards/CAMPAIGN_ID/claims \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

#### 6. Preview Eligible Users
**Endpoint:** `POST /api/guilds/[id]/rewards/[campaignId]/preview`

```bash
curl -X POST http://localhost:3000/api/guilds/YOUR_GUILD_ID/rewards/CAMPAIGN_ID/preview \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

#### 7. Refresh Eligibility Cache
**Endpoint:** `PUT /api/guilds/[id]/rewards/[campaignId]/preview`

```bash
curl -X PUT http://localhost:3000/api/guilds/YOUR_GUILD_ID/rewards/CAMPAIGN_ID/preview \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
```

---

### ✅ Webapp UI Components

#### 1. Rewards List Page
**Path:** `/dashboard/guild/[id]/rewards`

**Test Steps:**
1. Navigate to guild dashboard
2. Click "Reward Campaigns" card
3. Verify rewards list page loads

**Expected elements:**
- Header with "Reward Campaigns" title
- "Create Campaign" button
- Empty state (if no campaigns)
- Campaign cards (if campaigns exist)
- Each card shows: name, status, type, claim stats
- Toggle switch for active/paused
- Edit/Delete/View Claims buttons

#### 2. Create Reward Dialog
**Test Steps:**
1. Click "Create Campaign" button
2. Verify dialog opens with all sections

**Test each reward type:**

**Role Reward:**
1. Select "Discord Role" type
2. Multi-select roles from dropdown
3. Verify role picker loads Discord roles
4. Create campaign
5. Verify API call succeeds

**XP Reward:**
1. Select "XP/Points" type
2. Enter XP amount (e.g., 500)
3. Create campaign
4. Verify API call succeeds

**Access Grant Reward:**
1. Select "Channel Access" type
2. Select channels from multi-select
3. Set duration (0 for permanent, or hours)
4. Create campaign
5. Verify API call succeeds

#### 3. Trigger Types

**Manual Claim:**
1. Set trigger type to "Manual Claim"
2. Verify auto-claim toggle is hidden
3. Create campaign
4. Users must run `/reward claim` to get reward

**Rule-Based:**
1. Set trigger type to "Rule-Based"
2. Select a rule group
3. Enable auto-claim toggle
4. Create campaign
5. When user passes rule group, reward auto-delivers

#### 4. Eligibility Requirements

**Rule Group:**
1. Select "Link to Rule Group"
2. Choose a rule group from dropdown
3. Verify custom requirements are disabled
4. Create campaign
5. Only users passing the rule group can claim

**Custom Requirements:**
1. Select "Custom Requirements"
2. Set min level (e.g., 10)
3. Set min XP (e.g., 5000)
4. Set min messages (e.g., 100)
5. Create campaign
6. Only users meeting ALL requirements can claim

#### 5. Campaign Settings

**Max Claims:**
1. Set max claims to 100
2. Create campaign
3. Verify campaign ends after 100 claims

**Cooldown:**
1. Set cooldown to 24 hours
2. Create campaign
3. User can claim, wait 24h, claim again

**One-time (cooldown = 0):**
1. Keep default cooldown = 0
2. User can only claim once ever

---

### ✅ Integration Tests

#### 1. Role Reward Delivery
**Steps:**
1. Create role reward campaign (manual claim)
2. User runs `/reward claim [campaign]`
3. Verify role is assigned in Discord
4. Check database: `reward_claims` has entry with status = 'completed'

**SQL Verification:**
```sql
SELECT * FROM reward_claims
WHERE discord_user_id = 'USER_ID'
AND campaign_id = 'CAMPAIGN_ID';

-- Expected: status = 'completed', delivery_method = 'manual'
```

#### 2. XP Reward Delivery
**Steps:**
1. Create XP reward campaign (500 XP)
2. Check user's current XP: `SELECT xp FROM discord_users WHERE user_id = 'USER_ID'`
3. User claims reward
4. Verify XP increased by 500

**SQL Verification:**
```sql
SELECT xp FROM discord_users WHERE user_id = 'USER_ID';
-- Should be +500 from before
```

#### 3. Access Grant Delivery
**Steps:**
1. Create access grant campaign
2. User claims reward
3. Verify channel permissions in Discord
4. Check channel overwrites include user

**Discord Verification:**
- User can now see/access the granted channels
- Channel permissions show explicit allow for user

#### 4. Rule-Based Auto-Claim
**Steps:**
1. Create rule-based campaign with auto_claim = true
2. Link to a rule group (e.g., "Hold 100 SAGE tokens")
3. User verifies wallet and passes rule
4. Verify reward auto-delivers (no `/reward claim` needed)

**Expected flow:**
1. User runs `/verify`
2. Wallet passes rule group
3. Roles assigned from token-gating
4. Reward scheduler triggers
5. Reward auto-delivered
6. User receives DM notification

**SQL Verification:**
```sql
SELECT * FROM reward_claims
WHERE discord_user_id = 'USER_ID'
AND delivery_method = 'auto';

-- Expected: status = 'completed'
```

#### 5. Eligibility Caching
**Steps:**
1. Create campaign with custom requirements (level 10)
2. Refresh eligibility cache (PUT /preview)
3. Check `reward_eligibility` table

**SQL Verification:**
```sql
SELECT * FROM reward_eligibility
WHERE campaign_id = 'CAMPAIGN_ID';

-- Should show all guild members with eligible = true/false
```

#### 6. Delivery Queue Processing
**Steps:**
1. Create campaign
2. User claims reward
3. Check delivery queue

**SQL Verification:**
```sql
SELECT * FROM reward_delivery_queue
WHERE discord_user_id = 'USER_ID'
ORDER BY created_at DESC;

-- Expected: status = 'processing' or 'completed'
```

**Monitor logs:**
```
[RewardScheduler] Processing queue: 1 pending deliveries
[RewardDelivery] Delivering role reward to USER_ID
[RewardDelivery] ✅ Role reward delivered successfully
```

---

### ✅ Error Handling Tests

#### 1. Invalid Campaign Data
**Test:** Create campaign with invalid reward_config

```json
{
  "name": "Bad Campaign",
  "reward_type": "role",
  "reward_config": {},  // Missing role_ids
  "trigger_type": "manual"
}
```

**Expected:** 400 Bad Request with validation error

#### 2. Missing Roles/Channels
**Test:** Create campaign with non-existent Discord role ID

**Expected:**
- Campaign creates successfully
- Delivery fails with error logged
- Claim status = 'failed'
- Error message saved to database

#### 3. Unauthorized Access
**Test:** Non-admin user tries to create campaign

**Expected:** 403 Forbidden

#### 4. Cooldown Enforcement
**Test:** User tries to claim before cooldown expires

**Expected:** Error message with time remaining

#### 5. Max Claims Reached
**Test:** Campaign reaches max_claims limit

**Expected:**
- Campaign status auto-updates to 'ended'
- New claim attempts return error

---

### ✅ Performance Tests

#### 1. Eligibility Cache Refresh
**Test:** Refresh cache for campaign with 1000 members

**Expected:**
- Background job completes within 30 seconds
- Returns immediately with job started message
- Cache updates in background

#### 2. Queue Processing
**Test:** Create 100 claims simultaneously

**Expected:**
- All added to queue
- Processed within 5 minutes (30s intervals)
- No duplicate deliveries

---

## Test Scenarios by Reward Type

### Scenario 1: Early Supporter Role
**Campaign:**
- Type: Role
- Trigger: Manual
- Eligibility: None
- Max Claims: 100
- Cooldown: 0 (one-time)

**Test Flow:**
1. Create campaign via webapp
2. User runs `/reward list` - sees campaign
3. User runs `/reward claim Early Supporter`
4. Role assigned in Discord
5. User runs `/reward claim Early Supporter` again - error (already claimed)

### Scenario 2: Weekly XP Bonus
**Campaign:**
- Type: XP
- Amount: 1000 XP
- Trigger: Manual
- Eligibility: Level 5+
- Max Claims: None
- Cooldown: 168 hours (7 days)

**Test Flow:**
1. Create campaign
2. Level 3 user tries to claim - error (not eligible)
3. Level 5 user claims - receives 1000 XP
4. Same user tries to claim next day - error (cooldown)
5. After 7 days - can claim again

### Scenario 3: VIP Channel Access (Rule-Based)
**Campaign:**
- Type: Access Grant
- Channels: #vip-lounge, #exclusive-news
- Duration: 30 days
- Trigger: Rule-Based (hold 1000 SAGE)
- Auto-claim: Yes
- Eligibility: Rule group "Whale Tier"

**Test Flow:**
1. Create campaign linked to rule group
2. User verifies wallet with 1500 SAGE
3. Passes rule group - roles assigned
4. Reward auto-triggers
5. User gains access to VIP channels
6. Receives DM notification
7. After 30 days - access expires

---

## Debugging Tips

### Check Logs
```bash
# Bot logs
tail -f logs/bot.log | grep -i reward

# Webapp logs
tail -f logs/webapp.log | grep -i reward
```

### Database Queries
```sql
-- View all campaigns
SELECT * FROM reward_campaigns;

-- View claims for a campaign
SELECT rc.*, du.username
FROM reward_claims rc
JOIN discord_users du ON rc.discord_user_id = du.user_id
WHERE rc.campaign_id = 'CAMPAIGN_ID';

-- View delivery queue
SELECT * FROM reward_delivery_queue
WHERE status = 'pending'
ORDER BY priority DESC, scheduled_for ASC;

-- View eligibility cache
SELECT re.*, du.username
FROM reward_eligibility re
JOIN discord_users du ON re.discord_user_id = du.user_id
WHERE re.campaign_id = 'CAMPAIGN_ID'
AND re.eligible = true;
```

### Common Issues

**Issue:** Reward not delivering
- Check bot has permission to assign roles
- Verify role exists in Discord
- Check delivery queue status
- Review error logs

**Issue:** Eligibility check failing
- Refresh eligibility cache
- Verify rule group evaluation
- Check user's level/XP in database

**Issue:** Auto-claim not triggering
- Verify `global.rewardScheduler` is initialized
- Check trigger hook in verification-service.ts
- Verify rule_group_id matches

---

## Success Criteria

All tests pass when:

- ✅ All 3 reward types deliver correctly (role, XP, access grant)
- ✅ Manual claim via `/reward claim` works
- ✅ Rule-based auto-claim triggers after verification
- ✅ Eligibility requirements enforced (rule groups, custom)
- ✅ Cooldown system prevents early re-claims
- ✅ Max claims limit stops campaign when reached
- ✅ Webapp UI creates/edits/deletes campaigns
- ✅ API returns proper error messages
- ✅ Queue processes deliveries in background
- ✅ Failed deliveries retry correctly
- ✅ Analytics events logged for all actions

---

## Next Steps

Once Phase 1 testing is complete:

1. **Phase 2 Planning:**
   - NFT minting rewards
   - Custom Starknet POAP system
   - Webhook rewards with HMAC signatures

2. **Performance Optimization:**
   - Add caching for frequently accessed campaigns
   - Optimize eligibility checks for large guilds

3. **User Feedback:**
   - Gather community feedback on reward types
   - Identify most-used features
   - Plan additional reward types

---

**Testing completed on:** [DATE]
**Tested by:** [NAME]
**Version:** Phase 1 (MVP)
