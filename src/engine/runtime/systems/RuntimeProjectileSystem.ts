import * as THREE from "three";
import type { PlayerAttackPayload, PlayerNetState } from "../../../shared/types/MultiplayerSchema";
import type { Vector3 } from "../../../shared/types/ObjectSchema";
import type { WeaponAttackType } from "../../../shared/types/ItemSchema";
import { disposeObject3D } from "../../ObjectFactory";
import { createWeaponProjectileVisual } from "../../WeaponVisualFactory";
import {
  advanceProjectile,
  createProjectile,
  isProjectileExpired,
  isProjectileNearPosition,
  type ActiveProjectile,
  type ProjectileWeapon,
} from "../../mechanics/ProjectileMechanics";
import type { RuntimeSystem } from "../core/RuntimeSystem";
import type { EnemyRuntimeState } from "./RuntimeEnemySystem";

export type RuntimeProjectileWeapon = ProjectileWeapon & {
  attackType?: WeaponAttackType;
};

export type RuntimeProjectileSystemOptions<TWeapon extends RuntimeProjectileWeapon> = {
  world: THREE.Group;
  objectViews: Map<string, THREE.Object3D>;
  enableLifecycleUpdate?: boolean;
  createProjectileVisual?: (weaponId: string) => THREE.Object3D;
  getEnemyStates: () => EnemyRuntimeState[];
  getRemotePlayers: () => PlayerNetState[];
  isMultiplayerEnabled: () => boolean;
  damageEnemy: (state: EnemyRuntimeState, amount: number) => void;
  onEnemyHit: (enemyObjectId: string, damage: number, weaponId?: string) => void;
  onPlayerAttack: (payload: PlayerAttackPayload) => void;
};

export class RuntimeProjectileSystem<TWeapon extends RuntimeProjectileWeapon>
  implements RuntimeSystem
{
  readonly id = "projectiles";

  private readonly activeProjectiles = new Map<string, ActiveProjectile<TWeapon>>();
  private projectileSequence = 0;

  constructor(private readonly options: RuntimeProjectileSystemOptions<TWeapon>) {}

  update(deltaSeconds: number): void {
    if (this.options.enableLifecycleUpdate === false) {
      return;
    }

    this.updateProjectiles(deltaSeconds);
  }

  reset(): void {
    this.clearProjectiles();
    this.projectileSequence = 0;
  }

  dispose(): void {
    this.clearProjectiles();
  }

  getProjectileCount(): number {
    return this.activeProjectiles.size;
  }

  getProjectiles(): ActiveProjectile<TWeapon>[] {
    return [...this.activeProjectiles.values()];
  }

  spawnProjectile(
    origin: Vector3,
    direction: THREE.Vector3,
    weapon: TWeapon,
    local: boolean
  ): string | null {
    const mesh = (this.options.createProjectileVisual ?? createWeaponProjectileVisual)(weapon.id);
    const id = `projectile-${Date.now()}-${this.projectileSequence++}`;
    const projectile = createProjectile(id, mesh, origin, direction, weapon, local);

    if (!projectile) {
      disposeObject3D(mesh);
      return null;
    }

    this.options.world.add(mesh);
    this.activeProjectiles.set(id, projectile);
    return id;
  }

  clearProjectiles(): void {
    for (const projectileId of [...this.activeProjectiles.keys()]) {
      this.removeProjectile(projectileId);
    }
  }

  updateProjectiles(deltaSeconds: number): void {
    if (this.activeProjectiles.size === 0) {
      return;
    }

    const removeIds: string[] = [];

    for (const projectile of this.activeProjectiles.values()) {
      advanceProjectile(projectile, deltaSeconds);

      if (projectile.local) {
        const enemyHit = this.findEnemyHitByProjectile(projectile);
        if (enemyHit) {
          if (this.options.isMultiplayerEnabled()) {
            this.options.onEnemyHit(
              enemyHit.mapObject.id,
              projectile.weapon.damage,
              projectile.weapon.id
            );
          } else {
            this.options.damageEnemy(enemyHit, projectile.weapon.damage);
          }
          removeIds.push(projectile.id);
          continue;
        }

        if (this.options.isMultiplayerEnabled()) {
          const remoteHit = this.findRemotePlayerHitByProjectile(projectile);
          if (remoteHit) {
            this.options.onPlayerAttack({
              weaponId: projectile.weapon.id,
              origin: projectile.origin,
              direction: fromThreeVector(projectile.direction),
              range: projectile.weapon.range,
              damage: projectile.weapon.damage,
              targetPlayerId: remoteHit.id,
              attackType: projectile.weapon.attackType,
            });
            removeIds.push(projectile.id);
            continue;
          }
        }
      }

      if (isProjectileExpired(projectile)) {
        removeIds.push(projectile.id);
      }
    }

    for (const id of removeIds) {
      this.removeProjectile(id);
    }
  }

  private findEnemyHitByProjectile(projectile: ActiveProjectile<TWeapon>): EnemyRuntimeState | null {
    let closest: EnemyRuntimeState | null = null;
    let closestDistance = Infinity;

    for (const state of this.options.getEnemyStates()) {
      const view = this.options.objectViews.get(state.mapObject.id);
      if (!view || !view.visible || state.health <= 0) {
        continue;
      }

      if (!isProjectileNearPosition(projectile.mesh.position, view.position, 0.72, 1.7)) {
        continue;
      }

      const horizontalDistance = distance2DVector(projectile.mesh.position, view.position);
      if (horizontalDistance < closestDistance) {
        closestDistance = horizontalDistance;
        closest = state;
      }
    }

    return closest;
  }

  private findRemotePlayerHitByProjectile(
    projectile: ActiveProjectile<TWeapon>
  ): PlayerNetState | null {
    let closest: PlayerNetState | null = null;
    let closestDistance = Infinity;

    for (const remotePlayer of this.options.getRemotePlayers()) {
      if (!remotePlayer.isAlive) {
        continue;
      }

      const remotePosition = toThreeVector(remotePlayer.position);
      remotePosition.y += 0.9;
      if (!isProjectileNearPosition(projectile.mesh.position, remotePosition, 0.68, 1.35)) {
        continue;
      }

      const horizontalDistance = distance2DVector(projectile.mesh.position, remotePosition);
      if (horizontalDistance < closestDistance) {
        closestDistance = horizontalDistance;
        closest = remotePlayer;
      }
    }

    return closest;
  }

  private removeProjectile(projectileId: string): void {
    const projectile = this.activeProjectiles.get(projectileId);
    if (!projectile) {
      return;
    }

    this.options.world.remove(projectile.mesh);
    disposeObject3D(projectile.mesh);
    this.activeProjectiles.delete(projectileId);
  }
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

function distance2DVector(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
