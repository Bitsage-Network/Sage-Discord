# ✅ Starknet NFT/POAP Configuration - COMPLETE

**Date:** January 3, 2026
**Status:** Configuration Complete | 1 Permission Step Remaining

---

## 🎉 Configuration Summary

All Starknet variables are now configured in `.env`:

### ✅ Configured Variables

```bash
# Network & RPC
STARKNET_NETWORK=sepolia
STARKNET_RPC_URL=https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/GUBwFqKhSgn4mwVbN6Sbn

# Bot Account (Braavos Wallet)
STARKNET_ACCOUNT_ADDRESS=0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660
STARKNET_PRIVATE_KEY=0x02c22c55e9c3aae8293e99a8b5d4ee1862595936f5f15f7d1f6ddcf8b216c44d

# Achievement NFT Contract (Gamification)
ACHIEVEMENT_NFT_ADDRESS=0x047402be0797cda868f2601f6234f56fa814e51957fa1981989ffcbf471e81e4
```

### 📋 Account Details

| Account | Purpose | Address | Has Private Key |
|---------|---------|---------|----------------|
| **Braavos Bot Wallet** | Mints NFTs/POAPs, Pays gas fees | `0x01f9eb...64660` | ✅ Yes (in .env) |
| **Deployer Wallet** | Owns contracts, Grant permissions | `0x0759a4...18bb344` | ✅ Yes (has keystore) |

### 🔐 Deployed Contract

**Gamification (Achievement NFT):**
- **Address:** `0x047402be0797cda868f2601f6234f56fa814e51957fa1981989ffcbf471e81e4`
- **Type:** Achievement system with NFT minting
- **Capabilities:** Award achievements, mint POAPs, track worker stats
- **Owner:** Deployer address (`0x0759a4...`)
- **Network:** Starknet Sepolia
- **Explorer:** https://sepolia.starkscan.co/contract/0x047402be0797cda868f2601f6234f56fa814e51957fa1981989ffcbf471e81e4

---

## ⚠️ One Step Remaining: Grant Bot Minting Permission

Your Gamification contract has access control - only the `job_manager` can award achievements.

### Why This Is Needed

The bot needs to call `award_achievement()` to mint POAPs, but currently:
- ❌ Bot account is NOT set as job_manager
- ✅ Deployer account is the owner (can update job_manager)

### How to Grant Permission

**Option 1: Using Starkli (Recommended)**

```bash
cd /Users/vaamx/bitsage-network/BitSage-Cairo-Smart-Contracts

# Set bot as job manager (requires deployer private key)
starkli invoke \
  0x047402be0797cda868f2601f6234f56fa814e51957fa1981989ffcbf471e81e4 \
  set_job_manager \
  0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660 \
  --network sepolia \
  --keystore deployment/sepolia_keystore.json \
  --password bitsage123
```

**Option 2: Using Starknet.js Script**

```typescript
// grant-bot-permission.ts
import { Account, RpcProvider, Contract, cairo } from 'starknet';

const provider = new RpcProvider({
  nodeUrl: 'https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_7/GUBwFqKhSgn4mwVbN6Sbn'
});

const deployerAccount = new Account(
  provider,
  '0x0759a4374389b0e3cfcc59d49310b6bc75bb12bbf8ce550eb5c2f026918bb344', // Deployer
  '0x0154de503c7553e078b28044f15b60323899d9437bd44e99d9ab629acbada47a'  // Deployer private key
);

const gamificationAddress = '0x047402be0797cda868f2601f6234f56fa814e51957fa1981989ffcbf471e81e4';
const botAddress = '0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660';

// Call set_job_manager
const call = {
  contractAddress: gamificationAddress,
  entrypoint: 'set_job_manager',
  calldata: [botAddress]
};

const tx = await deployerAccount.execute(call);
await provider.waitForTransaction(tx.transaction_hash);

console.log('✅ Bot granted job_manager role!');
console.log('Transaction:', tx.transaction_hash);
```

Run:
```bash
npx ts-node grant-bot-permission.ts
```

**Option 3: Using Voyager/Starkscan UI**

1. Go to: https://sepolia.starkscan.co/contract/0x047402be0797cda868f2601f6234f56fa814e51957fa1981989ffcbf471e81e4
2. Click "Write Contract"
3. Connect deployer wallet
4. Call `set_job_manager` with bot address: `0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660`
5. Submit transaction

---

## 🧪 Verification Steps

### 1. Check Current Configuration

```bash
# Check .env has all variables
grep "STARKNET_ACCOUNT_ADDRESS\|STARKNET_PRIVATE_KEY\|ACHIEVEMENT_NFT_ADDRESS" .env
```

**Expected output:**
```
STARKNET_ACCOUNT_ADDRESS=0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660
STARKNET_PRIVATE_KEY=0x02c22c55e9c3aae8293e99a8b5d4ee1862595936f5f15f7d1f6ddcf8b216c44d
ACHIEVEMENT_NFT_ADDRESS=0x047402be0797cda868f2601f6234f56fa814e51957fa1981989ffcbf471e81e4
```

### 2. Check Bot Balance (Has Gas Fees?)

```bash
starkli balance 0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660 --network sepolia
```

**If balance is 0:** Get testnet ETH from Starknet faucet
- https://starknet-faucet.vercel.app/
- https://faucet.goerli.starknet.io/

**Recommended:** 0.01-0.05 ETH for testing (enough for 50-100 POAP mints)

### 3. Verify Bot Has Permission (After Granting)

**Using Starkli:**
```bash
# Read current job_manager
starkli call \
  0x047402be0797cda868f2601f6234f56fa814e51957fa1981989ffcbf471e81e4 \
  job_manager \
  --network sepolia
```

**Expected output after granting permission:**
```
0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660
```

### 4. Start Bot and Verify Initialization

```bash
cd /Users/vaamx/bitsage-network/Sage-Discord
npm run dev
```

**Expected log output:**
```
✅ Reward management services initialized
✅ NFT minting service initialized with account: 0x01f9eb...64660
✅ Gamification contract loaded: 0x047402...71e81e4
```

---

## 🎯 What Works NOW

### ✅ Phase 1 Rewards (Already Working)

These work immediately without Starknet setup:
- **Discord Role rewards** - Assign roles to users
- **XP/Points rewards** - Award experience points
- **Channel Access rewards** - Grant temporary/permanent access
- **Webhook rewards** - Call external APIs

### ⏸️ Phase 2 Rewards (After Permission Granted)

These will work once bot has job_manager permission:
- **NFT rewards** - Mint transferable NFTs via external contracts
- **POAP rewards** - Mint soulbound POAPs via Gamification contract

---

## 📊 Achievement Type Mapping

Your Gamification contract supports achievement types 0-255:

| Range | Usage | Example |
|-------|-------|---------|
| **0-6** | Worker achievements (existing) | Job completion, quality milestones |
| **7-99** | Reserved for future worker types | - |
| **100-199** | **Discord rewards** ← Use this! | Early Adopter (100), VIP Member (101), etc. |
| **200-255** | Custom events | - |

**When creating POAP campaigns, use achievement_type 100-199!**

---

## 🎁 Example POAP Campaign Configuration

Once permission is granted, create a POAP via admin UI:

```typescript
{
  name: "Discord OG Badge",
  reward_type: "poap",
  reward_config: {
    contract_address: "0x047402be0797cda868f2601f6234f56fa814e51957fa1981989ffcbf471e81e4",
    achievement_type: 100,  // Discord OG = type 100
    metadata_uri: "ipfs://QmYourPOAPMetadata/og-badge.json"
  },
  trigger_type: "manual",
  eligibility_requirements: {
    min_messages: 100,
    verified: true  // Must have verified Starknet wallet
  },
  max_claims: 500,  // Limited edition!
  cooldown_hours: 0  // One-time only
}
```

**User Flow:**
1. User runs `/verify` → Connects Starknet wallet
2. User gets 100+ messages in Discord
3. User runs `/reward claim Discord OG Badge`
4. Bot mints soulbound POAP to user's wallet
5. POAP appears in wallet (non-transferable)

**Transaction Flow:**
```
Bot Account → Gamification.award_achievement()
├─ achievement_type: 100 (Discord OG)
├─ worker_id: hash(discord_user_id)
├─ wallet: user's Starknet address
└─ Mints soulbound NFT to user
```

---

## 🔒 Security Checklist

- [x] ✅ Private key stored in .env (gitignored)
- [x] ✅ RPC URL uses Alchemy (reliable endpoint)
- [x] ✅ Bot account separate from deployer (best practice)
- [x] ✅ Gamification contract owned by deployer (safe)
- [ ] ⏸️ Bot granted job_manager role (one command away)
- [ ] ⏸️ Bot wallet funded with gas fees (get testnet ETH)

---

## 💰 Gas Fee Estimates

| Operation | Gas Cost (Sepolia) | Notes |
|-----------|-------------------|-------|
| **Award Achievement (POAP)** | ~$0.01-0.02 | Bot pays |
| **Mint External NFT** | ~$0.01-0.05 | Bot pays |
| **User Verification** | Free | No gas needed |

**For 100 POAP mints:** ~$1-2 total gas cost (extremely cheap on Starknet!)

---

## 🚀 Quick Start Guide

### Step 1: Grant Permission (Required Once)

```bash
# Option A: Using Starkli
starkli invoke \
  0x047402be0797cda868f2601f6234f56fa814e51957fa1981989ffcbf471e81e4 \
  set_job_manager \
  0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660 \
  --network sepolia \
  --keystore deployment/sepolia_keystore.json \
  --password bitsage123
```

### Step 2: Fund Bot Wallet (If Needed)

```bash
# Check balance
starkli balance 0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660 --network sepolia

# If 0, get testnet ETH from faucet
# Send to: 0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660
```

### Step 3: Restart Bot

```bash
cd /Users/vaamx/bitsage-network/Sage-Discord
npm run dev
```

### Step 4: Create POAP Campaign

1. Login to admin webapp
2. Go to `/dashboard/guild/[id]/rewards`
3. Click "Create Campaign"
4. Select "POAP (Soulbound)"
5. Fill in:
   - Contract: `0x047402...` (pre-filled)
   - Achievement Type: `100-199`
   - Metadata URI
6. Save!

### Step 5: Test User Flow

```
User: /verify
Bot: [Opens wallet verification]
User: [Connects wallet 0xUSER...]

User: /reward list
Bot: [Shows "Discord OG Badge" available]

User: /reward claim Discord OG Badge
Bot: ✅ Reward claimed! POAP minting in progress...
     Achievement Type: 100
     Contract: 0x047402...
     Transaction: https://sepolia.voyager.online/tx/0x...

[30 seconds later]
Bot DM: 🎉 Your POAP has been delivered!
        Check your wallet at 0xUSER...
```

---

## 📝 Summary

### ✅ What's Complete

1. ✅ Starknet account configured (Braavos wallet)
2. ✅ Private key securely stored in .env
3. ✅ Alchemy RPC endpoint configured
4. ✅ Gamification contract identified and configured
5. ✅ Achievement type mapping defined (100-199 for Discord)
6. ✅ All 6 reward types integrated (backend + frontend + database)

### ⏸️ What's Pending (Your Action)

1. ⚠️ **Grant bot minting permission** (run 1 command)
   - Use deployer wallet to call `set_job_manager(bot_address)`
   - Takes 1 minute

2. ⚠️ **Fund bot wallet with gas fees** (optional for testing)
   - Get free Sepolia ETH from faucet
   - Send to bot address

### 🎉 What You'll Have

- ✅ Full reward system with 6 types
- ✅ NFT minting capability (transferable)
- ✅ POAP minting capability (soulbound)
- ✅ Discord role/XP/access rewards
- ✅ Webhook integrations
- ✅ Complete admin UI
- ✅ Bot commands for users
- ✅ Gasless claiming for users (bot pays)

---

## 🆘 Troubleshooting

### Bot Can't Mint POAPs

**Error:** "Unauthorized" or "Not job_manager"

**Solution:**
```bash
# Verify bot has permission
starkli call 0x047402be0797cda868f2601f6234f56fa814e51957fa1981989ffcbf471e81e4 \
  job_manager --network sepolia

# If not bot address, grant permission (see Step 1 above)
```

### Bot Out of Gas

**Error:** "Insufficient balance for transaction"

**Solution:**
```bash
# Check balance
starkli balance 0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660 --network sepolia

# Get testnet ETH
# Visit: https://starknet-faucet.vercel.app/
```

### Transaction Failed

**Check transaction on explorer:**
```
https://sepolia.voyager.online/tx/[transaction_hash]
```

**Common issues:**
- Insufficient gas
- Wrong achievement_type (must be 100-199 for Discord)
- User wallet not verified
- Bot not authorized

---

## 📞 Support Resources

**Starknet Documentation:**
- Starknet.js: https://www.starknetjs.com/
- Starknet Docs: https://docs.starknet.io/

**Block Explorers:**
- Voyager: https://sepolia.voyager.online/
- Starkscan: https://sepolia.starkscan.co/

**Testnet Faucets:**
- https://starknet-faucet.vercel.app/
- https://faucet.goerli.starknet.io/

**Your Contract:**
- Gamification: https://sepolia.starkscan.co/contract/0x047402be0797cda868f2601f6234f56fa814e51957fa1981989ffcbf471e81e4

---

**Configuration Completed:** January 3, 2026
**Status:** ✅ Ready for Permission Grant + Testing

**Next Step:** Run the grant permission command, then you're ready to mint POAPs! 🚀
