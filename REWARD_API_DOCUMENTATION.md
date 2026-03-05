# 🎁 Reward Management System - API Documentation

**Base URL:** `/api/guilds/[id]/rewards`

All endpoints require authentication via NextAuth and guild admin/owner authorization.

---

## Authentication

All requests must include NextAuth session cookies. The session must contain:
- `session.user.discordId` - Discord user ID

## Authorization

User must be either:
- **Guild Owner** - `guild.owner_discord_id === session.user.discordId`
- **Guild Admin** - `guild_members.is_admin === true`

---

## Endpoints

### 1. List Campaigns

**GET** `/api/guilds/[guildId]/rewards`

Lists all reward campaigns for a guild.

**Response:**
```json
{
  "success": true,
  "campaigns": [
    {
      "id": "uuid",
      "guild_id": "uuid",
      "name": "Early Supporter",
      "description": "Reward for early community members",
      "reward_type": "role",
      "reward_config": {
        "role_ids": ["123456789"]
      },
      "trigger_type": "manual",
      "trigger_config": {},
      "auto_claim": false,
      "rule_group_id": null,
      "rule_group_name": null,
      "eligibility_requirements": {},
      "max_claims": 100,
      "cooldown_hours": 0,
      "start_date": null,
      "end_date": null,
      "status": "active",
      "claimed_count": 15,
      "created_at": "2026-01-03T10:00:00Z",
      "updated_at": "2026-01-03T10:00:00Z",
      "total_claims": 15,
      "successful_claims": 14
    }
  ],
  "count": 1
}
```

---

### 2. Create Campaign

**POST** `/api/guilds/[guildId]/rewards`

Creates a new reward campaign.

**Request Body:**
```json
{
  "name": "Early Supporter",
  "description": "Reward for early community members",
  "reward_type": "role",
  "reward_config": {
    "role_ids": ["123456789"]
  },
  "trigger_type": "manual",
  "trigger_config": {},
  "auto_claim": false,
  "rule_group_id": null,
  "eligibility_requirements": {
    "min_level": 5,
    "min_xp": 1000
  },
  "max_claims": 100,
  "cooldown_hours": 0,
  "start_date": null,
  "end_date": null
}
```

**Validation Rules:**
- `name` - Required, 1-200 characters
- `reward_type` - Required, one of: `role`, `xp`, `access_grant`, `nft`, `poap`, `webhook`
- `trigger_type` - Required, one of: `manual`, `rule_pass`, `scheduled`
- `reward_config` - Required, type-specific:
  - **role**: `{ role_ids: string[] }`
  - **xp**: `{ xp_amount: number }`
  - **access_grant**: `{ channel_ids: string[], duration_hours?: number }`

**Response:**
```json
{
  "success": true,
  "campaign": {
    "id": "uuid",
    "guild_id": "uuid",
    "name": "Early Supporter",
    ...
  }
}
```

**Error Responses:**
- `400` - Invalid request data
- `401` - Unauthorized
- `403` - Not guild owner/admin
- `404` - Guild not found

---

### 3. Get Campaign

**GET** `/api/guilds/[guildId]/rewards/[campaignId]`

Gets details for a single campaign.

**Response:**
```json
{
  "success": true,
  "campaign": {
    "id": "uuid",
    "guild_id": "uuid",
    "name": "Early Supporter",
    ...
    "total_claims": 15,
    "successful_claims": 14,
    "pending_claims": 1,
    "failed_claims": 0
  }
}
```

---

### 4. Update Campaign

**PATCH** `/api/guilds/[guildId]/rewards/[campaignId]`

Updates a campaign. All fields are optional.

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "status": "paused",
  "max_claims": 200
}
```

**Notes:**
- Updating `rule_group_id` or `eligibility_requirements` clears the eligibility cache
- Campaign status can be: `active`, `paused`, `ended`, `draft`

**Response:**
```json
{
  "success": true,
  "campaign": { ... }
}
```

---

### 5. Delete Campaign

**DELETE** `/api/guilds/[guildId]/rewards/[campaignId]`

Deletes a campaign. This cascades to:
- All claims (`reward_claims`)
- Eligibility cache (`reward_eligibility`)
- Delivery queue (`reward_delivery_queue`)

**Response:**
```json
{
  "success": true,
  "message": "Campaign deleted successfully"
}
```

---

### 6. List Claims

**GET** `/api/guilds/[guildId]/rewards/[campaignId]/claims`

Lists all claims for a campaign.

**Query Parameters:**
- `limit` (optional, default: 50) - Max results per page
- `offset` (optional, default: 0) - Pagination offset
- `status` (optional) - Filter by status: `pending`, `completed`, `failed`

**Example:**
```
GET /api/guilds/abc123/rewards/xyz789/claims?limit=25&offset=0&status=completed
```

**Response:**
```json
{
  "success": true,
  "campaign": {
    "id": "xyz789",
    "name": "Early Supporter"
  },
  "claims": [
    {
      "id": "uuid",
      "discord_user_id": "123456789",
      "status": "completed",
      "claimed_at": "2026-01-03T10:30:00Z",
      "delivery_method": "manual",
      "delivery_details": {
        "assigned_roles": [
          { "id": "987654321", "name": "Early Supporter" }
        ]
      },
      "error_message": null,
      "retries": 0,
      "username": "john_doe",
      "level": 10,
      "xp": 5000
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  },
  "stats": {
    "total": 15,
    "pending": 1,
    "completed": 14,
    "failed": 0
  }
}
```

---

### 7. Preview Eligible Users

**POST** `/api/guilds/[guildId]/rewards/[campaignId]/preview`

Gets list of eligible users from eligibility cache.

**Response:**
```json
{
  "success": true,
  "campaign": {
    "id": "xyz789",
    "name": "Early Supporter",
    "status": "active"
  },
  "eligible_users": [
    {
      "user_id": "123456789",
      "username": "john_doe",
      "level": 10,
      "xp": 5000,
      "total_messages": 250,
      "last_checked": "2026-01-03T10:00:00Z",
      "has_claimed": false,
      "claim_status": null,
      "claimed_at": null
    }
  ],
  "stats": {
    "eligible_count": 50,
    "ineligible_count": 25,
    "claimed_count": 15,
    "unclaimed_eligible": 35,
    "cache_last_updated": "2026-01-03T10:00:00Z"
  }
}
```

**Note:** Shows up to 100 eligible users. Use this to preview who can claim the reward.

---

### 8. Refresh Eligibility Cache

**PUT** `/api/guilds/[guildId]/rewards/[campaignId]/preview`

Triggers a background refresh of the eligibility cache for all guild members.

**Response:**
```json
{
  "success": true,
  "message": "Eligibility cache refresh started",
  "users_to_check": 500
}
```

**Notes:**
- This is an async operation that runs in the background
- Checks up to 1000 guild members
- Updates the `reward_eligibility` table
- Use this after updating campaign requirements

---

## Reward Types & Configurations

### Role Reward
```json
{
  "reward_type": "role",
  "reward_config": {
    "role_ids": ["123456789", "987654321"]
  }
}
```

### XP Reward
```json
{
  "reward_type": "xp",
  "reward_config": {
    "xp_amount": 500
  }
}
```

### Access Grant Reward
```json
{
  "reward_type": "access_grant",
  "reward_config": {
    "channel_ids": ["123456789", "987654321"],
    "duration_hours": 24
  }
}
```
**Note:** `duration_hours = 0` means permanent access.

---

## Trigger Types

### Manual (User Claims)
```json
{
  "trigger_type": "manual",
  "auto_claim": false
}
```
Users must run `/reward claim [campaign]` to claim.

### Rule Pass (Automatic)
```json
{
  "trigger_type": "rule_pass",
  "auto_claim": true,
  "rule_group_id": "uuid-of-rule-group"
}
```
Automatically triggered when user passes the linked rule group.

- `auto_claim: true` - Delivers reward immediately
- `auto_claim: false` - Sends DM notification, user must claim manually

### Scheduled (Cron-based)
```json
{
  "trigger_type": "scheduled",
  "trigger_config": {
    "cron": "0 0 * * *",
    "timezone": "UTC"
  }
}
```
**Note:** Scheduled delivery not yet implemented (Phase 2).

---

## Eligibility Requirements

### Link to Rule Group (Blockchain/Token-Gating)
```json
{
  "rule_group_id": "uuid-of-rule-group",
  "eligibility_requirements": {}
}
```
Uses existing `RuleGroupEvaluator` to check token balance, staking, etc.

### Custom Requirements (Level, XP, Messages)
```json
{
  "rule_group_id": null,
  "eligibility_requirements": {
    "min_level": 10,
    "min_xp": 5000,
    "min_messages": 100,
    "min_reputation": 50,
    "min_streak": 7,
    "verified": true
  }
}
```

All fields are optional. User must meet ALL specified requirements.

---

## Cooldown System

**One-time claim:**
```json
{
  "cooldown_hours": 0
}
```
User can only claim once (default).

**Recurring claim:**
```json
{
  "cooldown_hours": 24
}
```
User can claim again after 24 hours.

---

## Max Claims Limit

**Unlimited:**
```json
{
  "max_claims": null
}
```

**Limited:**
```json
{
  "max_claims": 100
}
```
Campaign ends when 100 claims are made.

---

## Status Lifecycle

1. **draft** - Campaign created but not active
2. **active** - Users can claim (if eligible)
3. **paused** - Temporarily disabled
4. **ended** - Permanently closed

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400  | Invalid request data (validation failed) |
| 401  | Unauthorized (no session) |
| 403  | Forbidden (not guild owner/admin) |
| 404  | Resource not found (guild or campaign) |
| 500  | Internal server error |
| 503  | Service unavailable (reward system not initialized) |

---

## Rate Limiting

No rate limiting currently implemented. Consider adding:
- 100 requests/minute per user
- 1000 requests/hour per guild

---

## Testing with curl

### Create Campaign
```bash
curl -X POST http://localhost:3000/api/guilds/YOUR_GUILD_ID/rewards \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "name": "Test Reward",
    "description": "Test reward campaign",
    "reward_type": "xp",
    "reward_config": {"xp_amount": 100},
    "trigger_type": "manual",
    "cooldown_hours": 0
  }'
```

### List Campaigns
```bash
curl http://localhost:3000/api/guilds/YOUR_GUILD_ID/rewards \
  -b "next-auth.session-token=YOUR_SESSION_TOKEN"
```

### Update Campaign
```bash
curl -X PATCH http://localhost:3000/api/guilds/YOUR_GUILD_ID/rewards/CAMPAIGN_ID \
  -H "Content-Type: application/json" \
  -b "next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{"status": "paused"}'
```

### Delete Campaign
```bash
curl -X DELETE http://localhost:3000/api/guilds/YOUR_GUILD_ID/rewards/CAMPAIGN_ID \
  -b "next-auth.session-token=YOUR_SESSION_TOKEN"
```

---

## Integration Examples

### React Component
```typescript
// Fetch campaigns
const fetchCampaigns = async (guildId: string) => {
  const response = await fetch(`/api/guilds/${guildId}/rewards`)
  const data = await response.json()

  if (data.success) {
    setCampaigns(data.campaigns)
  }
}

// Create campaign
const createCampaign = async (guildId: string, campaignData: any) => {
  const response = await fetch(`/api/guilds/${guildId}/rewards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(campaignData),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error)
  }

  return data.campaign
}
```

---

## Database Schema Reference

**Tables:**
- `reward_campaigns` - Campaign definitions
- `reward_claims` - User claims
- `reward_eligibility` - Eligibility cache
- `reward_delivery_queue` - Async processing queue

**See:** `migrations/008_reward_management.sql` for full schema.

---

**Last Updated:** January 3, 2026
**Version:** Phase 1 (MVP)
