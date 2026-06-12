import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createMapObject3D } from "../../ObjectFactory";
import type { ProjectileWeapon } from "../../mechanics/ProjectileMechanics";
import type { EnemyRuntimeState } from "./RuntimeEnemySystem";
import { RuntimeProjectileSystem } from "./RuntimeProjectileSystem";
import { createRuntimeTestObject } from "../../testing/createRuntimeTestMap";
import type { PlayerAttackPayload, PlayerNetState } from "../../../shared/types/MultiplayerSchema";
import type { MapObject, Vector3 } from "../../../shared/types/ObjectSchema";
import type { WeaponAttackType } from "../../../shared/types/ItemSchema";

type TestWeapon = ProjectileWeapon & {
  attackType: WeaponAttackType;
};

describe("RuntimeProjectileSystem", () => {
  it("cria projetil ranged e avanca no update", () => {
    const fixture = createProjectileFixture();

    fixture.system.spawnProjectile({ x: 0, y: 1, z: 0 }, new THREE.Vector3(1, 0, 0), testWeapon(), true);
    fixture.system.update(1);

    expect(fixture.system.getProjectileCount()).toBe(1);
    expect(fixture.world.children[0]?.position.x).toBeCloseTo(5);
  });

  it("remove projetil quando range expira", () => {
    const fixture = createProjectileFixture();

    fixture.system.spawnProjectile({ x: 0, y: 1, z: 0 }, new THREE.Vector3(1, 0, 0), testWeapon(), true);
    fixture.system.update(3);

    expect(fixture.system.getProjectileCount()).toBe(0);
    expect(fixture.world.children).toHaveLength(0);
  });

  it("projetil local acerta inimigo em solo", () => {
    const enemy = createEnemyState("enemy", { x: 2, y: 0.5, z: 0 });
    const fixture = createProjectileFixture({ enemies: [enemy] });

    fixture.system.spawnProjectile({ x: 0, y: 1, z: 0 }, new THREE.Vector3(1, 0, 0), testWeapon(), true);
    fixture.system.update(0.4);

    expect(fixture.enemyDamageEvents).toEqual([{ enemyObjectId: "enemy", amount: 7 }]);
    expect(fixture.system.getProjectileCount()).toBe(0);
  });

  it("projetil nao acerta inimigo morto", () => {
    const enemy = createEnemyState("enemy", { x: 2, y: 0.5, z: 0 });
    enemy.health = 0;
    const fixture = createProjectileFixture({ enemies: [enemy] });

    fixture.system.spawnProjectile({ x: 0, y: 1, z: 0 }, new THREE.Vector3(1, 0, 0), testWeapon(), true);
    fixture.system.update(0.4);

    expect(fixture.enemyDamageEvents).toEqual([]);
    expect(fixture.system.getProjectileCount()).toBe(1);
  });

  it("em multiplayer envia hit de inimigo em vez de aplicar dano local", () => {
    const enemy = createEnemyState("enemy", { x: 2, y: 0.5, z: 0 });
    const fixture = createProjectileFixture({ enemies: [enemy], isMultiplayer: true });

    fixture.system.spawnProjectile({ x: 0, y: 1, z: 0 }, new THREE.Vector3(1, 0, 0), testWeapon(), true);
    fixture.system.update(0.4);

    expect(fixture.enemyHitEvents).toEqual([{ enemyObjectId: "enemy", damage: 7, weaponId: "test_blaster" }]);
    expect(fixture.enemyDamageEvents).toEqual([]);
  });

  it("projetil local pode acertar player remoto em multiplayer", () => {
    const fixture = createProjectileFixture({
      isMultiplayer: true,
      remotePlayers: [createRemotePlayer("remote", { x: 2, y: 0.5, z: 0 })],
    });

    fixture.system.spawnProjectile({ x: 0, y: 1, z: 0 }, new THREE.Vector3(1, 0, 0), testWeapon(), true);
    fixture.system.update(0.4);

    expect(fixture.playerAttackEvents).toHaveLength(1);
    expect(fixture.playerAttackEvents[0]?.targetPlayerId).toBe("remote");
    expect(fixture.system.getProjectileCount()).toBe(0);
  });

  it("reset limpa projeteis ativos", () => {
    const fixture = createProjectileFixture();

    fixture.system.spawnProjectile({ x: 0, y: 1, z: 0 }, new THREE.Vector3(1, 0, 0), testWeapon(), true);
    fixture.system.reset();

    expect(fixture.system.getProjectileCount()).toBe(0);
    expect(fixture.world.children).toHaveLength(0);
  });
});

function createProjectileFixture(
  options: {
    enemies?: EnemyRuntimeState[];
    isMultiplayer?: boolean;
    remotePlayers?: PlayerNetState[];
  } = {}
) {
  const world = new THREE.Group();
  const objectViews = new Map<string, THREE.Object3D>();
  const enemyDamageEvents: Array<{ enemyObjectId: string; amount: number }> = [];
  const enemyHitEvents: Array<{ enemyObjectId: string; damage: number; weaponId?: string }> = [];
  const playerAttackEvents: PlayerAttackPayload[] = [];

  for (const enemy of options.enemies ?? []) {
    objectViews.set(enemy.mapObject.id, createMapObject3D(enemy.mapObject));
    objectViews.get(enemy.mapObject.id)?.position.copy(enemy.spawnPosition);
  }

  const system = new RuntimeProjectileSystem<TestWeapon>({
    world,
    objectViews,
    createProjectileVisual: () => new THREE.Object3D(),
    getEnemyStates: () => options.enemies ?? [],
    getRemotePlayers: () => options.remotePlayers ?? [],
    isMultiplayerEnabled: () => options.isMultiplayer === true,
    damageEnemy: (state, amount) =>
      enemyDamageEvents.push({ enemyObjectId: state.mapObject.id, amount }),
    onEnemyHit: (enemyObjectId, damage, weaponId) =>
      enemyHitEvents.push({ enemyObjectId, damage, weaponId }),
    onPlayerAttack: (payload) => playerAttackEvents.push(payload),
  });

  return {
    world,
    objectViews,
    system,
    enemyDamageEvents,
    enemyHitEvents,
    playerAttackEvents,
  };
}

function createEnemyState(id: string, position: Vector3): EnemyRuntimeState {
  const mapObject = createRuntimeTestObject(
    "enemy",
    id,
    { health: 30 },
    position,
    { x: 1, y: 1.6, z: 1 }
  );

  return {
    mapObject,
    spawnPosition: new THREE.Vector3(position.x, position.y, position.z),
    health: 30,
    maxHealth: 30,
    attackCooldown: 0,
    patrolTarget: 1,
    targetPosition: new THREE.Vector3(position.x, position.y, position.z),
    targetRotationY: 0,
    netState: "idle",
  };
}

function createRemotePlayer(id: string, position: Vector3): PlayerNetState {
  return {
    id,
    name: "Remote",
    teamId: null,
    position,
    rotationY: 0,
    health: 100,
    maxHealth: 100,
    equippedWeaponId: null,
    score: 0,
    isAlive: true,
  };
}

function testWeapon(): TestWeapon {
  return {
    id: "test_blaster",
    damage: 7,
    range: 10,
    projectileSpeed: 5,
    attackType: "shoot",
  };
}
