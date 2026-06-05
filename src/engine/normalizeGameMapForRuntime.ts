import { resolveAudioSettings } from "../shared/AudioSettings";
import { resolveVisualSettings } from "../shared/VisualSettings";
import type { GameMap } from "../shared/types/MapSchema";
import type { MapObject, Vector3 } from "../shared/types/ObjectSchema";

export function normalizeGameMapForRuntime(map: GameMap): GameMap {
  const snapshot = structuredClone(map);

  return {
    ...snapshot,
    version: snapshot.version ?? 1,
    authorId: snapshot.authorId || "local-builder",
    creatorName: snapshot.creatorName ?? "Criador local",
    description: snapshot.description ?? "",
    spawnPoint: normalizeVector(snapshot.spawnPoint, { x: 0, y: 1, z: 0 }),
    objects: Array.isArray(snapshot.objects)
      ? snapshot.objects.map((object) => normalizeObjectDefaults(object))
      : [],
    objectives: Array.isArray(snapshot.objectives) ? snapshot.objectives : [],
    logic: Array.isArray(snapshot.logic) ? snapshot.logic : [],
    teams: Array.isArray(snapshot.teams) ? snapshot.teams : [],
    assets: Array.isArray(snapshot.assets) ? snapshot.assets : [],
    tags: Array.isArray(snapshot.tags) ? snapshot.tags : [],
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
  };
}

export function ensureMapDefaults(map: GameMap): GameMap {
  return normalizeGameMapForRuntime(map);
}

export function normalizeObjectDefaults(object: MapObject): MapObject {
  return {
    ...object,
    position: normalizeVector(object.position, { x: 0, y: 0, z: 0 }),
    rotation: normalizeVector(object.rotation, { x: 0, y: 0, z: 0 }),
    scale: normalizeVector(object.scale, { x: 1, y: 1, z: 1 }),
    properties: object.properties ?? {},
  };
}

function normalizeVector(value: unknown, fallback: Vector3): Vector3 {
  if (
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
  ) {
    return { x: value.x, y: value.y, z: value.z };
  }

  return { ...fallback };
}
