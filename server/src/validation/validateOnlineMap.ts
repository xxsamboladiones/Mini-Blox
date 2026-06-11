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
  "innerhtml",
  "outerhtml",
  "dangerouslysetinnerhtml",
];

const MAX_OBJECTS = 5000;
const MAX_OBJECT_ID_LENGTH = 160;
const MAX_OBJECT_TYPE_LENGTH = 64;
const MAX_JSON_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ASSET_DATA_URL_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_ASSETS = 100;
const MAX_URL_LENGTH = 2048;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 32;
const MAX_LOGIC_RULES = 1000;
const MAX_OBJECTIVES = 200;
const MAX_ABSOLUTE_POSITION = 5000;
const MAX_OBJECT_SCALE = 250;
const MAX_DAMAGE = 100;
const MAX_ENEMY_HEALTH = 5000;
const MAX_ENEMY_DAMAGE = 100;
const MAX_ENEMY_SPEED = 50;
const MAX_HEAL_AMOUNT = 100;
const MAX_FORCE = 250;
const MAX_RANGE = 250;
const MAX_COOLDOWN = 120;
const MAX_TYCOON_OBJECTS = 600;
const MAX_TYCOON_CASH = 1_000_000_000;
const MAX_TYCOON_INCOME = 1_000_000;
const MAX_TYCOON_ARRAY_ITEMS = 100;

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

  const spawnPointError = validateVector(gameMap.spawnPoint, "spawnPoint", MAX_ABSOLUTE_POSITION);
  if (spawnPointError) {
    return spawnPointError;
  }

  const objectError = validateObjects(gameMap.objects, gameMap.gameModeSettings);
  if (objectError) {
    return objectError;
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

  const assetError = validateAssets(gameMap.assets);
  if (assetError) {
    return assetError;
  }

  const securityError = validateSecurity(gameMap);
  if (securityError) {
    return securityError;
  }

  return { valid: true };
}

function validateObjects(
  objects: unknown[],
  gameModeSettings?: unknown
): { valid: boolean; error?: string } | null {
  const ids = new Set<string>();
  let tycoonObjectCount = 0;

  for (let index = 0; index < objects.length; index += 1) {
    const objectPath = `objects[${index}]`;
    const mapObject = objects[index];
    if (!mapObject || typeof mapObject !== "object" || Array.isArray(mapObject)) {
      return { valid: false, error: `${objectPath} must be an object` };
    }

    const objectRecord = mapObject as Record<string, unknown>;
    const id = objectRecord.id;
    const type = objectRecord.type;

    if (typeof id !== "string" || id.trim().length === 0 || id.length > MAX_OBJECT_ID_LENGTH) {
      return { valid: false, error: `${objectPath}.id is invalid` };
    }

    if (ids.has(id)) {
      return { valid: false, error: `${objectPath}.id is duplicated` };
    }
    ids.add(id);

    if (
      typeof type !== "string" ||
      type.trim().length === 0 ||
      type.length > MAX_OBJECT_TYPE_LENGTH
    ) {
      return { valid: false, error: `${objectPath}.type is invalid` };
    }

    if (type.startsWith("tycoon")) {
      tycoonObjectCount += 1;
      if (tycoonObjectCount > MAX_TYCOON_OBJECTS) {
        return {
          valid: false,
          error: `Map cannot have more than ${MAX_TYCOON_OBJECTS} tycoon objects`,
        };
      }
    }

    const positionError = validateVector(
      objectRecord.position,
      `${objectPath}.position`,
      MAX_ABSOLUTE_POSITION
    );
    if (positionError) {
      return positionError;
    }

    if (objectRecord.rotation !== undefined) {
      const rotationError = validateVector(
        objectRecord.rotation,
        `${objectPath}.rotation`,
        36000
      );
      if (rotationError) {
        return rotationError;
      }
    }

    if (objectRecord.scale !== undefined) {
      const scaleError = validateVector(objectRecord.scale, `${objectPath}.scale`, MAX_OBJECT_SCALE, {
        min: 0.01,
      });
      if (scaleError) {
        return scaleError;
      }
    }

    if (!isOptionalSafeString(objectRecord.assetId) || !isOptionalSafeString(objectRecord.materialId)) {
      return { valid: false, error: `${objectPath} contains an invalid asset or material id` };
    }

    const colliderError = validateCollider(objectRecord.collider, objectPath);
    if (colliderError) {
      return colliderError;
    }

    const propertiesError = validateObjectProperties(
      type,
      objectRecord.properties,
      `${objectPath}.properties`
    );
    if (propertiesError) {
      return propertiesError;
    }
  }

  const tycoonReferenceError = validateTycoonReferences(objects, ids, gameModeSettings);
  if (tycoonReferenceError) {
    return tycoonReferenceError;
  }

  return null;
}

function validateCollider(collider: unknown, objectPath: string): { valid: boolean; error?: string } | null {
  if (collider === undefined) {
    return null;
  }

  if (!collider || typeof collider !== "object" || Array.isArray(collider)) {
    return { valid: false, error: `${objectPath}.collider must be an object` };
  }

  const record = collider as Record<string, unknown>;
  const sizeError =
    record.size === undefined
      ? null
      : validateVector(record.size, `${objectPath}.collider.size`, MAX_OBJECT_SCALE, { min: 0.01 });
  if (sizeError) {
    return sizeError;
  }

  const radiusError = validateOptionalNumber(
    record.radius,
    `${objectPath}.collider.radius`,
    0,
    MAX_OBJECT_SCALE
  );
  if (radiusError) {
    return radiusError;
  }

  return validateOptionalNumber(record.height, `${objectPath}.collider.height`, 0, MAX_OBJECT_SCALE);
}

function validateObjectProperties(
  objectType: string,
  properties: unknown,
  path: string
): { valid: boolean; error?: string } | null {
  if (properties === undefined) {
    return null;
  }

  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return { valid: false, error: `${path} must be an object` };
  }

  const record = properties as Record<string, unknown>;
  const numericLimits: Array<[string, number, number]> = [
    ["damage", 0, objectType === "enemy" ? MAX_ENEMY_DAMAGE : MAX_DAMAGE],
    ["damagePerSecond", 0, MAX_DAMAGE],
    ["health", 1, objectType === "enemy" ? MAX_ENEMY_HEALTH : MAX_HEAL_AMOUNT],
    ["speed", 0, objectType === "enemy" ? MAX_ENEMY_SPEED : MAX_FORCE],
    ["force", 0, MAX_FORCE],
    ["attackRange", 0, MAX_RANGE],
    ["detectionRange", 0, MAX_RANGE],
    ["interactionRange", 0, MAX_RANGE],
    ["radius", 0, MAX_RANGE],
    ["attackCooldown", 0.05, MAX_COOLDOWN],
    ["cooldown", 0, MAX_COOLDOWN],
    ["respawnTime", 0, MAX_COOLDOWN],
    ["respawnDelay", 0, MAX_COOLDOWN],
    ["amount", 0, MAX_HEAL_AMOUNT],
    ["healAmount", 0, MAX_HEAL_AMOUNT],
    ["coinValue", 0, 100000],
    ["value", 0, 100000],
    ["captureTime", 0, MAX_COOLDOWN],
    ["scorePerSecond", 0, 1000],
    ["lightIntensity", 0, 100],
    ["lightRange", 0, MAX_RANGE],
    ["cost", 0, MAX_TYCOON_CASH],
    ["incomePerTick", 0, MAX_TYCOON_INCOME],
    ["tickInterval", 0.1, 3600],
    ["maxStoredAmount", 0, MAX_TYCOON_CASH],
    ["collectRadius", 0.1, MAX_RANGE],
    ["capacity", 0, MAX_TYCOON_CASH],
    ["collectCooldown", 0, MAX_COOLDOWN],
    ["incomeMultiplier", 0, 100],
    ["intervalMultiplier", 0.05, 100],
    ["collectorCapacityBonus", 0, MAX_TYCOON_CASH],
    ["maxLevel", 1, 100],
  ];

  for (const [key, min, max] of numericLimits) {
    const error = validateOptionalNumber(record[key], `${path}.${key}`, min, max);
    if (error) {
      return error;
    }
  }

  for (const key of ["openOffset", "patrolOffset", "startOffset", "endOffset"]) {
    if (record[key] !== undefined) {
      const error = validateVector(record[key], `${path}.${key}`, MAX_OBJECT_SCALE);
      if (error) {
        return error;
      }
    }
  }

  const stringFields = [
    "tycoonId",
    "claimLabel",
    "generatorId",
    "targetCollectorId",
    "purchaseId",
    "upgradeGroupId",
    "collectorId",
    "unlockGroupId",
    "purchasedMessage",
    "insufficientFundsMessage",
    "groupId",
    "unlockedMessage",
    "upgradeId",
    "unlockedColor",
    "lockedColor",
  ];

  for (const key of stringFields) {
    if (!isOptionalSafeString(record[key], key.endsWith("Message") ? 240 : MAX_OBJECT_ID_LENGTH)) {
      return { valid: false, error: `${path}.${key} is invalid` };
    }
  }

  for (const key of [
    "unlockObjectIds",
    "unlockButtonIds",
    "requiredPurchaseIds",
    "targetGeneratorIds",
  ]) {
    const arrayError = validateStringArray(record[key], `${path}.${key}`);
    if (arrayError) {
      return arrayError;
    }
  }

  if (objectType.startsWith("tycoon")) {
    const requiredError = validateTycoonRequiredFields(objectType, record, path);
    if (requiredError) {
      return requiredError;
    }
  }

  return null;
}

function validateTycoonRequiredFields(
  objectType: string,
  record: Record<string, unknown>,
  path: string
): { valid: boolean; error?: string } | null {
  if (!isNonEmptySafeString(record.tycoonId)) {
    return { valid: false, error: `${path}.tycoonId is required for tycoon objects` };
  }

  const requiredFieldByType: Record<string, string> = {
    tycoonGenerator: "generatorId",
    tycoonCollector: "collectorId",
    tycoonBuyButton: "purchaseId",
    tycoonUpgrade: "upgradeId",
    tycoonBarrier: "purchaseId",
  };
  const requiredField = requiredFieldByType[objectType];

  if (requiredField && !isNonEmptySafeString(record[requiredField])) {
    return { valid: false, error: `${path}.${requiredField} is required` };
  }

  return null;
}

function validateStringArray(
  value: unknown,
  path: string
): { valid: boolean; error?: string } | null {
  if (value === undefined) {
    return null;
  }

  if (!Array.isArray(value) || value.length > MAX_TYCOON_ARRAY_ITEMS) {
    return { valid: false, error: `${path} must be an array with at most ${MAX_TYCOON_ARRAY_ITEMS} items` };
  }

  for (const item of value) {
    if (!isNonEmptySafeString(item)) {
      return { valid: false, error: `${path} contains an invalid id` };
    }
  }

  return null;
}

function validateTycoonReferences(
  objects: unknown[],
  objectIds: Set<string>,
  gameModeSettings?: unknown
): { valid: boolean; error?: string } | null {
  const purchaseIds = new Set<string>();
  const generatorIds = new Set<string>();
  const collectorIds = new Set<string>();
  const records = objects.filter(isRecord);

  for (const object of records) {
    const type = typeof object.type === "string" ? object.type : "";
    const properties = isRecord(object.properties) ? object.properties : {};

    if (type === "tycoonBuyButton" || type === "tycoonBarrier") {
      const purchaseId = getString(properties.purchaseId);
      if (purchaseId) {
        purchaseIds.add(purchaseId);
      }
    } else if (type === "tycoonUpgrade") {
      const upgradeId = getString(properties.upgradeId);
      if (upgradeId) {
        purchaseIds.add(upgradeId);
      }
    } else if (type === "tycoonGenerator") {
      const generatorId = getString(properties.generatorId);
      if (generatorId) {
        generatorIds.add(generatorId);
      }
    } else if (type === "tycoonCollector") {
      const collectorId = getString(properties.collectorId);
      if (collectorId) {
        collectorIds.add(collectorId);
      }
    }
  }

  for (const object of records) {
    const type = typeof object.type === "string" ? object.type : "";
    if (!type.startsWith("tycoon")) {
      continue;
    }

    const objectId = typeof object.id === "string" ? object.id : "unknown";
    const properties = isRecord(object.properties) ? object.properties : {};

    for (const unlockObjectId of getStringArray(properties.unlockObjectIds)) {
      if (!objectIds.has(unlockObjectId)) {
        return { valid: false, error: `${objectId} unlocks missing object ${unlockObjectId}` };
      }
    }

    for (const unlockButtonId of getStringArray(properties.unlockButtonIds)) {
      if (!objectIds.has(unlockButtonId) && !purchaseIds.has(unlockButtonId)) {
        return { valid: false, error: `${objectId} unlocks missing button or purchase ${unlockButtonId}` };
      }
    }

    for (const requiredPurchaseId of getStringArray(properties.requiredPurchaseIds)) {
      if (!purchaseIds.has(requiredPurchaseId)) {
        return { valid: false, error: `${objectId} requires missing purchase ${requiredPurchaseId}` };
      }
    }

    const collectorId = getString(properties.targetCollectorId);
    if (collectorId && !collectorIds.has(collectorId)) {
      return { valid: false, error: `${objectId} targets missing collector ${collectorId}` };
    }

    for (const generatorId of getStringArray(properties.targetGeneratorIds)) {
      if (!generatorIds.has(generatorId)) {
        return { valid: false, error: `${objectId} targets missing generator ${generatorId}` };
      }
    }
  }

  const winPurchaseError = validateTycoonWinPurchases(gameModeSettings, purchaseIds);
  if (winPurchaseError) {
    return winPurchaseError;
  }

  return null;
}

function validateTycoonWinPurchases(
  gameModeSettings: unknown,
  purchaseIds: Set<string>
): { valid: boolean; error?: string } | null {
  if (!isRecord(gameModeSettings)) {
    return null;
  }

  const tycoonSettings = gameModeSettings.tycoonSettings;
  if (tycoonSettings === undefined) {
    return null;
  }

  if (!isRecord(tycoonSettings)) {
    return { valid: false, error: "gameModeSettings.tycoonSettings must be an object" };
  }

  const arrayError = validateStringArray(
    tycoonSettings.winPurchaseIds,
    "gameModeSettings.tycoonSettings.winPurchaseIds"
  );
  if (arrayError) {
    return arrayError;
  }

  for (const purchaseId of getStringArray(tycoonSettings.winPurchaseIds)) {
    if (!purchaseIds.has(purchaseId)) {
      return {
        valid: false,
        error: `gameModeSettings.tycoonSettings.winPurchaseIds references missing purchase ${purchaseId}`,
      };
    }
  }

  return null;
}

function validateAssets(assets: unknown): { valid: boolean; error?: string } | null {
  if (assets === undefined) {
    return null;
  }

  if (!Array.isArray(assets)) {
    return { valid: false, error: "assets must be an array" };
  }

  if (assets.length > MAX_ASSETS) {
    return { valid: false, error: `Map cannot have more than ${MAX_ASSETS} assets` };
  }

  for (let index = 0; index < assets.length; index += 1) {
    const path = `assets[${index}]`;
    const asset = assets[index];
    if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
      return { valid: false, error: `${path} must be an object` };
    }

    const record = asset as Record<string, unknown>;
    if (!isOptionalSafeString(record.url, MAX_URL_LENGTH)) {
      return { valid: false, error: `${path}.url is invalid` };
    }

    if (record.dataUrl !== undefined) {
      if (typeof record.dataUrl !== "string") {
        return { valid: false, error: `${path}.dataUrl must be a string` };
      }

      if (record.dataUrl.length > MAX_ASSET_DATA_URL_SIZE) {
        return { valid: false, error: `${path}.dataUrl exceeds the 2MB limit` };
      }

      if (!isAllowedAssetDataUrl(record.dataUrl)) {
        return { valid: false, error: `${path}.dataUrl has an unsupported format` };
      }
    }
  }

  return null;
}

function validateVector(
  value: unknown,
  path: string,
  maxAbs: number,
  options: { min?: number } = {}
): { valid: boolean; error?: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, error: `${path} must be a vector` };
  }

  const record = value as Record<string, unknown>;
  for (const axis of ["x", "y", "z"] as const) {
    const coordinate = record[axis];
    if (typeof coordinate !== "number" || !Number.isFinite(coordinate)) {
      return { valid: false, error: `${path}.${axis} must be a finite number` };
    }

    if (options.min !== undefined && coordinate < options.min) {
      return { valid: false, error: `${path}.${axis} must be at least ${options.min}` };
    }

    if (Math.abs(coordinate) > maxAbs) {
      return { valid: false, error: `${path}.${axis} exceeds limit ${maxAbs}` };
    }
  }

  return null;
}

function validateOptionalNumber(
  value: unknown,
  path: string,
  min: number,
  max: number
): { valid: boolean; error?: string } | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return { valid: false, error: `${path} must be between ${min} and ${max}` };
  }

  return null;
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

  const suspiciousValues = findSuspiciousStringValues(map);
  if (suspiciousValues.length > 0) {
    return {
      valid: false,
      error: `Map contains suspicious string values: ${suspiciousValues.join(", ")}`,
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

function findSuspiciousStringValues(obj: unknown, path: string = ""): string[] {
  const suspicious: string[] = [];

  if (typeof obj === "string") {
    const value = obj.trim().toLowerCase();
    if (
      value.startsWith("javascript:") ||
      value.startsWith("vbscript:") ||
      value.startsWith("data:text/html") ||
      value.includes("<script") ||
      value.includes("onerror=") ||
      value.includes("onload=")
    ) {
      suspicious.push(path || "value");
    }

    return suspicious;
  }

  if (obj === null || typeof obj !== "object") {
    return suspicious;
  }

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    suspicious.push(...findSuspiciousStringValues(value, currentPath));
  }

  return suspicious;
}

function isOptionalSafeString(value: unknown, maxLength = MAX_OBJECT_ID_LENGTH): boolean {
  if (value === undefined) {
    return true;
  }

  if (typeof value !== "string" || value.length > maxLength) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    !normalized.startsWith("javascript:") &&
    !normalized.startsWith("vbscript:") &&
    !normalized.startsWith("data:text/html")
  );
}

function isNonEmptySafeString(value: unknown, maxLength = MAX_OBJECT_ID_LENGTH): value is string {
  return typeof value === "string" && value.trim().length > 0 && isOptionalSafeString(value, maxLength);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function isAllowedAssetDataUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("data:image/") ||
    normalized.startsWith("data:audio/") ||
    normalized.startsWith("data:model/") ||
    normalized.startsWith("data:application/octet-stream")
  );
}

export function estimateJsonSize(map: GameMap): number {
  return JSON.stringify(map).length;
}
