import * as THREE from "three";
import { applyObjectAppearanceToThree } from "../ObjectFactory";
import type { MapObject, Vector3 } from "../../shared/types/ObjectSchema";

export function isDoorObject(object: MapObject): boolean {
  return object.type === "door";
}

export function isButtonObject(object: MapObject): boolean {
  return object.type === "button";
}

export function getDoorId(object: MapObject): string {
  return getString(object.properties?.doorId, object.id);
}

export function getButtonId(object: MapObject): string {
  return object.id;
}

export function getLinkedDoorIds(buttonObject: MapObject): string[] {
  const targetDoorId = getString(
    buttonObject.properties?.targetDoorId,
    getString(buttonObject.properties?.buttonTargetId, "")
  );

  return targetDoorId ? [targetDoorId] : [];
}

export function findLinkedDoor(objects: MapObject[], targetDoorId: string): MapObject | null {
  return (
    objects.find(
      (candidate) =>
        isDoorObject(candidate) &&
        (candidate.id === targetDoorId || candidate.properties?.doorId === targetDoorId)
    ) ?? null
  );
}

export function applyDoorOpenVisual(view: THREE.Object3D, door: MapObject): void {
  const offset = getVector(door.properties?.openOffset, { x: 0, y: 4, z: 0 });
  view.position.add(new THREE.Vector3(offset.x, offset.y, offset.z));
}

export function applyDoorClosedVisual(view: THREE.Object3D, initialPosition: THREE.Vector3): void {
  view.position.copy(initialPosition);
}

export function applyButtonActivatedVisual(view: THREE.Object3D, buttonObject: MapObject): void {
  view.scale.y = Math.max(0.12, view.scale.y * 0.45);
  applyObjectAppearanceToThree(view, {
    ...buttonObject,
    properties: {
      ...buttonObject.properties,
      color: "#22c55e",
    },
  });
}

export function shouldInteractWithButton(
  playerBounds: THREE.Box3,
  buttonBounds: THREE.Box3
): boolean {
  return buttonBounds.intersectsBox(playerBounds);
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function getVector(value: unknown, fallback: Vector3): Vector3 {
  if (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    "z" in value &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.z === "number"
  ) {
    return { x: value.x, y: value.y, z: value.z };
  }

  return { ...fallback };
}
