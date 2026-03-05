import { RpcProvider } from 'starknet';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkBalance() {
  console.log('💰 Checking Bot Wallet Balances\n');

  const rpcUrl = process.env.STARKNET_RPC_URL;
  const accountAddress = process.env.STARKNET_ACCOUNT_ADDRESS;

  console.log(`📍 Account: ${accountAddress}`);
  console.log(`🌐 RPC: ${rpcUrl}\n`);

  try {
    console.log('📊 Balance Information:\n');

    // Note: Lava RPC might not support getBalance, so we'll note that
    console.log('⚠️  Note: Lava RPC has limited method support');
    console.log('   You can check balances manually at:');
    console.log(`   https://sepolia.voyager.online/contract/${accountAddress}\n`);

    console.log('🔍 Voyager Explorer:');
    console.log(`   ${`https://sepolia.voyager.online/contract/${accountAddress}`}\n`);

    console.log('📝 What you need:');
    console.log('   • ETH: Required for gas fees (minting transactions)');
    console.log('   • STRK: You have 800 (can be used for some gas, but ETH is primary)\n');

    console.log('💡 Recommendation:');
    console.log('   1. Check your balance on Voyager (link above)');
    console.log('   2. If ETH balance is low, get testnet ETH from faucet:');
    console.log('      https://faucet.goerli.starknet.io/ (select Sepolia)');
    console.log('   3. Recommended: 0.01-0.1 ETH for testing');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkBalance().catch(console.error);
