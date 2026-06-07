import * as THREE from "three";
import { normalizeWeaponId } from "../shared/ItemCatalog";

export type WeaponAttachmentKind = "sword" | "dagger" | "hammer" | "blaster" | "default";

export type WeaponAttachmentConfig = {
  kind: WeaponAttachmentKind;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
};

const ATTACHMENTS: Record<string, WeaponAttachmentConfig> = {
  basic_sword: {
    kind: "sword",
    position: { x: 0, y: -0.06, z: -0.02 },
    rotation: { x: -0.08, y: 0.04, z: -0.03 },
    scale: { x: 0.94, y: 0.94, z: 0.94 },
  },
  heavy_hammer: {
    kind: "hammer",
    position: { x: 0.015, y: -0.045, z: -0.015 },
    rotation: { x: -0.06, y: 0, z: -0.02 },
    scale: { x: 0.88, y: 0.88, z: 0.88 },
  },
  dagger: {
    kind: "dagger",
    position: { x: 0.01, y: -0.045, z: -0.015 },
    rotation: { x: -0.1, y: 0.08, z: -0.08 },
    scale: { x: 0.9, y: 0.9, z: 0.9 },
  },
  blaster: {
    kind: "blaster",
    position: { x: 0, y: -0.035, z: -0.035 },
    rotation: { x: -0.04, y: 0, z: 0 },
    scale: { x: 0.9, y: 0.9, z: 0.9 },
  },
};

const DEFAULT_ATTACHMENT: WeaponAttachmentConfig = {
  kind: "default",
  position: { x: 0, y: -0.055, z: -0.02 },
  rotation: { x: -0.08, y: 0, z: 0 },
  scale: { x: 0.92, y: 0.92, z: 0.92 },
};

export function getWeaponAttachmentConfig(
  weaponId: string | null | undefined
): WeaponAttachmentConfig {
  const normalized = normalizeWeaponId(weaponId);
  return normalized ? (ATTACHMENTS[normalized] ?? DEFAULT_ATTACHMENT) : DEFAULT_ATTACHMENT;
}

export function applyWeaponAttachment(
  weapon: THREE.Object3D,
  weaponId: string | null | undefined
): void {
  const config = getWeaponAttachmentConfig(weaponId);
  weapon.position.set(config.position.x, config.position.y, config.position.z);
  weapon.rotation.set(config.rotation.x, config.rotation.y, config.rotation.z);
  weapon.scale.set(config.scale.x, config.scale.y, config.scale.z);
  weapon.userData.weaponAttachmentKind = config.kind;
}
