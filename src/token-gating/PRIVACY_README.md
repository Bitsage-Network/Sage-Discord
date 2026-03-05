# BitSage Token-Gating Privacy Features

**Zero-Knowledge Proofs & Stealth Addresses for Discord Token-Gating**

This document explains how to use and develop the privacy features in the BitSage Discord token-gating bot.

---

## Overview

The privacy features allow users to verify token ownership **without revealing their exact balance** using:

- **Zero-Knowledge Proofs (ZK Proofs)** - Prove balance ≥ threshold without revealing the amount
- **Stealth Addresses** - Receive payments anonymously and verify totals
- **Auditor Compliance** - Regulatory access via 3-party encryption

These features integrate with the **Obelysk Privacy Layer** on Starknet.

---

## Architecture

### Services

**`PrivacyService`** (`services/privacy-service.ts`)
- Main privacy verification logic
- Verifies ZK balance proofs
- Manages stealth addresses
- Handles auditor access

**`ZKProofVerifier`** (`utils/zk-proof-verifier.ts`)
- Detailed cryptographic verification
- Schnorr proof validation
- Bulletproofs range proof validation
- Nullifier management

**`RuleMatcher`** (`utils/rule-matcher.ts`)
- Integrated privacy checks in rule evaluation
- Falls back to public verification if ZK proof not available

### Database Tables

**`zk_proof_nullifiers`** - Track verified proofs (prevent replay)
```sql
CREATE TABLE zk_proof_nullifiers (
    nullifier TEXT PRIMARY KEY,
    discord_id TEXT NOT NULL,
    starknet_address TEXT NOT NULL,
    threshold NUMERIC NOT NULL,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,  -- 7 days
    proof_data JSONB NOT NULL
);
```

**`stealth_addresses`** - User stealth meta-addresses
```sql
CREATE TABLE stealth_addresses (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    stealth_meta_address TEXT NOT NULL UNIQUE,
    spending_pubkey TEXT NOT NULL,
    viewing_pubkey TEXT NOT NULL,
    registered_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## How ZK Proofs Work

### User Flow (Privacy-Preserving)

```
1. User connects wallet to web app
2. App queries encrypted balance from PrivacyRouter contract
3. User provides viewing key (proves ownership)
4. App generates ZK proof client-side:
   - Schnorr proof: "I know the decryption key"
   - Range proof: "Decrypted balance ≥ threshold"
   - Nullifier: Unique ID for this proof
5. User signs proof with wallet
6. App submits proof to Discord bot API
7. Bot verifies proof off-chain:
   ✓ Proof is fresh (timestamp)
   ✓ Nullifier not used before
   ✓ Signature valid
   ✓ Encrypted balance matches on-chain state
   ✓ Schnorr proof valid
   ✓ Range proof valid
8. Bot stores nullifier (prevent replay)
9. Bot assigns Discord role
10. User's exact balance NEVER revealed to bot!
```

### Standard Flow (Public Balance)

```
1. User connects wallet
2. App signs message with wallet
3. Bot verifies signature
4. Bot queries balance from blockchain (PUBLIC)
5. Bot assigns role based on balance
6. User's balance IS visible to bot
```

### Comparison

| Method | Privacy | Speed | Complexity |
|--------|---------|-------|------------|
| **Standard** | Low - Balance visible | Fast (~2s) | Simple |
| **ZK Proof** | High - Balance hidden | Slower (~10s) | Complex |

---

## Usage

### For Developers

#### Initialize Privacy Service

```typescript
import { TokenGatingModule } from './token-gating';

const tokenGating = TokenGatingModule.getInstance();
const privacyService = tokenGating.privacyService;
```

#### Verify a ZK Proof

```typescript
import { ZKBalanceProof } from './token-gating/services/privacy-service';

// Proof generated client-side by user
const proof: ZKBalanceProof = {
  encrypted_balance: '0x...',
  threshold: '1000000000000000000',  // 1 SAGE
  nullifier: '0x...',
  timestamp: Date.now(),
  signature: ['0x...', '0x...'],
  schnorr_proof: { R: '0x...', s: '0x...' },
  range_proof: { A: '0x...', S: '0x...', ... },
  commitment: '0x...',
  ae_hint: '0x...',
};

// Verify proof
const result = await privacyService.verifyBalanceProof(
  proof,
  discordUserId,
  starknetAddress
);

if (result.valid) {
  console.log('✅ User has balance ≥ threshold (exact amount hidden)');
  console.log('Nullifier:', result.nullifier);
} else {
  console.log('❌ Verification failed:', result.reason);
}
```

#### Register Stealth Address

```typescript
const stealthMetaAddress = {
  spending_pubkey: '0x...',  // From user's wallet
  viewing_pubkey: '0x...',   // From user's wallet
};

await privacyService.registerStealthAddress(
  discordUserId,
  stealthMetaAddress
);
```

#### Verify Stealth Payments

```typescript
// Without viewing key (count announcements only)
const result = await privacyService.verifyStealthPayments(
  discordUserId,
  BigInt(5),  // Threshold: 5 payments
  undefined   // No viewing key
);

if (result.threshold_met) {
  console.log(`✅ User received ${result.announcements_found} stealth payments`);
}

// With viewing key (decrypt amounts)
const resultWithKey = await privacyService.verifyStealthPayments(
  discordUserId,
  BigInt('1000000000000000000'),  // 1 SAGE threshold
  viewingKey
);

if (resultWithKey.threshold_met) {
  console.log(`✅ User received ${resultWithKey.total_amount} SAGE in stealth payments`);
}
```

---

### For Bot Administrators

#### Create Privacy-Enabled Rule

```bash
/token-gate create
  role: @SAGE Whale
  type: token_balance
  min_balance: 10000
  privacy-enabled: true      # Allow ZK proofs (optional)
  require-zk-proof: false    # Don't force ZK proofs (standard allowed too)
```

**Result:**
- Users CAN verify with ZK proof (private, balance hidden)
- Users CAN ALSO verify with standard signature (public, balance visible)
- User chooses their privacy level

#### Create Privacy-REQUIRED Rule

```bash
/token-gate create
  role: @Anonymous Holder
  type: token_balance
  min_balance: 1000
  privacy-enabled: true      # Allow ZK proofs
  require-zk-proof: true     # FORCE ZK proofs only
```

**Result:**
- Users MUST verify with ZK proof (standard signature rejected)
- Ensures all verifications are private
- Protects user financial privacy

---

### For End Users

#### Standard Verification (Public)

```
1. In Discord: /verify-wallet
2. Choose method: "🖊️ Signature (Standard)"
3. Click "Verify Wallet" button
4. Connect wallet (Argent X / Braavos)
5. Sign message
6. ✅ Roles assigned
7. ⚠️ Bot can see your exact balance
```

#### Private Verification (ZK Proof)

```
1. In Discord: /verify-wallet
2. Choose method: "🔒 ZK Proof (Private)"
3. Click "Verify Wallet" button
4. Connect wallet
5. Provide viewing key (to decrypt your encrypted balance)
6. Generate proof (takes ~10 seconds)
7. Sign proof
8. ✅ Roles assigned
9. ✅ Bot CANNOT see your exact balance!
```

#### Check Status

```
/wallet-status
```

Shows:
- Verification method used (signature / zk_proof / stealth)
- Eligible roles
- Balance (if standard verification)
- OR "Balance hidden (ZK proof)" (if private verification)

---

## Testing

### Run Privacy Tests

```bash
npm run test-privacy
```

This runs `src/token-gating/test-privacy.ts` which tests:

1. ✅ Mock ZK proof generation
2. ✅ Proof format validation
3. ✅ ZK proof verification (prototype)
4. ✅ Replay attack prevention
5. ✅ Expired proof rejection
6. ✅ Nullifier database storage
7. ✅ Unique nullifier generation
8. ✅ Stealth address registration
9. ✅ Expired nullifier cleanup

**Expected Output:**
```
🧪 Testing Privacy Features
============================================================

Test 1: Generate Mock ZK Proof
✅ Mock proof generated

Test 2: Validate Proof Format
✅ Proof format validation: PASSED
✅ Invalid proof rejected: PASSED

Test 3: Verify ZK Proof
✅ ZK Proof Verified Successfully!

Test 4: Replay Attack Prevention
✅ Replay Attack PREVENTED!

Test 5: Expired Proof Rejection
✅ Expired Proof REJECTED!

...

🎉 Test Summary
✅ All privacy tests PASSED
```

---

## Configuration

### Environment Variables

```bash
# Enable/disable privacy features
TG_ENABLE_ZK_PROOFS=true
TG_ENABLE_STEALTH_ADDRESSES=true
TG_ENABLE_AUDITOR_SUPPORT=false

# Obelysk contract addresses (Starknet)
TG_PRIVACY_ROUTER_ADDRESS=0x...
TG_STEALTH_REGISTRY_ADDRESS=0x...
TG_BATCH_VERIFIER_ADDRESS=0x...

# Security settings
TG_ZK_PROOF_MAX_AGE_SECONDS=300       # 5 minutes
TG_NULLIFIER_EXPIRY_DAYS=7
TG_MAX_ZK_VERIFICATIONS_PER_HOUR=10
```

---

## Security

### Replay Attack Prevention

**Problem:** Attacker intercepts a valid ZK proof and tries to reuse it.

**Solution:** Nullifiers

- Each proof contains a unique nullifier
- Nullifier is stored in database after verification
- Duplicate nullifiers are rejected
- Nullifiers expire after 7 days (configurable)

```typescript
// Check nullifier hasn't been used
const exists = await query(
  'SELECT 1 FROM zk_proof_nullifiers WHERE nullifier = $1',
  [proof.nullifier]
);

if (exists) {
  return { valid: false, reason: 'Nullifier already used (replay attack)' };
}

// Store nullifier after successful verification
await query(
  'INSERT INTO zk_proof_nullifiers (nullifier, ...) VALUES (...)'
);
```

### Timestamp Validation

**Problem:** Attacker saves a proof and uses it later when balance decreased.

**Solution:** Proof age limit

- Proofs must be generated within 5 minutes of verification
- Timestamp is part of the proof
- Old proofs are rejected

```typescript
const proofAge = Date.now() - proof.timestamp;
const MAX_AGE = 5 * 60 * 1000; // 5 minutes

if (proofAge > MAX_AGE) {
  return { valid: false, reason: 'Proof expired' };
}
```

### Signature Validation

**Problem:** Attacker creates fake proof without wallet access.

**Solution:** User signature over proof data

- User signs proof with their Starknet wallet
- Signature is verified using account abstraction
- Only wallet owner can create valid proofs

```typescript
const proofHash = computeHash(proof);
const signatureValid = await verifySignature(
  userAddress,
  proofHash,
  proof.signature
);
```

---

## Cryptographic Details

### ZK Proof Structure

```typescript
interface ZKBalanceProof {
  // ElGamal ciphertext of user's balance
  encrypted_balance: string;

  // Minimum balance requirement (public, not secret)
  threshold: string;

  // Unique proof ID (prevents replay attacks)
  nullifier: string;

  // Proof generation time (prevents old proofs)
  timestamp: number;

  // User's signature over proof data
  signature: string[];

  // Proves user knows decryption key
  schnorr_proof: {
    R: string;  // Random commitment
    s: string;  // Response
  };

  // Proves decrypted balance ≥ threshold
  range_proof: {
    A: string;           // Commitment to bits
    S: string;           // Blinding factors
    T1: string;          // Polynomial commitment
    T2: string;          // Polynomial commitment
    tau_x: string;       // Blinding
    mu: string;          // Blinding
    t_hat: string;       // Polynomial evaluation
    inner_product_proof: string;  // Inner product argument
  };

  // Pedersen commitment to balance
  commitment: string;

  // Optional fast verification hint
  ae_hint?: string;
}
```

### Schnorr Proof Protocol

Proves user knows secret key `x` without revealing it.

**Prover:**
1. Secret key: `x`
2. Public key: `P = x * G` (on STARK curve)
3. Generate random `r`
4. Compute `R = r * G`
5. Compute challenge: `e = H(R || P || message)`
6. Compute response: `s = r + e * x`
7. Send proof: `(R, s)`

**Verifier:**
1. Receive `(R, s)` and `P`
2. Compute challenge: `e = H(R || P || message)`
3. Verify: `s * G == R + e * P`
4. If true, prover knows `x` without revealing it

### Bulletproofs Range Proof

Proves committed value `v` is in range `[threshold, 2^64]` without revealing `v`.

**Key Properties:**
- **Logarithmic size**: O(log n) proof size for n-bit range
- **No trusted setup**: No need for CRS
- **Efficient verification**: ~2 seconds for 64-bit range

**Protocol (simplified):**
1. Commitment: `C = v * G + r * H` (Pedersen commitment)
2. Bit decomposition: `v = v₀ + v₁*2 + v₂*4 + ... + v₆₃*2^63`
3. Prove each bit: `vᵢ ∈ {0, 1}`
4. Prove sum: `v >= threshold`
5. Use inner product argument for efficiency

---

## Development Roadmap

### Phase 3A: Core Infrastructure (✅ COMPLETE)

- ✅ PrivacyService with ZK proof verification
- ✅ ZKProofVerifier with Schnorr & range proof validation
- ✅ RuleMatcher integration
- ✅ Database schema for nullifiers and stealth addresses
- ✅ Replay attack prevention
- ✅ Test suite

### Phase 3B: Client-Side (🚧 IN PROGRESS)

- 🚧 Client-side proof generation in web app
- 🚧 ZK proof submission API endpoint
- 🚧 Updated `/verify-wallet` command with privacy options
- 🚧 Educational content for users

### Phase 3C: Cryptography (⏳ TODO)

- ⏳ Full Schnorr signature verification (STARK curve)
- ⏳ Full Bulletproofs range proof verification
- ⏳ ElGamal encryption/decryption
- ⏳ Pedersen commitment operations
- ⏳ STARK curve elliptic curve ops

### Phase 3D: Integration (⏳ TODO)

- ⏳ Deploy Obelysk contracts to Starknet testnet
- ⏳ Test with real encrypted balances
- ⏳ End-to-end integration testing
- ⏳ Performance optimization (target <10s)

### Phase 3E: Production (⏳ TODO)

- ⏳ Security audit by third-party
- ⏳ Deploy to mainnet
- ⏳ User documentation
- ⏳ Launch announcement

---

## Troubleshooting

### Proof Verification Fails

**Error:** `Proof expired (timestamp too old)`

**Solution:** Proofs must be generated within 5 minutes. Regenerate proof.

---

**Error:** `Nullifier already used (replay attack prevented)`

**Solution:** This proof was already verified. Generate a new proof with fresh nullifier.

---

**Error:** `Encrypted balance does not match on-chain state`

**Solution:** User's encrypted balance changed since proof generation. Regenerate proof with current balance.

---

**Error:** `Invalid Schnorr proof`

**Solution:** Cryptographic verification failed. Ensure proof was generated correctly with valid secret key.

---

### Nullifier Not Stored

**Check:**
1. Database connection working?
2. `zk_proof_nullifiers` table exists?
3. Permissions correct?

**Debug:**
```sql
-- Check if table exists
SELECT * FROM information_schema.tables WHERE table_name = 'zk_proof_nullifiers';

-- Check recent nullifiers
SELECT * FROM zk_proof_nullifiers ORDER BY verified_at DESC LIMIT 10;
```

---

## References

### Papers & Standards

- [ERC-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [Bulletproofs: Short Proofs for Confidential Transactions](https://eprint.iacr.org/2017/1066.pdf)
- [Schnorr Signatures](https://en.wikipedia.org/wiki/Schnorr_signature)
- [ElGamal Encryption](https://en.wikipedia.org/wiki/ElGamal_encryption)

### Obelysk Documentation

- [Obelysk Privacy Layer](https://github.com/bitsage-network/obelysk)
- [PrivacyRouter Contract](../BitSage-Cairo-Smart-Contracts/src/obelysk/privacy_router.cairo)
- [StealthRegistry Contract](../BitSage-Cairo-Smart-Contracts/src/obelysk/stealth_registry.cairo)

### Starknet Resources

- [Starknet.js Documentation](https://www.starknetjs.com/)
- [Cairo Language](https://www.cairo-lang.org/)
- [STARK Curve](https://docs.starkware.co/starkex/crypto/stark-curve.html)

---

## Support

**Issues:** Report in GitHub issues
**Questions:** Ask in #dev-help Discord channel
**Documentation:** See `PHASE_3_SUMMARY.md`

---

**Last Updated:** 2026-01-02
**Phase:** 3 (Privacy Features - ZK Proofs)
**Status:** 60% Complete

---

🔐 **Privacy-preserving token-gating for the decentralized future!**
