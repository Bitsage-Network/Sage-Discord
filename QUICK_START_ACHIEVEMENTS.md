# 🚀 Quick Start: Sage Achievements System

**Status:** ✅ **READY TO USE**
**Updated:** January 5, 2026

---

## 🎯 What You Have

Your Discord bot can now mint **soulbound achievement NFTs** on Starknet for community rewards!

### Your Infrastructure

**Gamification Contract:** (Deployed & Operational)
```
Address: 0x3beb685db6a20804ee0939948cee05c42de655b6b78a93e1e773447ce981cde
Network: Starknet Sepolia
Gas: STRK (not ETH!)
Status: ✅ OPERATIONAL
```

**Bot Wallet:**
```
Address: 0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660
Balance: 800 STRK
Minting Permission: ✅ GRANTED
```

**Capabilities:**
- ✅ Mint soulbound (non-transferable) achievements
- ✅ Store metadata on-chain
- ✅ Pay gas in STRK (no ETH needed!)
- ✅ Track by Discord user ID
- ✅ Achievement types 100-199 reserved for Discord
- ✅ Fully independent (your infrastructure!)

---

## 📝 Step 1: Create Achievement Campaign

### Via Dashboard

1. **Start dashboard:**
   ```bash
   cd webapp
   npm run dev
   ```

2. **Navigate to:**
   ```
   http://localhost:3000/dashboard/guild/[YOUR_GUILD_ID]/rewards
   ```

3. **Click "Create Reward Campaign"**

4. **Fill in the form:**

   **Basic Info:**
   ```
   Name: Early Adopter
   Description: Awarded to the first 100 community members
   ```

   **Reward Type:**
   ```
   Select: "Sage Achievement (Soulbound)"
   ```

   **Configuration:**
   ```
   Achievement NFT Contract: 0x3beb685db6a20804ee0939948cee05c42de655b6b78a93e1e773447ce981cde
   Achievement Type: 100
   Metadata URI: ipfs://YOUR_METADATA_CID/early-adopter.json
   ```

   **Trigger:**
   ```
   Trigger Type: Manual
   Auto-claim: No
   ```

   **Settings:**
   ```
   Max Claims: 100
   Cooldown: 0 hours
   Start Date: (today)
   End Date: (optional)
   ```

5. **Click "Create Campaign"**

6. **Toggle the campaign to "Active"** ✅

---

## 🎮 Step 2: Claim Achievements in Discord

### Manual Claim

Users can claim achievements manually:

```
/reward list
→ Shows all available campaigns

/reward claim "Early Adopter"
→ Bot mints achievement to user's Starknet wallet
→ User receives DM with transaction hash
→ Achievement appears on-chain!
```

### Automatic Delivery (Rule-Based)

You can also set up auto-delivery:

1. **Create rule group** (e.g., "Verified Members")
2. **Create campaign with:**
   - Trigger Type: **Rule Pass**
   - Auto-claim: **Yes**
   - Rule Group: **Verified Members**

3. **When user passes verification:**
   - Bot automatically mints achievement
   - User receives DM notification
   - No manual claim needed!

---

## 🎨 Step 3: Create Achievement Metadata

Achievements need metadata (image, description, attributes) hosted on IPFS or web server.

### Metadata Format (JSON)

```json
{
  "name": "Early Adopter",
  "description": "Awarded to the first 100 BitSage Discord members",
  "image": "ipfs://QmXXXXX/early-adopter.png",
  "attributes": [
    {
      "trait_type": "Category",
      "value": "Onboarding"
    },
    {
      "trait_type": "Tier",
      "value": "Bronze"
    },
    {
      "trait_type": "Season",
      "value": "2026 Q1"
    },
    {
      "trait_type": "Total Issued",
      "value": "100"
    }
  ]
}
```

### Upload to IPFS

**Option 1: Pinata**
1. Go to [pinata.cloud](https://pinata.cloud)
2. Upload metadata JSON
3. Upload achievement image
4. Copy CID
5. Use `ipfs://CID/filename.json` as Metadata URI

**Option 2: NFT.Storage**
1. Go to [nft.storage](https://nft.storage)
2. Upload files
3. Copy CID
4. Use in campaign

---

## 🏆 Achievement Type Registry

Reserved ranges for Discord achievements:

| Range | Purpose | Examples |
|-------|---------|----------|
| **100-109** | Onboarding | 100=Early Adopter, 101=Verified, 102=Intro Complete |
| **110-119** | Engagement | 110=Active Member, 111=100 Messages, 112=1 Year |
| **120-129** | Contributions | 120=Helper, 121=Bug Reporter, 122=Code Contributor |
| **130-139** | Events | 130=Hackathon, 131=AMA Attendee |
| **140-149** | Milestones | 140=Level 10, 141=Level 25, 142=Level 50 |
| **150-159** | Special | 150=Beta Tester, 151=Moderator, 152=Ambassador |
| **160-199** | Custom | Your choice! |

---

## 🔍 Step 4: Verify on Voyager

After minting, achievements are visible on Starknet Sepolia explorer:

### View Contract
https://sepolia.voyager.online/contract/0x3beb685db6a20804ee0939948cee05c42de655b6b78a93e1e773447ce981cde

### View User's Achievements
1. Go to [Voyager](https://sepolia.voyager.online)
2. Search user's Starknet wallet address
3. Click "Tokens" tab
4. See all Sage Achievements!

### View Transaction
After minting, bot returns transaction hash. View it:
```
https://sepolia.voyager.online/tx/[TRANSACTION_HASH]
```

---

## 📊 Monitoring & Analytics

### Bot Logs

```bash
# View bot logs
pm2 logs sage-discord-bot

# Filter for achievement minting
pm2 logs sage-discord-bot | grep -i "achievement\|mint\|poap"
```

Look for:
```
[INFO]: Minting achievement 100 for user 123456789
[INFO]: TX submitted: 0xabc123...
[INFO]: Achievement minted successfully!
```

### Database Queries

**Total achievements minted:**
```sql
SELECT COUNT(*) as total_achievements
FROM reward_nft_mints
WHERE campaign_id IN (
  SELECT id FROM reward_campaigns WHERE reward_type = 'poap'
);
```

**Achievements by type:**
```sql
SELECT
  reward_config->>'achievement_type' as achievement_type,
  COUNT(*) as mints
FROM reward_nft_mints rn
JOIN reward_campaigns rc ON rn.campaign_id = rc.id
WHERE rc.reward_type = 'poap'
GROUP BY achievement_type
ORDER BY mints DESC;
```

**Top recipients:**
```sql
SELECT
  discord_user_id,
  COUNT(*) as achievements_earned
FROM reward_nft_mints
GROUP BY discord_user_id
ORDER BY achievements_earned DESC
LIMIT 10;
```

**Recent mints:**
```sql
SELECT
  rn.discord_user_id,
  rn.wallet_address,
  rn.token_id,
  rn.tx_hash,
  rn.minted_at,
  rc.name as campaign_name
FROM reward_nft_mints rn
JOIN reward_campaigns rc ON rn.campaign_id = rc.id
WHERE rc.reward_type = 'poap'
ORDER BY rn.minted_at DESC
LIMIT 20;
```

---

## 💡 Example Campaigns

### Campaign 1: Welcome Achievement

**Goal:** Reward new members for joining and verifying

**Setup:**
```
Name: Welcome to BitSage
Type: Sage Achievement
Achievement Type: 100
Trigger: Rule Pass (New Member rule group)
Auto-claim: Yes
Max Claims: Unlimited
```

**Metadata:**
```json
{
  "name": "Welcome to BitSage",
  "description": "First step into the BitSage community",
  "image": "ipfs://QmXXX/welcome.png",
  "attributes": [
    {"trait_type": "Category", "value": "Onboarding"},
    {"trait_type": "Rarity", "value": "Common"}
  ]
}
```

### Campaign 2: Active Contributor

**Goal:** Reward members with 100+ messages

**Setup:**
```
Name: Active Contributor
Type: Sage Achievement
Achievement Type: 111
Trigger: Manual (admins award)
Max Claims: Unlimited
```

**Metadata:**
```json
{
  "name": "Active Contributor",
  "description": "100+ quality messages in the community",
  "image": "ipfs://QmYYY/contributor.png",
  "attributes": [
    {"trait_type": "Category", "value": "Engagement"},
    {"trait_type": "Rarity", "value": "Uncommon"}
  ]
}
```

### Campaign 3: Hackathon Participant

**Goal:** Limited-edition event achievement

**Setup:**
```
Name: Starknet Hackathon 2026
Type: Sage Achievement
Achievement Type: 130
Trigger: Manual
Max Claims: 50
Start Date: 2026-01-15
End Date: 2026-01-17
```

**Metadata:**
```json
{
  "name": "Starknet Hackathon 2026",
  "description": "Participated in the BitSage x Starknet Hackathon",
  "image": "ipfs://QmZZZ/hackathon-2026.png",
  "attributes": [
    {"trait_type": "Category", "value": "Event"},
    {"trait_type": "Rarity", "value": "Rare"},
    {"trait_type": "Total Issued", "value": "50"}
  ]
}
```

---

## 🐛 Troubleshooting

### Issue: "No Starknet account configured"

**Solution:**
Check `.env` file has:
```bash
STARKNET_ACCOUNT_ADDRESS=0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660
STARKNET_PRIVATE_KEY=YOUR_PRIVATE_KEY
STARKNET_RPC_URL=https://rpc.starknet-testnet.lava.build
```

### Issue: "Transaction failed"

**Causes:**
1. Insufficient STRK balance
2. User already claimed (duplicate)
3. Contract paused
4. Invalid wallet address

**Solution:**
- Check bot wallet balance on Voyager
- Check user hasn't already claimed
- Verify contract is not paused
- Ensure wallet address is valid Starknet address

### Issue: "Achievement type must be 100 or greater"

**Solution:**
Discord achievements MUST use types 100-199. This reserves 0-99 for job/staking rewards.

### Issue: "User already claimed this POAP"

**Solution:**
Each user can only claim each achievement once. This is by design to prevent duplicates.

---

## 🚀 Next Steps

### This Week

- [ ] Create 3-5 achievement types
- [ ] Upload metadata to IPFS
- [ ] Design achievement badges (PNG/SVG)
- [ ] Set up auto-delivery for new members
- [ ] Test claiming flow with real users

### This Month

- [ ] Create seasonal achievements (Q1 2026)
- [ ] Integrate with leaderboard system
- [ ] Add achievement showcase on website
- [ ] Create achievement rarity tiers
- [ ] Deploy enhanced contract with tier/season support

---

## 📚 Additional Resources

- **Sage Achievements Complete Guide:** `SAGE_ACHIEVEMENTS_COMPLETE.md`
- **Deployment Plan (Enhanced Contract):** `SAGE_ACHIEVEMENTS_DEPLOYMENT_PLAN.md`
- **Custom Contracts Guide:** `CUSTOM_STARKNET_CONTRACTS_GUIDE.md`
- **Contract Source:** `contracts/sage_achievements.cairo`

---

## 🎉 You're Ready!

Your Sage Achievements system is **100% operational** and ready to reward your community!

**Start creating campaigns and minting achievements now!** 🏆

---

**Last Updated:** January 5, 2026
**System Status:** ✅ **FULLY OPERATIONAL**
**Contract:** Gamification (0x3beb...cde)
**Gas Token:** STRK
**Independence:** 100% Your Infrastructure
