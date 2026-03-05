# 🚀 Sage Achievements Deployment Plan

**Date:** January 5, 2026
**Status:** ⚠️ Tooling Compatibility Issue (Temporary)

---

## Current Situation

### ✅ What's Already Working

**Gamification Contract** (Deployed & Operational)
```
Address: 0x3beb685db6a20804ee0939948cee05c42de655b6b78a93e1e773447ce981cde
Owner: 0x0759a4374389b0e3cfcc59d49310b6bc75bb12bbf8ce550eb5c2f026918bb344
Minter: 0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660 (Bot)
Network: Starknet Sepolia
Gas: STRK (Starknet-native)
Status: ✅ FULLY OPERATIONAL
```

**Bot Wallet:**
- Balance: 800 STRK
- Minting Permission: ✅ Granted
- Transaction: 0x7c0bccf0c1c7e230c07db6eea43076509898cc910f773c25a7f98ab27faea6e

**Current Capabilities:**
- ✅ Mint soulbound achievement NFTs
- ✅ Store achievement metadata on-chain
- ✅ Pay gas in STRK (not ETH)
- ✅ Query achievements by user
- ✅ Track achievement types (100-199 for Discord)
- ✅ Discord bot integration ready

---

## Enhanced Contract (Ready to Deploy When Tooling Fixed)

### 📦 New Contract Features

**Contract:** `contracts/sage_achievements.cairo`
**Compilation:** ✅ Successfully compiled with Scarb 2.8.2
**Status:** ⏳ Awaiting deployment (tooling compatibility issue)

**Additional Features Over Current Contract:**
1. **Tier System** - Bronze, Silver, Gold, Platinum achievements
2. **Season Tracking** - Year/season metadata (2026, 2027, etc.)
3. **Multi-Server Support** - guild_id field for multi-Discord support
4. **Enhanced Metadata** - More structured on-chain data
5. **Batch Minting** - Award multiple users at once (gas efficient)
6. **Query Functions** - Get achievements by type, user, etc.
7. **Pause/Unpause** - Emergency controls
8. **Statistics** - Total minted, unique recipients tracking
9. **Upgradeable** - Can upgrade contract logic without losing data

**Enhanced Metadata Structure:**
```cairo
struct AchievementMetadata {
    achievement_type: u16,      // 100-999 (expanded range)
    discord_user_id: felt252,   // Discord user ID
    guild_id: felt252,          // Server ID (multi-server!)
    earned_at: u64,             // Timestamp
    tier: u8,                   // 1=Bronze, 2=Silver, 3=Gold, 4=Platinum
    season: u16,                // Season/year (e.g., 2026)
}
```

---

## Deployment Blocker

### Issue: Class Hash Mismatch

**Error:**
```
Transaction execution error: Mismatch compiled class hash for class
Actual: 0x1bc5578bccb6fdadeeb1dc652c16cf9cc3bfd296de059ff2c9efaa40fbe748
Expected: 0x44842cdc3de1e630c58135f669f975f1a86b136da7e86e7aa9abac845b240ed
```

**Root Cause:** Version incompatibility between Scarb 2.8.2 and starknet.js 7.1.0

**What We Tried:**
1. ❌ Starknet.js 7.1.0 - Class hash mismatch
2. ❌ Starknet.js 9.2.1 - API changes (requires Node 22+)
3. ❌ Starkli CLI - Account fetch failed (custom account class hash not recognized)
4. ❌ Clean rebuild - Same class hash mismatch

---

## Solution Options

### Option 1: Use Existing Contract (RECOMMENDED FOR NOW) ✅

**Action:** Keep using the Gamification contract
**Timeline:** Already working
**Advantages:**
- ✅ Zero deployment work needed
- ✅ Bot already has permissions
- ✅ 800 STRK ready for gas
- ✅ Can start minting achievements immediately
- ✅ Soulbound, STRK-native, fully yours

**Limitations:**
- ❌ No tier system (Bronze/Silver/Gold/Platinum)
- ❌ No season tracking
- ❌ Single-server only (no guild_id field)
- ❌ Not upgradeable

**User Experience:** Fully functional for Discord rewards! The limitations are nice-to-haves, not blockers.

### Option 2: Fix Tooling Compatibility (1-2 hours)

**Option 2A: Upgrade to Node 22 + Starknet.js 9.x**
```bash
# Install Node 22
nvm install 22
nvm use 22

# Reinstall dependencies
npm install starknet@latest

# Update deployment script for v9 API
# Run deployment
```

**Option 2B: Use Starkli with Manual Account Setup**
```bash
# Create account descriptor manually
# Create signer keystore (workaround TTY issue)
# Declare contract
# Deploy contract
```

**Option 2C: Use Scarb 2.9.x + Starknet.js 7.x**
```bash
# Upgrade Scarb to match starknet.js expectations
scarb --version # Currently 2.8.2
asdf install scarb 2.9.2
scarb build
# Try deployment again
```

### Option 3: Deploy Later with Proper Tools (FUTURE)

**Action:** Use existing contract now, deploy enhanced later
**Timeline:** When tooling matures or during a scheduled upgrade
**Advantages:**
- Start delivering value immediately
- Deploy enhanced contract when convenient
- Existing contract meets current needs

---

## Recommendation: Dual-Phase Approach

### Phase 1: Launch NOW with Existing Contract ✅

**What to do:**
1. Use Gamification contract at `0x3beb...`
2. Create achievement campaigns in dashboard
3. Start minting achievements for Discord users
4. Build community engagement

**Features Available:**
- Soulbound achievements
- Achievement types (100-199)
- On-chain metadata
- STRK gas payments
- Full bot integration

### Phase 2: Upgrade When Ready (Future)

**When to do this:**
- After initial campaigns are successful
- When Node 22 is deployed
- When Starknet tooling stabilizes
- When multi-server support is needed

**How to upgrade:**
1. Deploy enhanced sage_achievements.cairo
2. Grant bot minting permission on new contract
3. Update bot config to use new contract address
4. Keep old achievements (they're permanent!)
5. New achievements get enhanced features

---

## Technical Details

### Files Ready:
- ✅ `contracts/sage_achievements.cairo` - Enhanced contract
- ✅ `contracts/Scarb.toml` - Build configuration
- ✅ `contracts/src/lib.cairo` - Module entry
- ✅ `deploy-sage-achievements.ts` - Deployment script
- ✅ Compiled artifacts in `contracts/target/dev/`

### Bot Configuration:
- ✅ NFT service configured
- ✅ Dashboard UI updated ("Sage Achievement" naming)
- ✅ Reward types added (poap = Sage Achievement)
- ✅ API routes ready

### What's Missing:
- ⏳ Successful deployment transaction (tooling issue)

---

## Next Steps

### Immediate (Today):

1. **Start Using Existing Contract**
   ```bash
   cd webapp
   npm run dev
   ```
   Navigate to: Rewards page → Create Campaign → Select "Sage Achievement"

2. **Create First Campaign**
   ```
   Name: Early Adopter
   Type: Sage Achievement (Soulbound)
   Contract: 0x3beb685db6a20804ee0939948cee05c42de655b6b78a93e1e773447ce981cde
   Achievement Type: 100
   Metadata URI: ipfs://YOUR_METADATA/early-adopter.json
   ```

3. **Test in Discord**
   ```
   /reward list
   /reward claim "Early Adopter"
   ```

### This Week:

- Create 3-5 achievement types
- Set up auto-delivery for new members
- Upload achievement metadata to IPFS
- Design achievement badge images
- Collect feedback from community

### Future (When Tooling Fixed):

- Deploy enhanced sage_achievements.cairo
- Add tier system (Bronze/Silver/Gold/Platinum)
- Enable multi-server support
- Implement seasonal achievements
- Batch minting for events

---

## Monitoring & Verification

### Check Achievement on Voyager:
https://sepolia.voyager.online/contract/0x3beb685db6a20804ee0939948cee05c42de655b6b78a93e1e773447ce981cde

### Bot Logs:
```bash
pm2 logs sage-discord-bot | grep achievement
```

### Database Analytics:
```sql
SELECT COUNT(*) FROM reward_nft_mints
WHERE campaign_id IN (
  SELECT id FROM reward_campaigns WHERE reward_type = 'poap'
);
```

---

## Summary

**Current Status:** ✅ **100% READY to mint achievements**
**Contract:** Gamification (working perfectly)
**Enhanced Contract:** Compiled and ready (awaiting tooling fix for deployment)
**Recommendation:** Start using existing contract NOW, upgrade to enhanced later

You're not blocked! You can start rewarding your community with permanent, soulbound Starknet achievements today. The enhanced contract with tiers/seasons is a nice-to-have upgrade, not a requirement.

---

**Last Updated:** January 5, 2026
**Author:** Claude
**Status:** ✅ Ready to Launch
