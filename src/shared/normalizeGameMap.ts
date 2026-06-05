import { resolveAudioSettings } from "./AudioSettings";
import { resolveVisualSettings } from "./VisualSettings";
import type { GameMap } from "./types/MapSchema";
import type { MapObject, Vector3 } from "./types/ObjectSchema";

export function normalizeGameMap(map: GameMap): GameMap {
  const snapshot = structuredClone(map);

  return {
    ...snapshot,
    version: snapshot.version ?? 1,
    id: snapshot.id || createId("map"),
    name: snapshot.name?.trim() || "Mapa sem nome",
    authorId: snapshot.authorId || "local-builder",
    creatorName: snapshot.creatorName?.trim() || "Criador local",
    description: snapshot.description ?? "",
    spawnPoint: normalizeVector(snapshot.spawnPoint, { x: 0, y: 1, z: 0 }),
    objects: Array.isArray(snapshot.objects)
      ? snapshot.objects.map((object) => normalizeMapObjectDefaults(object))
      : [],
    objectives: Array.isArray(snapshot.objectives) ? snapshot.objectives : [],
    logic: Array.isArray(snapshot.logic) ? snapshot.logic : [],
    teams: Array.isArray(snapshot.teams) ? snapshot.teams : [],
    assets: Array.isArray(snapshot.assets) ? snapshot.assets : [],
    tags: Array.isArray(snapshot.tags)
      ? [...new Set(snapshot.tags.map((tag) => tag.trim()).filter(Boolean))]
      : [],
    visualSettings: resolveVisualSettings(snapshot.visualSettings),
    audioSettings: resolveAudioSettings(snapshot.audioSettings),
    gameplaySettings: {
      voidDeathEnabled: snapshot.gameplaySettings?.voidDeathEnabled ?? true,
      voidDeathY: snapshot.gameplaySettings?.voidDeathY,
      requireObjectivesToFinish: snapshot.gameplaySettings?.requireObjectivesToFinish ?? false,
    },
    multiplayerSettings: {
      pvpEnabled: snapshot.multiplayerSettings?.pvpEnabled ?? false,
      friendlyFire: snapshot.multiplayerSettings?.friendlyFire ?? false,
    },
    gameModeSettings: snapshot.gameModeSettings ?? { mode: "freeplay" },
    logicDebug: snapshot.logicDebug ?? false,
    isPublished: snapshot.isPublished ?? Boolean(snapshot.publishedAt),
  };
}

export function ensureMapDefaults(map: GameMap): GameMap {
  return normalizeGameMap(map);
}

export function normalizeMapObjectDefaults(object: MapObject): MapObject {
  return {
    ...object,
    position: normalizeVector(object.position, { x: 0, y: 0, z: 0 }),
    rotation: normalizeVector(object.rotation, { x: 0, y: 0, z: 0 }),
    scale: normalizeScale(object.scale),
    properties: object.properties ?? {},
  };
}

export function normalizeVector(value: unknown, fallback: Vector3): Vector3 {
  if (isFiniteVector(value)) {
    return { x: value.x, y: value.y, z: value.z };
  }

  return { ...fallback };
}

export function normalizeScale(value: unknown): Vector3 {
  if (isFiniteVector(value) && value.x > 0 && value.y > 0 && value.z > 0) {
    return { x: value.x, y: value.y, z: value.z };
  }

  return { x: 1, y: 1, z: 1 };
}

export function isFiniteVector(value: unknown): value is Vector3 {
  return (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    "z" in value &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.z === "number" &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
