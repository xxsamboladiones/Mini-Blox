import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, getDatabase } from "./connection.js";
import { runMigrations } from "./schema.js";
import { logger } from "../logger.js";

export function migrateDatabase(): void {
  runMigrations(getDatabase());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    migrateDatabase();
    logger.info("database migrations complete");
  } finally {
    closeDatabase();
  }
}
