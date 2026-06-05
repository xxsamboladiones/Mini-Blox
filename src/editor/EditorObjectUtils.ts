import type { MapObject, Vector3 } from "../shared/types/ObjectSchema";

const MIN_SCALE = 0.05;

export function createObjectId(prefix = "object"): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function cloneEditorObjectWithNewId(
  source: MapObject,
  overrides: Partial<MapObject> = {}
): MapObject {
  const duplicate = ensureObjectDefaults(structuredClone(source));
  const id = createObjectId(String(source.type || "object"));

  return ensureObjectDefaults({
    ...duplicate,
    ...overrides,
    id,
    properties: {
      ...duplicate.properties,
      ...overrides.properties,
    },
  });
}

export function ensureObjectDefaults(object: MapObject): MapObject {
  return sanitizeObjectTransform({
    ...object,
    name: object.name ?? String(object.type || "Objeto"),
    position: sanitizeVector(object.position, { x: 0, y: 0, z: 0 }),
    rotation: sanitizeVector(object.rotation, { x: 0, y: 0, z: 0 }),
    scale: sanitizeScale(object.scale),
    properties: object.properties ?? {},
  });
}

export function sanitizeObjectTransform(object: MapObject): MapObject {
  return {
    ...object,
    position: sanitizeVector(object.position, { x: 0, y: 0, z: 0 }),
    rotation: sanitizeVector(object.rotation, { x: 0, y: 0, z: 0 }),
    scale: sanitizeScale(object.scale),
  };
}

export function patchObjectProperties(object: MapObject, patch: Partial<MapObject>): MapObject {
  return ensureObjectDefaults({
    ...object,
    ...patch,
    properties: patch.properties
      ? {
          ...object.properties,
          ...patch.properties,
        }
      : object.properties,
  });
}

export function isValidSelectedObject(
  selectedId: string | null,
  objects: MapObject[]
): selectedId is string {
  return Boolean(selectedId && objects.some((object) => object.id === selectedId));
}

export function sanitizeVector(value: unknown, fallback: Vector3): Vector3 {
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

export function sanitizeScale(value: unknown): Vector3 {
  const scale = sanitizeVector(value, { x: 1, y: 1, z: 1 });

  return {
    x: Math.max(MIN_SCALE, scale.x),
    y: Math.max(MIN_SCALE, scale.y),
    z: Math.max(MIN_SCALE, scale.z),
  };
}

export function readFiniteNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
