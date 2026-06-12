import * as THREE from "three";
import { beforeEach, describe, expect, it } from "vitest";
import { createMapObject3D } from "./ObjectFactory";
import { PhysicsSystem } from "./PhysicsSystem";
import { PlayerController } from "./PlayerController";
import { RuntimeMechanics } from "./RuntimeMechanics";
import { createMockAudioSystem } from "./testing/createMockAudioSystem";
import { createMockFeedbackSystem } from "./testing/createMockFeedbackSystem";
import { createMockHud } from "./testing/createMockHud";
import { createFreeplayTestMap, createRuntimeTestObject } from "./testing/createRuntimeTestMap";
import type { GameMap, GameMode, MapObjective } from "../shared/types/MapSchema";
import type {
  EnemyNetState,
  EnemyPositionUpdate,
  PlayerAttackPayload,
  PlayerAttackVisualPayload,
  PlayerHealRequestPayload,
  PlayerNetState,
} from "../shared/types/MultiplayerSchema";
import type { MapObject, Vector3 } from "../shared/types/ObjectSchema";
import type { LogicRule } from "../shared/types/ScriptSchema";

type MultiplayerRecorder = {
  enemyHits: Array<{ enemyObjectId: string; damage: number; weaponId?: string }>;
  enemyPositions: EnemyPositionUpdate[][];
  playerAttacks: PlayerAttackPayload[];
  playerAttackVisuals: PlayerAttackVisualPayload[];
  damageReports: Array<{ damage: number; source: "enemy" | "hazard" | "logic" }>;
  healRequests: PlayerHealRequestPayload[];
};

type RuntimeFixture = ReturnType<typeof createRuntimeFixture>;

beforeEach(() => {
  installLocalStorageShim();
});

describe("RuntimeMechanics enemy, combat and projectile protections", () => {
  it("inicializa inimigo com vida correta e aplica dano melee", () => {
    const enemy = createEnemy("enemy", { health: 30 });
    const fixture = createRuntimeFixture([enemy, createWeaponPickup("weapon_basic")]);

    equipWeapon(fixture);

    expect(fixture.mechanics.attack()).toBe(true);
    expect(hasMessage(fixture, "Inimigo: 12/30")).toBe(true);
    expect(fixture.objectViews.get("enemy")?.visible).toBe(true);
  });

  it("inimigo morre, fica invisivel, remove collider e completa objetivo", () => {
    const enemy = createEnemy("enemy", { health: 18, collision: true });
    const objectives: MapObjective[] = [
      {
        id: "defeat-enemy",
        title: "Derrote o inimigo",
        type: "defeatEnemies",
        targetAmount: 1,
        required: true,
        visible: true,
      },
    ];
    const fixture = createRuntimeFixture([enemy, createWeaponPickup("weapon_basic")], {
      objectives,
    });

    equipWeapon(fixture);
    expect(
      fixture.physicsSystem.getSolidColliders().some((collider) => collider.objectId === "enemy")
    ).toBe(true);

    expect(fixture.mechanics.attack()).toBe(true);

    expect(fixture.objectViews.get("enemy")?.visible).toBe(false);
    expect(
      fixture.physicsSystem.getSolidColliders().some((collider) => collider.objectId === "enemy")
    ).toBe(false);
    expect(hasMessage(fixture, "Inimigo derrotado")).toBe(true);
    expect(fixture.hud.objectives.at(-1)?.find((objective) => objective.id === "defeat-enemy"))
      .toEqual(expect.objectContaining({ completed: true, progress: 1, target: 1 }));
  });

  it("dispara onAllEnemiesDefeated apenas uma vez", () => {
    const logic: LogicRule[] = [
      {
        id: "all-enemies",
        name: "Todos os inimigos derrotados",
        enabled: true,
        trigger: { type: "onAllEnemiesDefeated" },
        conditions: [],
        actions: [{ type: "showMessage", message: "Todos derrotados" }],
      },
    ];
    const fixture = createRuntimeFixture([createEnemy("enemy_a"), createEnemy("enemy_b")], {
      logic,
    });

    fixture.mechanics.applyEnemyDefeated("enemy_a", false);
    fixture.mechanics.applyEnemyDefeated("enemy_b", false);
    fixture.mechanics.applyEnemyDefeated("enemy_b", false);

    expect(countMessages(fixture, "Todos derrotados")).toBe(1);
  });

  it("spawnEnemy via logica reativa inimigo derrotado", () => {
    const logic: LogicRule[] = [
      {
        id: "respawn-enemy",
        name: "Respawn enemy",
        enabled: true,
        trigger: { type: "onEnemyDefeated", objectId: "enemy" },
        conditions: [],
        actions: [{ type: "spawnEnemy", objectId: "enemy" }],
      },
    ];
    const fixture = createRuntimeFixture([createEnemy("enemy", { health: 18 })], { logic });

    fixture.mechanics.applyEnemyDefeated("enemy", false);

    expect(fixture.objectViews.get("enemy")?.visible).toBe(true);
    expect(hasMessage(fixture, "Inimigo reativado")).toBe(true);
  });

  it("restart restaura inimigos e limpa projeteis", () => {
    const fixture = createRuntimeFixture([
      createEnemy("enemy", { health: 18 }),
      createWeaponPickup("weapon_blaster"),
    ]);

    equipWeapon(fixture, "weapon_blaster");
    expect(fixture.mechanics.attack()).toBe(true);
    expect(countProjectiles(fixture.world)).toBe(1);

    fixture.mechanics.applyEnemyDefeated("enemy", false);
    fixture.mechanics.restart();

    expect(fixture.objectViews.get("enemy")?.visible).toBe(true);
    expect(countProjectiles(fixture.world)).toBe(0);
    expect(fixture.player.getHealth()).toBe(fixture.player.getMaxHealth());
  });

  it("inimigo ataca player quando perto e respeita cooldown", () => {
    const fixture = createRuntimeFixture([
      createEnemy("enemy", { damage: 12, attackRange: 2, attackCooldown: 1 }, { x: 0, y: 0.5, z: -1 }),
    ]);

    fixture.mechanics.update(0.1);
    const afterFirstAttack = fixture.player.getHealth();
    fixture.mechanics.update(0.1);
    const duringCooldown = fixture.player.getHealth();
    fixture.mechanics.update(1);

    expect(afterFirstAttack).toBe(88);
    expect(duringCooldown).toBe(afterFirstAttack);
    expect(fixture.player.getHealth()).toBe(76);
  });

  it("inimigo morto nao ataca player", () => {
    const fixture = createRuntimeFixture([
      createEnemy("enemy", { damage: 50, attackRange: 2 }, { x: 0, y: 0.5, z: -1 }),
    ]);

    fixture.mechanics.applyEnemyDefeated("enemy", false);
    fixture.mechanics.update(1);

    expect(fixture.player.getHealth()).toBe(100);
  });

  it("dano fatal de inimigo aciona fluxo de morte", () => {
    const fixture = createRuntimeFixture([
      createEnemy("enemy", { damage: 200, attackRange: 2 }, { x: 0, y: 0.5, z: -1 }),
    ]);

    fixture.mechanics.update(0.1);

    expect(fixture.hud.defeats.length).toBe(1);
    expect(fixture.audio.playedCues).toContain("death");
    expect(fixture.player.getHealth()).toBe(fixture.player.getMaxHealth());
    expect(fixture.hud.health).toContainEqual({ current: 0, max: 100 });
  });

  it("projetil ranged e criado, avanca e expira", () => {
    const fixture = createRuntimeFixture([createWeaponPickup("weapon_blaster")]);

    equipWeapon(fixture, "weapon_blaster");
    expect(fixture.mechanics.attack()).toBe(true);
    const projectile = getProjectiles(fixture.world)[0];
    const initialZ = projectile.position.z;

    fixture.mechanics.update(0.1);
    expect(projectile.position.z).toBeLessThan(initialZ);

    fixture.mechanics.update(1);
    expect(countProjectiles(fixture.world)).toBe(0);
  });

  it("projetil acerta inimigo vivo e ignora inimigo morto", () => {
    const fixture = createRuntimeFixture([
      createEnemy("enemy", { health: 40 }, { x: 0.24, y: 0.5, z: -2 }),
      createWeaponPickup("weapon_blaster"),
    ]);

    equipWeapon(fixture, "weapon_blaster");
    expect(fixture.mechanics.attack()).toBe(true);
    fixture.mechanics.update(0.1);
    expect(hasMessage(fixture, "Inimigo: 26/40")).toBe(true);

    fixture.mechanics.update(1);
    fixture.mechanics.applyEnemyDefeated("enemy", false);
    const messagesBeforeDeadShot = fixture.hud.messages.length;

    expect(fixture.mechanics.attack()).toBe(true);
    fixture.mechanics.update(0.1);

    expect(fixture.hud.messages.length).toBe(messagesBeforeDeadShot);
  });

  it("host multiplayer envia dano de inimigo sem aplicar estado final local", () => {
    const fixture = createRuntimeFixture(
      [createEnemy("enemy", { health: 18 }), createWeaponPickup("weapon_basic")],
      { multiplayer: { isHost: () => true } }
    );

    equipWeapon(fixture);
    expect(fixture.mechanics.attack()).toBe(true);

    expect(fixture.multiplayerEvents.enemyHits).toEqual([
      { enemyObjectId: "enemy", damage: 18, weaponId: "basic_sword" },
    ]);
    expect(fixture.objectViews.get("enemy")?.visible).toBe(true);
  });

  it("client multiplayer nao autoriza derrota final sozinho", () => {
    const fixture = createRuntimeFixture(
      [createEnemy("enemy", { health: 18 }), createWeaponPickup("weapon_basic")],
      { multiplayer: { isHost: () => false } }
    );

    equipWeapon(fixture);
    expect(fixture.mechanics.attack()).toBe(true);

    expect(fixture.multiplayerEvents.enemyHits).toHaveLength(1);
    expect(fixture.objectViews.get("enemy")?.visible).toBe(true);
    expect(hasMessage(fixture, "Inimigo derrotado")).toBe(false);
  });

  it("applyEnemyUpdated atualiza vida e posicao recebidas da rede", () => {
    const fixture = createRuntimeFixture([createEnemy("enemy", { health: 30 })], {
      multiplayer: { isHost: () => true },
    });

    fixture.mechanics.applyEnemyUpdated({
      objectId: "enemy",
      health: 20,
      maxHealth: 30,
      position: { x: 2, y: 0.5, z: -3 },
      rotationY: 0.75,
      state: "chase",
      alive: true,
      updatedAt: 1200,
    });

    expect(fixture.objectViews.get("enemy")?.position.x).toBeCloseTo(2);
    expect(fixture.objectViews.get("enemy")?.rotation.y).toBeCloseTo(0.75);
    expect(hasMessage(fixture, "Inimigo: 20/30")).toBe(true);
  });

  it("applyEnemyDefeated e idempotente", () => {
    const fixture = createRuntimeFixture([createEnemy("enemy", { health: 18 })], {
      gameMode: "combatArena",
    });

    fixture.mechanics.applyEnemyDefeated("enemy");
    const scoreAfterFirstDefeat = fixture.mechanics.getScore();
    fixture.mechanics.applyEnemyDefeated("enemy");

    expect(countMessages(fixture, "Inimigo derrotado")).toBe(1);
    expect(fixture.mechanics.getScore()).toBe(scoreAfterFirstDefeat);
  });

  it("visual remoto de ataque ranged cria projetil sem dano duplicado", () => {
    const fixture = createRuntimeFixture([
      createEnemy("enemy", { health: 18 }, { x: 0.24, y: 0.5, z: -2 }),
    ]);

    fixture.mechanics.applyRemoteAttackVisual({
      weaponId: "blaster",
      attackType: "shoot",
      origin: { x: 0.24, y: 1.58, z: -0.72 },
      direction: { x: 0, y: 0, z: -1 },
    });
    expect(countProjectiles(fixture.world)).toBe(1);

    fixture.mechanics.update(0.1);

    expect(fixture.objectViews.get("enemy")?.visible).toBe(true);
    expect(hasMessage(fixture, "Inimigo derrotado")).toBe(false);
    expect(countProjectiles(fixture.world)).toBe(1);
  });
});

function createRuntimeFixture(
  objects: MapObject[],
  options: {
    gameMode?: GameMode;
    objectives?: MapObjective[];
    logic?: LogicRule[];
    multiplayer?: Partial<{
      isHost: () => boolean;
      getLocalPlayerId: () => string | null;
      getRemotePlayers: () => PlayerNetState[];
    }>;
  } = {}
) {
  const map = createFreeplayTestMap(objects);
  map.objectives = options.objectives ?? [];
  map.logic = options.logic ?? [];
  map.gameModeSettings = {
    ...(map.gameModeSettings ?? { mode: "freeplay" }),
    mode: options.gameMode ?? "freeplay",
    winCondition:
      options.gameMode === "combatArena" ? { type: "defeatEnemies" } : { type: "none" },
  };

  const scene = new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world);
  const camera = new THREE.PerspectiveCamera();
  const physicsSystem = new PhysicsSystem();
  const objectViews = new Map<string, THREE.Object3D>();

  for (const object of map.objects) {
    const view = createMapObject3D(object);
    objectViews.set(object.id, view);
    world.add(view);
  }

  const player = new PlayerController(
    scene,
    camera,
    { focus: () => undefined } as HTMLElement,
    physicsSystem
  );
  player.setExternalCameraControl(true);
  player.setPosition(map.spawnPoint);
  player.resetVelocity();

  const hud = createMockHud();
  const audio = createMockAudioSystem();
  const feedback = createMockFeedbackSystem();
  const multiplayerEvents: MultiplayerRecorder = {
    enemyHits: [],
    enemyPositions: [],
    playerAttacks: [],
    playerAttackVisuals: [],
    damageReports: [],
    healRequests: [],
  };
  const multiplayer = options.multiplayer
    ? {
        isHost: options.multiplayer.isHost ?? (() => true),
        getLocalPlayerId: options.multiplayer.getLocalPlayerId ?? (() => "local-player"),
        getRemotePlayers: options.multiplayer.getRemotePlayers ?? (() => []),
        onEnemyHit: (enemyObjectId: string, damage: number, weaponId?: string) => {
          multiplayerEvents.enemyHits.push({ enemyObjectId, damage, weaponId });
        },
        onEnemyPositionUpdate: (enemies: EnemyPositionUpdate[]) => {
          multiplayerEvents.enemyPositions.push(enemies);
        },
        onPlayerAttack: (payload: PlayerAttackPayload) => {
          multiplayerEvents.playerAttacks.push(payload);
        },
        onPlayerAttackVisual: (payload: PlayerAttackVisualPayload) => {
          multiplayerEvents.playerAttackVisuals.push(payload);
        },
        onPlayerDamageReport: (damage: number, source: "enemy" | "hazard" | "logic") => {
          multiplayerEvents.damageReports.push({ damage, source });
        },
        onPlayerHealRequest: (payload: PlayerHealRequestPayload) => {
          multiplayerEvents.healRequests.push(payload);
        },
      }
    : undefined;

  const mechanics = new RuntimeMechanics(
    map as GameMap,
    world,
    objectViews,
    player,
    hud,
    physicsSystem,
    audio,
    feedback,
    {
      onRestart: () => undefined,
      onEdit: () => undefined,
      onMenu: () => undefined,
      multiplayer,
      getElapsedTime: () => 12,
    }
  );

  return {
    map,
    scene,
    world,
    objectViews,
    player,
    hud,
    audio,
    feedback,
    physicsSystem,
    mechanics,
    multiplayerEvents,
  };
}

function createEnemy(
  id: string,
  properties: MapObject["properties"] = {},
  position: Vector3 = { x: 0, y: 0.5, z: -1.2 }
): MapObject {
  return createRuntimeTestObject("enemy", id, {
    health: 30,
    damage: 10,
    speed: 0,
    detectionRange: 8,
    attackRange: 1.6,
    attackCooldown: 1,
    ...properties,
  }, position);
}

function createWeaponPickup(itemId = "weapon_basic"): MapObject {
  return createRuntimeTestObject(
    "itemPickup",
    `pickup-${itemId}`,
    { itemId },
    { x: 5, y: 0.5, z: 5 }
  );
}

function equipWeapon(fixture: RuntimeFixture, itemId = "weapon_basic"): void {
  const pickupId = `pickup-${itemId}`;
  expect(fixture.mechanics.interactWithObject(pickupId)).toBe(true);
  expect(fixture.mechanics.getEquippedWeaponId()).not.toBeNull();
}

function getProjectiles(world: THREE.Group): THREE.Object3D[] {
  return world.children.filter((child) => child.userData.weaponProjectile);
}

function countProjectiles(world: THREE.Group): number {
  return getProjectiles(world).length;
}

function hasMessage(fixture: RuntimeFixture, text: string): boolean {
  return fixture.hud.messages.some((message) => message.text === text);
}

function countMessages(fixture: RuntimeFixture, text: string): number {
  return fixture.hud.messages.filter((message) => message.text === text).length;
}

function installLocalStorageShim(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
  });
}
