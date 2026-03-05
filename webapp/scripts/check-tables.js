const { Pool } = require("pg");

async function checkTables() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://bitsage:bitsage_dev_password@localhost:5432/bitsage",
  });

  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log("📊 Database Tables:");
    console.log("=" .repeat(50));
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });
    console.log("=" .repeat(50));
    console.log(`Total: ${result.rows.length} tables\n`);

    // Check specifically for webapp tables
    const webappTables = [
      "guilds",
      "guild_pages",
      "guild_members",
      "subscriptions",
      "analytics_events",
      "reward_campaigns",
      "reward_claims",
    ];

    console.log("✅ Webapp Tables:");
    for (const table of webappTables) {
      const exists = result.rows.some((row) => row.table_name === table);
      console.log(`   ${exists ? "✓" : "✗"} ${table}`);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
