#!/usr/bin/env ts-node
/**
 * 🚀 Sage Achievements Contract Deployment Script
 *
 * Deploys the custom BitSage Discord Rewards NFT contract to Starknet Sepolia.
 * This contract is:
 * - Fully owned by BitSage Network
 * - Independent of external systems
 * - STRK-native (pays gas in STRK, not ETH)
 * - Soulbound (achievements cannot be transferred)
 */

import { Account, RpcProvider, json, CallData } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

interface DeploymentResult {
  contractAddress: string;
  classHash: string;
  transactionHash: string;
  deployedAt: string;
}

async function deploySageAchievements() {
  console.log('🚀 Deploying Sage Achievements Contract\n');
  console.log('═'.repeat(60));
  console.log('');

  // ============================================
  // Step 1: Setup Provider & Account
  // ============================================

  console.log('📡 Step 1: Connecting to Starknet...\n');

  const rpcUrl = process.env.STARKNET_RPC_URL || 'https://rpc.starknet-testnet.lava.build';
  const provider = new RpcProvider({ nodeUrl: rpcUrl });

  // Use deployer account (contract owner)
  const deployerAddress = '0x0759a4374389b0e3cfcc59d49310b6bc75bb12bbf8ce550eb5c2f026918bb344';
  const deployerPrivateKey = '0x0154de503c7553e078b28044f15b60323899d9437bd44e99d9ab629acbada47a';

  const deployerAccount = new Account(provider, deployerAddress, deployerPrivateKey);

  console.log(`✓ RPC URL: ${rpcUrl}`);
  console.log(`✓ Deployer: ${deployerAddress}`);
  console.log(`✓ Network: Starknet Sepolia\n`);

  // ============================================
  // Step 2: Compile Contract (Manual step reminder)
  // ============================================

  console.log('📦 Step 2: Contract Compilation\n');

  const targetDir = path.join(__dirname, 'contracts', 'target', 'dev');
  const sierraPath = path.join(targetDir, 'sage_achievements_SageAchievements.contract_class.json');
  const casmPath = path.join(targetDir, 'sage_achievements_SageAchievements.compiled_contract_class.json');

  // Check if compiled files exist
  if (!fs.existsSync(sierraPath)) {
    console.log('❌ Contract not compiled yet!\n');
    console.log('Please run:');
    console.log('  scarb build\n');
    console.log('Then run this script again.');
    process.exit(1);
  }

  console.log(`✓ Sierra file: ${path.basename(sierraPath)}`);
  console.log(`✓ CASM file: ${path.basename(casmPath)}\n`);

  // ============================================
  // Step 3: Declare Contract Class
  // ============================================

  console.log('📝 Step 3: Declaring contract class...\n');

  const sierraCode = json.parse(fs.readFileSync(sierraPath).toString('utf-8'));
  const casmCode = json.parse(fs.readFileSync(casmPath).toString('utf-8'));

  try {
    const declareResponse = await deployerAccount.declareIfNot({
      contract: sierraCode,
      casm: casmCode
    });

    const classHash = declareResponse.class_hash;
    console.log(`✓ Class Hash: ${classHash}`);

    if (declareResponse.transaction_hash) {
      console.log(`✓ Declare TX: ${declareResponse.transaction_hash}`);
      console.log('⏳ Waiting for declaration confirmation...\n');
      await provider.waitForTransaction(declareResponse.transaction_hash);
    } else {
      console.log('✓ Class already declared (skipped)\n');
    }

    // ============================================
    // Step 4: Deploy Contract Instance
    // ============================================

    console.log('🏗️  Step 4: Deploying contract instance...\n');

    // Constructor parameters
    const botAddress = process.env.STARKNET_ACCOUNT_ADDRESS!;
    const constructorCalldata = CallData.compile({
      owner: deployerAddress,           // Owner (can change minter, pause, etc.)
      minter: botAddress,                // Minter (Discord bot - can mint achievements)
      name: 'Sage Achievements',         // NFT collection name
      symbol: 'SAGE',                    // NFT symbol
      base_uri: 'https://achievements.bitsage.network/metadata/' // Base metadata URI
    });

    console.log('Constructor parameters:');
    console.log(`  Owner: ${deployerAddress}`);
    console.log(`  Minter (Bot): ${botAddress}`);
    console.log(`  Name: Sage Achievements`);
    console.log(`  Symbol: SAGE`);
    console.log('  Base URI: https://achievements.bitsage.network/metadata/\n');

    const deployResponse = await deployerAccount.deployContract({
      classHash,
      constructorCalldata
    });

    console.log(`✓ Contract Address: ${deployResponse.contract_address}`);
    console.log(`✓ Deploy TX: ${deployResponse.transaction_hash}\n`);

    console.log('⏳ Waiting for deployment confirmation...');
    await provider.waitForTransaction(deployResponse.transaction_hash);

    console.log('✅ Contract deployed successfully!\n');

    // ============================================
    // Step 5: Save Deployment Info
    // ============================================

    console.log('💾 Step 5: Saving deployment info...\n');

    const deployment: DeploymentResult = {
      contractAddress: deployResponse.contract_address,
      classHash,
      transactionHash: deployResponse.transaction_hash,
      deployedAt: new Date().toISOString()
    };

    const deploymentsPath = path.join(__dirname, 'sage-achievements-deployment.json');
    fs.writeFileSync(deploymentsPath, JSON.stringify(deployment, null, 2));

    console.log(`✓ Saved to: ${deploymentsPath}\n`);

    // ============================================
    // Step 6: Update .env
    // ============================================

    console.log('⚙️  Step 6: Updating .env configuration...\n');

    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');

    // Add or update SAGE_ACHIEVEMENTS_ADDRESS
    const envKey = 'SAGE_ACHIEVEMENTS_ADDRESS';
    const envValue = deployResponse.contract_address;

    if (envContent.includes(envKey)) {
      // Update existing
      envContent = envContent.replace(
        new RegExp(`${envKey}=.*`, 'g'),
        `${envKey}=${envValue}`
      );
    } else {
      // Add new
      envContent += `\n# Sage Achievements Contract (Discord Rewards NFT)\n`;
      envContent += `${envKey}=${envValue}\n`;
    }

    fs.writeFileSync(envPath, envContent);

    console.log(`✓ Updated .env with SAGE_ACHIEVEMENTS_ADDRESS\n`);

    // ============================================
    // Summary
    // ============================================

    console.log('═'.repeat(60));
    console.log('');
    console.log('🎉 Deployment Complete!\n');
    console.log('Contract Details:');
    console.log(`  📍 Address: ${deployment.contractAddress}`);
    console.log(`  📝 Class Hash: ${deployment.classHash}`);
    console.log(`  🔗 TX Hash: ${deployment.transactionHash}`);
    console.log(`  🌐 Explorer: https://sepolia.voyager.online/contract/${deployment.contractAddress}`);
    console.log('');
    console.log('Access Control:');
    console.log(`  👑 Owner: ${deployerAddress} (you)`);
    console.log(`  🤖 Minter: ${botAddress} (Discord bot)`);
    console.log('');
    console.log('Gas Payment: ✅ STRK (Starknet-native)');
    console.log('Transfers: ❌ Disabled (soulbound)');
    console.log('External Dependencies: ❌ None (100% yours!)');
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Verify bot has minting permission (already set!)');
    console.log('  2. Restart Discord bot to load new contract');
    console.log('  3. Create achievement campaign in dashboard');
    console.log('  4. Test minting with /reward claim');
    console.log('');
    console.log('═'.repeat(60));

  } catch (error: any) {
    console.error('\n❌ Deployment failed:', error.message);
    if (error.message.includes('StarknetErrorCode')) {
      console.error('\n💡 Tip: Make sure you have STRK tokens for gas fees');
      console.error(`   Check balance: https://sepolia.voyager.online/contract/${deployerAddress}`);
    }
    process.exit(1);
  }
}

// Run deployment
deploySageAchievements().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
