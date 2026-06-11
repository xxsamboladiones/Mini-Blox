import * as THREE from "three";
import { getWeaponItemId } from "../../shared/ItemCatalog";
import type { ItemPickupObject, ItemSpawnMode } from "../../shared/types/ItemSchema";
import type { MapObject, Vector3 } from "../../shared/types/ObjectSchema";

export function isCoinObject(object: MapObject): boolean {
  return object.type === "coin";
}

export function isPickupObject(object: MapObject): object is ItemPickupObject {
  return object.type === "itemPickup";
}

export function isHealthPickupObject(object: ItemPickupObject): boolean {
  return object.properties.itemId === "health_pack" || object.properties.itemId === "health";
}

export function isCoinPickupObject(object: ItemPickupObject): boolean {
  return object.properties.itemId === "coin";
}

export function getPickupId(object: MapObject | ItemPickupObject): string {
  return object.id;
}

export function getPickupAmount(pickup: ItemPickupObject): number {
  const itemId = pickup.properties.itemId;
  return getNumber(
    pickup.properties.amount,
    getNumber(pickup.properties.healAmount, itemId === "coin" ? 1 : 25)
  );
}

export function getPickupHealAmount(pickup: ItemPickupObject): number {
  return isHealthPickupObject(pickup) ? Math.max(1, Math.floor(getPickupAmount(pickup))) : 0;
}

export function getCoinAmount(mapObject: MapObject): number {
  return getNumber(mapObject.properties?.value, getNumber(mapObject.properties?.coinValue, 1));
}

export function shouldCollectPickup(playerBounds: THREE.Box3, objectBounds: THREE.Box3): boolean {
  return objectBounds.intersectsBox(playerBounds);
}

export function hideCollectedPickupObject(view: THREE.Object3D | undefined): void {
  if (view) {
    view.visible = false;
  }
}

export function shouldTrackSharedPickup(
  sharedWorldEnabled: boolean,
  applyEffects?: boolean
): boolean {
  return sharedWorldEnabled || applyEffects === false;
}

export function getSpawnMode(value: unknown): ItemSpawnMode {
  return value === "random" ? "random" : "fixed";
}

export function getRespawnTime(spawner: MapObject): number {
  return Math.max(0, getNumber(spawner.properties?.respawnTime, 0));
}

export function getMaxSpawnedItems(spawner: MapObject): number {
  return Math.max(1, Math.floor(getNumber(spawner.properties?.maxSpawnedItems, 1)));
}

export function chooseItemId(spawner: MapObject): string | null {
  const spawnItemType = spawner.properties?.spawnItemType;

  if (spawnItemType === "health") {
    return "health_pack";
  }

  if (spawnItemType === "coin") {
    return "coin";
  }

  if (spawnItemType === "weapon_basic") {
    return "weapon_basic";
  }

  const weaponItemId = getWeaponItemId(typeof spawnItemType === "string" ? spawnItemType : null);
  if (weaponItemId) {
    return weaponItemId;
  }

  const itemPool = getStringArray(spawner.properties?.itemPool);

  if (itemPool.length === 0) {
    return null;
  }

  if (getSpawnMode(spawner.properties?.spawnMode) === "random") {
    const selectedItemId = itemPool[Math.floor(Math.random() * itemPool.length)];
    return getWeaponItemId(selectedItemId) ?? selectedItemId;
  }

  return getWeaponItemId(itemPool[0]) ?? itemPool[0];
}

export function getSpawnerAmount(spawner: MapObject, itemId: string): number {
  const fallback = itemId === "coin" ? 1 : 25;
  return Math.max(1, getNumber(spawner.properties?.amount, fallback));
}

export function getPickupPosition(spawner: MapObject, index: number): Vector3 {
  const scale = spawner.scale ?? { x: 1, y: 1, z: 1 };
  const angle = index * 2.3999632297;
  const radius = index === 0 ? 0 : 0.55;

  return {
    x: spawner.position.x + Math.cos(angle) * radius,
    y: spawner.position.y + Math.max(0.75, scale.y * 0.75),
    z: spawner.position.z + Math.sin(angle) * radius,
  };
}

export function getSpawnerPickupId(spawner: MapObject, index: number): string {
  return `itemPickup-${spawner.id}-${index}`;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
