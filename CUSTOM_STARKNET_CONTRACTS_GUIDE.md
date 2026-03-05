# 🏗️ Using Your Own Starknet Infrastructure - Complete Guide

**Date:** January 3, 2026

---

## 🎯 TL;DR

**You're ALREADY using your own Starknet infrastructure!** The system is designed to support ANY custom contracts you deploy.

- ✅ "POAP" = YOUR Gamification contract (achievement_nft.cairo)
- ✅ "NFT" = ANY ERC721 contract you deploy
- ✅ Fully customizable via dashboard

**No POAP.xyz dependency!** Everything is on-chain Starknet, controlled by YOU.

---

## 📊 Current Setup

### Your Deployed Contracts:

From `deployment/deployment-2025-12-31.json`:

```json
{
  "gamification": "0x3beb685db6a20804ee0939948cee05c42de655b6b78a93e1e773447ce981cde",
  "sage_token": "0x072349097c8a802e7f66dc96b95aca84e4d78ddad22014904076c76293a99850",
  "staking": "0x3287a0af5ab2d74fbf968204ce2291adde008d645d42bc363cb741ebfa941b",
  "reputation_manager": "0x4ef80990256fb016381f57c340a306e37376c1de70fa11147a4f1fc57a834de",
  // ... + 15 more contracts
}
```

**You have a FULL BitSage ecosystem deployed on Starknet!**

---

## 🎨 How Reward Types Work

### Reward Type Comparison:

| Reward Type | Contract Used | Customizable? | Example Use Case |
|-------------|---------------|---------------|------------------|
| **role** | Discord API | N/A | Grant "Verified" role |
| **xp** | Database | N/A | Award 100 XP |
| **access_grant** | Discord API | N/A | Grant VIP channel access |
| **nft** | **ANY ERC721 you deploy** | ✅ YES | Custom limited NFTs |
| **poap** | **YOUR achievement_nft.cairo** | ✅ YES | Soulbound achievements |
| **webhook** | External URL | ✅ YES | Trigger external systems |

### NFT vs POAP:

#### NFT Reward Type:
```typescript
// Dashboard input fields:
{
  contract_address: "0x...",        // ANY ERC721 contract
  metadata_uri: "ipfs://Qm.../",    // YOUR metadata
  token_id_start: 1,                 // Optional range
  token_id_end: 1000                 // Optional range
}

// Bot calls:
await externalNFTContract.mint(userWallet, tokenId);
// Or: safe_mint(), mintTo(), whatever your contract uses
```

**Use Cases:**
- Custom artwork collections
- Transferable collectibles
- Limited edition rewards
- Tradeable NFTs on marketplaces

#### POAP Reward Type:
```typescript
// Dashboard input fields:
{
  contract_address: "0x3beb685...", // YOUR Gamification contract
  achievement_type: 101,             // 100-199 Discord range
  metadata_uri: "ipfs://..."        // Optional
}

// Bot calls:
await gamificationContract.mint_achievement(
  userWallet,
  tokenId,
  {
    achievement_type: 101,
    worker_id: discordIdToFelt(userId),
    earned_at: timestamp,
    reward_amount: 0
  }
);
```

**Use Cases:**
- Non-transferable achievements
- Permanent Discord milestones
- Proof of participation
- Community badges

---

## 🚀 Using Your Own Contracts

### Option 1: Use Your Existing Gamification Contract (Current Setup)

**What it does:**
- Mints soulbound achievement NFTs
- Tracks achievement types
- Links Discord ID to Starknet wallet
- Permanent on-chain record

**How to use in dashboard:**

1. Create POAP campaign
2. Contract address: `0x3beb685db6a20804ee0939948cee05c42de655b6b78a93e1e773447ce981cde`
3. Achievement type: 100-199 (e.g., 100 = Early Adopter, 101 = Verified, etc.)
4. Save & activate

**Done!** Bot already has minting permission (we granted job_manager role).

---

### Option 2: Deploy Your Own Custom ERC721 NFT Contract

Want fully custom NFTs with your own logic? Here's how:

#### Step 1: Write Your Starknet NFT Contract

Example `custom_nft.cairo`:

```cairo
#[starknet::contract]
mod CustomDiscordNFT {
    use starknet::ContractAddress;

    #[storage]
    struct Storage {
        // Your custom storage
        owner: ContractAddress,
        minter: ContractAddress,
        // ERC721 standard storage
        // ...
    }

    #[external(v0)]
    fn mint(ref self: ContractState, to: ContractAddress, token_id: u256) {
        // Your custom minting logic
        // Can include:
        // - Rarity system
        // - Dynamic metadata
        // - Special attributes
        // - Integration with SAGE token
        assert(get_caller_address() == self.minter.read(), 'Not authorized');
        // ... mint NFT
    }

    #[external(v0)]
    fn set_minter(ref self: ContractState, new_minter: ContractAddress) {
        assert(get_caller_address() == self.owner.read(), 'Not owner');
        self.minter.write(new_minter);
    }
}
```

#### Step 2: Deploy Your Contract

```bash
# In your BitSage-Cairo-Smart-Contracts repo
cd /Users/vaamx/bitsage-network/BitSage-Cairo-Smart-Contracts

# Compile
scarb build

# Deploy
starkli deploy \
  --account deployment/sepolia_account.json \
  --keystore deployment/sepolia_keystore.json \
  target/dev/custom_discord_nft.sierra.json \
  <constructor args>

# Returns: 0xYOUR_NEW_CONTRACT_ADDRESS
```

#### Step 3: Grant Bot Minting Permission

```typescript
// Create grant-nft-permission.ts
import { Account, RpcProvider } from 'starknet';

const provider = new RpcProvider({
  nodeUrl: 'https://rpc.starknet-testnet.lava.build'
});

const deployerAccount = new Account(
  provider,
  '0x0759a4374389b0e3cfcc59d49310b6bc75bb12bbf8ce550eb5c2f026918bb344',
  '0x0154de503c7553e078b28044f15b60323899d9437bd44e99d9ab629acbada47a'
);

const call = {
  contractAddress: '0xYOUR_NEW_CONTRACT_ADDRESS',
  entrypoint: 'set_minter', // Or whatever your contract uses
  calldata: ['0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660']
  // ↑ Bot account address
};

const tx = await deployerAccount.execute(call);
console.log('Permission granted! TX:', tx.transaction_hash);
```

#### Step 4: Create Campaign in Dashboard

1. Go to Rewards page
2. Click "Create Reward Campaign"
3. Select type: **NFT** (not POAP!)
4. Enter your contract address: `0xYOUR_NEW_CONTRACT_ADDRESS`
5. Configure:
   - Metadata URI: `ipfs://YOUR_METADATA/`
   - Token ID range: 1-1000 (or whatever)
6. Save & activate

**Done!** Bot will mint from YOUR contract! 🎉

---

### Option 3: Integrate with Your Existing Contracts

You have 19+ contracts deployed! Here's how to use them:

#### Example: Reward SAGE Tokens

**Current contracts:**
- SAGE Token: `0x072349097c8a802e7f66dc96b95aca84e4d78ddad22014904076c76293a99850`
- Staking: `0x3287a0af5ab2d74fbf968204ce2291adde008d645d42bc363cb741ebfa941b`

**Option A: Use Webhook Reward Type**

1. Create webhook campaign
2. URL: `https://your-api.com/reward-sage`
3. When user claims, webhook sends:
   ```json
   {
     "user_discord_id": "123456",
     "user_wallet": "0xabc...",
     "campaign": "sage_reward",
     "amount": "100"
   }
   ```
4. Your API receives webhook → Mints SAGE tokens to user

**Option B: Add Custom Reward Type**

Extend the reward system! Add `src/services/reward-sage-service.ts`:

```typescript
export class RewardSageService {
  private sageContract: Contract;

  async rewardSAGE(userWallet: string, amount: bigint) {
    const call = this.sageContract.populate('transfer', [
      userWallet,
      uint256.bnToUint256(amount)
    ]);

    const tx = await this.account.execute(call);
    return tx.transaction_hash;
  }
}
```

Then update `reward-delivery-service.ts` to handle `reward_type: 'sage'`.

---

## 🎨 Example: Custom Achievement System

### Scenario: Multi-Tier Discord Achievements

You want achievements that:
- Track multiple milestones
- Have visual rarity (bronze/silver/gold)
- Integrate with SAGE staking
- Give on-chain reputation

### Step 1: Deploy Enhanced Achievement Contract

```cairo
#[starknet::contract]
mod EnhancedAchievements {
    struct Achievement {
        achievement_type: u8,
        tier: u8,              // 1=Bronze, 2=Silver, 3=Gold
        discord_id: felt252,
        earned_at: u64,
        sage_reward: u256,
        reputation_boost: u32
    }

    #[external(v0)]
    fn mint_tiered_achievement(
        ref self: ContractState,
        to: ContractAddress,
        achievement_type: u8,
        tier: u8
    ) {
        // Mint NFT
        // Award SAGE tokens based on tier
        // Increase reputation score
        // ...
    }
}
```

### Step 2: Create Campaigns for Each Tier

**Dashboard campaigns:**
```
Campaign 1: "Early Adopter - Bronze"
- Type: POAP
- Contract: 0xYOUR_ENHANCED_CONTRACT
- Achievement Type: 100
- Tier: 1
- Trigger: rule_pass (joined server)

Campaign 2: "Early Adopter - Silver"
- Type: POAP
- Achievement Type: 100
- Tier: 2
- Trigger: manual (30 days active)

Campaign 3: "Early Adopter - Gold"
- Type: POAP
- Achievement Type: 100
- Tier: 3
- Trigger: manual (6 months + 100 messages)
```

### Step 3: Users Collect Achievements

- Join Discord → Auto-get Bronze achievement
- Stay active 30 days → Claim Silver
- Reach 6 months + engagement → Claim Gold

**All on-chain!** Permanent proof of participation.

---

## 🔧 Technical Integration Points

### Where Custom Contracts Are Used:

**1. NFT Minting Service** (`src/services/reward-nft-service.ts`)

```typescript
// Line 158-172: POAP minting
const contract = new Contract(
  ACHIEVEMENT_NFT_ABI,
  config.contract_address,  // ← YOUR contract address from dashboard
  this.provider
);
contract.connect(this.account);

const call = contract.populate('mint_achievement', [
  walletAddress,
  tokenId,
  metadata
]);

const tx = await this.account.execute(call);
```

**2. Campaign Configuration** (`webapp/components/rewards/CreateRewardDialog.tsx`)

```typescript
// Line 521-531: NFT contract input
<Input
  id="nft_contract_address"
  placeholder="0x..."
  {...register("nft_contract_address")}
/>
// ↑ Admin enters YOUR contract address here!

// Line 585-595: POAP contract input
<Input
  id="poap_contract_address"
  placeholder="0x..."
  {...register("poap_contract_address")}
/>
```

**3. Database Storage** (`migrations/009_reward_management_phase2.sql`)

```sql
CREATE TABLE reward_campaigns (
  -- ...
  reward_config JSONB NOT NULL,  -- Stores contract address, etc.
  -- ...
);

-- Example reward_config for NFT:
{
  "contract_address": "0xYOUR_CONTRACT",
  "metadata_uri": "ipfs://...",
  "token_id_start": 1,
  "token_id_end": 1000
}
```

---

## 📋 Quick Start: Use Your Own Contract

### 5-Minute Setup:

1. **Choose Contract:**
   - Use existing Gamification: `0x3beb685...` (POAP)
   - Or deploy new ERC721 (NFT)

2. **Grant Permission:**
   ```bash
   npx ts-node grant-bot-permission.ts
   # (Already done for Gamification!)
   ```

3. **Start Dashboard:**
   ```bash
   cd webapp
   npm run dev
   ```

4. **Create Campaign:**
   - Go to: `http://localhost:3000/dashboard/guild/[id]/rewards`
   - Click "Create Reward Campaign"
   - Type: NFT or POAP
   - Contract: `0xYOUR_CONTRACT_ADDRESS`
   - Save!

5. **Test:**
   ```
   In Discord: /reward claim [campaign]
   ```

**Done!** Your custom contract is minting NFTs via Discord! 🎉

---

## 🌟 Advanced: Multi-Contract Ecosystem

### Using ALL Your Deployed Contracts:

You have 19 contracts! Here's how to integrate them:

```typescript
// Create: src/services/reward-ecosystem-service.ts

export class RewardEcosystemService {
  private sageToken: Contract;
  private stakingContract: Contract;
  private reputationManager: Contract;
  private gamificationContract: Contract;

  async rewardDiscordMilestone(
    userId: string,
    wallet: string,
    milestoneType: string
  ) {
    // 1. Mint achievement POAP
    await this.gamificationContract.mint_achievement(...);

    // 2. Award SAGE tokens
    await this.sageToken.transfer(wallet, amount);

    // 3. Increase reputation
    await this.reputationManager.boost_reputation(wallet, points);

    // 4. Optional: Auto-stake SAGE
    await this.stakingContract.stake_on_behalf(wallet, amount);

    // All in ONE Discord command! 🤯
  }
}
```

**Result:** `/reward claim milestone` triggers 4 on-chain transactions across your ecosystem!

---

## ✅ Summary

| Question | Answer |
|----------|--------|
| **Can we use our own Starknet infra?** | ✅ YES - Already doing it! |
| **Can we deploy custom contracts?** | ✅ YES - Dashboard supports ANY address |
| **Can we replace POAP system?** | ✅ YES - It's YOUR contract, not POAP.xyz |
| **Can we add new reward types?** | ✅ YES - Extend reward-delivery-service.ts |
| **Do we control the contracts?** | ✅ YES - You're the deployer & owner |

**You have FULL control!** The reward system is a flexible framework for YOUR infrastructure.

---

## 🚀 Next Steps

### Immediate:
1. ✅ Use existing Gamification contract (POAP type)
2. ✅ Create campaigns via dashboard
3. ✅ Test with Discord commands

### Soon:
1. Deploy custom ERC721 for special NFTs
2. Create tiered achievement system
3. Integrate SAGE token rewards

### Future:
1. Multi-contract reward orchestration
2. Dynamic NFT metadata based on Discord activity
3. Cross-contract reward combos

---

**Last Updated:** January 3, 2026
**Your Ecosystem:** 19+ Starknet contracts deployed ✅
**Reward System:** Fully customizable for YOUR infrastructure ✅
