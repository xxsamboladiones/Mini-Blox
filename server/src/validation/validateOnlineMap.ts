import type { GameMap } from "../types/OnlineMapSchema.js";

const SUSPICIOUS_FIELD_NAMES = [
  "script",
  "code",
  "eval",
  "function",
  "javascript",
  "js",
  "html",
  "onclick",
  "onload",
  "onerror",
  "innerHTML",
  "dangerouslySetInnerHTML",
];

const MAX_OBJECTS = 5000;
const MAX_JSON_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 32;
const MAX_LOGIC_RULES = 1000;
const MAX_OBJECTIVES = 200;

export function validateOnlineMap(map: unknown): { valid: boolean; error?: string } {
  if (!map || typeof map !== "object") {
    return { valid: false, error: "Map must be an object" };
  }

  const gameMap = map as Partial<GameMap>;

  if (!gameMap.id || typeof gameMap.id !== "string") {
    return { valid: false, error: "Map must have a valid id" };
  }

  if (!gameMap.name || typeof gameMap.name !== "string") {
    return { valid: false, error: "Map must have a valid name" };
  }

  if (gameMap.name.length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `Map name exceeds maximum length of ${MAX_NAME_LENGTH} characters`,
    };
  }

  if (gameMap.description && gameMap.description.length > MAX_DESCRIPTION_LENGTH) {
    return {
      valid: false,
      error: `Map description exceeds maximum length of ${MAX_DESCRIPTION_LENGTH} characters`,
    };
  }

  if (!Array.isArray(gameMap.objects)) {
    return { valid: false, error: "Map must have an objects array" };
  }

  if (gameMap.objects.length > MAX_OBJECTS) {
    return { valid: false, error: `Map exceeds maximum object count of ${MAX_OBJECTS}` };
  }

  if (gameMap.tags && (!Array.isArray(gameMap.tags) || gameMap.tags.length > MAX_TAGS)) {
    return { valid: false, error: `Map cannot have more than ${MAX_TAGS} tags` };
  }

  if (gameMap.tags) {
    for (const tag of gameMap.tags) {
      if (typeof tag !== "string" || tag.length > MAX_TAG_LENGTH) {
        return {
          valid: false,
          error: `Each tag must be a string with maximum ${MAX_TAG_LENGTH} characters`,
        };
      }
    }
  }

  if (gameMap.logic && (!Array.isArray(gameMap.logic) || gameMap.logic.length > MAX_LOGIC_RULES)) {
    return { valid: false, error: `Map cannot have more than ${MAX_LOGIC_RULES} logic rules` };
  }

  if (
    gameMap.objectives &&
    (!Array.isArray(gameMap.objectives) || gameMap.objectives.length > MAX_OBJECTIVES)
  ) {
    return { valid: false, error: `Map cannot have more than ${MAX_OBJECTIVES} objectives` };
  }

  const thumbnailError = validateThumbnail(gameMap.thumbnail);
  if (thumbnailError) {
    return thumbnailError;
  }

  const securityError = validateSecurity(gameMap);
  if (securityError) {
    return securityError;
  }

  return { valid: true };
}

function validateThumbnail(thumbnail: unknown): { valid: boolean; error?: string } | null {
  if (!thumbnail) {
    return null;
  }

  if (typeof thumbnail !== "string") {
    return { valid: false, error: "Thumbnail must be a string" };
  }

  if (thumbnail.length > MAX_THUMBNAIL_SIZE) {
    return {
      valid: false,
      error: `Thumbnail exceeds maximum size of ${MAX_THUMBNAIL_SIZE / 1024 / 1024}MB`,
    };
  }

  if (
    !thumbnail.startsWith("data:image/") &&
    !thumbnail.startsWith("http://") &&
    !thumbnail.startsWith("https://")
  ) {
    return { valid: false, error: "Thumbnail must be a data URL or HTTP/HTTPS URL" };
  }

  return null;
}

function validateSecurity(map: Partial<GameMap>): { valid: boolean; error?: string } | null {
  const jsonString = JSON.stringify(map);

  if (jsonString.length > MAX_JSON_SIZE) {
    return {
      valid: false,
      error: `Map JSON exceeds maximum size of ${MAX_JSON_SIZE / 1024 / 1024}MB`,
    };
  }

  const suspiciousFields = findSuspiciousFields(map);
  if (suspiciousFields.length > 0) {
    return {
      valid: false,
      error: `Map contains suspicious field names: ${suspiciousFields.join(", ")}`,
    };
  }

  return null;
}

function findSuspiciousFields(obj: unknown, path: string = ""): string[] {
  const suspicious: string[] = [];

  if (obj === null || typeof obj !== "object") {
    return suspicious;
  }

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (SUSPICIOUS_FIELD_NAMES.includes(key.toLowerCase())) {
      suspicious.push(currentPath);
    }

    if (typeof value === "object" && value !== null) {
      suspicious.push(...findSuspiciousFields(value, currentPath));
    }
  }

  return suspicious;
}

export function estimateJsonSize(map: GameMap): number {
  return JSON.stringify(map).length;
}
