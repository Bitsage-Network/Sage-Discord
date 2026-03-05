const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

async function runAllMigrations() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://bitsage:bitsage_dev_password@localhost:5432/bitsage",
  });

  try {
    // Create schema_migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        description TEXT,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log("✅ Schema migrations table ready\n");

    const migrationsDir = path.join(__dirname, "../../migrations");
    const migrationFiles = [
      "001_token_gating_schema.sql",
      "004_bot_protection.sql",
      "005_prune_warning.sql",
      "006_token_gating_schema.sql",
      "007_webapp_guilds.sql",
    ];

    for (const file of migrationFiles) {
      const migrationPath = path.join(migrationsDir, file);

      if (!fs.existsSync(migrationPath)) {
        console.log(`⏭️  Skipping ${file} (not found)`);
        continue;
      }

      const sql = fs.readFileSync(migrationPath, "utf8");

      console.log(`Running migration ${file}...`);

      try {
        await pool.query(sql);
        console.log(`✅ ${file} completed`);
      } catch (error) {
        // If table already exists, that's OK
        if (error.code === "42P07") {
          console.log(`⏭️  ${file} already applied (table exists)`);
        } else if (error.message.includes("already exists")) {
          console.log(`⏭️  ${file} already applied`);
        } else {
          throw error;
        }
      }
    }

    console.log("\n✅ All migrations completed successfully!");
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    console.error("Error code:", error.code);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runAllMigrations();
