# Third-Party Integration Guide for BitSage Discord

## Overview

This guide covers integrating third-party verification and utility bots with the BitSage Discord server.

---

## 1. Token-Gated Access (Wallet Verification)

### Option A: Collab.Land (Recommended for Token Gating)

**Use Case:** Verify users hold SAGE tokens or BitSage NFTs

**Features:**
- Starknet wallet verification
- Token-gated roles (e.g., "SAGE Holder" if balance > 1000 SAGE)
- NFT holder verification
- Battle-tested, used by major projects

**Setup:**
1. Invite Collab.Land bot: https://collab.land
2. Configure token requirements:
   ```
   Role: "SAGE Holder"
   Chain: Starknet
   Contract: <SAGE_TOKEN_CONTRACT_ADDRESS>
   Min Balance: 1000 SAGE
   ```
3. Create verification channel (#checker-holder-verification)
4. Users connect wallet → Get role automatically

**Pricing:**
- Free: Up to 5 token-gated roles
- Pro ($50/mo): Unlimited roles + advanced features

**Integration with Our Bot:**
- Collab.Land assigns roles based on wallet
- Our bot sees the roles and grants channel access
- Works seamlessly together

---

### Option B: Guild.xyz

**Use Case:** More flexible role requirements, multi-chain support

**Features:**
- Supports Starknet, Ethereum, and 20+ chains
- Complex requirements (AND/OR logic)
- Social media verification (Twitter, GitHub, Discord activity)
- Free for all features

**Setup:**
1. Create Guild at https://guild.xyz
2. Configure requirements:
   ```
   "Validator" role requires:
   - Hold 5000+ SAGE tokens
   - OR run a validator node (verified via API)
   - AND Twitter follower of @BitSageNetwork
   ```
3. Install Guild.xyz bot
4. Link Discord server

**Pricing:**
- Completely free

**Recommendation:**
Use Guild.xyz if you need complex multi-requirement verification. Otherwise, Collab.Land is simpler.

---

## 2. Phone/Email Verification

### Option A: Build Our Own (Recommended)

**Pros:**
- Full control
- Integrated UX (one bot)
- Cost-effective at scale
- Data privacy

**Tech Stack:**
- **SMS:** Twilio API (~$0.0079/SMS for verification)
- **Email:** SendGrid free tier (100 emails/day)

**Implementation:**
```typescript
// Add to our existing verification flow (Step 5)
// After captcha, before final verification

// SMS Verification
import twilio from 'twilio';

async function sendVerificationSMS(phoneNumber: string): Promise<string> {
  const client = twilio(TWILIO_SID, TWILIO_AUTH_TOKEN);
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await client.messages.create({
    body: `Your BitSage verification code is: ${code}`,
    from: TWILIO_PHONE_NUMBER,
    to: phoneNumber
  });

  return code;
}

// Email Verification
import sgMail from '@sendgrid/mail';

async function sendVerificationEmail(email: string): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await sgMail.send({
    to: email,
    from: 'verify@bitsage.network',
    subject: 'BitSage Discord Verification',
    text: `Your verification code is: ${code}`,
    html: `<p>Your verification code is: <strong>${code}</strong></p>`
  });

  return code;
}
```

**Cost Estimate:**
- 1000 verifications/month: ~$8 (Twilio) + $0 (SendGrid free tier)
- 10,000 verifications/month: ~$80 + $10 (SendGrid)

---

### Option B: Pandera Guard / Wick Bot

**Use Case:** If you don't want to build verification yourself

**Pandera Guard:**
- Phone verification via Discord modal
- Anti-alt detection
- Raid protection
- $5-20/month depending on server size

**Wick Bot:**
- Similar to Pandera
- Free tier available
- Phone + CAPTCHA verification
- Auto-moderation features

**Setup:**
1. Invite bot: https://wickbot.com or https://pandera.gg
2. Configure verification channel
3. Set verification requirements (phone, email, captcha)
4. Bot handles verification, assigns "Verified" role
5. Our bot sees "Verified" role and grants access

**Recommendation:**
Only use if you want to avoid development time. Otherwise, building our own is better.

---

## 3. Advanced Anti-Bot Protection

### Wick Bot (Free)

**Features:**
- Auto-moderation (spam, raids, malicious links)
- Verification gates (CAPTCHA, phone, email)
- Join screening
- Customizable rules

**Setup:**
1. Invite: https://wickbot.com
2. Configure anti-raid settings
3. Enable join verification
4. Set trusted roles (our "Verified" role)

**Pricing:** Free

---

### Double Counter (Advanced Analytics)

**Features:**
- Member growth tracking
- Activity heatmaps
- Region/timezone distribution
- Real-time analytics

**Setup:**
1. Invite: https://double-counter.com
2. Creates stat channels automatically
3. Updates every 10 minutes

**Pricing:** Free

---

## 4. Twitter Feed Integration

### TweetShift Bot

**Use Case:** Auto-post BitSage tweets to Discord

**Features:**
- Monitor Twitter accounts
- Post new tweets to designated channel
- Filter by keywords
- Embed formatting

**Setup:**
1. Invite: https://tweetshift.com
2. Add Twitter account: @BitSageNetwork
3. Set destination channel: #twitter-feed
4. Configure filters (only tweets with #announcement)

**Pricing:**
- Free: 1 Twitter account
- Pro ($5/mo): Unlimited accounts

---

### Alternative: Build Our Own

**Tech Stack:**
- Twitter API v2 (Free tier: 500k tweets/month)
- Webhook to Discord

**Implementation:**
```typescript
import { TwitterApi } from 'twitter-api-v2';

const twitterClient = new TwitterApi(TWITTER_BEARER_TOKEN);

// Monitor @BitSageNetwork tweets
const stream = await twitterClient.v2.searchStream({
  'tweet.fields': ['created_at', 'author_id'],
  expansions: ['author_id']
});

stream.on('data', async (tweet) => {
  // Post to Discord #twitter-feed
  await twitterChannel.send({
    content: `**New Tweet from @BitSageNetwork**\nhttps://twitter.com/BitSageNetwork/status/${tweet.data.id}`
  });
});
```

---

## 5. Recommended Integration Strategy

### Phase 1: Now (Basic Verification)
✅ Our custom bot with 4-step verification (role, region, interests, captcha)
✅ Role-based channel permissions
✅ Server stats display

### Phase 2: Token Gating (Next 2-4 weeks)
- [ ] Add Collab.Land for wallet verification
- [ ] Create "SAGE Holder" role (1000+ tokens)
- [ ] Create "Validator Node Operator" role (on-chain proof)
- [ ] Token-gated channels (e.g., #holders-only, #validator-lounge)

### Phase 3: Advanced Verification (If needed)
- [ ] Build SMS verification with Twilio (add to Step 5)
- [ ] Build email verification with SendGrid (alternative to SMS)
- [ ] Add to our existing verification flow

### Phase 4: Utilities (Nice to have)
- [ ] TweetShift for #twitter-feed
- [ ] Wick Bot for anti-raid protection
- [ ] Double Counter for analytics

---

## 6. Cost Summary

| Service | Monthly Cost | Purpose |
|---------|--------------|---------|
| Our Bot | $0 | Core verification |
| Collab.Land Free | $0 | Token gating (5 roles) |
| Twilio | ~$8-80 | SMS verification (1k-10k users) |
| SendGrid | $0-10 | Email verification |
| TweetShift | $0-5 | Twitter feed |
| Wick Bot | $0 | Anti-raid |
| **Total** | **$0-100** | Depending on scale |

---

## 7. Quick Start Commands

After integrating, test with:

```bash
# Setup role-based permissions
npm run setup-role-permissions

# Update server stats display
npm run update-stats

# Test verification flow
1. Click "✅ Verify" in #rules
2. Complete 4-step process
3. Get verified + role assigned
4. Check channel access
```

---

## Support

- Collab.Land: https://discord.gg/collabland
- Guild.xyz: https://guild.xyz/discord
- Wick Bot: https://wickbot.com/support
- Pandera Guard: https://pandera.gg/discord

