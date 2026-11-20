import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { randomBytes } from "node:crypto";

/**
 * Single database access point. Works with any PostgreSQL 14+ instance
 * (Neon, Render Postgres, Railway, RDS) as well as the embedded PGlite
 * server used for local development.
 */
const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5433/postgres";

const isEmbedded = /127\.0\.0\.1:5433|localhost:5433/.test(connectionString);
const needsSsl =
  !isEmbedded &&
  (process.env.PGSSLMODE === "require" ||
    /sslmode=require/.test(connectionString) ||
    /neon\.tech|render\.com|railway|supabase/.test(connectionString));

declare global {
  // eslint-disable-next-line no-var
  var __ubPool: Pool | undefined;
}

function createPool() {
  return new Pool({
    connectionString,
    max: isEmbedded ? 1 : Number(process.env.PGPOOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export const pool = global.__ubPool ?? createPool();
if (process.env.NODE_ENV !== "production") global.__ubPool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function one<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function scalar<T = unknown>(text: string, params: unknown[] = []): Promise<T | null> {
  const row = await one<Record<string, unknown>>(text, params);
  if (!row) return null;
  return (Object.values(row)[0] as T) ?? null;
}

/** Run a function inside a real database transaction. Rolls back on any error. */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection already broken */
    }
    throw err;
  } finally {
    client.release();
  }
}

export function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export async function nextSequence(name: "member_id_seq" | "referral_code_seq" | "invoice_seq") {
  const value = await scalar<string>(`SELECT nextval('${name}')::int AS value`);
  return Number(value);
}

/** Format integer minor units for display, e.g. 4950 -> "$49.50". */
export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
