import { resolveAudioSettings } from "./AudioSettings";
import { resolveVisualSettings } from "./VisualSettings";
import type { GameMap, GameModeSettings } from "./types/MapSchema";
import type { MapObject, MapObjectProperties, Vector3 } from "./types/ObjectSchema";

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
    gameModeSettings: normalizeGameModeSettings(snapshot.gameModeSettings),
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
    properties: normalizeObjectProperties(object),
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

function normalizeGameModeSettings(settings?: GameModeSettings): GameModeSettings {
  const mode = settings?.mode ?? "freeplay";
  const defaultWinCondition =
    mode === "tycoon"
      ? { type: "completeTycoon" as const, requireAll: true }
      : { type: "none" as const };

  return {
    mode,
    roundEnabled: settings?.roundEnabled ?? false,
    roundTimeLimit: settings?.roundTimeLimit ?? 180,
    respawnDelay: settings?.respawnDelay ?? 1,
    teamsEnabled: settings?.teamsEnabled ?? false,
    requireObjectivesToFinish: settings?.requireObjectivesToFinish ?? false,
    winCondition: {
      ...defaultWinCondition,
      ...(settings?.winCondition ?? {}),
    },
    scoring: {
      coinScore: 10,
      enemyDefeatScore: 100,
      objectiveScore: 250,
      deathPenalty: 25,
      ...(settings?.scoring ?? {}),
    },
    tycoonSettings: {
      startingCash: 0,
      sharedCash: false,
      requireAllPurchasesToWin: true,
      allowStealing: false,
      autoClaimInSolo: true,
      generatorTickRateScale: 1,
      ...(settings?.tycoonSettings ?? {}),
      winPurchaseIds: Array.isArray(settings?.tycoonSettings?.winPurchaseIds)
        ? settings.tycoonSettings.winPurchaseIds.filter(isNonEmptyString)
        : [],
    },
  };
}

function normalizeObjectProperties(object: MapObject): MapObjectProperties {
  const properties: MapObjectProperties = { ...(object.properties ?? {}) };

  if (!String(object.type).startsWith("tycoon")) {
    return properties;
  }

  properties.tycoonId = getString(properties.tycoonId, "tycoon_1");

  if (object.type === "tycoonOwnerClaim") {
    properties.claimLabel = getString(properties.claimLabel, "Minha Fabrica");
    properties.autoClaimInSolo = getBoolean(properties.autoClaimInSolo, true);
    properties.collision = false;
  } else if (object.type === "tycoonGenerator") {
    properties.generatorId = getString(properties.generatorId, object.id);
    properties.incomePerTick = getClampedNumber(properties.incomePerTick, 5, 0, 1_000_000);
    properties.tickInterval = getClampedNumber(properties.tickInterval, 2, 0.1, 3600);
    properties.targetCollectorId = getString(properties.targetCollectorId, "");
    properties.requiresPurchase = getBoolean(properties.requiresPurchase, false);
    properties.purchaseId = getString(properties.purchaseId, "");
    properties.startsEnabled = getBoolean(properties.startsEnabled, true);
    properties.maxStoredAmount = getClampedNumber(properties.maxStoredAmount, 500, 0, 1_000_000_000);
    properties.upgradeGroupId = getString(properties.upgradeGroupId, "");
  } else if (object.type === "tycoonCollector") {
    properties.collectorId = getString(properties.collectorId, object.id);
    properties.collectRadius = getClampedNumber(properties.collectRadius, 2, 0.5, 25);
    properties.capacity = getClampedNumber(properties.capacity, 1000, 0, 1_000_000_000);
    properties.autoCollect = getBoolean(properties.autoCollect, true);
    properties.collectCooldown = getClampedNumber(properties.collectCooldown, 0.5, 0, 60);
    properties.collision = false;
  } else if (object.type === "tycoonBuyButton") {
    properties.purchaseId = getString(properties.purchaseId, object.id);
    properties.cost = getClampedNumber(properties.cost, 25, 0, 1_000_000_000);
    properties.unlockObjectIds = getStringArray(properties.unlockObjectIds);
    properties.unlockGroupId = getString(properties.unlockGroupId, "");
    properties.unlockButtonIds = getStringArray(properties.unlockButtonIds);
    properties.requiredPurchaseIds = getStringArray(properties.requiredPurchaseIds);
    properties.hideAfterPurchase = getBoolean(properties.hideAfterPurchase, true);
    properties.purchasedMessage = getString(properties.purchasedMessage, "Comprado!");
    properties.insufficientFundsMessage = getString(
      properties.insufficientFundsMessage,
      "Dinheiro insuficiente."
    );
    properties.oneTime = getBoolean(properties.oneTime, true);
    properties.collision = false;
  } else if (object.type === "tycoonUnlockable") {
    properties.purchaseId = getString(properties.purchaseId, "");
    properties.groupId = getString(properties.groupId, "");
    properties.startsLocked = getBoolean(properties.startsLocked, true);
    properties.lockedCollision = getBoolean(properties.lockedCollision, false);
    properties.unlockedMessage = getString(properties.unlockedMessage, "Item desbloqueado!");
  } else if (object.type === "tycoonUpgrade") {
    properties.upgradeId = getString(properties.upgradeId, object.id);
    properties.cost = getClampedNumber(properties.cost, 80, 0, 1_000_000_000);
    properties.targetGeneratorIds = getStringArray(properties.targetGeneratorIds);
    properties.incomeMultiplier = getClampedNumber(properties.incomeMultiplier, 1.5, 0, 100);
    properties.intervalMultiplier = getClampedNumber(properties.intervalMultiplier, 1, 0.05, 100);
    properties.collectorCapacityBonus = getClampedNumber(
      properties.collectorCapacityBonus,
      0,
      0,
      1_000_000_000
    );
    properties.requiredPurchaseIds = getStringArray(properties.requiredPurchaseIds);
    properties.maxLevel = Math.max(1, Math.floor(getClampedNumber(properties.maxLevel, 1, 1, 100)));
    properties.hideAfterPurchase = getBoolean(properties.hideAfterPurchase, true);
    properties.collision = false;
  } else if (object.type === "tycoonBarrier") {
    properties.purchaseId = getString(properties.purchaseId, object.id);
    properties.startsLocked = getBoolean(properties.startsLocked, true);
    properties.lockedCollision = getBoolean(properties.lockedCollision, true);
    properties.lockedColor = getString(properties.lockedColor, "#ef4444");
    properties.unlockedColor = getString(properties.unlockedColor, "#22c55e");
  }

  return properties;
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function getBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function getClampedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isNonEmptyString).slice(0, 100) : [];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
