import "dotenv/config";
import { dropSchema, runMigrations } from "../db/migrate-runner";
import { seedDatabase } from "../db/seed-data";
import { pool } from "../lib/db";

/**
 * DESTRUCTIVE: removes every table in the public schema, recreates the schema,
 * applies migrations and reseeds demo data. Intended for local/demo databases only.
 */
async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DB_RESET !== "true") {
    throw new Error("Refusing to reset a production database. Set ALLOW_DB_RESET=true to override.");
  }
  console.log(`[reset] target: ${url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@")}`);
  await dropSchema();
  await runMigrations(false);
  await seedDatabase();
  await pool.end();
  console.log("[reset] database recreated with demo data");
}

main().catch(async (err) => {
  console.error("[reset] failed:", err);
  process.exit(1);
});
