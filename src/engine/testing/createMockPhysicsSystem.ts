import * as THREE from "three";
import type { Collider, PhysicsSystem } from "../PhysicsSystem";
import type { MapObject } from "../../shared/types/ObjectSchema";

export type MockPhysicsSystem = PhysicsSystem & {
  activeColliderIds: Set<string>;
  colliderUpdates: Array<{ objectId: string; solid: boolean }>;
  colliderRemovals: string[];
  hasCollider: (objectId: string) => boolean;
};

export function createMockPhysicsSystem(): MockPhysicsSystem {
  const activeColliderIds = new Set<string>();
  const colliderUpdates: Array<{ objectId: string; solid: boolean }> = [];
  const colliderRemovals: string[] = [];
  const colliders = new Map<string, Collider>();

  const mock = {
    activeColliderIds,
    colliderUpdates,
    colliderRemovals,
    clear: () => {
      activeColliderIds.clear();
      colliders.clear();
    },
    updateColliderForObject: (mapObject: MapObject, object3D: THREE.Object3D, solid = true) => {
      colliderUpdates.push({ objectId: mapObject.id, solid });
      if (!solid || !object3D.visible) {
        activeColliderIds.delete(mapObject.id);
        colliders.delete(mapObject.id);
        return;
      }

      activeColliderIds.add(mapObject.id);
      colliders.set(mapObject.id, {
        id: `mock-collider-${mapObject.id}`,
        objectId: mapObject.id,
        type: String(mapObject.type),
        bounds: new THREE.Box3().setFromObject(object3D),
        solid: true,
        object3D,
      });
    },
    removeCollider: (objectId: string) => {
      colliderRemovals.push(objectId);
      activeColliderIds.delete(objectId);
      colliders.delete(objectId);
    },
    getSolidColliders: () => [...colliders.values()],
    hasCollider: (objectId: string) => activeColliderIds.has(objectId),
  };

  return mock as unknown as MockPhysicsSystem;
}
