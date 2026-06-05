export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export const BUILT_IN_OBJECT_TYPES = [
  "cube",
  "ramp",
  "platform",
  "model",
  "spawn",
  "damage",
  "checkpoint",
  "coin",
  "door",
  "button",
  "finish",
  "npc",
  "enemy",
  "itemSpawner",
  "teamSpawn",
  "capturePoint",
  "movingPlatform",
  "disappearingBlock",
  "jumpPad",
  "teleporter",
  "messageZone",
  "key",
  "tree",
  "rock",
  "crate",
  "barrel",
  "sign",
  "lamp",
  "arch",
  "pillar",
] as const;

export type BuiltInObjectType = (typeof BUILT_IN_OBJECT_TYPES)[number];

export type MapObjectType = BuiltInObjectType | (string & {});

export type ColliderShape = "box" | "sphere" | "capsule" | "mesh" | "none";

export type ColliderSchema = {
  shape: ColliderShape;
  isTrigger?: boolean;
  size?: Vector3;
  radius?: number;
  height?: number;
};

export type MapObjectProperties = Record<string, unknown> & {
  color?: string;
  collision?: boolean;
  material?: "default" | "metal" | "glass" | "glow" | "rubber" | "ice";
  opacity?: number;
  emissive?: string;
  activatedColor?: string;
  mode?: "kill" | "damage";
  damage?: number;
  damagePerSecond?: number;
  checkpointId?: string;
  value?: number;
  coinValue?: number;
  doorId?: string;
  openOffset?: Vector3;
  startsOpen?: boolean;
  doorState?: "open" | "closed";
  targetDoorId?: string;
  oneTime?: boolean;
  buttonTargetId?: string;
  requiresAllCoins?: boolean;
  message?: string;
  dialog?: string;
  npcName?: string;
  dialogue?: string[];
  interactionRange?: number;
  showQuestHint?: boolean;
  enemyType?: "basic";
  health?: number;
  detectionRange?: number;
  attackRange?: number;
  attackCooldown?: number;
  behavior?: "idle" | "patrol" | "chase";
  patrolOffset?: Vector3;
  itemPool?: string[];
  spawnItemType?:
    | "health"
    | "coin"
    | "weapon_basic"
    | "weapon_basic_sword"
    | "weapon_heavy_hammer"
    | "weapon_dagger"
    | "weapon_blaster";
  spawnMode?: "fixed" | "random";
  respawnTime?: number;
  spawnOnStart?: boolean;
  maxSpawnedItems?: number;
  amount?: number;
  healAmount?: number;
  weaponId?: string;
  itemId?: string;
  sourceSpawnerId?: string;
  teamId?: string;
  pointId?: string;
  ownerTeamId?: string;
  captureTime?: number;
  scorePerSecond?: number;
  radius?: number;
  startOffset?: Vector3;
  endOffset?: Vector3;
  speed?: number;
  loop?: boolean;
  delayBeforeDisappear?: number;
  respawnDelay?: number;
  force?: number;
  teleporterId?: string;
  targetTeleporterId?: string;
  cooldown?: number;
  keyId?: string;
  label?: string;
  requiredKeyId?: string;
  text?: string;
  lightEnabled?: boolean;
  lightColor?: string;
  lightIntensity?: number;
  lightRange?: number;
};

export type MapObject = {
  id: string;
  type: MapObjectType;
  name?: string;
  position: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
  assetId?: string;
  materialId?: string;
  collider?: ColliderSchema;
  properties?: MapObjectProperties;
  scriptIds?: string[];
};

export type MapAsset = {
  id: string;
  name: string;
  kind: "model" | "texture" | "audio";
  mimeType?: string;
  dataUrl?: string;
  url?: string;
};

export function vector3(x = 0, y = 0, z = 0): Vector3 {
  return { x, y, z };
}
