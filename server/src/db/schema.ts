import type { DatabaseSync } from "node:sqlite";
import { migration001Initial } from "./migrations/001_initial.js";
import { logger } from "../logger.js";

type Migration = {
  id: string;
  up: (database: DatabaseSync) => void;
};

const MIGRATIONS: Migration[] = [migration001Initial];

export function runMigrations(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    database
      .prepare("SELECT id FROM schema_migrations")
      .all()
      .map((row) => String((row as { id: unknown }).id))
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) {
      continue;
    }

    database.exec("BEGIN");
    try {
      migration.up(database);
      database
        .prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)")
        .run(migration.id, new Date().toISOString());
      database.exec("COMMIT");
      logger.info("migration applied", { migrationId: migration.id });
    } catch (error) {
      database.exec("ROLLBACK");
      logger.error("migration failed", { migrationId: migration.id, error });
      throw error;
    }
  }
}
