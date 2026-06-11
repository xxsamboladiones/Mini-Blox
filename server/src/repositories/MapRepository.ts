import type { DatabaseSync } from "node:sqlite";
import { getDatabase } from "../db/connection.js";
import type { GameMap } from "../types/OnlineMapSchema.js";
import type {
  CreateMapInput,
  LegacyMapImportInput,
  OnlineMapRecord,
  OnlineMapSummaryWithOwnership,
} from "./interfaces.js";

type MapRow = {
  id: string;
  owner_user_id: string | null;
  legacy_owner_client_id: string | null;
  name: string;
  description: string;
  creator_name: string;
  thumbnail: string | null;
  tags_json: string;
  theme: string;
  object_count: number;
  mode: string;
  map_json: string;
  play_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  published_at: string;
};

export class MapRepository {
  constructor(private readonly database: DatabaseSync = getDatabase()) {}

  createMap(input: CreateMapInput): OnlineMapRecord {
    const metadata = getMapMetadata(input.map, input.creatorName);
    this.database
      .prepare(
        `
          INSERT INTO maps (
            id, owner_user_id, legacy_owner_client_id, name, description, creator_name,
            thumbnail, tags_json, theme, object_count, mode, map_json, play_count, like_count,
            created_at, updated_at, published_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
        `
      )
      .run(
        input.id,
        input.ownerUserId,
        input.legacyOwnerClientId ?? null,
        metadata.name,
        metadata.description,
        metadata.creatorName,
        metadata.thumbnail,
        JSON.stringify(metadata.tags),
        metadata.theme,
        metadata.objectCount,
        metadata.mode,
        JSON.stringify(input.map),
        input.now,
        input.now,
        input.now
      );

    const record = this.getMap(input.id);
    if (!record) {
      throw new Error("Failed to create map");
    }
    return record;
  }

  listMapSummaries(currentUserId?: string | null): OnlineMapSummaryWithOwnership[] {
    const rows = this.database
      .prepare("SELECT * FROM maps ORDER BY published_at DESC, updated_at DESC")
      .all() as MapRow[];
    return rows.map((row) => this.toSummary(row, currentUserId));
  }

  getMap(id: string): OnlineMapRecord | null {
    const row = this.database.prepare("SELECT * FROM maps WHERE id = ?").get(id) as
      | MapRow
      | undefined;
    return row ? toRecord(row) : null;
  }

  getMapSummary(id: string, currentUserId?: string | null): OnlineMapSummaryWithOwnership | null {
    const row = this.database.prepare("SELECT * FROM maps WHERE id = ?").get(id) as
      | MapRow
      | undefined;
    return row ? this.toSummary(row, currentUserId) : null;
  }

  updateMap(id: string, map: GameMap, creatorName: string): OnlineMapRecord | null {
    const existing = this.getMap(id);
    if (!existing) {
      return null;
    }

    const metadata = getMapMetadata(map, creatorName);
    const now = new Date().toISOString();
    this.database
      .prepare(
        `
          UPDATE maps
          SET name = ?, description = ?, creator_name = ?, thumbnail = ?, tags_json = ?,
              theme = ?, object_count = ?, mode = ?, map_json = ?, updated_at = ?
          WHERE id = ?
        `
      )
      .run(
        metadata.name,
        metadata.description,
        metadata.creatorName,
        metadata.thumbnail,
        JSON.stringify(metadata.tags),
        metadata.theme,
        metadata.objectCount,
        metadata.mode,
        JSON.stringify(map),
        now,
        id
      );

    return this.getMap(id);
  }

  claimLegacyMap(id: string, userId: string): boolean {
    const result = this.database
      .prepare(
        "UPDATE maps SET owner_user_id = ?, updated_at = ? WHERE id = ? AND owner_user_id IS NULL"
      )
      .run(userId, new Date().toISOString(), id);
    return result.changes > 0;
  }

  deleteMap(id: string): boolean {
    const result = this.database.prepare("DELETE FROM maps WHERE id = ?").run(id);
    return result.changes > 0;
  }

  incrementPlayCount(id: string): boolean {
    const result = this.database
      .prepare("UPDATE maps SET play_count = play_count + 1 WHERE id = ?")
      .run(id);
    return result.changes > 0;
  }

  toggleLike(id: string, userId: string): { liked: boolean; likeCount: number } {
    const existing = this.getMap(id);
    if (!existing) {
      throw new Error("Map not found");
    }

    const liked = this.isLikedByUser(id, userId);
    if (liked) {
      this.database
        .prepare("DELETE FROM map_likes WHERE map_id = ? AND user_id = ?")
        .run(id, userId);
    } else {
      this.database
        .prepare("INSERT INTO map_likes (map_id, user_id, created_at) VALUES (?, ?, ?)")
        .run(id, userId, new Date().toISOString());
    }

    const likeCount = this.getLikeCount(id);
    this.database.prepare("UPDATE maps SET like_count = ? WHERE id = ?").run(likeCount, id);
    return { liked: !liked, likeCount };
  }

  importLegacyMaps(entries: LegacyMapImportInput[]): number {
    let imported = 0;

    for (const entry of entries) {
      if (this.getMap(entry.id)) {
        continue;
      }

      const metadata = getMapMetadata(entry.map, entry.map.creatorName ?? "Criador");
      this.database
        .prepare(
          `
            INSERT INTO maps (
              id, owner_user_id, legacy_owner_client_id, name, description, creator_name,
              thumbnail, tags_json, theme, object_count, mode, map_json, play_count, like_count,
              created_at, updated_at, published_at
            )
            VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          entry.id,
          entry.ownerClientId,
          metadata.name,
          metadata.description,
          metadata.creatorName,
          metadata.thumbnail,
          JSON.stringify(metadata.tags),
          metadata.theme,
          metadata.objectCount,
          metadata.mode,
          JSON.stringify(entry.map),
          entry.playCount,
          entry.likeCount,
          entry.createdAt,
          entry.updatedAt,
          entry.publishedAt
        );
      imported += 1;
    }

    return imported;
  }

  private isLikedByUser(id: string, userId: string): boolean {
    const row = this.database
      .prepare("SELECT 1 AS liked FROM map_likes WHERE map_id = ? AND user_id = ?")
      .get(id, userId) as { liked: number } | undefined;
    return Boolean(row);
  }

  private getLikeCount(id: string): number {
    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM map_likes WHERE map_id = ?")
      .get(id) as { count: number | bigint } | undefined;
    return Number(row?.count ?? 0);
  }

  private toSummary(row: MapRow, currentUserId?: string | null): OnlineMapSummaryWithOwnership {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      creatorName: row.creator_name,
      thumbnail: row.thumbnail,
      tags: parseTags(row.tags_json),
      theme: row.theme,
      objectCount: row.object_count,
      mode: row.mode,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      playCount: row.play_count,
      likeCount: row.like_count,
      ownerUserId: row.owner_user_id,
      isOwner: currentUserId ? row.owner_user_id === currentUserId : false,
      likedByCurrentUser: currentUserId ? this.isLikedByUser(row.id, currentUserId) : false,
    };
  }
}

export const mapRepository = new MapRepository();

function toRecord(row: MapRow): OnlineMapRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    legacyOwnerClientId: row.legacy_owner_client_id,
    map: JSON.parse(row.map_json) as GameMap,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    playCount: row.play_count,
    likeCount: row.like_count,
  };
}

function getMapMetadata(map: GameMap, creatorName: string) {
  return {
    name: map.name,
    description: map.description ?? "",
    creatorName: map.creatorName ?? creatorName,
    thumbnail: map.thumbnail ?? null,
    tags: map.tags ?? [],
    theme: map.visualSettings?.theme ?? "classic",
    objectCount: map.objects.length,
    mode: map.gameModeSettings?.mode ?? "freeplay",
  };
}

function parseTags(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
