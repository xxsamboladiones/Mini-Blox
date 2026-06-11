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
  objectPositions: Map<string, Vector3>;
  objectTypes: Map<string, string>;
  doorIds: Set<string>;
  doorObjectIdsByDoorId: Map<string, string>;
  buttonObjectIds: Set<string>;
  buttonTargetDoorIds: Map<string, string>;
  coinObjectIds: Set<string>;
  itemObjectIds: Set<string>;
  itemHealAmounts: Map<string, number>;
  tycoonPurchaseIds: Set<string>;
  tycoonUpgradeIds: Set<string>;
  enemyObjectIds: Set<string>;
  enemySpeeds: Map<string, number>;
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
  const objectPositions = new Map<string, Vector3>();
  const objectTypes = new Map<string, string>();
  const doorIds = new Set<string>();
  const doorObjectIdsByDoorId = new Map<string, string>();
  const buttonObjectIds = new Set<string>();
  const buttonTargetDoorIds = new Map<string, string>();
  const coinObjectIds = new Set<string>();
  const itemObjectIds = new Set<string>();
  const itemHealAmounts = new Map<string, number>();
  const tycoonPurchaseIds = new Set<string>();
  const tycoonUpgradeIds = new Set<string>();
  const enemyObjectIds = new Set<string>();
  const enemySpeeds = new Map<string, number>();
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
    objectPositions.set(mapObject.id, cloneVector(mapObject.position));
    objectTypes.set(mapObject.id, mapObject.type);

    if (mapObject.type === "door") {
      const doorId = getString(mapObject.properties?.doorId, mapObject.id);
      doorIds.add(mapObject.id);
      doorIds.add(doorId);
      doorObjectIdsByDoorId.set(mapObject.id, mapObject.id);
      doorObjectIdsByDoorId.set(doorId, mapObject.id);
    } else if (mapObject.type === "button") {
      buttonObjectIds.add(mapObject.id);
      const targetDoorId =
        getOptionalString(mapObject.properties?.targetDoorId) ??
        getOptionalString(mapObject.properties?.buttonTargetId);
      if (targetDoorId) {
        buttonTargetDoorIds.set(mapObject.id, targetDoorId);
      }
    } else if (mapObject.type === "coin") {
      coinObjectIds.add(mapObject.id);
    } else if (mapObject.type === "itemPickup") {
      itemObjectIds.add(mapObject.id);
      const healAmount = getHealthAmountForItem(mapObject);
      if (healAmount > 0) {
        itemHealAmounts.set(mapObject.id, healAmount);
      }
    } else if (mapObject.type === "itemSpawner") {
      itemObjectIds.add(mapObject.id);
      const healAmount = getHealthAmountForItem(mapObject);
      if (healAmount > 0) {
        itemHealAmounts.set(mapObject.id, healAmount);
      }

      for (let index = 0; index < getMaxSpawnedItems(mapObject); index += 1) {
        const pickupId = `itemPickup-${mapObject.id}-${index}`;
        itemObjectIds.add(pickupId);
        objectPositions.set(pickupId, getPickupPosition(mapObject, index));
        objectTypes.set(pickupId, "itemPickup");

        if (healAmount > 0) {
          itemHealAmounts.set(pickupId, healAmount);
        }
      }
    } else if (mapObject.type === "enemy") {
      enemyObjectIds.add(mapObject.id);
      enemySpeeds.set(mapObject.id, Math.max(0.1, getNumber(mapObject.properties?.speed, 1)));
      enemyInitialStates[mapObject.id] = createEnemyInitialState(mapObject);
    } else if (mapObject.type === "tycoonBuyButton" || mapObject.type === "tycoonBarrier") {
      const purchaseId = getString(mapObject.properties?.purchaseId, mapObject.id);
      tycoonPurchaseIds.add(purchaseId);
    } else if (mapObject.type === "tycoonUpgrade") {
      const upgradeId = getString(mapObject.properties?.upgradeId, mapObject.id);
      tycoonPurchaseIds.add(upgradeId);
      tycoonUpgradeIds.add(upgradeId);
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
    objectPositions,
    objectTypes,
    doorIds,
    doorObjectIdsByDoorId,
    buttonObjectIds,
    buttonTargetDoorIds,
    coinObjectIds,
    itemObjectIds,
    itemHealAmounts,
    tycoonPurchaseIds,
    tycoonUpgradeIds,
    enemyObjectIds,
    enemySpeeds,
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
    objectPositions: new Map(),
    objectTypes: new Map(),
    doorIds: new Set(),
    doorObjectIdsByDoorId: new Map(),
    buttonObjectIds: new Set(),
    buttonTargetDoorIds: new Map(),
    coinObjectIds: new Set(),
    itemObjectIds: new Set(),
    itemHealAmounts: new Map(),
    tycoonPurchaseIds: new Set(),
    tycoonUpgradeIds: new Set(),
    enemyObjectIds: new Set(),
    enemySpeeds: new Map(),
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

function getPickupPosition(mapObject: MapObject, index: number): Vector3 {
  const spacing = Math.max(0.4, getNumber(mapObject.properties?.spawnRadius, 1.2));
  const angle = index * 2.399963229728653;

  return {
    x: mapObject.position.x + Math.cos(angle) * spacing,
    y: mapObject.position.y,
    z: mapObject.position.z + Math.sin(angle) * spacing,
  };
}

function getHealthAmountForItem(mapObject: MapObject): number {
  const itemId = getString(mapObject.properties?.itemId, "");
  const spawnItemType = getString(mapObject.properties?.spawnItemType, "");
  const itemPool = getStringArray(mapObject.properties?.itemPool);
  const hasHealthItem =
    isHealthItemId(itemId) ||
    isHealthItemId(spawnItemType) ||
    itemPool.some((poolItemId) => isHealthItemId(poolItemId));

  if (!hasHealthItem) {
    return 0;
  }

  return Math.max(1, getNumber(mapObject.properties?.amount, 25));
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim());
}

function isHealthItemId(value: string): boolean {
  const id = value.trim().toLowerCase();
  return id === "health" || id === "health_pack" || id === "potion" || id.includes("heal");
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
