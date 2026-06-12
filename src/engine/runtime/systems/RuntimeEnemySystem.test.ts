import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createMapObject3D } from "../../ObjectFactory";
import { createMockAudioSystem } from "../../testing/createMockAudioSystem";
import { createMockFeedbackSystem } from "../../testing/createMockFeedbackSystem";
import { createMockHud } from "../../testing/createMockHud";
import { createMockPhysicsSystem } from "../../testing/createMockPhysicsSystem";
import { createFreeplayTestMap, createRuntimeTestObject } from "../../testing/createRuntimeTestMap";
import { createPlayerBounds } from "../../testing/simulateRuntimeTicks";
import { RuntimeSystemManager } from "../core/RuntimeSystemManager";
import { RuntimeEnemySystem, type RuntimeEnemyLogicEvent } from "./RuntimeEnemySystem";
import type { GameMap } from "../../../shared/types/MapSchema";
import type { EnemyNetState, EnemyPositionUpdate, PlayerNetState } from "../../../shared/types/MultiplayerSchema";
import type { MapObject, Vector3 } from "../../../shared/types/ObjectSchema";

describe("RuntimeEnemySystem", () => {
  it("inicializa inimigo com vida correta", () => {
    const enemy = createEnemy("enemy", { health: 35 });
    const fixture = createEnemyFixture([enemy]);

    const state = fixture.system.getEnemyState("enemy");

    expect(state?.health).toBe(35);
    expect(state?.maxHealth).toBe(35);
    expect(state?.netState).toBe("chase");
    expect(fixture.system.getTotalEnemyCount()).toBe(1);
  });

  it("reset restaura vida, visibilidade e collider", () => {
    const enemy = createEnemy("enemy", { health: 20 });
    const fixture = createEnemyFixture([enemy]);

    fixture.system.applyEnemyDefeated("enemy");
    fixture.system.reset();

    expect(fixture.system.getEnemyState("enemy")?.health).toBe(20);
    expect(fixture.system.isEnemyDefeated("enemy")).toBe(false);
    expect(fixture.objectViews.get("enemy")?.visible).toBe(true);
    expect(fixture.physics.hasCollider("enemy")).toBe(true);
  });

  it("spawnEnemy reativa inimigo derrotado", () => {
    const enemy = createEnemy("enemy", { health: 20 });
    const fixture = createEnemyFixture([enemy]);

    fixture.system.applyEnemyDefeated("enemy");
    const spawned = fixture.system.spawnEnemy("enemy");

    expect(spawned).toBe(true);
    expect(fixture.system.getEnemyState("enemy")?.health).toBe(20);
    expect(fixture.system.isEnemyDefeated("enemy")).toBe(false);
    expect(fixture.enabledChanges).toEqual([{ objectId: "enemy", enabled: true }]);
    expect(fixture.hud.messages.at(-1)?.text).toBe("Inimigo reativado");
  });

  it("applyEnemyDefeated deixa inimigo invisivel", () => {
    const enemy = createEnemy("enemy");
    const fixture = createEnemyFixture([enemy]);

    fixture.system.applyEnemyDefeated("enemy");

    expect(fixture.objectViews.get("enemy")?.visible).toBe(false);
  });

  it("applyEnemyDefeated remove collider", () => {
    const enemy = createEnemy("enemy");
    const fixture = createEnemyFixture([enemy]);

    fixture.system.applyEnemyDefeated("enemy");

    expect(fixture.physics.hasCollider("enemy")).toBe(false);
    expect(fixture.physics.colliderRemovals).toEqual(["enemy"]);
  });

  it("applyEnemyDefeated e idempotente", () => {
    const enemy = createEnemy("enemy");
    const fixture = createEnemyFixture([enemy]);

    fixture.system.applyEnemyDefeated("enemy");
    fixture.system.applyEnemyDefeated("enemy");

    expect(fixture.system.getDefeatedEnemyCount()).toBe(1);
    expect(fixture.objectiveCalls).toHaveLength(1);
    expect(fixture.gameModeCalls).toHaveLength(1);
    expect(fixture.hud.messages.map((message) => message.text)).toEqual(["Inimigo derrotado"]);
  });

  it("dispara objetivos game mode e eventos de logica ao derrotar inimigo", () => {
    const enemy = createEnemy("enemy");
    const fixture = createEnemyFixture([enemy]);

    fixture.system.applyEnemyDefeated("enemy");

    expect(fixture.objectiveCalls).toEqual([{ defeatedCount: 1, totalEnemies: 1 }]);
    expect(fixture.gameModeCalls).toEqual([{ defeatedCount: 1, totalEnemies: 1 }]);
    expect(fixture.logicEvents).toEqual([
      { type: "onEnemyDefeated", objectId: "enemy" },
      { type: "onAnyEnemyDefeated", objectId: "enemy" },
      { type: "onAllEnemiesDefeated" },
    ]);
  });

  it("applyEnemyUpdated reduz vida e mostra feedback", () => {
    const enemy = createEnemy("enemy", { health: 40 });
    const fixture = createEnemyFixture([enemy]);

    fixture.system.applyEnemyUpdated(createEnemyNetState("enemy", { health: 18, maxHealth: 40 }));

    expect(fixture.system.getEnemyState("enemy")?.health).toBe(18);
    expect(fixture.audio.playedCues).toEqual(["hit"]);
    expect(fixture.feedback.spawns.at(-1)?.cue).toBe("damage");
    expect(fixture.hud.messages.at(-1)?.text).toBe("Inimigo: 18/40");
  });

  it("applyEnemyUpdated morto derrota inimigo", () => {
    const enemy = createEnemy("enemy", { health: 40 });
    const fixture = createEnemyFixture([enemy]);

    fixture.system.applyEnemyUpdated(
      createEnemyNetState("enemy", { health: 0, maxHealth: 40, alive: false, state: "dead" })
    );

    expect(fixture.system.isEnemyDefeated("enemy")).toBe(true);
    expect(fixture.objectViews.get("enemy")?.visible).toBe(false);
    expect(fixture.objectiveCalls).toEqual([{ defeatedCount: 1, totalEnemies: 1 }]);
  });

  it("applyEnemyUpdated atualiza posicao e rotacao quando host", () => {
    const enemy = createEnemy("enemy", { health: 40 });
    const fixture = createEnemyFixture([enemy], { isHost: true });

    fixture.system.applyEnemyUpdated(
      createEnemyNetState("enemy", {
        health: 40,
        maxHealth: 40,
        position: { x: 5, y: 0.5, z: -2 },
        rotationY: 1.25,
      })
    );

    expect(fixture.objectViews.get("enemy")?.position.x).toBeCloseTo(5);
    expect(fixture.objectViews.get("enemy")?.position.z).toBeCloseTo(-2);
    expect(fixture.objectViews.get("enemy")?.rotation.y).toBeCloseTo(1.25);
  });

  it("getDefeatedEnemyCount acompanha inimigos derrotados", () => {
    const fixture = createEnemyFixture([createEnemy("enemy_a"), createEnemy("enemy_b")]);

    fixture.system.applyEnemyDefeated("enemy_a");

    expect(fixture.system.getDefeatedEnemyCount()).toBe(1);
    expect(fixture.system.getTotalEnemyCount()).toBe(2);
  });

  it("isEnemyDefeated reflete estado atual", () => {
    const fixture = createEnemyFixture([createEnemy("enemy")]);

    expect(fixture.system.isEnemyDefeated("enemy")).toBe(false);
    fixture.system.applyEnemyDefeated("enemy");
    expect(fixture.system.isEnemyDefeated("enemy")).toBe(true);
  });

  it("dispara onAllEnemiesDefeated apenas uma vez", () => {
    const fixture = createEnemyFixture([createEnemy("enemy_a"), createEnemy("enemy_b")]);

    fixture.system.applyEnemyDefeated("enemy_a");
    fixture.system.applyEnemyDefeated("enemy_b");
    fixture.system.applyEnemyDefeated("enemy_b");

    expect(fixture.logicEvents.filter((event) => event.type === "onAllEnemiesDefeated")).toHaveLength(
      1
    );
  });

  it("mapa sem inimigos nao quebra", () => {
    const cube = createRuntimeTestObject("cube", "cube");
    const fixture = createEnemyFixture([cube]);

    expect(() => fixture.system.reset()).not.toThrow();
    expect(fixture.system.getTotalEnemyCount()).toBe(0);
    expect(fixture.system.getAliveEnemyStates()).toEqual([]);
  });

  it("RuntimeSystemManager registra e reseta o sistema corretamente", () => {
    const fixture = createEnemyFixture([createEnemy("enemy")]);
    const manager = new RuntimeSystemManager();

    manager.register(fixture.system);
    fixture.system.applyEnemyDefeated("enemy");
    manager.reset();

    expect(manager.getSystem("enemies")).toBe(fixture.system);
    expect(fixture.system.isEnemyDefeated("enemy")).toBe(false);
    expect(fixture.objectViews.get("enemy")?.visible).toBe(true);
  });

  it("chase move inimigo em direcao ao player", () => {
    const enemy = createEnemy("enemy", { speed: 2, detectionRange: 10 }, { x: 0, y: 0.5, z: 0 });
    const fixture = createEnemyFixture([enemy], {
      playerPosition: { x: 5, y: 0.5, z: 0 },
    });

    fixture.system.update(1);

    expect(fixture.objectViews.get("enemy")?.position.x).toBeCloseTo(2);
    expect(fixture.objectViews.get("enemy")?.position.z).toBeCloseTo(0);
  });

  it("idle nao persegue player", () => {
    const enemy = createEnemy(
      "enemy",
      { behavior: "idle", speed: 5, detectionRange: 10 },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createEnemyFixture([enemy], {
      playerPosition: { x: 5, y: 0.5, z: 0 },
    });

    fixture.system.update(1);

    expect(fixture.objectViews.get("enemy")?.position.x).toBeCloseTo(0);
  });

  it("patrol alterna entre spawn e patrolOffset", () => {
    const enemy = createEnemy(
      "enemy",
      {
        behavior: "patrol",
        speed: 10,
        patrolOffset: { x: 4, y: 0, z: 0 },
      },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createEnemyFixture([enemy], {
      playerPosition: { x: 20, y: 0.5, z: 0 },
    });

    fixture.system.update(0.5);
    expect(fixture.objectViews.get("enemy")?.position.x).toBeCloseTo(4);

    fixture.system.update(0.1);
    fixture.system.update(0.1);
    expect(fixture.objectViews.get("enemy")?.position.x).toBeLessThan(4);
  });

  it("inimigo ataca player quando perto e respeita cooldown", () => {
    const enemy = createEnemy(
      "enemy",
      { damage: 12, attackCooldown: 0.5, attackRange: 1.5, speed: 0 },
      { x: 0, y: 0.5, z: 0 }
    );
    const fixture = createEnemyFixture([enemy], {
      playerPosition: { x: 0.2, y: 0.5, z: 0 },
    });

    fixture.system.update(0.016);
    fixture.system.update(0.016);
    fixture.system.update(0.5);

    expect(fixture.damageEvents).toEqual([
      { amount: 12, message: "Inimigo causou dano", position: enemy.position },
      { amount: 12, message: "Inimigo causou dano", position: enemy.position },
    ]);
  });

  it("inimigo morto nao ataca", () => {
    const enemy = createEnemy("enemy", { damage: 12, attackRange: 2 }, { x: 0, y: 0.5, z: 0 });
    const fixture = createEnemyFixture([enemy], {
      playerPosition: { x: 0.2, y: 0.5, z: 0 },
    });

    fixture.system.applyEnemyDefeated("enemy");
    fixture.system.update(1);

    expect(fixture.damageEvents).toEqual([]);
  });

  it("cliente multiplayer interpola inimigo recebido pela rede", () => {
    const enemy = createEnemy("enemy", { speed: 2 }, { x: 0, y: 0.5, z: 0 });
    const fixture = createEnemyFixture([enemy], {
      isMultiplayer: true,
      isHost: false,
      playerPosition: { x: 50, y: 0.5, z: 0 },
    });

    fixture.system.applyEnemyUpdated(
      createEnemyNetState("enemy", {
        position: { x: 10, y: 0.5, z: 0 },
        rotationY: 1,
      }),
      false
    );
    fixture.system.update(0.1);

    expect(fixture.objectViews.get("enemy")?.position.x).toBeCloseTo(8);
    expect(fixture.objectViews.get("enemy")?.rotation.y).toBeCloseTo(0.8);
  });

  it("host multiplayer envia updates de posicao com throttle", () => {
    const enemy = createEnemy("enemy", { speed: 2, detectionRange: 10 }, { x: 0, y: 0.5, z: 0 });
    const fixture = createEnemyFixture([enemy], {
      isMultiplayer: true,
      isHost: true,
      playerPosition: { x: 5, y: 0.5, z: 0 },
    });

    fixture.system.update(0.1);
    fixture.system.update(0.05);

    expect(fixture.enemyPositionUpdates).toHaveLength(1);
    expect(fixture.enemyPositionUpdates[0]?.[0]?.objectId).toBe("enemy");
    expect(fixture.enemyPositionUpdates[0]?.[0]?.position.x).toBeGreaterThan(0);
  });
});

function createEnemyFixture(
  objects: MapObject[],
  options: {
    isHost?: boolean;
    isMultiplayer?: boolean;
    playerPosition?: Vector3;
    deathCooldown?: number;
    remotePlayers?: PlayerNetState[];
  } = {}
): {
  map: GameMap;
  objectViews: Map<string, THREE.Object3D>;
  physics: ReturnType<typeof createMockPhysicsSystem>;
  hud: ReturnType<typeof createMockHud>;
  audio: ReturnType<typeof createMockAudioSystem>;
  feedback: ReturnType<typeof createMockFeedbackSystem>;
  system: RuntimeEnemySystem;
  objectiveCalls: Array<{ defeatedCount: number; totalEnemies: number }>;
  gameModeCalls: Array<{ defeatedCount: number; totalEnemies: number }>;
  logicEvents: RuntimeEnemyLogicEvent[];
  enabledChanges: Array<{ objectId: string; enabled: boolean }>;
  damageEvents: Array<{ amount: number; message: string; position: Vector3 }>;
  enemyPositionUpdates: EnemyPositionUpdate[][];
} {
  const map = createFreeplayTestMap(objects);
  const objectViews = new Map<string, THREE.Object3D>();

  for (const mapObject of map.objects) {
    objectViews.set(mapObject.id, createMapObject3D(mapObject));
  }

  const physics = createMockPhysicsSystem();
  for (const mapObject of map.objects) {
    const view = objectViews.get(mapObject.id);
    if (view) {
      physics.updateColliderForObject(mapObject, view);
    }
  }

  const hud = createMockHud();
  const audio = createMockAudioSystem();
  const feedback = createMockFeedbackSystem();
  const objectiveCalls: Array<{ defeatedCount: number; totalEnemies: number }> = [];
  const gameModeCalls: Array<{ defeatedCount: number; totalEnemies: number }> = [];
  const logicEvents: RuntimeEnemyLogicEvent[] = [];
  const enabledChanges: Array<{ objectId: string; enabled: boolean }> = [];
  const damageEvents: Array<{ amount: number; message: string; position: Vector3 }> = [];
  const enemyPositionUpdates: EnemyPositionUpdate[][] = [];
  const playerPosition = options.playerPosition ?? { x: 0, y: 0.5, z: 0 };

  const system = new RuntimeEnemySystem({
    map,
    objectViews,
    physicsSystem: physics,
    hud,
    audio,
    feedback,
    isHost: () => options.isHost === true,
    isMultiplayerEnabled: () => options.isMultiplayer === true,
    getLocalPlayerId: () => "local-player",
    getRemotePlayers: () => options.remotePlayers ?? [],
    getPlayerPosition: () => playerPosition,
    getPlayerBounds: () => createPlayerBounds(playerPosition, { x: 1, y: 1.8, z: 1 }),
    getDeathCooldown: () => options.deathCooldown ?? 0,
    damagePlayer: (amount, message, position) => damageEvents.push({ amount, message, position }),
    onEnemyPositionUpdate: (enemies) => enemyPositionUpdates.push(enemies),
    setObjectRuntimeEnabled: (objectId, enabled) => enabledChanges.push({ objectId, enabled }),
    onEnemyDefeated: (defeatedCount, totalEnemies) =>
      objectiveCalls.push({ defeatedCount, totalEnemies }),
    onGameModeEnemyDefeated: (defeatedCount, totalEnemies) =>
      gameModeCalls.push({ defeatedCount, totalEnemies }),
    onLogicEvent: (event) => logicEvents.push(event),
  });

  return {
    map,
    objectViews,
    physics,
    hud,
    audio,
    feedback,
    system,
    objectiveCalls,
    gameModeCalls,
    logicEvents,
    enabledChanges,
    damageEvents,
    enemyPositionUpdates,
  };
}

function createEnemy(
  id: string,
  properties: MapObject["properties"] = {},
  position: Vector3 = { x: 0, y: 0.5, z: 0 }
): MapObject {
  return createRuntimeTestObject(
    "enemy",
    id,
    {
      health: 50,
      damage: 10,
      behavior: "chase",
      ...properties,
    },
    position,
    { x: 1, y: 1.6, z: 1 }
  );
}

function createEnemyNetState(
  objectId: string,
  overrides: Partial<EnemyNetState> = {}
): EnemyNetState {
  return {
    objectId,
    position: { x: 0, y: 0.5, z: 0 },
    rotationY: 0,
    health: 50,
    maxHealth: 50,
    alive: true,
    state: "chase",
    updatedAt: Date.now(),
    ...overrides,
  };
}
