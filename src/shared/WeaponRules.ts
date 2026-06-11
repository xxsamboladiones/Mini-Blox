import weaponRulesJson from "../../shared/weapon-rules.json";
import type { WeaponAttackType, WeaponClass } from "./types/ItemSchema";

export type WeaponCombatId = "basic_sword" | "heavy_hammer" | "dagger" | "blaster";

export type WeaponRule = {
  label: string;
  damage: number;
  range: number;
  cooldownSeconds: number;
  attackType: WeaponAttackType;
  weaponClass: WeaponClass;
  minDot: number;
  projectileSpeed?: number;
};

export const WEAPON_RULES = weaponRulesJson as Record<WeaponCombatId, WeaponRule>;

export const WEAPON_ALIASES: Record<string, WeaponCombatId> = {
  weapon_basic: "basic_sword",
  weapon_basic_sword: "basic_sword",
  basic_sword: "basic_sword",
  sword: "basic_sword",
  weapon_heavy_hammer: "heavy_hammer",
  heavy_hammer: "heavy_hammer",
  hammer: "heavy_hammer",
  weapon_dagger: "dagger",
  dagger: "dagger",
  weapon_blaster: "blaster",
  blaster: "blaster",
};

export const WEAPON_ITEM_IDS: Record<WeaponCombatId, string> = {
  basic_sword: "weapon_basic",
  heavy_hammer: "weapon_heavy_hammer",
  dagger: "weapon_dagger",
  blaster: "weapon_blaster",
};

export function normalizeWeaponId(weaponId: string | null | undefined): WeaponCombatId | null {
  if (typeof weaponId !== "string") {
    return null;
  }

  const key = weaponId.trim();
  if (!key) {
    return null;
  }

  return WEAPON_ALIASES[key] ?? null;
}

export function getWeaponRule(weaponId: string | null | undefined): WeaponRule | null {
  const normalized = normalizeWeaponId(weaponId);
  return normalized ? WEAPON_RULES[normalized] : null;
}
