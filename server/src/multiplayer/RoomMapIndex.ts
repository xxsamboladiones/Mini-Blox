import type {
  GameMap,
  GameModeSettings,
  MapObject,
  MultiplayerSettings,
  TeamDefinition,
  Vector3,
} from "../types/OnlineMapSchema.js";
import type { EnemyNetState } from "./types.js";

export type RoomMapIndex = {
  mapId: string;
  mapName: string;
  objectIds: Set<string>;
  doorIds: Set<string>;
  buttonObjectIds: Set<string>;
  coinObjectIds: Set<string>;
  itemObjectIds: Set<string>;
  enemyObjectIds: Set<string>;
  teamIds: Set<string>;
  spawnPoint: Vector3;
  teamSpawns: Map<string, Vector3>;
  teams: TeamDefinition[];
  gameModeSettings?: GameModeSettings;
  multiplayerSettings: Required<MultiplayerSettings>;
  enemyInitialStates: Record<string, EnemyNetState>;
};

const DEFAULT_MULTIPLAYER_SETTINGS: Required<MultiplayerSettings> = {
  pvpEnabled: false,
  friendlyFire: false,
};

export function createRoomMapIndex(map: GameMap): RoomMapIndex {
  const objectIds = new Set<string>();
  const doorIds = new Set<string>();
  const buttonObjectIds = new Set<string>();
  const coinObjectIds = new Set<string>();
  const itemObjectIds = new Set<string>();
  const enemyObjectIds = new Set<string>();
  const teamIds = new Set<string>();
  const teamSpawns = new Map<string, Vector3>();
  const enemyInitialStates: Record<string, EnemyNetState> = {};
  const teams = Array.isArray(map.teams) ? map.teams : [];

  for (const team of teams) {
    teamIds.add(team.id);

    if (isVector3(team.spawnPoint)) {
      teamSpawns.set(team.id, cloneVector(team.spawnPoint));
    }
  }

  for (const mapObject of map.objects) {
    objectIds.add(mapObject.id);

    if (mapObject.type === "door") {
      doorIds.add(mapObject.id);
      doorIds.add(getString(mapObject.properties?.doorId, mapObject.id));
    } else if (mapObject.type === "button") {
      buttonObjectIds.add(mapObject.id);
    } else if (mapObject.type === "coin") {
      coinObjectIds.add(mapObject.id);
    } else if (mapObject.type === "itemPickup") {
      itemObjectIds.add(mapObject.id);
    } else if (mapObject.type === "itemSpawner") {
      itemObjectIds.add(mapObject.id);
      for (let index = 0; index < getMaxSpawnedItems(mapObject); index += 1) {
        itemObjectIds.add(`itemPickup-${mapObject.id}-${index}`);
      }
    } else if (mapObject.type === "enemy") {
      enemyObjectIds.add(mapObject.id);
      enemyInitialStates[mapObject.id] = createEnemyInitialState(mapObject);
    } else if (mapObject.type === "teamSpawn") {
      const teamId = getString(mapObject.properties?.teamId, "");
      if (teamId) {
        teamSpawns.set(teamId, cloneVector(mapObject.position));
      }
    }
  }

  return {
    mapId: map.id,
    mapName: map.name,
    objectIds,
    doorIds,
    buttonObjectIds,
    coinObjectIds,
    itemObjectIds,
    enemyObjectIds,
    teamIds,
    spawnPoint: cloneVector(map.spawnPoint),
    teamSpawns,
    teams,
    gameModeSettings: map.gameModeSettings,
    multiplayerSettings: {
      pvpEnabled: map.multiplayerSettings?.pvpEnabled ?? DEFAULT_MULTIPLAYER_SETTINGS.pvpEnabled,
      friendlyFire:
        map.multiplayerSettings?.friendlyFire ?? DEFAULT_MULTIPLAYER_SETTINGS.friendlyFire,
    },
    enemyInitialStates,
  };
}

export function createEmptyRoomMapIndex(onlineMapId: string): RoomMapIndex {
  return {
    mapId: onlineMapId,
    mapName: onlineMapId,
    objectIds: new Set(),
    doorIds: new Set(),
    buttonObjectIds: new Set(),
    coinObjectIds: new Set(),
    itemObjectIds: new Set(),
    enemyObjectIds: new Set(),
    teamIds: new Set(),
    spawnPoint: { x: 0, y: 1, z: 0 },
    teamSpawns: new Map(),
    teams: [],
    multiplayerSettings: { ...DEFAULT_MULTIPLAYER_SETTINGS },
    enemyInitialStates: {},
  };
}

function createEnemyInitialState(mapObject: MapObject): EnemyNetState {
  const maxHealth = Math.max(1, getNumber(mapObject.properties?.health, 50));
  const behavior = getEnemyBehavior(mapObject);
  const now = Date.now();

  return {
    objectId: mapObject.id,
    enemyGroupId: getOptionalString(mapObject.properties?.enemyGroupId),
    isBoss: mapObject.properties?.isBoss === true,
    position: cloneVector(mapObject.position),
    rotationY: getNumber(mapObject.rotation?.y, 0),
    health: maxHealth,
    maxHealth,
    alive: true,
    state: behavior,
    updatedAt: now,
  };
}

function getEnemyBehavior(mapObject: MapObject): EnemyNetState["state"] {
  const behavior = mapObject.properties?.behavior;

  if (behavior === "idle" || behavior === "patrol" || behavior === "chase") {
    return behavior;
  }

  return "chase";
}

function getMaxSpawnedItems(mapObject: MapObject): number {
  return Math.max(1, Math.floor(getNumber(mapObject.properties?.maxSpawnedItems, 1)));
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isVector3(value: unknown): value is Vector3 {
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

function cloneVector(vector: Vector3): Vector3 {
  return { x: vector.x, y: vector.y, z: vector.z };
}
