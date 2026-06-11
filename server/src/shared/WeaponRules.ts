import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { WeaponAttackType } from "../multiplayer/types.js";

export type ServerWeaponRule = {
  label: string;
  damage: number;
  range: number;
  cooldownSeconds: number;
  cooldownMs: number;
  attackType: WeaponAttackType;
  weaponClass: "melee" | "ranged";
  minDot: number;
  projectileSpeed?: number;
};

const WEAPON_ALIASES: Record<string, string> = {
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

const WEAPON_RULES = loadWeaponRules();

export function normalizeWeaponId(weaponId: string | null | undefined): string | null {
  if (typeof weaponId !== "string") {
    return null;
  }

  return WEAPON_ALIASES[weaponId.trim()] ?? null;
}

export function getServerWeaponRule(weaponId: string | null | undefined): ServerWeaponRule | null {
  const normalized = normalizeWeaponId(weaponId);
  return normalized ? (WEAPON_RULES[normalized] ?? null) : null;
}

function loadWeaponRules(): Record<string, ServerWeaponRule> {
  const filename = resolveSharedWeaponRulesFile();
  const raw = JSON.parse(readFileSync(filename, "utf-8")) as Record<
    string,
    Omit<ServerWeaponRule, "cooldownMs">
  >;
  const rules: Record<string, ServerWeaponRule> = {};

  for (const [id, rule] of Object.entries(raw)) {
    rules[id] = {
      ...rule,
      cooldownMs: Math.round(rule.cooldownSeconds * 1000),
    };
  }

  return rules;
}

function resolveSharedWeaponRulesFile(): string {
  const candidates = [
    path.resolve(process.cwd(), "shared", "weapon-rules.json"),
    path.resolve(process.cwd(), "..", "shared", "weapon-rules.json"),
  ];

  const filename = candidates.find((candidate) => existsSync(candidate));
  if (!filename) {
    throw new Error("Could not find shared/weapon-rules.json");
  }

  return filename;
}
