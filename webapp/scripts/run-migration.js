const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

async function runMigration() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://bitsage:bitsage_dev_password@localhost:5432/bitsage",
  });

  try {
    const migrationPath = path.join(
      __dirname,
      "../../migrations/007_webapp_guilds.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    console.log("Running migration 007_webapp_guilds.sql...");
    await pool.query(sql);
    console.log("✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
