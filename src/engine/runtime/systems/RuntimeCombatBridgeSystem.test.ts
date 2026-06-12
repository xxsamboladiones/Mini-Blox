import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createMapObject3D } from "../../ObjectFactory";
import { createMockAudioSystem } from "../../testing/createMockAudioSystem";
import { createMockFeedbackSystem } from "../../testing/createMockFeedbackSystem";
import { createMockHud } from "../../testing/createMockHud";
import { createRuntimeTestObject } from "../../testing/createRuntimeTestMap";
import type { EnemyRuntimeState } from "./RuntimeEnemySystem";
import {
  RuntimeCombatBridgeSystem,
  type EquippedWeapon,
} from "./RuntimeCombatBridgeSystem";
import type {
  PlayerAttackPayload,
  PlayerAttackVisualPayload,
  PlayerNetState,
} from "../../../shared/types/MultiplayerSchema";
import type { Vector3 } from "../../../shared/types/ObjectSchema";
import type { WeaponAttackType } from "../../../shared/types/ItemSchema";

describe("RuntimeCombatBridgeSystem", () => {
  it("ataque sem arma mostra mensagem e falha", () => {
    const fixture = createCombatFixture();

    expect(fixture.system.attack()).toBe(false);
    expect(fixture.hud.messages.at(-1)?.text).toBe("Pegue uma arma para atacar.");
    expect(fixture.messageCooldown).toBe(1);
  });

  it("equipWeapon atualiza player HUD e hasWeapon", () => {
    const fixture = createCombatFixture();

    fixture.system.equipWeapon("weapon_basic");

    expect(fixture.equippedPlayerWeaponIds).toEqual(["basic_sword"]);
    const weaponHudInfo = fixture.hud.weapons.at(-1);
    expect(typeof weaponHudInfo === "object" ? weaponHudInfo?.label : null).toBe("Espada Basica");
    expect(fixture.system.hasWeapon("basic_sword")).toBe(true);
    expect(fixture.system.getEquippedWeaponId()).toBe("basic_sword");
  });

  it("cooldown impede ataque repetido ate update liberar", () => {
    const fixture = createCombatFixture();

    fixture.system.equipWeapon("weapon_basic");

    expect(fixture.system.attack()).toBe(true);
    expect(fixture.system.attack()).toBe(false);
    fixture.system.update(1);
    expect(fixture.system.attack()).toBe(true);
  });

  it("ataque melee causa dano em inimigo no solo", () => {
    const enemy = createEnemyState("enemy", { x: 0, y: 0.5, z: -1 });
    const fixture = createCombatFixture({ enemies: [enemy] });

    fixture.system.equipWeapon("weapon_basic");
    fixture.system.attack();

    expect(fixture.enemyDamageEvents).toEqual([{ enemyObjectId: "enemy", amount: 18 }]);
  });

  it("ataque melee multiplayer envia enemyHit em vez de dano local", () => {
    const enemy = createEnemyState("enemy", { x: 0, y: 0.5, z: -1 });
    const fixture = createCombatFixture({ enemies: [enemy], isMultiplayer: true });

    fixture.system.equipWeapon("weapon_basic");
    fixture.system.attack();

    expect(fixture.enemyHitEvents).toEqual([
      { enemyObjectId: "enemy", damage: 18, weaponId: "basic_sword" },
    ]);
    expect(fixture.enemyDamageEvents).toEqual([]);
  });

  it("ataque ranged cria projetil e envia visual multiplayer", () => {
    const fixture = createCombatFixture({ isMultiplayer: true });

    fixture.system.equipWeapon("weapon_blaster");
    fixture.system.attack();

    expect(fixture.projectileSpawns).toHaveLength(1);
    expect(fixture.projectileSpawns[0]?.weapon.id).toBe("blaster");
    expect(fixture.attackVisualEvents).toHaveLength(1);
    expect(fixture.attackVisualEvents[0]?.weaponId).toBe("blaster");
  });

  it("ataque melee pode acertar player remoto em multiplayer", () => {
    const fixture = createCombatFixture({
      isMultiplayer: true,
      remotePlayers: [createRemotePlayer("remote", { x: 0, y: 0.5, z: -1 })],
    });

    fixture.system.equipWeapon("weapon_basic");
    fixture.system.attack();

    expect(fixture.playerAttackEvents).toHaveLength(1);
    expect(fixture.playerAttackEvents[0]?.targetPlayerId).toBe("remote");
  });

  it("reset limpa arma equipada e cooldown", () => {
    const fixture = createCombatFixture();

    fixture.system.equipWeapon("weapon_basic");
    fixture.system.attack();
    fixture.system.reset();

    expect(fixture.system.getEquippedWeaponId()).toBeNull();
    expect(fixture.equippedPlayerWeaponIds.at(-1)).toBeNull();
    expect(fixture.hud.weapons.at(-1)).toBeNull();
  });
});

function createCombatFixture(
  options: {
    enemies?: EnemyRuntimeState[];
    isMultiplayer?: boolean;
    remotePlayers?: PlayerNetState[];
  } = {}
) {
  const hud = createMockHud();
  const audio = createMockAudioSystem();
  const feedback = createMockFeedbackSystem();
  const objectViews = new Map<string, THREE.Object3D>();
  const equippedPlayerWeaponIds: Array<string | null> = [];
  const playerAttackEvents: PlayerAttackPayload[] = [];
  const attackVisualEvents: PlayerAttackVisualPayload[] = [];
  const enemyDamageEvents: Array<{ enemyObjectId: string; amount: number }> = [];
  const enemyHitEvents: Array<{ enemyObjectId: string; damage: number; weaponId?: string }> = [];
  const projectileSpawns: Array<{
    origin: Vector3;
    direction: THREE.Vector3;
    weapon: EquippedWeapon;
    local: boolean;
  }> = [];
  let messageCooldown = 0;

  for (const enemy of options.enemies ?? []) {
    objectViews.set(enemy.mapObject.id, createMapObject3D(enemy.mapObject));
    objectViews.get(enemy.mapObject.id)?.position.copy(enemy.spawnPosition);
  }

  const system = new RuntimeCombatBridgeSystem({
    hud,
    audio,
    feedback,
    objectViews,
    projectileSystem: {
      spawnProjectile: (origin, direction, weapon, local) => {
        projectileSpawns.push({ origin, direction: direction.clone(), weapon, local });
        return "projectile";
      },
    },
    getEnemyStates: () => options.enemies ?? [],
    getRemotePlayers: () => options.remotePlayers ?? [],
    getPlayerPosition: () => ({ x: 0, y: 0.5, z: 0 }),
    getPlayerForwardDirection: () => new THREE.Vector3(0, 0, -1),
    setPlayerEquippedWeapon: (weaponId) => equippedPlayerWeaponIds.push(weaponId),
    playPlayerAttackFeedback: () => undefined,
    isGameFinished: () => false,
    getDeathCooldown: () => 0,
    getMessageCooldown: () => messageCooldown,
    setMessageCooldown: (value) => {
      messageCooldown = value;
    },
    isMultiplayerEnabled: () => options.isMultiplayer === true,
    damageEnemy: (state, amount) =>
      enemyDamageEvents.push({ enemyObjectId: state.mapObject.id, amount }),
    onEnemyHit: (enemyObjectId, damage, weaponId) =>
      enemyHitEvents.push({ enemyObjectId, damage, weaponId }),
    onPlayerAttack: (payload) => playerAttackEvents.push(payload),
    onPlayerAttackVisual: (payload) => attackVisualEvents.push(payload),
  });

  return {
    system,
    hud,
    audio,
    feedback,
    objectViews,
    equippedPlayerWeaponIds,
    playerAttackEvents,
    attackVisualEvents,
    enemyDamageEvents,
    enemyHitEvents,
    projectileSpawns,
    get messageCooldown() {
      return messageCooldown;
    },
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
