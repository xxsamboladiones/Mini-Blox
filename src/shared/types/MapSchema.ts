import type { MapAsset, MapObject, Vector3 } from "./ObjectSchema";
import type { LogicRule } from "./ScriptSchema";

export type VisualTheme = "classic" | "grass" | "desert" | "neon" | "dark";

export type VisualSettings = {
  skyColor?: string;
  groundColor?: string;
  fogEnabled?: boolean;
  fogColor?: string;
  fogNear?: number;
  fogFar?: number;
  ambientLightIntensity?: number;
  sunLightIntensity?: number;
  theme?: VisualTheme;
};

export type AmbientMusic = "none" | "calm" | "adventure" | "dark" | "neon";

export type AudioSettings = {
  masterVolume?: number;
  sfxVolume?: number;
  musicVolume?: number;
  muted?: boolean;
  ambientMusic?: AmbientMusic;
};

export type GameplaySettings = {
  voidDeathEnabled?: boolean;
  voidDeathY?: number;
  requireObjectivesToFinish?: boolean;
};

export type MultiplayerSettings = {
  pvpEnabled?: boolean;
  friendlyFire?: boolean;
};

export type GameMode =
  | "freeplay"
  | "obby"
  | "coinCollect"
  | "combatArena"
  | "objectiveRun"
  | "teamBattle"
  | "capturePoint"
  | "tycoon";

export type WinConditionType =
  | "none"
  | "finish"
  | "collectCoins"
  | "defeatEnemies"
  | "completeObjectives"
  | "score"
  | "capturePoint"
  | "completeTycoon";

export type GameModeWinCondition = {
  type: WinConditionType;
  targetAmount?: number;
  requireAll?: boolean;
};

export type ScoringSettings = {
  coinScore?: number;
  enemyDefeatScore?: number;
  objectiveScore?: number;
  deathPenalty?: number;
};

export type TycoonSettings = {
  startingCash?: number;
  sharedCash?: boolean;
  requireAllPurchasesToWin?: boolean;
  winPurchaseIds?: string[];
  allowStealing?: boolean;
  autoClaimInSolo?: boolean;
  generatorTickRateScale?: number;
};

export type GameModeSettings = {
  mode: GameMode;
  roundEnabled?: boolean;
  roundTimeLimit?: number;
  respawnDelay?: number;
  teamsEnabled?: boolean;
  requireObjectivesToFinish?: boolean;
  winCondition?: GameModeWinCondition;
  scoring?: ScoringSettings;
  tycoonSettings?: TycoonSettings;
};

export type TeamDefinition = {
  id: string;
  name: string;
  color: string;
  spawnPoint?: Vector3;
};

export type ObjectiveType =
  | "collectCoins"
  | "reachObject"
  | "collectKey"
  | "activateButton"
  | "openDoor"
  | "defeatEnemies"
  | "customLogic"
  | "completeTycoon"
  | "purchaseTycoonItem"
  | "collectTycoonCash";

export type MapObjective = {
  id: string;
  title: string;
  description?: string;
  type: ObjectiveType;
  targetObjectId?: string;
  targetKeyId?: string;
  targetDoorId?: string;
  targetPurchaseId?: string;
  targetTycoonId?: string;
  targetAmount?: number;
  required?: boolean;
  visible?: boolean;
  completedMessage?: string;
};

export type GameMap = {
  version?: number;
  id: string;
  name: string;
  authorId: string;
  description?: string;
  creatorName?: string;
  spawnPoint: Vector3;
  objects: MapObject[];
  objectives?: MapObjective[];
  gameModeSettings?: GameModeSettings;
  teams?: TeamDefinition[];
  logic?: LogicRule[];
  logicDebug?: boolean;
  visualSettings?: VisualSettings;
  audioSettings?: AudioSettings;
  gameplaySettings?: GameplaySettings;
  multiplayerSettings?: MultiplayerSettings;
  assets?: MapAsset[];
  createdAt?: string;
  updatedAt?: string;
  thumbnail?: string;
  tags?: string[];
  isPublished?: boolean;
  publishedAt?: string;
  onlineMetadata?: {
    onlineId?: string;
    publishedAt?: string;
    updatedAt?: string;
    ownerClientId?: string;
  };
};

export function createEmptyGameMap(name = "Novo mapa"): GameMap {
  return {
    version: 1,
    id: createId("map"),
    name,
    authorId: "local-builder",
    description: "",
    creatorName: "Criador local",
    spawnPoint: { x: 0, y: 1, z: 0 },
    objects: [],
    objectives: [],
    logic: [],
    logicDebug: false,
    visualSettings: {
      theme: "classic",
      skyColor: "#cfe5ff",
      groundColor: "#edf4fb",
      fogEnabled: false,
      fogColor: "#cfe5ff",
      fogNear: 18,
      fogFar: 90,
      ambientLightIntensity: 1.8,
      sunLightIntensity: 2.2,
    },
    audioSettings: {
      masterVolume: 0.8,
      sfxVolume: 0.9,
      musicVolume: 0.35,
      muted: false,
      ambientMusic: "none",
    },
    gameplaySettings: {
      voidDeathEnabled: true,
    },
    multiplayerSettings: {
      pvpEnabled: false,
      friendlyFire: false,
    },
    gameModeSettings: {
      mode: "freeplay",
      roundEnabled: false,
      respawnDelay: 1,
      teamsEnabled: false,
      winCondition: { type: "none" },
      scoring: {
        coinScore: 10,
        enemyDefeatScore: 100,
        objectiveScore: 250,
        deathPenalty: 25,
      },
      tycoonSettings: {
        startingCash: 0,
        sharedCash: false,
        requireAllPurchasesToWin: true,
        winPurchaseIds: [],
        allowStealing: false,
        autoClaimInSolo: true,
        generatorTickRateScale: 1,
      },
    },
    teams: [],
    tags: [],
    isPublished: false,
  };
}

export function assertGameMap(value: unknown): asserts value is GameMap {
  if (!isGameMap(value)) {
    throw new Error("Invalid GameMap file.");
  }
}

export function isGameMap(value: unknown): value is GameMap {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.authorId === "string" &&
    (value.version === undefined || Number.isFinite(value.version)) &&
    (value.description === undefined || typeof value.description === "string") &&
    (value.creatorName === undefined || typeof value.creatorName === "string") &&
    isVector3(value.spawnPoint) &&
    Array.isArray(value.objects) &&
    value.objects.every(isMapObject) &&
    (value.objectives === undefined ||
      (Array.isArray(value.objectives) && value.objectives.every(isMapObjective))) &&
    (value.gameModeSettings === undefined || isGameModeSettings(value.gameModeSettings)) &&
    (value.teams === undefined ||
      (Array.isArray(value.teams) && value.teams.every(isTeamDefinition))) &&
    (value.logic === undefined || (Array.isArray(value.logic) && value.logic.every(isLogicRule))) &&
    (value.logicDebug === undefined || typeof value.logicDebug === "boolean") &&
    (value.visualSettings === undefined || isVisualSettings(value.visualSettings)) &&
    (value.audioSettings === undefined || isAudioSettings(value.audioSettings)) &&
    (value.gameplaySettings === undefined || isGameplaySettings(value.gameplaySettings)) &&
    (value.multiplayerSettings === undefined || isMultiplayerSettings(value.multiplayerSettings)) &&
    (value.assets === undefined ||
      (Array.isArray(value.assets) && value.assets.every(isMapAsset))) &&
    (value.createdAt === undefined || typeof value.createdAt === "string") &&
    (value.updatedAt === undefined || typeof value.updatedAt === "string") &&
    (value.thumbnail === undefined || typeof value.thumbnail === "string") &&
    (value.tags === undefined ||
      (Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === "string"))) &&
    (value.isPublished === undefined || typeof value.isPublished === "boolean") &&
    (value.publishedAt === undefined || typeof value.publishedAt === "string")
  );
}

function isMapObject(value: unknown): value is MapObject {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    isVector3(value.position) &&
    (value.rotation === undefined || isVector3(value.rotation)) &&
    (value.scale === undefined || isVector3(value.scale))
  );
}

function isMapObjective(value: unknown): value is MapObjective {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    isObjectiveType(value.type) &&
    (value.description === undefined || typeof value.description === "string") &&
    (value.targetObjectId === undefined || typeof value.targetObjectId === "string") &&
    (value.targetKeyId === undefined || typeof value.targetKeyId === "string") &&
    (value.targetDoorId === undefined || typeof value.targetDoorId === "string") &&
    (value.targetPurchaseId === undefined || typeof value.targetPurchaseId === "string") &&
    (value.targetTycoonId === undefined || typeof value.targetTycoonId === "string") &&
    (value.targetAmount === undefined || Number.isFinite(value.targetAmount)) &&
    (value.required === undefined || typeof value.required === "boolean") &&
    (value.visible === undefined || typeof value.visible === "boolean") &&
    (value.completedMessage === undefined || typeof value.completedMessage === "string")
  );
}

function isMapAsset(value: unknown): value is MapAsset {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.kind === "string" &&
    (value.dataUrl === undefined || typeof value.dataUrl === "string") &&
    (value.url === undefined || typeof value.url === "string")
  );
}

function isLogicRule(value: unknown): value is LogicRule {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    (value.name === undefined || typeof value.name === "string") &&
    (value.enabled === undefined || typeof value.enabled === "boolean") &&
    (value.trigger === undefined || isLogicPart(value.trigger)) &&
    (value.conditions === undefined ||
      (Array.isArray(value.conditions) && value.conditions.every(isLogicPart))) &&
    (value.actions === undefined ||
      (Array.isArray(value.actions) && value.actions.every(isLogicPart))) &&
    (value.type === undefined || typeof value.type === "string")
  );
}

function isLogicPart(value: unknown): boolean {
  return isRecord(value) && typeof value.type === "string";
}

function isVisualSettings(value: unknown): value is VisualSettings {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.skyColor === undefined || typeof value.skyColor === "string") &&
    (value.groundColor === undefined || typeof value.groundColor === "string") &&
    (value.fogEnabled === undefined || typeof value.fogEnabled === "boolean") &&
    (value.fogColor === undefined || typeof value.fogColor === "string") &&
    (value.fogNear === undefined || Number.isFinite(value.fogNear)) &&
    (value.fogFar === undefined || Number.isFinite(value.fogFar)) &&
    (value.ambientLightIntensity === undefined || Number.isFinite(value.ambientLightIntensity)) &&
    (value.sunLightIntensity === undefined || Number.isFinite(value.sunLightIntensity)) &&
    (value.theme === undefined ||
      value.theme === "classic" ||
      value.theme === "grass" ||
      value.theme === "desert" ||
      value.theme === "neon" ||
      value.theme === "dark")
  );
}

function isAudioSettings(value: unknown): value is AudioSettings {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.masterVolume === undefined || Number.isFinite(value.masterVolume)) &&
    (value.sfxVolume === undefined || Number.isFinite(value.sfxVolume)) &&
    (value.musicVolume === undefined || Number.isFinite(value.musicVolume)) &&
    (value.muted === undefined || typeof value.muted === "boolean") &&
    (value.ambientMusic === undefined ||
      value.ambientMusic === "none" ||
      value.ambientMusic === "calm" ||
      value.ambientMusic === "adventure" ||
      value.ambientMusic === "dark" ||
      value.ambientMusic === "neon")
  );
}

function isGameplaySettings(value: unknown): value is GameplaySettings {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.voidDeathEnabled === undefined || typeof value.voidDeathEnabled === "boolean") &&
    (value.voidDeathY === undefined || Number.isFinite(value.voidDeathY)) &&
    (value.requireObjectivesToFinish === undefined ||
      typeof value.requireObjectivesToFinish === "boolean")
  );
}

function isMultiplayerSettings(value: unknown): value is MultiplayerSettings {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.pvpEnabled === undefined || typeof value.pvpEnabled === "boolean") &&
    (value.friendlyFire === undefined || typeof value.friendlyFire === "boolean")
  );
}

function isGameModeSettings(value: unknown): value is GameModeSettings {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isGameMode(value.mode) &&
    (value.roundEnabled === undefined || typeof value.roundEnabled === "boolean") &&
    (value.roundTimeLimit === undefined || Number.isFinite(value.roundTimeLimit)) &&
    (value.respawnDelay === undefined || Number.isFinite(value.respawnDelay)) &&
    (value.teamsEnabled === undefined || typeof value.teamsEnabled === "boolean") &&
    (value.requireObjectivesToFinish === undefined ||
      typeof value.requireObjectivesToFinish === "boolean") &&
    (value.winCondition === undefined || isGameModeWinCondition(value.winCondition)) &&
    (value.scoring === undefined || isScoringSettings(value.scoring)) &&
    (value.tycoonSettings === undefined || isTycoonSettings(value.tycoonSettings))
  );
}

function isGameModeWinCondition(value: unknown): value is GameModeWinCondition {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isWinConditionType(value.type) &&
    (value.targetAmount === undefined || Number.isFinite(value.targetAmount)) &&
    (value.requireAll === undefined || typeof value.requireAll === "boolean")
  );
}

function isScoringSettings(value: unknown): value is ScoringSettings {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.coinScore === undefined || Number.isFinite(value.coinScore)) &&
    (value.enemyDefeatScore === undefined || Number.isFinite(value.enemyDefeatScore)) &&
    (value.objectiveScore === undefined || Number.isFinite(value.objectiveScore)) &&
    (value.deathPenalty === undefined || Number.isFinite(value.deathPenalty))
  );
}

function isTycoonSettings(value: unknown): value is TycoonSettings {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.startingCash === undefined || Number.isFinite(value.startingCash)) &&
    (value.sharedCash === undefined || typeof value.sharedCash === "boolean") &&
    (value.requireAllPurchasesToWin === undefined ||
      typeof value.requireAllPurchasesToWin === "boolean") &&
    (value.winPurchaseIds === undefined ||
      (Array.isArray(value.winPurchaseIds) &&
        value.winPurchaseIds.every((purchaseId) => typeof purchaseId === "string"))) &&
    (value.allowStealing === undefined || typeof value.allowStealing === "boolean") &&
    (value.autoClaimInSolo === undefined || typeof value.autoClaimInSolo === "boolean") &&
    (value.generatorTickRateScale === undefined ||
      Number.isFinite(value.generatorTickRateScale))
  );
}

function isTeamDefinition(value: unknown): value is TeamDefinition {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.color === "string" &&
    (value.spawnPoint === undefined || isVector3(value.spawnPoint))
  );
}

function isGameMode(value: unknown): value is GameMode {
  return (
    value === "freeplay" ||
    value === "obby" ||
    value === "coinCollect" ||
    value === "combatArena" ||
    value === "objectiveRun" ||
    value === "teamBattle" ||
    value === "capturePoint" ||
    value === "tycoon"
  );
}

function isWinConditionType(value: unknown): value is WinConditionType {
  return (
    value === "none" ||
    value === "finish" ||
    value === "collectCoins" ||
    value === "defeatEnemies" ||
    value === "completeObjectives" ||
    value === "score" ||
    value === "capturePoint" ||
    value === "completeTycoon"
  );
}

function isObjectiveType(value: unknown): value is ObjectiveType {
  return (
    value === "collectCoins" ||
    value === "reachObject" ||
    value === "collectKey" ||
    value === "activateButton" ||
    value === "openDoor" ||
    value === "defeatEnemies" ||
    value === "customLogic" ||
    value === "completeTycoon" ||
    value === "purchaseTycoonItem" ||
    value === "collectTycoonCash"
  );
}

function isVector3(value: unknown): value is Vector3 {
  if (!isRecord(value)) {
    return false;
  }

  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
