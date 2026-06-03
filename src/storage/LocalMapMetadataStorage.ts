export type LocalMapStats = {
  playCount: number;
  completedCount: number;
  bestCoinsCollected: number;
  lastPlayedAt?: string;
};

const FAVORITES_KEY = "mini-blox-favorites";
const LIKES_KEY = "mini-blox-likes";
const MAP_STATS_KEY = "mini-blox-map-stats";

export const LocalMapMetadataStorage = {
  getFavoriteIds(): Set<string> {
    return new Set(readStringArray(FAVORITES_KEY));
  },

  isFavorite(mapId: string): boolean {
    return this.getFavoriteIds().has(mapId);
  },

  toggleFavorite(mapId: string): boolean {
    const favorites = this.getFavoriteIds();

    if (favorites.has(mapId)) {
      favorites.delete(mapId);
      writeStringArray(FAVORITES_KEY, [...favorites]);
      return false;
    }

    favorites.add(mapId);
    writeStringArray(FAVORITES_KEY, [...favorites]);
    return true;
  },

  deleteFavorite(mapId: string): void {
    const favorites = this.getFavoriteIds();
    favorites.delete(mapId);
    writeStringArray(FAVORITES_KEY, [...favorites]);
  },

  getLikeIds(): Set<string> {
    return new Set(readStringArray(LIKES_KEY));
  },

  isLiked(mapId: string): boolean {
    return this.getLikeIds().has(mapId);
  },

  toggleLike(mapId: string): boolean {
    const likes = this.getLikeIds();

    if (likes.has(mapId)) {
      likes.delete(mapId);
      writeStringArray(LIKES_KEY, [...likes]);
      return false;
    }

    likes.add(mapId);
    writeStringArray(LIKES_KEY, [...likes]);
    return true;
  },

  getLikeCount(mapId: string): number {
    return this.isLiked(mapId) ? 1 : 0;
  },

  deleteLike(mapId: string): void {
    const likes = this.getLikeIds();
    likes.delete(mapId);
    writeStringArray(LIKES_KEY, [...likes]);
  },

  getAllStats(): Record<string, LocalMapStats> {
    const parsed = readRecord(MAP_STATS_KEY);
    const result: Record<string, LocalMapStats> = {};

    for (const [mapId, value] of Object.entries(parsed)) {
      if (typeof value !== "object" || value === null) {
        continue;
      }

      const record = value as Record<string, unknown>;
      result[mapId] = {
        playCount: getNumber(record.playCount, 0),
        completedCount: getNumber(record.completedCount, 0),
        bestCoinsCollected: getNumber(record.bestCoinsCollected, 0),
        lastPlayedAt: typeof record.lastPlayedAt === "string" ? record.lastPlayedAt : undefined
      };
    }

    return result;
  },

  getStats(mapId: string): LocalMapStats {
    return this.getAllStats()[mapId] ?? {
      playCount: 0,
      completedCount: 0,
      bestCoinsCollected: 0
    };
  },

  recordPlay(mapId: string): LocalMapStats {
    const allStats = this.getAllStats();
    const current = allStats[mapId] ?? {
      playCount: 0,
      completedCount: 0,
      bestCoinsCollected: 0
    };
    const next: LocalMapStats = {
      ...current,
      playCount: current.playCount + 1,
      lastPlayedAt: new Date().toISOString()
    };
    allStats[mapId] = next;
    writeRecord(MAP_STATS_KEY, allStats);
    return next;
  },

  recordCompletion(mapId: string, coinsCollected: number): LocalMapStats {
    const allStats = this.getAllStats();
    const current = allStats[mapId] ?? {
      playCount: 0,
      completedCount: 0,
      bestCoinsCollected: 0
    };
    const next: LocalMapStats = {
      ...current,
      completedCount: current.completedCount + 1,
      bestCoinsCollected: Math.max(current.bestCoinsCollected, Math.max(0, Math.floor(coinsCollected)))
    };
    allStats[mapId] = next;
    writeRecord(MAP_STATS_KEY, allStats);
    return next;
  },

  deleteStats(mapId: string): void {
    const allStats = this.getAllStats();
    delete allStats[mapId];
    writeRecord(MAP_STATS_KEY, allStats);
  },

  deleteMapMetadata(mapId: string): void {
    this.deleteFavorite(mapId);
    this.deleteLike(mapId);
    this.deleteStats(mapId);
  },

  getLastPlayedMapId(): string | null {
    const allStats = this.getAllStats();
    let result: { mapId: string; lastPlayedAt: string } | null = null;

    for (const [mapId, stats] of Object.entries(allStats)) {
      if (!stats.lastPlayedAt) {
        continue;
      }

      if (!result || stats.lastPlayedAt > result.lastPlayedAt) {
        result = { mapId, lastPlayedAt: stats.lastPlayedAt };
      }
    }

    return result?.mapId ?? null;
  }
};

function readStringArray(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function writeStringArray(key: string, value: string[]): void {
  localStorage.setItem(key, JSON.stringify([...new Set(value)]));
}

function readRecord(key: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    return typeof parsed === "object" && parsed !== null
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function writeRecord(key: string, value: Record<string, unknown>): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
