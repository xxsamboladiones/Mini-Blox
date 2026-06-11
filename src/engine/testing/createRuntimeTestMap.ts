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

export function createFreeplayTestMap(objects: MapObject[] = []): GameMap {
  return createRuntimeTestMap({
    gameMode: "freeplay",
    objects,
    tycoonSettings: { winPurchaseIds: [] },
  });
}

export function createCoinTestMap(): GameMap {
  return createRuntimeTestMap({
    gameMode: "coinCollect",
    objects: [
      createRuntimeTestObject("coin", "coin_1", { coinValue: 1 }, { x: 1, y: 0.5, z: 0 }),
      createRuntimeTestObject("finish", "finish", {}, { x: 3, y: 0.5, z: 0 }),
    ],
  });
}

export function createDoorButtonTestMap(): GameMap {
  return createRuntimeTestMap({
    gameMode: "freeplay",
    objects: [
      createRuntimeTestObject("door", "door_1", { doorId: "door_a" }, { x: 3, y: 1, z: 0 }),
      createRuntimeTestObject(
        "button",
        "button_1",
        { targetDoorId: "door_a" },
        { x: 0, y: 0.3, z: 0 }
      ),
    ],
  });
}

export function createTycoonTestMap(
  objects: MapObject[],
  options: RuntimeTestMapOptions = {}
): GameMap {
  return createRuntimeTestMap({
    ...options,
    gameMode: "tycoon",
    objects,
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
