import type { EnemyNetState } from "../../shared/types/MultiplayerSchema";
import type { MapObject } from "../../shared/types/ObjectSchema";

export type EnemyRuntimeConfig = {
  maxHealth: number;
  speed: number;
  detectionRange: number;
  attackRange: number;
  damage: number;
  attackCooldown: number;
  behavior: EnemyNetState["state"];
};

export function getEnemyRuntimeConfig(mapObject: MapObject): EnemyRuntimeConfig {
  return {
    maxHealth: getEnemyHealth(mapObject),
    speed: getEnemySpeed(mapObject),
    detectionRange: getEnemyDetectionRange(mapObject),
    attackRange: getEnemyAttackRange(mapObject),
    damage: getEnemyDamage(mapObject),
    attackCooldown: getEnemyAttackCooldown(mapObject),
    behavior: getEnemyBehavior(mapObject),
  };
}

export function getEnemyObjectId(mapObject: MapObject): string {
  return mapObject.id;
}

export function getEnemyHealth(mapObject: MapObject): number {
  return Math.max(1, getNumber(mapObject.properties?.health, 50));
}

export function getEnemyDamage(mapObject: MapObject): number {
  return Math.max(1, getNumber(mapObject.properties?.damage, 10));
}

export function getEnemySpeed(mapObject: MapObject): number {
  return Math.max(0, getNumber(mapObject.properties?.speed, 2));
}

export function getEnemyAttackRange(mapObject: MapObject): number {
  return Math.max(0.2, getNumber(mapObject.properties?.attackRange, 1.5));
}

export function getEnemyDetectionRange(mapObject: MapObject): number {
  return Math.max(0, getNumber(mapObject.properties?.detectionRange, 8));
}

export function getEnemyAttackCooldown(mapObject: MapObject): number {
  return Math.max(0.2, getNumber(mapObject.properties?.attackCooldown, 1));
}

export function isEnemyAlive(health: number, visible = true): boolean {
  return visible && health > 0;
}

export function clampEnemyHealth(health: number, maxHealth: number): number {
  return Math.max(0, Math.min(Math.max(1, maxHealth), health));
}

export function shouldEnemyAttackPlayer(options: {
  distanceToPlayer: number;
  attackRange: number;
  intersectsPlayer: boolean;
  attackCooldown: number;
  deathCooldown: number;
}): boolean {
  return (
    (options.distanceToPlayer <= options.attackRange || options.intersectsPlayer) &&
    options.attackCooldown <= 0 &&
    options.deathCooldown <= 0
  );
}

export function normalizeEnemyConfig(mapObject: MapObject): EnemyRuntimeConfig {
  return getEnemyRuntimeConfig(mapObject);
}

function getEnemyBehavior(mapObject: MapObject): EnemyNetState["state"] {
  const behavior = mapObject.properties?.behavior;

  if (behavior === "idle" || behavior === "patrol" || behavior === "chase") {
    return behavior;
  }

  return "chase";
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
