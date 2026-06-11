import * as THREE from "three";
import type { Vector3 } from "../../shared/types/ObjectSchema";

export type RuntimeTickTarget = {
  update: (deltaSeconds: number, playerBounds: THREE.Box3, playerPosition: Vector3) => void;
};

export type SimulateRuntimeTicksOptions = {
  ticks: number;
  deltaSeconds?: number;
  playerPosition?: Vector3;
  playerSize?: Vector3;
};

export function simulateRuntimeTicks(
  target: RuntimeTickTarget,
  {
    ticks,
    deltaSeconds = 1,
    playerPosition = { x: 0, y: 1, z: 0 },
    playerSize = { x: 0.8, y: 1.8, z: 0.8 },
  }: SimulateRuntimeTicksOptions
): void {
  for (let index = 0; index < ticks; index += 1) {
    target.update(deltaSeconds, createPlayerBounds(playerPosition, playerSize), playerPosition);
  }
}

export function createPlayerBounds(position: Vector3, size: Vector3): THREE.Box3 {
  const half = new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2);
  const center = new THREE.Vector3(position.x, position.y, position.z);
  return new THREE.Box3(center.clone().sub(half), center.clone().add(half));
}
