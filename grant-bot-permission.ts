import { Account, RpcProvider } from 'starknet';

async function grantPermission() {
  console.log('🔐 Granting Bot Minting Permission...\n');

  // Setup provider - trying Lava Network public RPC
  const provider = new RpcProvider({
    nodeUrl: 'https://rpc.starknet-testnet.lava.build'
  });

  // Deployer account (contract owner)
  const deployerAccount = new Account(
    provider,
    '0x0759a4374389b0e3cfcc59d49310b6bc75bb12bbf8ce550eb5c2f026918bb344',
    '0x0154de503c7553e078b28044f15b60323899d9437bd44e99d9ab629acbada47a'
  );

  console.log('✓ Deployer Account:', deployerAccount.address);

  // Contract addresses
  const gamificationAddress = '0x3beb685db6a20804ee0939948cee05c42de655b6b78a93e1e773447ce981cde';
  const botAddress = '0x01f9ebd4b60101259df3ac877a27a1a017e7961995fa913be1a6f189af664660';

  console.log('✓ Gamification Contract:', gamificationAddress);
  console.log('✓ Bot Address (to grant):', botAddress);
  console.log('');

  try {
    // Call set_job_manager
    console.log('📝 Calling set_job_manager...');
    const call = {
      contractAddress: gamificationAddress,
      entrypoint: 'set_job_manager',
      calldata: [botAddress]
    };

    const tx = await deployerAccount.execute(call);
    console.log('✓ Transaction submitted:', tx.transaction_hash);
    console.log('');

    console.log('⏳ Waiting for transaction confirmation...');
    await provider.waitForTransaction(tx.transaction_hash);

    console.log('');
    console.log('✅ SUCCESS! Bot granted job_manager role!');
    console.log('');
    console.log('Transaction:', tx.transaction_hash);
    console.log('Explorer:', `https://sepolia.voyager.online/tx/${tx.transaction_hash}`);
    console.log('');
    console.log('🎉 Bot can now mint POAPs!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Not owner')) {
      console.error('');
      console.error('⚠️  The deployer account is not the owner of the Gamification contract.');
      console.error('    Check who the actual owner is and use that account instead.');
    }
    process.exit(1);
  }
}

grantPermission().catch(console.error);
