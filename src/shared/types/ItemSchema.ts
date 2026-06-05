import type { MapObject, MapObjectProperties } from "./ObjectSchema";

export type ItemKind = "weapon" | "consumable" | "currency";

export type WeaponKind = "pistol" | "rifle" | "shotgun" | "sword" | "hammer" | "dagger" | "blaster";

export type WeaponClass = "melee" | "ranged";

export type WeaponAttackType = "slash" | "overhead" | "stab" | "shoot";

export type ItemDefinition = {
  id: string;
  name: string;
  kind: ItemKind;
  description: string;
  icon: string;
  color: string;
  stackable: boolean;
};

export type WeaponDefinition = ItemDefinition & {
  kind: "weapon";
  weaponKind: WeaponKind;
  combatId: string;
  weaponClass: WeaponClass;
  attackType: WeaponAttackType;
  damage: number;
  cooldown: number;
  range: number;
  projectileSpeed?: number;
  coneDot?: number;
};

export type CatalogItemDefinition = ItemDefinition | WeaponDefinition;

export type ItemSpawnMode = "fixed" | "random";

export type ItemSpawnerSpawnType =
  | "health"
  | "coin"
  | "weapon_basic"
  | "weapon_basic_sword"
  | "weapon_heavy_hammer"
  | "weapon_dagger"
  | "weapon_blaster";

export type ItemSpawnerProperties = {
  itemPool?: string[];
  spawnItemType: ItemSpawnerSpawnType;
  spawnMode: ItemSpawnMode;
  respawnTime: number;
  spawnOnStart: boolean;
  maxSpawnedItems: number;
  amount: number;
};

export type ItemPickupProperties = {
  itemId: string;
  sourceSpawnerId?: string;
  amount?: number;
  healAmount?: number;
  weaponId?: string;
};

export type ItemSpawnerObject = MapObject & {
  type: "itemSpawner";
  properties: MapObjectProperties & ItemSpawnerProperties;
};

export type ItemPickupObject = MapObject & {
  type: "itemPickup";
  properties: MapObjectProperties & ItemPickupProperties;
};

export type InventoryItem = {
  itemId: string;
  quantity: number;
  collectedAt: string;
};
