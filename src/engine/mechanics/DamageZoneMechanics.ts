import type { MapObject } from "../../shared/types/ObjectSchema";

export type DamageZoneMode = "damage" | "kill";

export function isDamageZoneObject(object: MapObject): boolean {
  return object.type === "damage" || object.type === "damageZone";
}

export function getDamageZoneMode(object: MapObject): DamageZoneMode {
  return object.properties?.mode === "damage" ? "damage" : "kill";
}

export function getDamageZoneAmount(object: MapObject): number {
  return getNumber(object.properties?.damage, getNumber(object.properties?.damagePerSecond, 25));
}

export function getDamageZoneCooldownSeconds(): number {
  return 0.7;
}

export function shouldApplyDamageZone(deathCooldown: number, intersectsPlayer: boolean): boolean {
  return deathCooldown <= 0 && intersectsPlayer;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
