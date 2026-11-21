import "dotenv/config";
import { runMigrations } from "../db/migrate-runner";
import { pool, scalar } from "../lib/db";

/**
 * Runs automatically before `next start` on hosted environments (see render.yaml).
 *
 * 1. Applies any pending SQL migrations (idempotent).
 * 2. Seeds the demo data the first time the database is empty (idempotent).
 *
 * This exists because free hosting tiers have no shell access, so the
 * database can't be prepared by hand after deployment.
 */
async function main() {
  console.log("[deploy-init] applying migrations…");
  await runMigrations();

  const hasUsers = await scalar<number>("SELECT count(*)::int FROM users");
  if (!hasUsers) {
    console.log("[deploy-init] database is empty — loading demo data…");
    const { seedDatabase, DEMO_CREDENTIALS } = await import("../db/seed-data");
    await seedDatabase();
    console.log("[deploy-init] demo sign-in details:");
    console.table(DEMO_CREDENTIALS);
  } else {
    console.log(`[deploy-init] database already contains ${hasUsers} user(s) — skipping seed`);
  }

  await pool.end();
  console.log("[deploy-init] ready");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[deploy-init] failed:", err);
    process.exit(1);
  });
