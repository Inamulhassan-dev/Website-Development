import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import path from "node:path";

/**
 * Local development database: PostgreSQL 17 compiled to WASM (PGlite), exposed
 * over the real PostgreSQL wire protocol so the app can use the exact same `pg`
 * driver and SQL as production Neon Postgres.
 *
 * PGlite supports one connection at a time; lib/db.ts uses a pool of 1 locally.
 */
const dataDir = process.env.PGDATA_DIR ?? path.join(process.cwd(), ".pgdata");
const port = Number(process.env.PGLITE_PORT ?? 5433);

// A client disconnecting mid-query must not take down the local database.
process.on("uncaughtException", (err: NodeJS.ErrnoException) => {
  if (["ECONNRESET", "EPIPE", "ECONNREFUSED"].includes(err?.code ?? "")) {
    console.warn(`[pglite] ignored client socket error: ${err.code}`);
    return;
  }
  console.error("[pglite] uncaught exception", err);
});
process.on("unhandledRejection", (reason) => {
  console.warn("[pglite] ignored rejection:", reason);
});

async function main() {
  const db = await PGlite.create({ dataDir });
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
  await server.start();
  console.log(`[pglite] PostgreSQL wire server listening on 127.0.0.1:${port}`);
  console.log(`[pglite] data directory: ${dataDir}`);
  const shutdown = async () => {
    try {
      await server.stop();
      await db.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[pglite] failed to start", err);
  process.exit(1);
});
