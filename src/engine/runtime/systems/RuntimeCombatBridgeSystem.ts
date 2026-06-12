import * as THREE from "three";
import { getWeaponDefinition, getWeaponLabel, normalizeWeaponId } from "../../../shared/ItemCatalog";
import type {
  PlayerAttackPayload,
  PlayerAttackVisualPayload,
  PlayerNetState,
} from "../../../shared/types/MultiplayerSchema";
import type { Vector3 } from "../../../shared/types/ObjectSchema";
import type {
  WeaponAttackType,
  WeaponClass,
  WeaponDefinition,
} from "../../../shared/types/ItemSchema";
import type { AudioSystem } from "../../AudioSystem";
import type { FeedbackSystem } from "../../FeedbackSystem";
import type { RuntimeHud } from "../../RuntimeHud";
import { RuntimeCombatSystem } from "../RuntimeCombatSystem";
import type { RuntimeSystem } from "../core/RuntimeSystem";
import type { EnemyRuntimeState } from "./RuntimeEnemySystem";
import type { RuntimeProjectileWeapon } from "./RuntimeProjectileSystem";

export type EquippedWeapon = RuntimeProjectileWeapon & {
  itemId: string;
  label: string;
  weaponClass: WeaponClass;
  attackType: WeaponAttackType;
  cooldown: number;
  coneDot: number;
};

export type RuntimeProjectileSpawner = {
  spawnProjectile: (
    origin: Vector3,
    direction: THREE.Vector3,
    weapon: EquippedWeapon,
    local: boolean
  ) => string | null;
};

export type RuntimeCombatBridgeSystemOptions = {
  hud: RuntimeHud;
  audio: AudioSystem;
  feedback: FeedbackSystem;
  enableLifecycleUpdate?: boolean;
  objectViews: Map<string, THREE.Object3D>;
  projectileSystem: RuntimeProjectileSpawner;
  getEnemyStates: () => EnemyRuntimeState[];
  getRemotePlayers: () => PlayerNetState[];
  getPlayerPosition: () => Vector3;
  getPlayerForwardDirection: () => THREE.Vector3;
  setPlayerEquippedWeapon: (weaponId: string | null) => void;
  playPlayerAttackFeedback: (attackType: WeaponAttackType) => void;
  isGameFinished: () => boolean;
  getDeathCooldown: () => number;
  getMessageCooldown: () => number;
  setMessageCooldown: (cooldownSeconds: number) => void;
  isMultiplayerEnabled: () => boolean;
  damageEnemy: (state: EnemyRuntimeState, amount: number) => void;
  onEnemyHit: (enemyObjectId: string, damage: number, weaponId?: string) => void;
  onPlayerAttack: (payload: PlayerAttackPayload) => void;
  onPlayerAttackVisual: (payload: PlayerAttackVisualPayload) => void;
};

const UP = new THREE.Vector3(0, 1, 0);
const DEFAULT_WEAPON: EquippedWeapon = {
  id: "basic_sword",
  itemId: "weapon_basic",
  label: "Espada Basica",
  weaponClass: "melee",
  attackType: "slash",
  damage: 18,
  range: 1.85,
  cooldown: 0.65,
  projectileSpeed: 0,
  coneDot: 0.18,
};

export class RuntimeCombatBridgeSystem implements RuntimeSystem {
  readonly id = "combat-bridge";

  private readonly combatSystem = new RuntimeCombatSystem();
  private equippedWeapon: EquippedWeapon | null = null;

  constructor(private readonly options: RuntimeCombatBridgeSystemOptions) {}

  update(deltaSeconds: number): void {
    if (this.options.enableLifecycleUpdate === false) {
      return;
    }

    this.updateCombat(deltaSeconds);
  }

  updateCombat(deltaSeconds: number): void {
    this.combatSystem.update(deltaSeconds);
    this.updateWeaponCooldownHud();
  }

  reset(): void {
    this.combatSystem.reset();
    this.equippedWeapon = null;
    this.options.setPlayerEquippedWeapon(null);
    this.options.hud.setWeapon(null);
  }

  getEquippedWeaponId(): string | null {
    return this.equippedWeapon?.id ?? null;
  }

  hasWeapon(weaponId: string): boolean {
    return this.equippedWeapon?.id === normalizeWeaponId(weaponId);
  }

  equipWeapon(itemId: string): EquippedWeapon {
    const definition = getWeaponDefinition(itemId);
    const weapon = definition ? createEquippedWeaponFromDefinition(definition) : DEFAULT_WEAPON;

    this.equippedWeapon = weapon;
    this.options.setPlayerEquippedWeapon(weapon.id);
    this.options.hud.setWeapon({
      label: weapon.label,
      typeLabel: getWeaponHudTypeLabel(weapon),
      cooldownProgress: 1,
    });
    return weapon;
  }

  attack(): boolean {
    if (this.options.isGameFinished() || this.options.getDeathCooldown() > 0) {
      return false;
    }

    if (!this.equippedWeapon) {
      if (this.options.getMessageCooldown() <= 0) {
        this.options.hud.showMessage("Pegue uma arma para atacar.");
        this.options.setMessageCooldown(1);
      }

      return false;
    }

    if (!this.combatSystem.canAttack()) {
      return false;
    }

    const weapon = this.equippedWeapon;
    const direction = this.options.getPlayerForwardDirection();
    const origin = this.getAttackOrigin(direction);
    this.combatSystem.beginAttack(weapon);
    this.updateWeaponCooldownHud();
    this.options.audio.play(weapon.attackType === "shoot" ? "blaster" : "attack");
    this.options.playPlayerAttackFeedback(weapon.attackType);
    this.options.feedback.spawn("attack", this.options.getPlayerPosition());

    if (this.options.isMultiplayerEnabled()) {
      this.options.onPlayerAttackVisual({
        weaponId: weapon.id,
        attackType: weapon.attackType,
        origin,
        direction: fromThreeVector(direction),
      });
    }

    if (weapon.weaponClass === "ranged") {
      this.options.projectileSystem.spawnProjectile(origin, direction, weapon, true);
      return true;
    }

    const hit = this.findEnemyInAttackRange(weapon.range, weapon.coneDot);

    if (hit) {
      if (this.options.isMultiplayerEnabled()) {
        this.options.onEnemyHit(hit.mapObject.id, weapon.damage, weapon.id);
      } else {
        this.options.damageEnemy(hit, weapon.damage);
      }
      return true;
    }

    if (this.options.isMultiplayerEnabled()) {
      const remoteHit = this.findRemotePlayerInAttackRange(weapon.range, weapon.coneDot);
      if (remoteHit) {
        this.options.onPlayerAttack({
          weaponId: weapon.id,
          origin,
          direction: fromThreeVector(direction),
          range: weapon.range,
          damage: weapon.damage,
          targetPlayerId: remoteHit.id,
          attackType: weapon.attackType,
        });
      }
    }

    return true;
  }

  private findEnemyInAttackRange(range: number, coneDot: number): EnemyRuntimeState | null {
    const playerPosition = toThreeVector(this.options.getPlayerPosition());
    const facing = this.options.getPlayerForwardDirection();
    let bestState: EnemyRuntimeState | null = null;
    let bestDistance = Infinity;

    for (const state of this.options.getEnemyStates()) {
      const view = this.options.objectViews.get(state.mapObject.id);

      if (!view || !view.visible || state.health <= 0) {
        continue;
      }

      const offsetToEnemy = view.position.clone().sub(playerPosition);
      offsetToEnemy.y = 0;
      const distance = offsetToEnemy.length();

      if (distance > range + 0.7 || distance <= 0.0001) {
        continue;
      }

      const dot = offsetToEnemy.clone().normalize().dot(facing);

      if (dot < coneDot && distance > 0.85) {
        continue;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        bestState = state;
      }
    }

    return bestState;
  }

  private findRemotePlayerInAttackRange(range: number, coneDot: number): PlayerNetState | null {
    const playerPosition = toThreeVector(this.options.getPlayerPosition());
    const facing = this.options.getPlayerForwardDirection();
    let bestPlayer: PlayerNetState | null = null;
    let bestDistance = Infinity;

    for (const remotePlayer of this.options.getRemotePlayers()) {
      if (!remotePlayer.isAlive) {
        continue;
      }

      const offsetToPlayer = toThreeVector(remotePlayer.position).sub(playerPosition);
      offsetToPlayer.y = 0;
      const distance = offsetToPlayer.length();

      if (distance > range + 0.7 || distance <= 0.0001) {
        continue;
      }

      const dot = offsetToPlayer.clone().normalize().dot(facing);
      if (dot < coneDot && distance > 0.85) {
        continue;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        bestPlayer = remotePlayer;
      }
    }

    return bestPlayer;
  }

  private getAttackOrigin(direction: THREE.Vector3): Vector3 {
    const position = toThreeVector(this.options.getPlayerPosition());
    const forward = direction.clone();
    forward.y = 0;

    if (forward.lengthSq() <= 0.0001) {
      forward.set(0, 0, -1);
    }

    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
    position.addScaledVector(forward, 0.72);
    position.addScaledVector(right, 0.24);
    position.y += 1.08;
    return fromThreeVector(position);
  }

  private updateWeaponCooldownHud(): void {
    if (!this.equippedWeapon) {
      return;
    }

    const progress = this.combatSystem.getWeaponCooldownProgress(this.equippedWeapon);
    this.options.hud.setWeaponCooldown(progress);
  }
}

export function createEquippedWeaponFromDefinition(definition: WeaponDefinition): EquippedWeapon {
  return {
    id: normalizeWeaponId(definition.id) ?? normalizeWeaponId(definition.combatId) ?? definition.id,
    itemId: definition.id,
    label: getWeaponLabel(definition.id),
    weaponClass: definition.weaponClass,
    attackType: definition.attackType,
    damage: definition.damage,
    range: definition.range,
    cooldown: definition.cooldown,
    projectileSpeed: Math.max(0, definition.projectileSpeed ?? 0),
    coneDot: Math.max(-1, Math.min(1, definition.coneDot ?? 0.18)),
  };
}

function getWeaponHudTypeLabel(weapon: EquippedWeapon): string {
  const mode = weapon.weaponClass === "ranged" ? "Ranged" : "Melee";
  return `${mode} - ${weapon.damage} dmg - ${weapon.cooldown.toFixed(2)}s`;
}

function toThreeVector(vector: Vector3): THREE.Vector3 {
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

function fromThreeVector(vector: THREE.Vector3): Vector3 {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}
