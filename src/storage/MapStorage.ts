import { assertGameMap, type GameMap } from "../shared/types/MapSchema";

const MAP_PREFIX = "mini-blox:maps:item:";
const MAP_INDEX_KEY = "mini-blox:maps:index";
const LAST_MAP_KEY = "mini-blox:maps:last";
const LEGACY_AUTOSAVE_KEY = "mini-blox:editor-map";
const LEGACY_PUBLISHED_PREFIX = "mini-blox:published:";

export const MapStorage = {
  saveMap(map: GameMap): void {
    assertGameMap(map);
    const existingMap = parseMap(localStorage.getItem(getMapKey(map.id)));
    const now = new Date().toISOString();
    const nextMap: GameMap = {
      ...map,
      version: map.version ?? 1,
      description: map.description ?? existingMap?.description ?? "",
      creatorName: map.creatorName ?? existingMap?.creatorName ?? "Criador local",
      tags: normalizeTags(map.tags),
      isPublished: map.isPublished ?? Boolean(map.publishedAt),
      createdAt: map.createdAt ?? existingMap?.createdAt ?? now,
      updatedAt: now
    };
    localStorage.setItem(getMapKey(nextMap.id), JSON.stringify(nextMap));
    writeIndex([nextMap.id, ...readIndex().filter((id) => id !== nextMap.id)]);
    this.setLastMap(nextMap.id);
  },

  getMap(id: string): GameMap | null {
    migrateLegacyMaps();
    const raw = localStorage.getItem(getMapKey(id));
    return parseMap(raw);
  },

  hasMap(id: string): boolean {
    migrateLegacyMaps();
    return Boolean(parseMap(localStorage.getItem(getMapKey(id))));
  },

  getAllMaps(): GameMap[] {
    migrateLegacyMaps();
    const maps = readIndex()
      .map((id) => parseMap(localStorage.getItem(getMapKey(id))))
      .filter((map): map is GameMap => Boolean(map));

    const validIds = maps.map((map) => map.id);
    writeIndex(validIds);
    return maps;
  },

  deleteMap(id: string): void {
    localStorage.removeItem(getMapKey(id));
    writeIndex(readIndex().filter((candidate) => candidate !== id));

    if (localStorage.getItem(LAST_MAP_KEY) === id) {
      localStorage.removeItem(LAST_MAP_KEY);
    }
  },

  getLastMap(): GameMap | null {
    migrateLegacyMaps();
    const lastId = localStorage.getItem(LAST_MAP_KEY);

    if (lastId) {
      const lastMap = this.getMap(lastId);

      if (lastMap) {
        return lastMap;
      }
    }

    return this.getAllMaps()[0] ?? null;
  },

  setLastMap(id: string): void {
    localStorage.setItem(LAST_MAP_KEY, id);
  }
};

function getMapKey(id: string): string {
  return `${MAP_PREFIX}${id}`;
}

function readIndex(): string[] {
  const raw = localStorage.getItem(MAP_INDEX_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  localStorage.setItem(MAP_INDEX_KEY, JSON.stringify([...new Set(ids)]));
}

function parseMap(raw: string | null): GameMap | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    assertGameMap(parsed);
    return parsed;
  } catch {
    return null;
  }
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
}

function migrateLegacyMaps(): void {
  const migratedIds = new Set(readIndex());
  const legacyAutosave = parseMap(localStorage.getItem(LEGACY_AUTOSAVE_KEY));

  if (legacyAutosave && !migratedIds.has(legacyAutosave.id)) {
    localStorage.setItem(getMapKey(legacyAutosave.id), JSON.stringify(legacyAutosave));
    migratedIds.add(legacyAutosave.id);
    localStorage.setItem(LAST_MAP_KEY, legacyAutosave.id);
  }

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);

    if (!key?.startsWith(LEGACY_PUBLISHED_PREFIX)) {
      continue;
    }

    const map = parseMap(localStorage.getItem(key));

    if (map && !migratedIds.has(map.id)) {
      localStorage.setItem(getMapKey(map.id), JSON.stringify(map));
      migratedIds.add(map.id);
    }
  }

  writeIndex([...migratedIds]);
}
