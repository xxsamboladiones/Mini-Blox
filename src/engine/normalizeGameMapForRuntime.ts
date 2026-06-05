import type { GameMap } from "../shared/types/MapSchema";
import type { MapObject } from "../shared/types/ObjectSchema";
import {
  ensureMapDefaults,
  normalizeGameMap,
  normalizeMapObjectDefaults,
} from "../shared/normalizeGameMap";

export function normalizeGameMapForRuntime(map: GameMap): GameMap {
  return normalizeGameMap(map);
}

export function normalizeObjectDefaults(object: MapObject): MapObject {
  return normalizeMapObjectDefaults(object);
}

export { ensureMapDefaults };
