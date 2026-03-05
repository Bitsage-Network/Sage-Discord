# 🧪 Reward System Phase 2 - Testing Guide

**Date:** January 3, 2026
**Phase:** 2 - NFT, POAP, and Webhook Rewards
**Status:** Ready for Testing

---

## 📋 Testing Prerequisites

### 1. Environment Setup

Ensure the following are configured in `.env`:

```bash
# Starknet Configuration
STARKNET_NETWORK=sepolia
STARKNET_RPC_URL=https://rpc.starknet-testnet.lava.build
STARKNET_ACCOUNT_ADDRESS=0x...  # Bot's Starknet wallet
STARKNET_PRIVATE_KEY=0x...      # Bot's private key

# Achievement NFT Contract (for POAPs)
ACHIEVEMENT_NFT_ADDRESS=0x...   # Deployed achievement_nft.cairo address
```

### 2. Database Migration

Verify migration 009 is applied:

```bash
docker exec -i bitsage-postgres psql -U bitsage bitsage -c "\dt reward*"
```

**Expected tables:**
- `reward_campaigns`
- `reward_claims`
- `reward_eligibility`
- `reward_delivery_queue`
- `reward_nft_configs` ← NEW
- `reward_nft_mints` ← NEW
- `reward_webhook_logs` ← NEW
- `reward_webhook_rate_limits` ← NEW
- `reward_webhook_secrets` ← NEW

### 3. Smart Contract Deployment

**For POAP Testing:**
1. Deploy `achievement_nft.cairo` to Starknet Sepolia
2. Grant bot minter role:
   ```cairo
   set_gamification_contract(bot_starknet_address)
   ```
3. Update `ACHIEVEMENT_NFT_ADDRESS` in `.env`

**For NFT Testing:**
1. Use any existing ERC721 contract you have minter access to
2. Or deploy a simple ERC721 for testing

### 4. Test Users

Create 3 test Discord accounts:
- **User A** - Has verified Starknet wallet
- **User B** - Has verified Starknet wallet
- **User C** - No verified wallet (for negative testing)

Verify wallets via `/verify` command for Users A and B.

---

## 🎯 Test Plan Overview

| Test Suite | Reward Type | Tests | Priority |
|-------------|-------------|-------|----------|
| **Suite 1** | NFT | 8 tests | High |
| **Suite 2** | POAP | 8 tests | High |
| **Suite 3** | Webhook | 10 tests | High |
| **Suite 4** | Integration | 6 tests | Medium |
| **Suite 5** | Error Handling | 8 tests | High |

**Total:** 40 tests

---

## 🧪 Test Suite 1: NFT Rewards (Transferable)

### Test 1.1: Create NFT Campaign via Admin UI

**Objective:** Verify admin can create NFT campaign through webapp

**Steps:**
1. Login to webapp as admin
2. Navigate to `/dashboard/guild/[id]/rewards`
3. Click "Create Reward Campaign"
4. Fill in form:
   - Name: "Genesis Avatar NFT"
   - Reward Type: "NFT (Transferable)"
   - Contract Address: `0x1234...` (your test ERC721)
   - Metadata URI: `ipfs://QmTest.../metadata/`
   - Auto-increment: ✅ Enabled
   - Token ID Start: `1`
   - Token ID End: `100`
   - Trigger Type: "Manual"
   - Eligibility: Min Level 5
5. Click "Create Campaign"

**Expected Result:**
- ✅ Campaign created successfully
- ✅ Database row in `reward_campaigns` with `reward_type = 'nft'`
- ✅ Database row in `reward_nft_configs` with contract details
- ✅ Campaign appears in rewards list

**Verification Query:**
```sql
SELECT c.name, c.reward_type, nc.contract_address, nc.auto_increment
FROM reward_campaigns c
JOIN reward_nft_configs nc ON c.id = nc.campaign_id
WHERE c.name = 'Genesis Avatar NFT';
```

---

### Test 1.2: User Claims NFT (Manual Trigger)

**Objective:** User with verified wallet can claim NFT reward

**Setup:**
- User A has verified Starknet wallet: `0xAAA...`
- User A has Level 5+

**Steps:**
1. User A runs `/rewards list` in Discord
2. Verify "Genesis Avatar NFT" shows as available
3. User A runs `/rewards claim Genesis Avatar NFT`
4. Wait for delivery (check queue processing)

**Expected Result:**
- ✅ Bot responds: "✅ Reward claimed! NFT minting in progress..."
- ✅ Database row in `reward_claims` with `status = 'completed'`
- ✅ Database row in `reward_nft_mints` with token_id = 1
- ✅ Transaction submitted to Starknet
- ✅ User A receives DM with:
  - Token ID: `1`
  - Contract: `0x1234...`
  - Explorer link to transaction

**Verification Query:**
```sql
SELECT m.token_id, m.wallet_address, m.tx_hash, c.discord_user_id
FROM reward_nft_mints m
JOIN reward_claims c ON m.claim_id = c.id
WHERE c.discord_user_id = 'user_a_discord_id';
```

**On-Chain Verification:**
1. Visit Starknet Sepolia explorer
2. Search for transaction hash from `reward_nft_mints.tx_hash`
3. Verify:
   - Status: "Success"
   - Function: `mint` or `safeMint`
   - Recipient: `0xAAA...` (User A's wallet)

---

### Test 1.3: NFT Auto-Increment Token IDs

**Objective:** Verify token IDs auto-increment correctly

**Steps:**
1. User B (Level 5+, verified wallet `0xBBB...`) runs `/rewards claim Genesis Avatar NFT`
2. Check assigned token ID

**Expected Result:**
- ✅ User B receives Token ID: `2` (auto-incremented from User A's `1`)
- ✅ Database shows `reward_nft_configs.current_token_id = 2`

**Verification Query:**
```sql
SELECT current_token_id FROM reward_nft_configs
WHERE campaign_id = (SELECT id FROM reward_campaigns WHERE name = 'Genesis Avatar NFT');
```

---

### Test 1.4: NFT Token ID Range Enforcement

**Objective:** Verify campaign stops when token ID range exhausted

**Setup:**
- Create campaign with `token_id_start = 1`, `token_id_end = 2`

**Steps:**
1. User A claims (gets Token ID 1)
2. User B claims (gets Token ID 2)
3. User C (verified wallet) tries to claim

**Expected Result:**
- ✅ User C receives error: "❌ No more NFTs available (max supply reached)"
- ✅ Claim not created in database
- ✅ No transaction submitted

---

### Test 1.5: NFT Claim Without Verified Wallet

**Objective:** Verify wallet verification requirement enforced

**Setup:**
- User C has NOT run `/verify`

**Steps:**
1. User C runs `/rewards claim Genesis Avatar NFT`

**Expected Result:**
- ✅ Bot responds: "❌ You must verify your Starknet wallet first! Use `/verify` to connect your wallet."
- ✅ No claim created
- ✅ No NFT minted

---

### Test 1.6: NFT Claim with Rule-Based Trigger

**Objective:** Verify auto-minting when user passes rule group

**Setup:**
1. Create rule group: "Whale Tier" (holds 10,000+ SAGE tokens)
2. Create NFT campaign:
   - Trigger Type: "Rule Pass"
   - Auto-claim: ✅ Enabled
   - Rule Group: "Whale Tier"

**Steps:**
1. User A verifies wallet (already holds 15,000 SAGE)
2. Wait for scheduler to process (30-second interval)

**Expected Result:**
- ✅ NFT automatically minted to User A (no manual claim needed)
- ✅ User A receives DM notification
- ✅ Database shows claim with `delivery_method = 'automatic'`

**Verification Query:**
```sql
SELECT c.discord_user_id, c.delivery_method, c.status, m.token_id
FROM reward_claims c
JOIN reward_nft_mints m ON c.id = m.claim_id
WHERE c.campaign_id = (SELECT id FROM reward_campaigns WHERE name = 'Whale Tier NFT');
```

---

### Test 1.7: NFT Cooldown Enforcement

**Objective:** Verify cooldown period between claims

**Setup:**
- Campaign with `cooldown_hours = 24`

**Steps:**
1. User A claims NFT successfully
2. User A tries to claim again immediately

**Expected Result:**
- ✅ Bot responds: "❌ You must wait 24 hours before claiming this reward again."
- ✅ Second claim rejected

---

### Test 1.8: NFT Max Claims Limit

**Objective:** Verify per-user claim limit enforcement

**Setup:**
- Campaign with `max_claims_per_user = 1`

**Steps:**
1. User A claims NFT successfully (Token ID 1)
2. User A tries to claim again after cooldown expires

**Expected Result:**
- ✅ Bot responds: "❌ You have already claimed this reward the maximum number of times."
- ✅ Second claim rejected

---

## 🎖️ Test Suite 2: POAP Rewards (Soulbound)

### Test 2.1: Create POAP Campaign via Admin UI

**Objective:** Verify admin can create POAP campaign

**Steps:**
1. Navigate to `/dashboard/guild/[id]/rewards`
2. Click "Create Reward Campaign"
3. Fill in form:
   - Name: "Discord OG POAP"
   - Reward Type: "POAP (Soulbound)"
   - Contract Address: `{ACHIEVEMENT_NFT_ADDRESS}`
   - Achievement Type: `100` (Discord OG)
   - Metadata URI: `ipfs://QmPOAP.../og.json`
   - Trigger Type: "Manual"
   - Eligibility: Min Messages 100
4. Click "Create Campaign"

**Expected Result:**
- ✅ Campaign created
- ✅ Database row with `reward_type = 'poap'`
- ✅ `reward_config` contains `achievement_type: 100`

---

### Test 2.2: User Claims POAP

**Objective:** User receives soulbound POAP NFT

**Setup:**
- User A has 150 messages, verified wallet `0xAAA...`

**Steps:**
1. User A runs `/rewards claim Discord OG POAP`
2. Wait for minting

**Expected Result:**
- ✅ Bot calls `mint_achievement()` on achievement_nft contract
- ✅ Parameters:
  - `recipient`: `0xAAA...`
  - `achievement_type`: `100`
  - `worker_id`: `feltFromDiscordId(user_a_id)`
- ✅ POAP appears in User A's wallet
- ✅ POAP is **non-transferable** (soulbound)

**On-Chain Verification:**
1. Check transaction on explorer
2. Verify function called: `mint_achievement`
3. Try to transfer POAP → should fail (soulbound)

---

### Test 2.3: POAP Achievement Type Validation

**Objective:** Verify achievement types 100-199 reserved for Discord

**Steps:**
1. Try to create POAP with `achievement_type = 5` (worker achievement)

**Expected Result:**
- ✅ Frontend validation error: "Achievement type must be between 100-199 for Discord rewards"
- ✅ Campaign creation rejected

---

### Test 2.4: POAP Duplicate Prevention

**Objective:** Verify one POAP per user per campaign

**Setup:**
- Campaign: "Discord OG POAP"
- User A already claimed

**Steps:**
1. User A tries to claim again

**Expected Result:**
- ✅ Bot responds: "❌ You have already claimed this POAP."
- ✅ No second mint

---

### Test 2.5: POAP with Auto-Claim on Join

**Objective:** Auto-mint POAP when user joins server

**Setup:**
1. Create POAP campaign:
   - Trigger Type: "Event"
   - Event: "Member Join"
   - Auto-claim: ✅ Enabled

**Steps:**
1. New user joins Discord server
2. New user runs `/verify` to connect wallet
3. Wait for scheduler

**Expected Result:**
- ✅ POAP automatically minted to new user
- ✅ DM sent: "Welcome! You received the 'New Member POAP'!"

---

### Test 2.6: POAP Metadata URI

**Objective:** Verify metadata URI passed correctly to contract

**Steps:**
1. Create POAP with metadata URI: `ipfs://QmTest123/poap.json`
2. User claims POAP
3. Check on-chain metadata

**Expected Result:**
- ✅ Contract stores correct metadata URI
- ✅ NFT marketplaces display POAP with correct image/description

---

### Test 2.7: POAP Gas Fee Monitoring

**Objective:** Verify bot pays gas fees

**Steps:**
1. Check bot's Starknet balance before mint
2. User claims POAP
3. Check bot's balance after mint

**Expected Result:**
- ✅ Bot's balance decreased by gas fee amount
- ✅ User did NOT pay any gas fees

**Verification:**
```bash
# Check bot balance
starkli balance $STARKNET_ACCOUNT_ADDRESS --rpc $STARKNET_RPC_URL
```

---

### Test 2.8: POAP Max Supply

**Objective:** Verify limited edition POAPs

**Setup:**
- Campaign with `max_claims = 500`

**Steps:**
1. Simulate 500 claims (or check counter)
2. 501st user tries to claim

**Expected Result:**
- ✅ 501st claim rejected: "❌ All POAPs have been claimed (500/500)"

---

## 🔗 Test Suite 3: Webhook Rewards

### Test 3.1: Create Webhook Campaign via Admin UI

**Objective:** Verify admin can create webhook campaign

**Setup:**
- Use webhook testing service: https://webhook.site (get unique URL)

**Steps:**
1. Navigate to `/dashboard/guild/[id]/rewards`
2. Click "Create Reward Campaign"
3. Fill in form:
   - Name: "External Platform Sync"
   - Reward Type: "Webhook"
   - URL: `https://webhook.site/your-unique-id`
   - Method: "POST"
   - Headers: `{"X-API-Key": "test-key"}`
   - Use HMAC: ✅ Enabled
   - HMAC Secret: `shared-secret-123`
   - Rate Limit: `100` calls/hour
   - Timeout: `10000` ms
4. Click "Create Campaign"

**Expected Result:**
- ✅ Campaign created
- ✅ Database row with `reward_type = 'webhook'`
- ✅ HMAC secret stored in `reward_webhook_secrets` (hashed)
- ✅ Rate limit config in `reward_webhook_rate_limits`

---

### Test 3.2: User Claims Webhook Reward

**Objective:** Verify webhook called with correct payload

**Steps:**
1. User A runs `/rewards claim External Platform Sync`
2. Check webhook.site for received request

**Expected Result:**
- ✅ Bot responds: "✅ Reward claimed! External action triggered."
- ✅ Webhook received POST request
- ✅ Payload contains:
```json
{
  "event": "reward.claimed",
  "campaign_id": "uuid",
  "campaign_name": "External Platform Sync",
  "discord_user_id": "user_a_discord_id",
  "discord_username": "UserA#1234",
  "wallet_address": "0xAAA...",
  "claimed_at": "2026-01-03T10:30:00Z",
  "reward_type": "webhook",
  "reward_config": {...}
}
```

**Verification Query:**
```sql
SELECT webhook_url, request_payload, response_status, success
FROM reward_webhook_logs
WHERE campaign_id = (SELECT id FROM reward_campaigns WHERE name = 'External Platform Sync')
ORDER BY created_at DESC LIMIT 1;
```

---

### Test 3.3: Webhook HMAC Signature Validation

**Objective:** Verify HMAC signature included in headers

**Steps:**
1. User claims webhook reward
2. Check webhook.site request headers

**Expected Result:**
- ✅ Header `X-BitSage-Signature` present
- ✅ Format: `sha256=abc123def456...`
- ✅ Header `X-BitSage-Timestamp` present
- ✅ Format: Unix timestamp in milliseconds

**Manual Verification:**
```javascript
// External platform validates signature:
const crypto = require('crypto');
const payload = JSON.stringify(requestBody);
const secret = 'shared-secret-123';

const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload);
const expectedSignature = 'sha256=' + hmac.digest('hex');

console.log('Expected:', expectedSignature);
console.log('Received:', headers['x-bitsage-signature']);
// Should match ✅
```

---

### Test 3.4: Webhook Rate Limiting

**Objective:** Verify rate limit enforced per campaign

**Setup:**
- Campaign with `rate_limit = 5` calls/hour

**Steps:**
1. User A claims 5 times (within 1 hour)
2. User A tries 6th claim

**Expected Result:**
- ✅ First 5 claims succeed
- ✅ 6th claim rejected: "❌ Rate limit exceeded. Try again later."
- ✅ Database shows rate limit hit in `reward_webhook_rate_limits`

**Verification Query:**
```sql
SELECT call_count, max_calls_per_window, window_end
FROM reward_webhook_rate_limits
WHERE campaign_id = (SELECT id FROM reward_campaigns WHERE name = 'External Platform Sync');
```

---

### Test 3.5: Webhook Retry on Failure

**Objective:** Verify retry logic with exponential backoff

**Setup:**
- Configure webhook.site to return 500 error for first 2 requests

**Steps:**
1. User claims reward
2. Monitor webhook.site request log
3. Check database logs

**Expected Result:**
- ✅ Attempt 1: Immediate (fails with 500)
- ✅ Attempt 2: After 2 seconds (fails with 500)
- ✅ Attempt 3: After 4 seconds (succeeds or fails permanently)
- ✅ Database shows 3 entries in `reward_webhook_logs` with same `claim_id`

**Verification Query:**
```sql
SELECT attempt_number, response_status, success, created_at
FROM reward_webhook_logs
WHERE claim_id = 'specific_claim_id'
ORDER BY attempt_number;
```

---

### Test 3.6: Webhook Timeout

**Objective:** Verify timeout protection

**Setup:**
- Configure webhook.site to delay response by 15 seconds
- Campaign timeout: `10000` ms (10 seconds)

**Steps:**
1. User claims reward
2. Wait for timeout

**Expected Result:**
- ✅ Request cancelled after 10 seconds
- ✅ Database log shows:
  - `success = false`
  - `error_message = 'Request timeout'`
  - `response_time_ms >= 10000`

---

### Test 3.7: Webhook 4xx Error (No Retry)

**Objective:** Verify 4xx errors don't retry

**Setup:**
- Configure webhook.site to return 400 Bad Request

**Steps:**
1. User claims reward
2. Check retry attempts

**Expected Result:**
- ✅ Only 1 attempt made
- ✅ No retries (4xx = client error = permanent failure)
- ✅ User notified: "❌ Reward delivery failed. Contact admin."

---

### Test 3.8: Webhook Custom Headers

**Objective:** Verify custom headers passed correctly

**Steps:**
1. Create campaign with headers:
```json
{
  "X-API-Key": "secret-key-123",
  "X-Custom-Header": "custom-value",
  "Content-Type": "application/json"
}
```
2. User claims reward
3. Check webhook.site request headers

**Expected Result:**
- ✅ All custom headers present in request
- ✅ Plus automatic headers:
  - `X-BitSage-Signature`
  - `X-BitSage-Timestamp`

---

### Test 3.9: Webhook Response Logging

**Objective:** Verify request/response logged for audit

**Steps:**
1. User claims webhook reward
2. Query webhook logs

**Expected Result:**
- ✅ Database row in `reward_webhook_logs` contains:
  - `request_payload` (full JSON)
  - `request_headers` (JSON)
  - `response_body` (full response)
  - `response_status` (HTTP code)
  - `response_time_ms` (latency)
  - `success` (true/false)

**Query:**
```sql
SELECT
  webhook_url,
  response_status,
  response_time_ms,
  LENGTH(request_payload::text) as payload_size,
  success
FROM reward_webhook_logs
WHERE campaign_id = 'webhook_campaign_id'
ORDER BY created_at DESC LIMIT 10;
```

---

### Test 3.10: Webhook with GET Method

**Objective:** Verify GET requests supported

**Setup:**
- Create campaign with `method = 'GET'`
- URL with query params: `https://webhook.site/abc?user_id={{discord_user_id}}`

**Steps:**
1. User claims reward
2. Check webhook.site

**Expected Result:**
- ✅ GET request sent (not POST)
- ✅ Query parameters populated
- ✅ No request body (GET requests don't have body)

---

## 🔄 Test Suite 4: Integration Tests

### Test 4.1: Mixed Reward Campaign (Role + NFT)

**Objective:** Verify multiple reward types in single flow

**Setup:**
1. Create rule group: "VIP Member" (holds 5,000+ SAGE)
2. Create 2 campaigns:
   - Campaign A: Discord Role "VIP"
   - Campaign B: NFT "VIP Avatar"
   - Both use same rule group, both auto-claim

**Steps:**
1. User A verifies wallet with 6,000 SAGE
2. Wait for scheduler (30s)

**Expected Result:**
- ✅ User A receives VIP role
- ✅ User A receives VIP Avatar NFT
- ✅ Both claims created in database
- ✅ User A receives single DM with both rewards listed

---

### Test 4.2: Reward Scheduler Performance

**Objective:** Verify queue processes efficiently

**Setup:**
- Create 10 NFT campaigns
- 5 users claim all 10 (50 total claims)

**Steps:**
1. All 5 users claim simultaneously
2. Monitor `reward_delivery_queue` table
3. Measure processing time

**Expected Result:**
- ✅ All 50 claims processed within 5 minutes
- ✅ No duplicate deliveries
- ✅ Queue table empty after processing

**Verification Query:**
```sql
SELECT status, COUNT(*) FROM reward_delivery_queue GROUP BY status;
-- Expected: All 'completed' or 'failed', none 'pending'
```

---

### Test 4.3: Eligibility Cache Update

**Objective:** Verify eligibility cache refreshes correctly

**Setup:**
- Campaign requires Level 10
- User A is Level 9

**Steps:**
1. User A tries to claim → rejected (ineligible)
2. User A gains XP and reaches Level 10
3. Eligibility cache refreshes (background job)
4. User A tries to claim again

**Expected Result:**
- ✅ First claim rejected
- ✅ After level-up, second claim succeeds
- ✅ Cache table updated

**Verification Query:**
```sql
SELECT discord_user_id, is_eligible, last_checked_at
FROM reward_eligibility
WHERE campaign_id = 'specific_campaign'
  AND discord_user_id = 'user_a_discord_id';
```

---

### Test 4.4: Cross-Campaign Analytics

**Objective:** Verify analytics queries work across all reward types

**Query:**
```sql
-- Total rewards claimed per type
SELECT
  reward_type,
  COUNT(*) as total_claims,
  COUNT(DISTINCT discord_user_id) as unique_claimers
FROM reward_claims c
JOIN reward_campaigns r ON c.campaign_id = r.id
WHERE c.status = 'completed'
GROUP BY reward_type
ORDER BY total_claims DESC;
```

**Expected Result:**
- ✅ Shows breakdown by type: role, xp, access_grant, nft, poap, webhook
- ✅ All counts match manual verification

---

### Test 4.5: Failed Delivery Recovery

**Objective:** Verify failed deliveries can be retried manually

**Setup:**
1. Create NFT campaign
2. Temporarily disable bot's Starknet account (cause mint to fail)
3. User claims NFT

**Steps:**
1. Claim fails with error
2. Re-enable bot's Starknet account
3. Admin triggers manual retry (via admin UI or direct DB update)

**Expected Result:**
- ✅ Initial claim status: `failed`
- ✅ After retry, status: `completed`
- ✅ NFT minted successfully

---

### Test 4.6: Multi-Guild Isolation

**Objective:** Verify rewards isolated per guild

**Setup:**
- Create identical campaign in Guild A and Guild B
- User is member of both guilds

**Steps:**
1. User claims in Guild A
2. User claims in Guild B

**Expected Result:**
- ✅ Both claims succeed (not counted as duplicate)
- ✅ User receives 2 separate NFTs
- ✅ Database shows 2 claims with different `guild_id`

---

## ⚠️ Test Suite 5: Error Handling & Edge Cases

### Test 5.1: Starknet RPC Failure

**Objective:** Verify graceful handling of RPC downtime

**Setup:**
- Temporarily set `STARKNET_RPC_URL` to invalid endpoint

**Steps:**
1. User claims NFT reward

**Expected Result:**
- ✅ Error logged: "Failed to connect to Starknet RPC"
- ✅ Claim marked as `failed`
- ✅ User receives error message
- ✅ Claim can be retried later

---

### Test 5.2: Insufficient Bot Balance

**Objective:** Verify error when bot can't pay gas fees

**Setup:**
- Drain bot's Starknet wallet to 0 ETH

**Steps:**
1. User claims POAP reward

**Expected Result:**
- ✅ Error: "Insufficient balance for gas fees"
- ✅ Claim marked as `failed`
- ✅ Admin receives notification
- ✅ User receives: "❌ Reward delivery failed. Admin has been notified."

---

### Test 5.3: Invalid Contract Address

**Objective:** Verify validation of contract addresses

**Steps:**
1. Try to create NFT campaign with invalid address: `0xINVALID`

**Expected Result:**
- ✅ Frontend validation error
- ✅ Campaign not created

---

### Test 5.4: Malformed Webhook URL

**Objective:** Verify webhook URL validation

**Steps:**
1. Try to create webhook campaign with URL: `not-a-url`

**Expected Result:**
- ✅ Zod validation error: "Invalid URL format"
- ✅ Campaign not created

---

### Test 5.5: Webhook Response > 5MB

**Objective:** Verify large response handling

**Setup:**
- Configure webhook.site to return 10MB response

**Steps:**
1. User claims webhook reward

**Expected Result:**
- ✅ Request succeeds (or times out)
- ✅ Response body truncated in database (to prevent bloat)
- ✅ Log shows: `response_body_truncated = true`

---

### Test 5.6: Concurrent Claims (Race Condition)

**Objective:** Verify no duplicate mints from simultaneous claims

**Setup:**
- Campaign with `max_claims_per_user = 1`

**Steps:**
1. User A runs `/rewards claim` command
2. Immediately (< 1 second) runs same command again

**Expected Result:**
- ✅ Only 1 claim created
- ✅ Only 1 NFT minted
- ✅ Second command receives: "You already have a pending claim for this reward"

---

### Test 5.7: Special Characters in Campaign Name

**Objective:** Verify input sanitization

**Steps:**
1. Create campaign with name: `Test "Campaign" <script>alert('xss')</script>`

**Expected Result:**
- ✅ Name saved correctly (escaped)
- ✅ No XSS vulnerability in frontend
- ✅ Bot commands work correctly

---

### Test 5.8: Very Long Metadata URIs

**Objective:** Verify handling of long URIs (>2000 chars)

**Steps:**
1. Create NFT campaign with 3000-character metadata URI

**Expected Result:**
- ✅ Validation error: "Metadata URI too long (max 2000 characters)"
- ✅ Or: URI truncated/hashed

---

## 📊 Success Criteria Summary

Phase 2 testing is complete when:

### Backend
- [ ] All 8 NFT tests pass
- [ ] All 8 POAP tests pass
- [ ] All 10 Webhook tests pass
- [ ] All 6 Integration tests pass
- [ ] All 8 Error Handling tests pass

### Frontend
- [ ] Admin can create all 3 new reward types via UI
- [ ] Campaigns display correctly in rewards list
- [ ] Form validation works for all fields
- [ ] No console errors in browser

### Database
- [ ] All 5 new tables have data
- [ ] Foreign key constraints enforced
- [ ] Indexes improve query performance
- [ ] Analytics queries return correct results

### Documentation
- [ ] All test results documented
- [ ] Known issues logged with workarounds
- [ ] Deployment steps verified

---

## 🔧 Testing Tools

### Database Queries

**Check campaign stats:**
```sql
SELECT
  c.name,
  c.reward_type,
  COUNT(cl.id) as total_claims,
  SUM(CASE WHEN cl.status = 'completed' THEN 1 ELSE 0 END) as successful,
  SUM(CASE WHEN cl.status = 'failed' THEN 1 ELSE 0 END) as failed
FROM reward_campaigns c
LEFT JOIN reward_claims cl ON c.id = cl.campaign_id
GROUP BY c.id, c.name, c.reward_type;
```

**Check NFT mints:**
```sql
SELECT
  m.token_id,
  m.contract_address,
  m.wallet_address,
  m.tx_hash,
  m.minted_at,
  c.name as campaign_name
FROM reward_nft_mints m
JOIN reward_campaigns c ON m.campaign_id = c.id
ORDER BY m.minted_at DESC LIMIT 20;
```

**Check webhook logs:**
```sql
SELECT
  webhook_url,
  response_status,
  response_time_ms,
  success,
  error_message,
  created_at
FROM reward_webhook_logs
ORDER BY created_at DESC LIMIT 20;
```

### Starknet Explorer

**Verify transactions:**
- Sepolia: https://sepolia.voyager.online/
- Search by tx hash from `reward_nft_mints.tx_hash`

### Webhook Testing

**Services:**
- https://webhook.site - Get unique URL, view requests
- https://requestbin.com - Alternative
- https://beeceptor.com - Mock API responses

---

## 📝 Test Reporting Template

```markdown
## Test Report: [Test Name]

**Date:** YYYY-MM-DD
**Tester:** [Your Name]
**Environment:** Development / Staging / Production

### Test Details
- **Suite:** Suite X
- **Test ID:** X.Y
- **Priority:** High / Medium / Low

### Result
- [x] PASS
- [ ] FAIL
- [ ] BLOCKED

### Evidence
- Screenshots: [attach]
- Database queries: [results]
- Transaction hashes: [links]
- Logs: [paste relevant logs]

### Issues Found
1. [Issue description]
   - Severity: Critical / Major / Minor
   - Workaround: [if any]
   - Ticket: [link]

### Notes
[Any additional observations]
```

---

## 🎉 Next Steps After Testing

Once all tests pass:

1. **Update Status Docs**
   - Mark Phase 2 as "✅ Production Ready" in `REWARD_PHASE2_INTEGRATION_SUMMARY.md`

2. **Deploy to Production**
   - Run migration on production DB
   - Update production `.env` with Starknet config
   - Deploy achievement_nft.cairo to mainnet
   - Restart bot and webapp

3. **User Communication**
   - Announce new reward types in Discord
   - Create tutorial for admins
   - Update bot `/help` command

4. **Monitoring**
   - Set up alerts for failed NFT mints
   - Monitor bot's Starknet balance
   - Track webhook success rates

---

**Testing Guide Created:** January 3, 2026
**Total Tests:** 40
**Estimated Testing Time:** 8-12 hours (comprehensive)

Good luck with testing! 🚀
