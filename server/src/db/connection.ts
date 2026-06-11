import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { logger } from "../logger.js";

const DEFAULT_DATABASE_URL = "file:./data/miniblox.sqlite";

let database: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  const filename = resolveSqliteFilename(databaseUrl);
  database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");
  logger.info("sqlite connected", { databaseUrl: maskDatabaseUrl(databaseUrl), filename });
  return database;
}

export function closeDatabase(): void {
  if (!database) {
    return;
  }

  database.close();
  database = null;
}

export function getDefaultDatabaseUrl(): string {
  return DEFAULT_DATABASE_URL;
}

export function resolveSqliteFilename(databaseUrl: string): string {
  if (databaseUrl === ":memory:" || databaseUrl === "file::memory:") {
    return ":memory:";
  }

  if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
    throw new Error("Postgres DATABASE_URL is reserved for a future adapter; SQLite is active now.");
  }

  if (!databaseUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL must use file: for the SQLite adapter.");
  }

  const rawPath = databaseUrl.slice("file:".length);
  const filename = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
  mkdirSync(path.dirname(filename), { recursive: true });
  return filename;
}

function maskDatabaseUrl(databaseUrl: string): string {
  if (databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  return "[redacted]";
}
