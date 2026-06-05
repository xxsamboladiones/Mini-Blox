import type { CatalogItemDefinition, WeaponDefinition } from "./types/ItemSchema";

export const ITEM_CATALOG: CatalogItemDefinition[] = [
  {
    id: "pistol",
    name: "Pistol",
    kind: "weapon",
    weaponKind: "pistol",
    combatId: "pistol",
    weaponClass: "ranged",
    attackType: "shoot",
    description: "Arma leve preparada para minigames futuros.",
    icon: "crosshair",
    color: "#3b82f6",
    stackable: false,
    damage: 20,
    cooldown: 0.35,
    range: 24,
    projectileSpeed: 22,
    coneDot: 0.68,
  },
  {
    id: "rifle",
    name: "Rifle",
    kind: "weapon",
    weaponKind: "rifle",
    combatId: "rifle",
    weaponClass: "ranged",
    attackType: "shoot",
    description: "Arma de medio alcance para sistemas futuros.",
    icon: "crosshair",
    color: "#14b8a6",
    stackable: false,
    damage: 16,
    cooldown: 0.12,
    range: 34,
    projectileSpeed: 28,
    coneDot: 0.78,
  },
  {
    id: "shotgun",
    name: "Shotgun",
    kind: "weapon",
    weaponKind: "shotgun",
    combatId: "shotgun",
    weaponClass: "ranged",
    attackType: "shoot",
    description: "Arma curta e forte para minigames futuros.",
    icon: "crosshair",
    color: "#f97316",
    stackable: false,
    damage: 48,
    cooldown: 0.85,
    range: 12,
    projectileSpeed: 18,
    coneDot: 0.48,
  },
  {
    id: "sword",
    name: "Sword",
    kind: "weapon",
    weaponKind: "sword",
    combatId: "basic_sword",
    weaponClass: "melee",
    attackType: "slash",
    description: "Arma corpo a corpo para minigames futuros.",
    icon: "swords",
    color: "#a855f7",
    stackable: false,
    damage: 18,
    cooldown: 0.65,
    range: 1.85,
    coneDot: 0.18,
  },
  {
    id: "weapon_basic",
    name: "Espada Basica",
    kind: "weapon",
    weaponKind: "sword",
    combatId: "basic_sword",
    weaponClass: "melee",
    attackType: "slash",
    description: "Espada curta simples para combate corpo a corpo.",
    icon: "swords",
    color: "#38bdf8",
    stackable: false,
    damage: 18,
    cooldown: 0.65,
    range: 1.85,
    coneDot: 0.18,
  },
  {
    id: "weapon_heavy_hammer",
    name: "Martelo Pesado",
    kind: "weapon",
    weaponKind: "hammer",
    combatId: "heavy_hammer",
    weaponClass: "melee",
    attackType: "overhead",
    description: "Arma lenta de impacto alto para acertar com timing.",
    icon: "hammer",
    color: "#f59e0b",
    stackable: false,
    damage: 32,
    cooldown: 1.15,
    range: 1.65,
    coneDot: 0.05,
  },
  {
    id: "weapon_dagger",
    name: "Adaga",
    kind: "weapon",
    weaponKind: "dagger",
    combatId: "dagger",
    weaponClass: "melee",
    attackType: "stab",
    description: "Arma rapida de alcance curto para golpes constantes.",
    icon: "sword",
    color: "#22c55e",
    stackable: false,
    damage: 10,
    cooldown: 0.35,
    range: 1.45,
    coneDot: 0.42,
  },
  {
    id: "weapon_blaster",
    name: "Blaster",
    kind: "weapon",
    weaponKind: "blaster",
    combatId: "blaster",
    weaponClass: "ranged",
    attackType: "shoot",
    description: "Arma de alcance medio que dispara projetil visivel.",
    icon: "zap",
    color: "#06b6d4",
    stackable: false,
    damage: 14,
    cooldown: 0.75,
    range: 12,
    projectileSpeed: 18,
    coneDot: 0.58,
  },
  {
    id: "health_pack",
    name: "Health Pack",
    kind: "consumable",
    description: "Item de cura preparado para minigames futuros.",
    icon: "heart-plus",
    color: "#ef4444",
    stackable: true,
  },
];

export function getItemDefinition(itemId: string): CatalogItemDefinition | undefined {
  const catalogId = getCatalogItemId(itemId) ?? itemId;
  return ITEM_CATALOG.find((item) => item.id === catalogId);
}

export function getItemLabel(itemId: string): string {
  return getItemDefinition(itemId)?.name ?? itemId;
}

export const WEAPON_SPAWNER_OPTIONS = [
  { id: "weapon_basic", label: "Espada Basica" },
  { id: "weapon_heavy_hammer", label: "Martelo Pesado" },
  { id: "weapon_dagger", label: "Adaga" },
  { id: "weapon_blaster", label: "Blaster" },
] as const;

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

const WEAPON_ITEM_IDS: Record<string, string> = {
  basic_sword: "weapon_basic",
  heavy_hammer: "weapon_heavy_hammer",
  dagger: "weapon_dagger",
  blaster: "weapon_blaster",
};

export function normalizeWeaponId(weaponId: string | null | undefined): string | null {
  if (typeof weaponId !== "string") {
    return null;
  }

  const key = weaponId.trim();
  if (!key) {
    return null;
  }

  return WEAPON_ALIASES[key] ?? null;
}

export function getWeaponItemId(weaponId: string | null | undefined): string | null {
  const normalized = normalizeWeaponId(weaponId);
  return normalized ? (WEAPON_ITEM_IDS[normalized] ?? null) : null;
}

export function getCatalogItemId(itemId: string | null | undefined): string | null {
  if (typeof itemId !== "string") {
    return null;
  }

  const directId = itemId.trim();
  if (!directId) {
    return null;
  }

  if (directId === "weapon_basic_sword") {
    return "weapon_basic";
  }

  const weaponItemId = getWeaponItemId(directId);
  return weaponItemId ?? directId;
}

export function getWeaponDefinition(weaponId: string | null | undefined): WeaponDefinition | null {
  const itemId = getWeaponItemId(weaponId);
  const definition = itemId ? getItemDefinition(itemId) : undefined;
  return definition && isWeaponDefinition(definition) ? definition : null;
}

export function isWeaponItemId(itemId: string | null | undefined): boolean {
  return getWeaponDefinition(itemId) !== null;
}

export function getWeaponLabel(weaponId: string | null | undefined): string {
  return getWeaponDefinition(weaponId)?.name ?? String(weaponId ?? "");
}

function isWeaponDefinition(definition: CatalogItemDefinition): definition is WeaponDefinition {
  return (
    definition.kind === "weapon" &&
    "combatId" in definition &&
    "weaponClass" in definition &&
    "attackType" in definition &&
    "damage" in definition &&
    "cooldown" in definition &&
    "range" in definition
  );
}
