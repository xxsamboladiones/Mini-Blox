import type { DatabaseSync } from "node:sqlite";
import { getDatabase } from "../db/connection.js";
import type { AuthSessionRecord, UserRecord } from "./interfaces.js";

type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
};

export class UserRepository {
  constructor(private readonly database: DatabaseSync = getDatabase()) {}

  createUser(input: {
    id: string;
    username: string;
    passwordHash: string;
    displayName: string;
    now: string;
  }): UserRecord {
    this.database
      .prepare(
        `
          INSERT INTO users (id, username, password_hash, display_name, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `
      )
      .run(input.id, input.username, input.passwordHash, input.displayName, input.now, input.now);

    const user = this.findById(input.id);
    if (!user) {
      throw new Error("Failed to create user");
    }
    return user;
  }

  findByUsername(username: string): UserRecord | null {
    const row = this.database.prepare("SELECT * FROM users WHERE username = ?").get(username) as
      | UserRow
      | undefined;
    return row ? toUserRecord(row) : null;
  }

  findById(id: string): UserRecord | null {
    const row = this.database.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | UserRow
      | undefined;
    return row ? toUserRecord(row) : null;
  }

  createSession(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: string;
    now: string;
  }): AuthSessionRecord {
    this.database
      .prepare(
        `
          INSERT INTO auth_tokens (id, user_id, token_hash, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?)
        `
      )
      .run(input.id, input.userId, input.tokenHash, input.expiresAt, input.now);

    const session = this.findSessionByTokenHash(input.tokenHash);
    if (!session) {
      throw new Error("Failed to create auth session");
    }
    return session;
  }

  findSessionByTokenHash(tokenHash: string): AuthSessionRecord | null {
    const row = this.database
      .prepare("SELECT * FROM auth_tokens WHERE token_hash = ?")
      .get(tokenHash) as SessionRow | undefined;
    return row ? toSessionRecord(row) : null;
  }

  deleteSessionByTokenHash(tokenHash: string): boolean {
    const result = this.database
      .prepare("DELETE FROM auth_tokens WHERE token_hash = ?")
      .run(tokenHash);
    return result.changes > 0;
  }

  deleteExpiredSessions(now: string): number {
    const result = this.database.prepare("DELETE FROM auth_tokens WHERE expires_at <= ?").run(now);
    return Number(result.changes);
  }
}

export const userRepository = new UserRepository();

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSessionRecord(row: SessionRow): AuthSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}
