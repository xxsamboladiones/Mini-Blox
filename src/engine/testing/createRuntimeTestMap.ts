import { normalizeGameMap } from "../../shared/normalizeGameMap";
import {
  createEmptyGameMap,
  type GameMap,
  type GameMode,
  type TycoonSettings,
} from "../../shared/types/MapSchema";
import type {
  MapObject,
  MapObjectProperties,
  MapObjectType,
  Vector3,
} from "../../shared/types/ObjectSchema";

export type RuntimeTestMapOptions = {
  id?: string;
  name?: string;
  gameMode?: GameMode;
  startingCash?: number;
  objects?: MapObject[];
  tycoonSettings?: Partial<TycoonSettings>;
  winPurchaseIds?: string[];
};

export function createRuntimeTestMap(options: RuntimeTestMapOptions = {}): GameMap {
  const map = createEmptyGameMap(options.name ?? "Runtime Test Map");
  const tycoonSettings = {
    ...(map.gameModeSettings?.tycoonSettings ?? {}),
    startingCash: options.startingCash ?? 0,
    ...(options.tycoonSettings ?? {}),
    winPurchaseIds:
      options.winPurchaseIds ??
      options.tycoonSettings?.winPurchaseIds ??
      map.gameModeSettings?.tycoonSettings?.winPurchaseIds ??
      [],
  };

  return normalizeGameMap({
    ...map,
    id: options.id ?? "runtime-test-map",
    objects: options.objects ?? [],
    gameModeSettings: {
      ...(map.gameModeSettings ?? { mode: "freeplay" }),
      mode: options.gameMode ?? "tycoon",
      winCondition: {
        type: options.gameMode === "freeplay" ? "none" : "completeTycoon",
        requireAll: true,
      },
      tycoonSettings,
    },
  });
}

export function createRuntimeTestObject(
  type: MapObjectType,
  id: string,
  properties: MapObjectProperties = {},
  position: Vector3 = { x: 0, y: 0.5, z: 0 },
  scale: Vector3 = { x: 1, y: 1, z: 1 }
): MapObject {
  return {
    id,
    type,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    scale,
    properties,
  };
}
