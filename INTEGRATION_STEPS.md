# Token-Gating Integration Steps

Quick guide to integrate the token-gating module into the main Discord bot.

---

## Prerequisites

✅ All completed:
- Phase 1 foundation implemented
- Phase 2 Discord commands implemented
- Database migration ready
- Dependencies installed

---

## Step 1: Run Database Migration

```bash
cd /Users/vaamx/bitsage-network/Sage-Discord

# Connect to PostgreSQL
psql $DATABASE_URL

# Run migration
\i migrations/001_token_gating_schema.sql

# Verify tables created
\dt

# Expected output should include:
# - wallet_verifications
# - token_gating_rules
# - role_mappings
# - verification_sessions
# - zk_proof_nullifiers
# - stealth_addresses
# - auditor_permissions
# - auditor_decrypt_log
# - user_rule_cache
# - balance_cache
```

---

## Step 2: Update Bot Startup Code

Edit `src/index.ts`:

```typescript
// Add imports at the top
import { initializeTokenGating, initializeRoleSyncHandler } from './token-gating';

// In the client.once('ready') handler:
client.once('ready', async () => {
  logger.info(`Logged in as ${client.user?.tag}`);

  // Existing ready logic...

  // Initialize token-gating module
  try {
    logger.info('Initializing token-gating module...');
    const tokenGating = initializeTokenGating();

    // Health check
    const health = await tokenGating.healthCheck();
    if (health.overall) {
      logger.info('Token-gating module initialized and healthy');
    } else {
      logger.warn('Token-gating module initialized but health check failed');
    }

    // Initialize role sync handler
    const roleSyncHandler = initializeRoleSyncHandler(client);
    logger.info('Role sync handler initialized');
  } catch (error: any) {
    logger.error('Failed to initialize token-gating', {
      error: error.message,
    });
  }

  // Rest of ready logic...
});
```

---

## Step 3: Deploy Commands

```bash
# Deploy new slash commands
npm run deploy-commands

# Expected output:
# - Loaded command: verify-wallet
# - Loaded command: wallet-status
# - Loaded command: disconnect-wallet
# - Loaded command: token-gate
# - Successfully deployed X commands
```

---

## Step 4: Configure Environment

Ensure `.env` has all required variables:

```bash
# Check required variables
grep -E "TG_|STARKNET_|DATABASE_" .env

# Required (minimum):
# DATABASE_URL=postgresql://user:password@localhost:5432/sage_discord
# STARKNET_RPC_URL=https://rpc.starknet-testnet.lava.build
# TG_SAGE_TOKEN_ADDRESS=0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7
```

---

## Step 5: Test the Integration

### 5.1 Start the Bot

```bash
npm run dev

# Expected logs:
# - Token-gating configuration loaded
# - Token-gating module initialized successfully
# - Starknet RPC: Healthy
# - Role sync handler initialized
# - Role sync scheduler started (interval: 3600s)
```

### 5.2 Test Admin Commands

In Discord (as admin):

```
/token-gate create role:@SAGE Holder type:token_balance min_balance:1000 priority:10
```

Expected: ✅ Rule created successfully

```
/token-gate list
```

Expected: Shows the rule you just created

### 5.3 Test User Commands

```
/verify-wallet method:signature
```

Expected:
- ✅ Ephemeral message sent
- ✅ Contains "Verify Wallet" button
- ✅ Button has URL to verify.bitsage.network
- ⚠️ Clicking button goes to non-existent web page (expected - Phase 2B pending)

```
/wallet-status
```

Expected: "⚠️ Wallet Not Verified" (since web app doesn't exist yet)

---

## Step 6: Manual Verification Test (Optional)

To test role sync without the web app, manually insert a verification:

```sql
-- Replace with your actual values
INSERT INTO wallet_verifications (user_id, wallet_address, verification_method, verified, verified_at)
VALUES ('YOUR_DISCORD_USER_ID', '0xYOUR_STARKNET_ADDRESS', 'signature', TRUE, NOW());

-- Check it was created
SELECT * FROM wallet_verifications;
```

Then restart the bot or wait for the hourly role sync. Check if you received the role!

---

## Step 7: Monitor Logs

Watch for these log messages:

**Successful startup:**
```
[info] Token-gating configuration loaded
[info] Token-gating module initialized successfully
[info] Role sync handler initialized
[info] Role sync scheduler started
```

**During role sync:**
```
[info] Starting role sync for all guilds
[info] Guild role sync completed (users_synced: X)
[info] Token-gated role assigned (user, role)
```

**On command usage:**
```
[info] Verification session created for user
[info] Wallet status checked
[info] Token-gating rule created
```

---

## Troubleshooting

### Issue: Commands not showing

**Solution:**
```bash
# Re-deploy commands
npm run deploy-commands

# Check GUILD_ID is set (for instant guild commands)
echo $GUILD_ID

# If empty, set it in .env:
GUILD_ID=your-server-id
```

### Issue: Module initialization failed

**Solution:**
```bash
# Run test script
npm run test-token-gating

# Check for errors, fix configuration
# Common issues:
# - DATABASE_URL not set
# - TG_SAGE_TOKEN_ADDRESS not set
# - STARKNET_RPC_URL unreachable
```

### Issue: Role sync not running

**Solution:**
```bash
# Check configuration
grep TG_ENABLE_AUTO_ROLE_SYNC .env

# Should be:
TG_ENABLE_AUTO_ROLE_SYNC=true

# If false, change to true and restart bot
```

### Issue: Database migration failed

**Solution:**
```bash
# Check if tables already exist
psql $DATABASE_URL -c "\dt"

# If token_gating tables exist, migration already ran

# If migration failed halfway:
# 1. Check error message
# 2. Manually fix the issue
# 3. Re-run migration (it's idempotent with IF NOT EXISTS)
```

---

## Verification Checklist

After integration, verify:

- [ ] Bot starts without errors
- [ ] Token-gating module initialized
- [ ] Role sync handler started
- [ ] `/verify-wallet` command appears in Discord
- [ ] `/wallet-status` command appears
- [ ] `/disconnect-wallet` command appears
- [ ] `/token-gate` command appears (admin only)
- [ ] Can create token-gating rules
- [ ] Can list token-gating rules
- [ ] Database tables exist
- [ ] Logs show role sync running every hour

---

## Next Steps

After successful integration:

1. **Create token-gating rules** for your community:
   ```
   /token-gate create role:@SAGE Holder type:token_balance min_balance:1000
   /token-gate create role:@SAGE Whale type:token_balance min_balance:10000
   ```

2. **Build the web app** (Phase 2B) to enable actual wallet verification

3. **Test end-to-end flow** once web app is deployed

4. **Monitor and optimize** based on usage patterns

---

## Support

**Issues:** Check logs in `logs/` directory
**Questions:** Review PHASE_2_SUMMARY.md
**Testing:** Use `npm run test-token-gating`

---

**Integration Time:** ~15 minutes
**Testing Time:** ~10 minutes
**Total Time:** ~25 minutes

✅ **You're ready to use token-gating!** (Pending web app for full verification flow)
