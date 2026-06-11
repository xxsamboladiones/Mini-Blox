import * as THREE from "three";
import type { Vector3 } from "../../shared/types/ObjectSchema";

export type ProjectileWeapon = {
  id: string;
  damage: number;
  range: number;
  projectileSpeed: number;
};

export type ActiveProjectile<TWeapon extends ProjectileWeapon = ProjectileWeapon> = {
  id: string;
  mesh: THREE.Object3D;
  weapon: TWeapon;
  origin: Vector3;
  direction: THREE.Vector3;
  remainingRange: number;
  local: boolean;
};

export function createProjectile<TWeapon extends ProjectileWeapon>(
  id: string,
  mesh: THREE.Object3D,
  origin: Vector3,
  direction: THREE.Vector3,
  weapon: TWeapon,
  local: boolean
): ActiveProjectile<TWeapon> | null {
  const shotDirection = direction.clone();
  shotDirection.y = 0;

  if (shotDirection.lengthSq() <= 0.0001) {
    return null;
  }

  shotDirection.normalize();
  mesh.position.set(origin.x, origin.y, origin.z);
  mesh.lookAt(mesh.position.clone().add(shotDirection));

  return {
    id,
    mesh,
    weapon,
    origin,
    direction: shotDirection,
    remainingRange: weapon.range,
    local,
  };
}

export function advanceProjectile(projectile: ActiveProjectile, deltaSeconds: number): void {
  const step = Math.min(
    projectile.weapon.projectileSpeed * deltaSeconds,
    projectile.remainingRange
  );
  projectile.mesh.position.addScaledVector(projectile.direction, step);
  projectile.remainingRange -= step;
}

export function isProjectileExpired(projectile: ActiveProjectile): boolean {
  return projectile.remainingRange <= 0.01;
}

export function isProjectileNearPosition(
  projectilePosition: THREE.Vector3,
  targetPosition: THREE.Vector3,
  maxHorizontalDistance: number,
  maxVerticalDistance: number
): boolean {
  const horizontalDistance = Math.hypot(
    projectilePosition.x - targetPosition.x,
    projectilePosition.z - targetPosition.z
  );
  const verticalDistance = Math.abs(projectilePosition.y - targetPosition.y);
  return horizontalDistance <= maxHorizontalDistance && verticalDistance <= maxVerticalDistance;
}
