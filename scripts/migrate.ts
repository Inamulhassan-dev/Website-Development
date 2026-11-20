import "dotenv/config";
import { runMigrations } from "../db/migrate-runner";

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[migrate] failed:", err.message);
    process.exit(1);
  });
