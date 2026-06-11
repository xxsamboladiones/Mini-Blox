import type { DatabaseSync } from "node:sqlite";

export const migration001Initial = {
  id: "001_initial",
  up(database: DatabaseSync): void {
    database.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id);

      CREATE TABLE IF NOT EXISTS maps (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT,
        legacy_owner_client_id TEXT,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        creator_name TEXT NOT NULL,
        thumbnail TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        theme TEXT NOT NULL DEFAULT 'classic',
        object_count INTEGER NOT NULL DEFAULT 0,
        mode TEXT NOT NULL DEFAULT 'freeplay',
        map_json TEXT NOT NULL,
        play_count INTEGER NOT NULL DEFAULT 0,
        like_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT NOT NULL,
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_maps_owner_user_id ON maps(owner_user_id);
      CREATE INDEX IF NOT EXISTS idx_maps_updated_at ON maps(updated_at);
      CREATE INDEX IF NOT EXISTS idx_maps_published_at ON maps(published_at);

      CREATE TABLE IF NOT EXISTS map_likes (
        map_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (map_id, user_id),
        FOREIGN KEY (map_id) REFERENCES maps(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_map_likes_user_id ON map_likes(user_id);
    `);
  },
};
