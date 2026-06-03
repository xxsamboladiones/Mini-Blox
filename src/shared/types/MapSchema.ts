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
  logic?: LogicRule[];
  logicDebug?: boolean;
  visualSettings?: VisualSettings;
  audioSettings?: AudioSettings;
  gameplaySettings?: GameplaySettings;
  assets?: MapAsset[];
  createdAt?: string;
  updatedAt?: string;
  thumbnail?: string;
  tags?: string[];
  isPublished?: boolean;
  publishedAt?: string;
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
      sunLightIntensity: 2.2
    },
    audioSettings: {
      masterVolume: 0.8,
      sfxVolume: 0.9,
      musicVolume: 0.35,
      muted: false,
      ambientMusic: "none"
    },
    gameplaySettings: {
      voidDeathEnabled: true
    },
    tags: [],
    isPublished: false
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
    (value.logic === undefined ||
      (Array.isArray(value.logic) && value.logic.every(isLogicRule))) &&
    (value.logicDebug === undefined || typeof value.logicDebug === "boolean") &&
    (value.visualSettings === undefined || isVisualSettings(value.visualSettings)) &&
    (value.audioSettings === undefined || isAudioSettings(value.audioSettings)) &&
    (value.gameplaySettings === undefined || isGameplaySettings(value.gameplaySettings)) &&
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
    (value.voidDeathY === undefined || Number.isFinite(value.voidDeathY))
  );
}

function isVector3(value: unknown): value is Vector3 {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z)
  );
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
