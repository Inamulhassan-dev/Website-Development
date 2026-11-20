import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export async function runMigrations(verbose = true) {
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/postgres";
  const needsSsl =
    !/127\.0\.0\.1:5433|localhost:5433/.test(connectionString) &&
    (/sslmode=require/.test(connectionString) || /neon\.tech|render\.com|railway|supabase/.test(connectionString));
  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
  try {
    const dir = path.join(process.cwd(), "db", "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const applied = new Set((await pool.query("SELECT id FROM schema_migrations")).rows.map((r) => r.id));
    for (const file of files) {
      if (applied.has(file)) {
        if (verbose) console.log(`[migrate] skip ${file}`);
        continue;
      }
      const sql = await readFile(path.join(dir, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
        await client.query("COMMIT");
        if (verbose) console.log(`[migrate] applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
    if (verbose) console.log("[migrate] database is up to date");
  } finally {
    await pool.end();
  }
}

export async function dropSchema() {
  const connectionString =
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/postgres";
  const needsSsl =
    !/127\.0\.0\.1:5433|localhost:5433/.test(connectionString) &&
    (/sslmode=require/.test(connectionString) || /neon\.tech|render\.com|railway|supabase/.test(connectionString));
  const pool = new Pool({ connectionString, max: 1, ssl: needsSsl ? { rejectUnauthorized: false } : undefined });
  try {
    await pool.query("DROP SCHEMA public CASCADE");
    await pool.query("CREATE SCHEMA public");
  } finally {
    await pool.end();
  }
}
