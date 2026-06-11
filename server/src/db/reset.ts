import { existsSync, rmSync } from "node:fs";
import { closeDatabase, resolveSqliteFilename } from "./connection.js";
import { migrateDatabase } from "./migrate.js";
import { logger } from "../logger.js";

const databaseUrl = process.env.DATABASE_URL || "file:./data/miniblox.sqlite";

if (process.env.NODE_ENV === "production") {
  throw new Error("db:reset is disabled in production.");
}

closeDatabase();

const filename = resolveSqliteFilename(databaseUrl);
if (filename !== ":memory:" && existsSync(filename)) {
  rmSync(filename, { force: true });
  for (const suffix of ["-wal", "-shm"]) {
    const extraFile = `${filename}${suffix}`;
    if (existsSync(extraFile)) {
      rmSync(extraFile, { force: true });
    }
  }
  logger.warn("sqlite database reset", { filename });
}

migrateDatabase();
closeDatabase();
