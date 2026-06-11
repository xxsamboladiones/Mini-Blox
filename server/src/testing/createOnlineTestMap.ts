import type { GameMap, MapObject, MapObjectProperties } from "../types/OnlineMapSchema.js";

export function createOnlineTestMap(overrides: Partial<GameMap> = {}): GameMap {
  return {
    version: 1,
    id: overrides.id ?? "test-map",
    name: overrides.name ?? "Mapa de Teste",
    authorId: overrides.authorId ?? "test-author",
    description: overrides.description ?? "Mapa usado nos testes automatizados.",
    creatorName: overrides.creatorName ?? "Tester",
    spawnPoint: overrides.spawnPoint ?? { x: 0, y: 1, z: 0 },
    objects: overrides.objects ?? [
      createObject("spawn", "spawn", {}, { x: 0, y: 0.5, z: 0 }),
      createObject(
        "cube",
        "ground",
        { collision: true },
        { x: 0, y: -0.05, z: 0 },
        {
          x: 10,
          y: 0.1,
          z: 10,
        }
      ),
    ],
    objectives: overrides.objectives ?? [],
    logic: overrides.logic ?? [],
    visualSettings: overrides.visualSettings ?? { theme: "classic" },
    audioSettings: overrides.audioSettings ?? { ambientMusic: "none" },
    gameplaySettings: overrides.gameplaySettings ?? { voidDeathEnabled: true },
    multiplayerSettings: overrides.multiplayerSettings ?? {
      pvpEnabled: false,
      friendlyFire: false,
    },
    gameModeSettings: overrides.gameModeSettings ?? {
      mode: "freeplay",
      winCondition: { type: "none" },
      tycoonSettings: {
        startingCash: 0,
        sharedCash: false,
        requireAllPurchasesToWin: true,
        winPurchaseIds: [],
        autoClaimInSolo: true,
        generatorTickRateScale: 1,
      },
    },
    teams: overrides.teams ?? [],
    assets: overrides.assets ?? [],
    tags: overrides.tags ?? ["test"],
    thumbnail: overrides.thumbnail,
    createdAt: overrides.createdAt,
    updatedAt: overrides.updatedAt,
    publishedAt: overrides.publishedAt,
    isPublished: overrides.isPublished,
  };
}

export function createValidTycoonOnlineMap(): GameMap {
  return createOnlineTestMap({
    id: "test-tycoon-map",
    name: "Tycoon Teste",
    tags: ["tycoon", "test"],
    gameModeSettings: {
      mode: "tycoon",
      winCondition: { type: "completeTycoon", requireAll: true },
      tycoonSettings: {
        startingCash: 0,
        sharedCash: false,
        requireAllPurchasesToWin: true,
        winPurchaseIds: ["buy_wall"],
        autoClaimInSolo: true,
        generatorTickRateScale: 1,
      },
    },
    objects: [
      createObject("spawn", "spawn", {}, { x: 0, y: 0.5, z: 0 }),
      createObject("tycoonOwnerClaim", "claim", {
        tycoonId: "factory_1",
        autoClaimInSolo: true,
      }),
      createObject("tycoonCollector", "collector", {
        tycoonId: "factory_1",
        collectorId: "collector_1",
        collectRadius: 2,
        capacity: 1000,
      }),
      createObject("tycoonGenerator", "generator", {
        tycoonId: "factory_1",
        generatorId: "gen_1",
        incomePerTick: 5,
        tickInterval: 1,
        targetCollectorId: "collector_1",
      }),
      createObject("tycoonUnlockable", "wall", {
        tycoonId: "factory_1",
        startsLocked: true,
        lockedCollision: false,
      }),
      createObject("tycoonBuyButton", "button", {
        tycoonId: "factory_1",
        purchaseId: "buy_wall",
        cost: 25,
        unlockObjectIds: ["wall"],
      }),
    ],
  });
}

function createObject(
  type: string,
  id: string,
  properties: MapObjectProperties = {},
  position = { x: 0, y: 0.5, z: 0 },
  scale = { x: 1, y: 1, z: 1 }
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
