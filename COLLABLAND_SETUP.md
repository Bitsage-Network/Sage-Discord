# Collab.Land Setup Guide for BitSage Discord

Complete guide to integrate Collab.Land for Starknet token-gated access.

---

## Prerequisites

Before starting, ensure you have:
- ✅ Run `npm run setup-token-gating` (creates roles and channels)
- ✅ Admin permissions on BitSage Discord server
- ✅ SAGE token contract address on Starknet
- ✅ Validator/Worker registry contract addresses (optional)

---

## Step 1: Invite Collab.Land Bot

1. Visit: https://cc.collab.land/login
2. Sign in with Discord
3. Select **BitSage Network** server
4. Authorize with these permissions:
   - ✅ Manage Roles
   - ✅ Send Messages
   - ✅ Read Message History
   - ✅ Add Reactions
5. Click **Authorize**

**Result:** Collab.Land bot appears in your server

---

## Step 2: Access Collab.Land Command Center

1. Go to: https://cc.collab.land
2. Select **BitSage Network** from dropdown
3. Navigate to **Token Gating** → **Add TGR** (Token Gated Role)

---

## Step 3: Configure SAGE Holder Role (1,000+ tokens)

### Basic Settings
```
Role Name: SAGE Holder
Role to Assign: @SAGE Holder (select from dropdown)
Description: Verified holder of 1,000+ SAGE tokens
```

### Token Requirements
```
Blockchain: Starknet
Token Type: ERC-20
Contract Address: <YOUR_SAGE_TOKEN_CONTRACT_ADDRESS>
  Example: 0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7

Minimum Balance: 1000
Symbol: SAGE (optional, for display)
```

### Logic
```
Requirement Type: Token Balance
Operator: Greater Than or Equal (>=)
Value: 1000
```

### Save
Click **Create Token Gated Role**

---

## Step 4: Configure SAGE Whale Role (10,000+ tokens)

Repeat Step 3 with:
```
Role Name: SAGE Whale
Role to Assign: @SAGE Whale
Minimum Balance: 10000
```

---

## Step 5: Configure Validator Operator Role (On-Chain Proof)

### Option A: Using NFT Proof
If validators get an NFT:
```
Blockchain: Starknet
Token Type: ERC-721 (NFT)
Contract Address: <VALIDATOR_NFT_CONTRACT_ADDRESS>
Minimum Balance: 1
```

### Option B: Using Contract State
If validator registry is a smart contract:
```
Blockchain: Starknet
Token Type: Custom Contract Call
Contract Address: <VALIDATOR_REGISTRY_CONTRACT_ADDRESS>
Function: isValidator(address)
Expected Return: true
```

**Note:** Option B requires Collab.Land Pro ($50/month). For free tier, use Option A.

---

## Step 6: Configure Worker Operator Role

Same as Step 5, but for worker nodes:
```
Contract Address: <WORKER_REGISTRY_CONTRACT_ADDRESS>
```

---

## Step 7: Setup Verification Flow

### Create Verification Message

1. Go to Discord #verify-wallet channel
2. Type: `/collabland join`
3. Collab.Land posts verification message with **"Let's go!"** button

**Alternative:** Manual message via Command Center:
1. Go to: https://cc.collab.land
2. Navigate to **Bot Setup** → **Verification Message**
3. Customize message:
```
**🔗 Verify Your Wallet**

Connect your Starknet wallet to unlock exclusive channels based on your SAGE holdings:

💰 **SAGE Holder** (1,000+ tokens)
  ✅ Access to #holders-only
  ✅ Participate in governance votes
  ✅ Early access to announcements

🐋 **SAGE Whale** (10,000+ tokens)
  ✅ All SAGE Holder benefits
  ✅ Access to #whale-lounge
  ✅ Direct communication with team

🖥️ **Validator Operator**
  ✅ Access to #validator-lounge
  ✅ Real-time alerts in #validator-alerts

⚙️ **Worker Operator**
  ✅ Access to #worker-lounge

Click **"Let's go!"** below to connect your wallet.
```

4. Select Channel: #verify-wallet
5. Click **Post Message**

---

## Step 8: Test Wallet Verification

### For Testing (Without Real Tokens)

1. Go to #verify-wallet
2. Click **"Let's go!"** button
3. Collab.Land DMs you with wallet connection options:
   - **Argent** (recommended for Starknet)
   - **Braavos**
   - **WalletConnect**
4. Select wallet type
5. Connect wallet address
6. Sign message to verify ownership
7. Collab.Land checks token balance
8. If balance >= 1000 SAGE → Gets "SAGE Holder" role
9. Channel access updates automatically

### Wallet Connection Flow
```
User clicks "Let's go!"
   ↓
Selects wallet (Argent/Braavos)
   ↓
Enters wallet address OR scans QR code
   ↓
Signs verification message
   ↓
Collab.Land queries Starknet:
  - GET token balance at <SAGE_CONTRACT>
  - Check if address >= 1000 tokens
   ↓
IF TRUE: Assign @SAGE Holder role
IF FALSE: Show "Insufficient balance" message
```

---

## Step 9: Configure Advanced Settings (Optional)

### Re-Verification Period
Automatically re-check token balances:
```
Settings → Token Gated Roles → SAGE Holder → Edit
Re-verification: Every 7 days
```

Users who sell tokens lose role after 7 days.

### Multiple Requirements (Pro Feature)
Require BOTH token holding AND social proof:
```
Requirements:
  1. Hold 1000+ SAGE tokens (Starknet)
  AND
  2. Follow @BitSageNetwork on Twitter
  AND
  3. In Discord for 7+ days
```

---

## Step 10: Monitor and Manage

### View Token Holders
1. Go to: https://cc.collab.land
2. Navigate to **Members**
3. Filter by role: "SAGE Holder"
4. See all verified wallet addresses

### Manual Role Assignment (Emergency)
If verification fails:
```
Discord → Server Settings → Roles
Manually assign @SAGE Holder to user
```

---

## Troubleshooting

### Issue: Collab.Land not responding
**Solution:**
- Check bot has correct permissions (Manage Roles)
- Verify bot is online (green dot)
- Try `/collabland help` in any channel

### Issue: Token balance not detected
**Solution:**
- Verify contract address is correct
- Check token is ERC-20 standard on Starknet
- Wait 5 minutes (blockchain sync delay)
- Try reconnecting wallet

### Issue: Role not assigned after verification
**Solution:**
- Check @SAGE Holder role is BELOW Collab.Land bot role in hierarchy
  - Server Settings → Roles → Drag Collab.Land above SAGE Holder
- Retry verification

### Issue: Starknet not supported
**Solution:**
- As of 2024, Collab.Land supports 40+ chains including Starknet
- If not listed, contact Collab.Land support: https://discord.gg/collabland
- **Alternative:** Use Guild.xyz (fully supports Starknet)

---

## Alternative: Guild.xyz (Recommended if Starknet issues)

If Collab.Land doesn't support your Starknet token yet:

1. Visit: https://guild.xyz
2. Create Guild: "BitSage Network"
3. Add Requirement:
```
Type: Token Holding
Chain: Starknet
Contract: <SAGE_TOKEN_ADDRESS>
Minimum: 1000
```
4. Link Discord Server
5. Select Role: @SAGE Holder
6. Users verify via: https://guild.xyz/bitsage

**Benefits:**
- ✅ Full Starknet support
- ✅ Completely FREE (no pro tier)
- ✅ More flexible requirements (AND/OR logic)
- ✅ Twitter, GitHub, Discord activity verification

---

## Important Starknet Addresses

You'll need these for configuration:

```bash
# SAGE Token Contract (REPLACE WITH YOUR ACTUAL ADDRESS)
SAGE_TOKEN_ADDRESS=0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7

# Validator Registry Contract (REPLACE WITH YOUR ACTUAL ADDRESS)
VALIDATOR_REGISTRY=0x...

# Worker Registry Contract (REPLACE WITH YOUR ACTUAL ADDRESS)
WORKER_REGISTRY=0x...

# Starknet Chain ID
# Mainnet: SN_MAIN
# Goerli Testnet: SN_GOERLI
# Sepolia Testnet: SN_SEPOLIA
```

---

## Pricing

### Collab.Land Free Tier
✅ Up to 5 token-gated roles
✅ Basic token balance checks
✅ 40+ blockchain support
✅ Discord role assignment
❌ No custom contract calls
❌ No advanced logic (AND/OR)

### Collab.Land Pro ($50/month)
✅ Unlimited token-gated roles
✅ Custom contract calls
✅ Advanced logic (AND/OR requirements)
✅ API access
✅ Priority support

### Guild.xyz
✅ 100% FREE forever
✅ Unlimited roles
✅ Advanced logic
✅ Full Starknet support

**Recommendation:** Start with free tier (Collab.Land or Guild.xyz). Upgrade only if you need custom contract calls.

---

## Quick Commands Reference

```bash
# Setup infrastructure (run first)
npm run setup-token-gating

# Collab.Land Discord Commands
/collabland join          # Post verification message
/collabland admin         # Access admin panel
/collabland help          # Show help
/collabland verify @user  # Manual verification

# Guild.xyz Discord Commands
/guild verify             # Verify wallet
/guild status             # Check verification status
```

---

## Testing Checklist

After setup, test:

- [ ] Bot appears in server member list
- [ ] #verify-wallet channel exists
- [ ] Verification message posted
- [ ] Click "Let's go!" button works
- [ ] Wallet connection flow opens
- [ ] Can connect Argent/Braavos wallet
- [ ] Token balance detected correctly
- [ ] @SAGE Holder role assigned automatically
- [ ] #holders-only channel becomes visible
- [ ] Role persists after disconnect/reconnect
- [ ] Re-verification works (7 days later)

---

## Support

- **Collab.Land Discord:** https://discord.gg/collabland
- **Guild.xyz Discord:** https://guild.xyz/discord
- **Starknet Docs:** https://docs.starknet.io
- **BitSage Support:** #help channel

---

## Next Steps After Setup

1. **Announce to Community**
   - Post in #announcements about token gating
   - Explain benefits of verification
   - Direct users to #verify-wallet

2. **Create Holder-Exclusive Content**
   - Post alpha in #holders-only
   - Host governance votes in #governance-discussion
   - Share early updates in #holders-announcements

3. **Monitor Engagement**
   - Track verification rate
   - Analyze holder activity
   - Adjust token requirements if needed

4. **Expand Token Gates**
   - Add more tiers (100k+ "SAGE Legends")
   - NFT holder roles
   - Liquidity provider roles

