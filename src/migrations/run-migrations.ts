/* eslint-disable no-console */
/**
 * Database Migration Runner
 *
 * Executes SQL migrations from the migrations/postgres directory.
 *
 * Usage:
 *   NODE_OPTIONS='--loader ts-node/esm' pnpm exec ts-node migrations/run-migrations.ts
 *
 * Environment Variables:
 *   PG_USER, PG_PASSWORD, PG_DATABASE, PG_HOST, PG_PORT
 *
 * Prerequisites:
 *   - PostgreSQL running (docker-compose up -d postgres)
 *   - Environment variables configured
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { config } from "../config.js";

const { Client } = pg;

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration from centralized config
const dbConfig = {
  user: config.DATABASE.PG.user,
  password: config.DATABASE.PG.password,
  database: config.DATABASE.PG.database,
  host: config.DATABASE.PG.host,
  port: config.DATABASE.PG.port,
  ssl: config.DATABASE.PG.ssl ? { rejectUnauthorized: false } : false,
};

async function runMigrations() {
  const client = new Client(dbConfig);

  try {
    console.log("🔌 Connecting to PostgreSQL...");
    console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   Database: ${dbConfig.database}`);
    console.log(`   User: ${dbConfig.user}`);

    await client.connect();
    console.log("✅ Connected to PostgreSQL");

    // Get migration files directory
    // In production (Docker): __dirname = /app/dist/migrations
    // In development: __dirname = /path/to/project/dist/src/migrations
    // SQL files are always in postgres/ subdirectory relative to this file
    const migrationsDir = path.join(__dirname, "postgres");

    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found: ${migrationsDir}`);
    }
    // Get all SQL migration files (only numbered ones)
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith(".sql") && file.match(/^\d+/)) // Only numbered migration files
      .sort(); // Execute in alphabetical order

    if (migrationFiles.length === 0) {
      console.log("⚠️  No migration files found");
      return;
    }

    console.log(`📁 Found ${migrationFiles.length} migration file(s):`);
    migrationFiles.forEach(file => console.log(`   - ${file}`));
    console.log("");

    // Execute each migration file
    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf8");

      console.log(`🔄 Executing migration: ${file}`);

      try {
        await client.query(sql);
        console.log(`✅ Migration completed: ${file}`);
      } catch (error) {
        console.error(`❌ Migration failed: ${file}`);
        console.error(
          `   Error: ${error instanceof Error ? error.message : String(error)}`
        );
        throw error;
      }
    }

    console.log("");
    console.log("🎉 All migrations completed successfully!");
  } catch (error) {
    console.error("💥 Migration failed:");
    console.error(
      `   ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  } finally {
    await client.end();
    console.log("🔌 Database connection closed");
  }
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
