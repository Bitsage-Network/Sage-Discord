const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://bitsage:bitsage_dev_password@localhost:5432/bitsage'
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '006_add_reputation_worker_validator_systems.sql');
    console.log(`Reading migration file: ${migrationPath}`);

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('Migration file loaded, executing SQL...');

    // Execute migration
    await client.query(migrationSQL);
    console.log('✅ Migration 006 executed successfully!');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'user_reputation',
        'reputation_transactions',
        'reputation_rewards',
        'worker_profiles',
        'worker_jobs',
        'worker_skills',
        'validator_profiles',
        'validator_uptime',
        'validator_validations',
        'validator_slashes',
        'staking_contracts'
      )
      ORDER BY table_name
    `);

    console.log('\n📊 Created tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

runMigration()
  .then(() => {
    console.log('\n✨ All done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
