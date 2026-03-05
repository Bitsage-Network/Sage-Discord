import { RpcProvider, Contract, cairo } from 'starknet';
import * as dotenv from 'dotenv';

dotenv.config();

async function testSTRKBalance() {
  console.log('💰 Checking STRK Balance for Gas Fees\n');

  const rpcUrl = process.env.STARKNET_RPC_URL;
  const accountAddress = process.env.STARKNET_ACCOUNT_ADDRESS;

  console.log(`📍 Account: ${accountAddress}`);
  console.log(`🌐 RPC: ${rpcUrl}\n`);

  try {
    const provider = new RpcProvider({ nodeUrl: rpcUrl });

    // STRK token contract address on Sepolia
    const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';

    // Minimal ERC20 ABI for balanceOf
    const erc20Abi = [
      {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
        outputs: [{ type: 'core::integer::u256' }],
        state_mutability: 'view'
      },
      {
        name: 'decimals',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'core::integer::u8' }],
        state_mutability: 'view'
      }
    ];

    console.log('📊 Querying STRK balance...\n');

    const strkContract = new Contract(erc20Abi, STRK_ADDRESS, provider);

    try {
      const balance = await strkContract.balanceOf(accountAddress!);
      const decimals = await strkContract.decimals();

      // Convert balance to human-readable format
      const balanceBN = cairo.uint256(balance);
      const balanceNum = Number(balanceBN) / Math.pow(10, Number(decimals));

      console.log(`✅ STRK Balance: ${balanceNum.toFixed(4)} STRK\n`);

      if (balanceNum >= 1) {
        console.log('🎉 Excellent! You have enough STRK for gas fees!');
        console.log(`   ${balanceNum.toFixed(2)} STRK ≈ ${Math.floor(balanceNum * 10000)} POAP mints (conservative)\n`);
      } else if (balanceNum > 0) {
        console.log('⚠️  Low STRK balance. You can mint some POAPs, but may need more.');
        console.log(`   ${balanceNum.toFixed(4)} STRK ≈ ${Math.floor(balanceNum * 10000)} POAP mints\n`);
      } else {
        console.log('❌ No STRK balance detected!');
        console.log('   Please deposit STRK tokens or get testnet ETH instead.\n');
      }

      console.log('💡 Gas Fee Info:');
      console.log('   • STRK can be used for gas fees on Starknet (v0.13.0+)');
      console.log('   • Our bot automatically detects and uses STRK if available');
      console.log('   • Estimated gas: ~0.0001-0.001 STRK per POAP mint');
      console.log('   • You can also use ETH for gas (optional)\n');

    } catch (error) {
      console.log('⚠️  Could not query balance via RPC (Lava has limited methods)\n');
      console.log('📍 Check your balance manually:');
      console.log(`   https://sepolia.voyager.online/contract/${accountAddress}\n`);
      console.log('   Look for STRK token balance in the "Tokens" tab.');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testSTRKBalance().catch(console.error);
