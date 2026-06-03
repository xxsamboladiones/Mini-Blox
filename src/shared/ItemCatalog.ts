import type { CatalogItemDefinition } from "./types/ItemSchema";

export const ITEM_CATALOG: CatalogItemDefinition[] = [
  {
    id: "pistol",
    name: "Pistol",
    kind: "weapon",
    weaponKind: "pistol",
    description: "Arma leve preparada para minigames futuros.",
    icon: "crosshair",
    color: "#3b82f6",
    stackable: false,
    damage: 20,
    cooldown: 0.35,
    range: 24
  },
  {
    id: "rifle",
    name: "Rifle",
    kind: "weapon",
    weaponKind: "rifle",
    description: "Arma de medio alcance para sistemas futuros.",
    icon: "crosshair",
    color: "#14b8a6",
    stackable: false,
    damage: 16,
    cooldown: 0.12,
    range: 34
  },
  {
    id: "shotgun",
    name: "Shotgun",
    kind: "weapon",
    weaponKind: "shotgun",
    description: "Arma curta e forte para minigames futuros.",
    icon: "crosshair",
    color: "#f97316",
    stackable: false,
    damage: 48,
    cooldown: 0.85,
    range: 12
  },
  {
    id: "sword",
    name: "Sword",
    kind: "weapon",
    weaponKind: "sword",
    description: "Arma corpo a corpo para minigames futuros.",
    icon: "swords",
    color: "#a855f7",
    stackable: false,
    damage: 32,
    cooldown: 0.45,
    range: 2
  },
  {
    id: "weapon_basic",
    name: "Arma Basica",
    kind: "weapon",
    weaponKind: "sword",
    description: "Espada curta simples para combate MVP.",
    icon: "swords",
    color: "#38bdf8",
    stackable: false,
    damage: 25,
    cooldown: 0.5,
    range: 2
  },
  {
    id: "health_pack",
    name: "Health Pack",
    kind: "consumable",
    description: "Item de cura preparado para minigames futuros.",
    icon: "heart-plus",
    color: "#ef4444",
    stackable: true
  }
];

export function getItemDefinition(itemId: string): CatalogItemDefinition | undefined {
  return ITEM_CATALOG.find((item) => item.id === itemId);
}

export function getItemLabel(itemId: string): string {
  return getItemDefinition(itemId)?.name ?? itemId;
}
