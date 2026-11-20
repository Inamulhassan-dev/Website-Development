import "dotenv/config";
import { seedDatabase, DEMO_CREDENTIALS } from "../db/seed-data";
import { pool } from "../lib/db";

seedDatabase()
  .then(async () => {
    console.log("[seed] demo sign-in details:");
    console.table(DEMO_CREDENTIALS);
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[seed] failed:", err);
    await pool.end();
    process.exit(1);
  });
