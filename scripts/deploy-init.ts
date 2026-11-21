import "dotenv/config";
import { runMigrations } from "../db/migrate-runner";
import { pool, query, scalar } from "../lib/db";

/**
 * Demo-data freshness.
 *
 * The overview chart shows the last 7 days of activity. A database seeded weeks
 * ago would therefore look empty, so if the demo member has no demo reward in the
 * last 7 days we move their two most recent sample rewards to "2 days ago" and
 * "1 day ago". Timestamps only — no amount, balance or ledger value is touched.
 */
async function keepDemoActivityRecent() {
  const demoUser = "usr_seed_m01";
  const recent = await scalar<number>(
    `SELECT count(*)::int FROM wallet_transactions
      WHERE user_id = $1 AND type = 'AD_REWARD' AND created_at > now() - interval '7 days'`,
    [demoUser],
  );
  if (recent && recent > 0) return;

  const rows = await query<{ id: string; related_id: string }>(
    `SELECT id, related_id FROM wallet_transactions
      WHERE user_id = $1 AND type = 'AD_REWARD'
      ORDER BY created_at DESC LIMIT 2`,
    [demoUser],
  );
  if (rows.length < 2) return;

  const offsets = [2, 1];
  for (const [index, row] of rows.entries()) {
    await query(`UPDATE wallet_transactions SET created_at = now() - ($2 || ' days')::interval WHERE id = $1`, [
      row.id,
      offsets[index],
    ]);
    await query(
      `UPDATE ad_sessions SET started_at = now() - ($2 || ' days')::interval,
              last_activity_at = now() - ($2 || ' days')::interval,
              completed_at = now() - ($2 || ' days')::interval,
              expires_at = now() - ($2 || ' days')::interval + interval '1 hour'
        WHERE id = $1`,
      [row.related_id, offsets[index]],
    );
  }
  console.log("[deploy-init] refreshed demo activity dates for the overview chart");
}

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
    await keepDemoActivityRecent();
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
