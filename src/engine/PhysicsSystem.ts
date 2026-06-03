import * as THREE from "three";
import type { GameMap } from "../shared/types/MapSchema";
import type { MapObject } from "../shared/types/ObjectSchema";

export type Collider = {
  id: string;
  objectId: string;
  type: string;
  bounds: THREE.Box3;
  solid: boolean;
  object3D?: THREE.Object3D;
};

export type PlayerPhysicsState = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  size: THREE.Vector3;
};

export type MoveResult = {
  grounded: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
};

export type CollisionRole = "solid" | "trigger" | "none";

export class PhysicsSystem {
  private readonly colliders = new Map<string, Collider>();

  clear(): void {
    this.colliders.clear();
  }

  setCollidersFromObjects(map: GameMap, objectViews: Map<string, THREE.Object3D>): void {
    this.colliders.clear();

    for (const mapObject of map.objects) {
      const object3D = objectViews.get(mapObject.id);

      if (!object3D) {
        continue;
      }

      this.updateColliderForObject(mapObject, object3D);
    }
  }

  updateColliderForObject(
    mapObject: MapObject,
    object3D: THREE.Object3D,
    solid = isSolidMapObject(mapObject)
  ): void {
    if (!solid || !object3D.visible) {
      this.removeCollider(mapObject.id);
      return;
    }

    const bounds = new THREE.Box3().setFromObject(object3D);

    if (bounds.isEmpty()) {
      this.removeCollider(mapObject.id);
      return;
    }

    this.colliders.set(mapObject.id, {
      id: `collider-${mapObject.id}`,
      objectId: mapObject.id,
      type: String(mapObject.type),
      bounds,
      object3D,
      solid: true
    });
  }

  updateColliderForObject3D(
    objectId: string,
    type: string,
    object3D: THREE.Object3D,
    solid: boolean
  ): void {
    if (!solid || !object3D.visible) {
      this.removeCollider(objectId);
      return;
    }

    const bounds = new THREE.Box3().setFromObject(object3D);

    if (bounds.isEmpty()) {
      this.removeCollider(objectId);
      return;
    }

    this.colliders.set(objectId, {
      id: `collider-${objectId}`,
      objectId,
      type,
      bounds,
      object3D,
      solid: true
    });
  }

  removeCollider(objectId: string): void {
    this.colliders.delete(objectId);
  }

  getSolidColliders(): Collider[] {
    return [...this.colliders.values()].filter((collider) => collider.solid);
  }

  movePlayer(state: PlayerPhysicsState, deltaSeconds: number): MoveResult {
    const position = state.position.clone();
    const velocity = state.velocity.clone();
    const size = state.size.clone();
    let grounded = false;

    position.x = this.resolveHorizontalAxis(position, size, velocity.x * deltaSeconds, "x");
    position.z = this.resolveHorizontalAxis(position, size, velocity.z * deltaSeconds, "z");

    const verticalDelta = velocity.y * deltaSeconds;
    const verticalResult = this.resolveVertical(position, size, verticalDelta);
    position.copy(verticalResult.position);

    if (verticalResult.hitGround) {
      grounded = true;
      velocity.y = 0;
    } else if (verticalResult.hitCeiling) {
      velocity.y = Math.min(0, velocity.y);
    }

    const rampGroundY = this.getRampGroundY(position, size);
    if (velocity.y <= 0 && rampGroundY !== null && position.y <= rampGroundY + 0.35) {
      position.y = rampGroundY + 0.001;
      velocity.y = 0;
      grounded = true;
    }

    return { position, velocity, grounded };
  }

  getPlayerBounds(position: THREE.Vector3, size: THREE.Vector3): THREE.Box3 {
    const half = size.clone().multiplyScalar(0.5);
    const min = new THREE.Vector3(position.x - half.x, position.y, position.z - half.z);
    const max = new THREE.Vector3(position.x + half.x, position.y + size.y, position.z + half.z);
    return new THREE.Box3(min, max);
  }

  getGroundInfo(position: THREE.Vector3, size: THREE.Vector3): { grounded: boolean; groundY: number } {
    const probePosition = position.clone();
    probePosition.y -= 0.04;
    const bounds = this.getPlayerBounds(probePosition, size);

    for (const collider of this.getSolidColliders()) {
      if (collider.type === "ramp") {
        const rampGroundY = this.getRampSurfaceY(collider, position);

        if (rampGroundY !== null && Math.abs(position.y - rampGroundY) <= 0.08) {
          return { grounded: true, groundY: rampGroundY };
        }

        continue;
      }

      if (bounds.intersectsBox(collider.bounds) && position.y >= collider.bounds.max.y - 0.08) {
        return { grounded: true, groundY: collider.bounds.max.y };
      }
    }

    return { grounded: false, groundY: 0 };
  }

  private resolveHorizontalAxis(
    position: THREE.Vector3,
    size: THREE.Vector3,
    delta: number,
    axis: "x" | "z"
  ): number {
    if (delta === 0) {
      return position[axis];
    }

    const nextPosition = position.clone();
    nextPosition[axis] += delta;
    const playerBounds = this.getPlayerBounds(nextPosition, size);

    for (const collider of this.getSolidColliders()) {
      if (collider.type === "ramp" && this.getRampSurfaceY(collider, nextPosition) !== null) {
        continue;
      }

      if (!playerBounds.intersectsBox(collider.bounds)) {
        continue;
      }

      if (delta > 0) {
        nextPosition[axis] = collider.bounds.min[axis] - size[axis] / 2 - 0.001;
      } else {
        nextPosition[axis] = collider.bounds.max[axis] + size[axis] / 2 + 0.001;
      }

      playerBounds.copy(this.getPlayerBounds(nextPosition, size));
    }

    return nextPosition[axis];
  }

  private resolveVertical(
    position: THREE.Vector3,
    size: THREE.Vector3,
    delta: number
  ): { hitCeiling: boolean; hitGround: boolean; position: THREE.Vector3 } {
    const nextPosition = position.clone();
    nextPosition.y += delta;
    const playerBounds = this.getPlayerBounds(nextPosition, size);
    let hitGround = false;
    let hitCeiling = false;

    for (const collider of this.getSolidColliders()) {
      if (collider.type === "ramp") {
        continue;
      }

      if (!playerBounds.intersectsBox(collider.bounds)) {
        continue;
      }

      if (delta <= 0) {
        nextPosition.y = collider.bounds.max.y + 0.001;
        hitGround = true;
      } else {
        nextPosition.y = collider.bounds.min.y - size.y - 0.001;
        hitCeiling = true;
      }

      playerBounds.copy(this.getPlayerBounds(nextPosition, size));
    }

    return { hitCeiling, hitGround, position: nextPosition };
  }

  private getRampGroundY(position: THREE.Vector3, size: THREE.Vector3): number | null {
    let bestGroundY: number | null = null;

    for (const collider of this.getSolidColliders()) {
      if (collider.type !== "ramp") {
        continue;
      }

      const surfaceY = this.getRampSurfaceY(collider, position);

      if (surfaceY === null) {
        continue;
      }

      const feetBounds = this.getPlayerBounds(position, size);
      const rampBounds = collider.bounds.clone();
      rampBounds.max.y += 0.45;

      if (!feetBounds.intersectsBox(rampBounds)) {
        continue;
      }

      if (bestGroundY === null || surfaceY > bestGroundY) {
        bestGroundY = surfaceY;
      }
    }

    return bestGroundY;
  }

  private getRampSurfaceY(collider: Collider, position: THREE.Vector3): number | null {
    if (!collider.object3D) {
      return null;
    }

    collider.object3D.updateWorldMatrix(true, true);
    const localPoint = collider.object3D.worldToLocal(position.clone());

    if (Math.abs(localPoint.x) > 0.52 || Math.abs(localPoint.z) > 0.52) {
      return null;
    }

    const surfaceLocal = new THREE.Vector3(
      THREE.MathUtils.clamp(localPoint.x, -0.5, 0.5),
      THREE.MathUtils.clamp(localPoint.z, -0.5, 0.5),
      THREE.MathUtils.clamp(localPoint.z, -0.5, 0.5)
    );
    const surfaceWorld = collider.object3D.localToWorld(surfaceLocal);
    return surfaceWorld.y;
  }
}

export function isSolidMapObject(mapObject: MapObject): boolean {
  return getCollisionRole(mapObject) === "solid";
}

export function getCollisionRole(mapObject: MapObject): CollisionRole {
  if (mapObject.type === "door" && (mapObject.properties?.startsOpen || mapObject.properties?.doorState === "open")) {
    return "none";
  }

  if (mapObject.properties?.collision === false) {
    return isTriggerMapObject(mapObject) ? "trigger" : "none";
  }

  if (mapObject.properties?.collision === true) {
    return "solid";
  }

  if (mapObject.type === "door") {
    return "solid";
  }

  if (
    mapObject.type === "cube" ||
    mapObject.type === "platform" ||
    mapObject.type === "movingPlatform" ||
    mapObject.type === "disappearingBlock" ||
    mapObject.type === "ramp" ||
    mapObject.type === "model" ||
    mapObject.type === "tree" ||
    mapObject.type === "rock" ||
    mapObject.type === "crate" ||
    mapObject.type === "barrel" ||
    mapObject.type === "arch" ||
    mapObject.type === "pillar"
  ) {
    return "solid";
  }

  return isTriggerMapObject(mapObject) ? "trigger" : "none";
}

function isTriggerMapObject(mapObject: MapObject): boolean {
  return Boolean(mapObject.collider?.isTrigger) ||
    mapObject.type === "checkpoint" ||
    mapObject.type === "coin" ||
    mapObject.type === "button" ||
    mapObject.type === "damage" ||
    mapObject.type === "damageZone" ||
    mapObject.type === "jumpPad" ||
    mapObject.type === "teleporter" ||
    mapObject.type === "messageZone" ||
    mapObject.type === "key" ||
    mapObject.type === "finish" ||
    mapObject.type === "goal" ||
    mapObject.type === "itemPickup";
}
