import type {
  BuiltInObjectType,
  ColliderSchema,
  MapObject,
  MapObjectProperties,
  Vector3,
} from "./types/ObjectSchema";

export type ObjectCatalogItem = {
  type: BuiltInObjectType;
  label: string;
  icon: string;
  description: string;
  color: string;
  defaultScale: Vector3;
  collider?: ColliderSchema;
  properties?: MapObjectProperties;
};

export const OBJECT_CATALOG: ObjectCatalogItem[] = [
  {
    type: "cube",
    label: "Cubo",
    icon: "box",
    description: "Bloco basico para construir paredes e formas.",
    color: "#58a6ff",
    defaultScale: { x: 1, y: 1, z: 1 },
    collider: { shape: "box" },
    properties: { collision: true },
  },
  {
    type: "ramp",
    label: "Rampa",
    icon: "triangle-right",
    description: "Peca inclinada para subir, descer e conectar alturas.",
    color: "#9be564",
    defaultScale: { x: 2, y: 1, z: 2 },
    collider: { shape: "mesh" },
    properties: { collision: true },
  },
  {
    type: "platform",
    label: "Plataforma",
    icon: "panel-top",
    description: "Base larga para chao, pontes e ilhas.",
    color: "#d0d7de",
    defaultScale: { x: 4, y: 0.4, z: 4 },
    collider: { shape: "box" },
    properties: { collision: true },
  },
  {
    type: "movingPlatform",
    label: "Plataforma movel",
    icon: "move-3d",
    description: "Plataforma solida que se move entre dois pontos.",
    color: "#38bdf8",
    defaultScale: { x: 3, y: 0.35, z: 3 },
    collider: { shape: "box" },
    properties: {
      collision: true,
      startOffset: { x: 0, y: 0, z: 0 },
      endOffset: { x: 5, y: 0, z: 0 },
      speed: 1,
      loop: true,
    },
  },
  {
    type: "disappearingBlock",
    label: "Bloco que some",
    icon: "eye-off",
    description: "Bloco solido que desaparece e reaparece depois do toque.",
    color: "#f59e0b",
    defaultScale: { x: 2, y: 0.45, z: 2 },
    collider: { shape: "box" },
    properties: {
      collision: true,
      delayBeforeDisappear: 0.5,
      respawnDelay: 3,
    },
  },
  {
    type: "jumpPad",
    label: "Jump Pad",
    icon: "arrow-up",
    description: "Bloco de impulso que joga o player para cima.",
    color: "#22c55e",
    defaultScale: { x: 1.4, y: 0.28, z: 1.4 },
    collider: { shape: "box", isTrigger: true },
    properties: { collision: false, force: 12, cooldown: 0.4 },
  },
  {
    type: "spawn",
    label: "Spawn",
    icon: "map-pin",
    description: "Ponto inicial do jogador.",
    color: "#19c37d",
    defaultScale: { x: 1, y: 1, z: 1 },
    collider: { shape: "none" },
    properties: { collision: false },
  },
  {
    type: "damage",
    label: "Zona de dano",
    icon: "flame",
    description: "Volume que mata ou causa dano no modo jogar.",
    color: "#ff5c7a",
    defaultScale: { x: 3, y: 0.25, z: 3 },
    collider: { shape: "box", isTrigger: true },
    properties: { collision: false, mode: "kill", damage: 25, damagePerSecond: 25 },
  },
  {
    type: "teleporter",
    label: "Teleporte",
    icon: "repeat",
    description: "Portal que move o player para outro teleporte.",
    color: "#8b5cf6",
    defaultScale: { x: 1.4, y: 1, z: 1.4 },
    collider: { shape: "sphere", isTrigger: true, radius: 1 },
    properties: {
      collision: false,
      teleporterId: "tp_1",
      targetTeleporterId: "tp_2",
      cooldown: 1,
    },
  },
  {
    type: "messageZone",
    label: "Mensagem",
    icon: "message-square",
    description: "Zona transparente que mostra uma mensagem no HUD.",
    color: "#60a5fa",
    defaultScale: { x: 3, y: 1, z: 3 },
    collider: { shape: "box", isTrigger: true },
    properties: {
      collision: false,
      message: "Bem-vindo ao mapa!",
      oneTime: true,
    },
  },
  {
    type: "checkpoint",
    label: "Checkpoint",
    icon: "flag",
    description: "Marca de progresso do jogador.",
    color: "#ffcc4d",
    defaultScale: { x: 1, y: 1, z: 1 },
    collider: { shape: "sphere", isTrigger: true, radius: 1 },
    properties: { collision: false, checkpointId: "checkpoint", activatedColor: "#22c55e" },
  },
  {
    type: "coin",
    label: "Moeda",
    icon: "coins",
    description: "Coletavel simples.",
    color: "#ffd166",
    defaultScale: { x: 1, y: 1, z: 1 },
    collider: { shape: "sphere", isTrigger: true, radius: 0.6 },
    properties: { collision: false, value: 1, coinValue: 1 },
  },
  {
    type: "key",
    label: "Chave",
    icon: "key-round",
    description: "Chave coletavel para abrir portas especificas.",
    color: "#3b82f6",
    defaultScale: { x: 1, y: 1, z: 1 },
    collider: { shape: "sphere", isTrigger: true, radius: 0.65 },
    properties: {
      collision: false,
      keyId: "blue_key",
      label: "Chave Azul",
    },
  },
  {
    type: "door",
    label: "Porta",
    icon: "door-open",
    description: "Objeto que pode abrir com logica.",
    color: "#a06cd5",
    defaultScale: { x: 2, y: 3, z: 0.35 },
    collider: { shape: "box" },
    properties: {
      doorId: "door",
      doorState: "closed",
      openOffset: { x: 0, y: 4, z: 0 },
      startsOpen: false,
      requiredKeyId: "",
      collision: true,
    },
  },
  {
    type: "button",
    label: "Botao",
    icon: "circle-dot",
    description: "Ativador de portas, eventos ou logica.",
    color: "#f97316",
    defaultScale: { x: 1, y: 0.25, z: 1 },
    collider: { shape: "box", isTrigger: true },
    properties: { collision: false, targetDoorId: "", buttonTargetId: "", oneTime: true },
  },
  {
    type: "finish",
    label: "Final",
    icon: "trophy",
    description: "Ponto de vitoria do mapa.",
    color: "#22c55e",
    defaultScale: { x: 1.4, y: 1.4, z: 1.4 },
    collider: { shape: "sphere", isTrigger: true, radius: 1 },
    properties: {
      message: "Voce venceu!",
      requiresAllCoins: false,
      collision: false,
    },
  },
  {
    type: "npc",
    label: "NPC",
    icon: "user-round",
    description: "Personagem simples com dialogo.",
    color: "#4ecdc4",
    defaultScale: { x: 1, y: 1, z: 1 },
    collider: { shape: "capsule", height: 1.8, radius: 0.35 },
    properties: {
      collision: false,
      npcName: "Guia",
      dialog: "Ola, construtor!",
      dialogue: ["Ola, construtor!", "Use objetivos para guiar o jogador pelo mapa."],
      interactionRange: 4,
      showQuestHint: true,
    },
  },
  {
    type: "enemy",
    label: "Inimigo",
    icon: "skull",
    description: "Inimigo blocky simples com vida, patrulha e ataque por proximidade.",
    color: "#ef4444",
    defaultScale: { x: 1, y: 1, z: 1 },
    collider: { shape: "capsule", isTrigger: true, height: 1.8, radius: 0.4 },
    properties: {
      collision: false,
      enemyType: "basic",
      health: 50,
      damage: 10,
      speed: 2,
      detectionRange: 8,
      attackRange: 1.5,
      attackCooldown: 1,
      behavior: "chase",
      patrolOffset: { x: 4, y: 0, z: 0 },
    },
  },
  {
    type: "itemSpawner",
    label: "Spawner de Item",
    icon: "package",
    description: "Ponto que cria itens coletaveis no runtime.",
    color: "#06b6d4",
    defaultScale: { x: 1, y: 1, z: 1 },
    collider: { shape: "none" },
    properties: {
      collision: false,
      itemPool: ["weapon_basic", "weapon_dagger", "weapon_blaster", "weapon_heavy_hammer"],
      spawnItemType: "weapon_basic",
      spawnMode: "fixed",
      respawnTime: 10,
      spawnOnStart: true,
      maxSpawnedItems: 1,
      amount: 25,
    },
  },
  {
    type: "teamSpawn",
    label: "Spawn de Time",
    icon: "flag",
    description: "Ponto de nascimento usado por um time local.",
    color: "#ef4444",
    defaultScale: { x: 1.1, y: 1, z: 1.1 },
    collider: { shape: "none" },
    properties: {
      collision: false,
      teamId: "red",
    },
  },
  {
    type: "capturePoint",
    label: "Capture Point",
    icon: "circle-dot",
    description: "Area local que pode ser capturada para gerar pontos.",
    color: "#facc15",
    defaultScale: { x: 4, y: 0.3, z: 4 },
    collider: { shape: "box", isTrigger: true },
    properties: {
      collision: false,
      pointId: "point_a",
      ownerTeamId: "",
      captureTime: 5,
      scorePerSecond: 1,
      radius: 4,
    },
  },
  {
    type: "tree",
    label: "Arvore",
    icon: "tree-pine",
    description: "Arvore low-poly para decorar mapas externos.",
    color: "#2f9e44",
    defaultScale: { x: 1.4, y: 1.4, z: 1.4 },
    collider: { shape: "box" },
    properties: { collision: true, material: "default" },
  },
  {
    type: "rock",
    label: "Pedra",
    icon: "mountain",
    description: "Pedra blocada com colisao solida.",
    color: "#7f8c8d",
    defaultScale: { x: 1.2, y: 0.8, z: 1.1 },
    collider: { shape: "box" },
    properties: { collision: true, material: "default" },
  },
  {
    type: "crate",
    label: "Caixa",
    icon: "package",
    description: "Caixa de madeira para cenarios e obstaculos.",
    color: "#b7791f",
    defaultScale: { x: 1, y: 1, z: 1 },
    collider: { shape: "box" },
    properties: { collision: true, material: "default" },
  },
  {
    type: "barrel",
    label: "Barril",
    icon: "database",
    description: "Barril simples feito com cilindros.",
    color: "#8b5e34",
    defaultScale: { x: 1, y: 1.2, z: 1 },
    collider: { shape: "box" },
    properties: { collision: true, material: "metal" },
  },
  {
    type: "sign",
    label: "Placa",
    icon: "signpost",
    description: "Placa com texto configuravel.",
    color: "#d6a15d",
    defaultScale: { x: 1.4, y: 1.4, z: 1 },
    collider: { shape: "none" },
    properties: {
      collision: false,
      text: "Bem-vindo!",
      material: "default",
    },
  },
  {
    type: "lamp",
    label: "Lampada",
    icon: "lamp",
    description: "Poste decorativo com luz opcional.",
    color: "#fef08a",
    defaultScale: { x: 1, y: 1.6, z: 1 },
    collider: { shape: "none" },
    properties: {
      collision: false,
      material: "glow",
      emissive: "#fff7aa",
      lightEnabled: true,
      lightColor: "#fff7aa",
      lightIntensity: 1.5,
      lightRange: 8,
    },
  },
  {
    type: "arch",
    label: "Arco",
    icon: "landmark",
    description: "Arco solido para entradas e cenarios.",
    color: "#a8a29e",
    defaultScale: { x: 2.6, y: 2.4, z: 1 },
    collider: { shape: "box" },
    properties: { collision: true, material: "default" },
  },
  {
    type: "pillar",
    label: "Pilar",
    icon: "columns-3",
    description: "Pilar solido para templos e arenas.",
    color: "#d6d3d1",
    defaultScale: { x: 1, y: 2.2, z: 1 },
    collider: { shape: "box" },
    properties: { collision: true, material: "default" },
  },
  {
    type: "tycoonOwnerClaim",
    label: "Claim Tycoon",
    icon: "flag",
    description: "Area para reivindicar uma base tycoon.",
    color: "#22c55e",
    defaultScale: { x: 2.4, y: 0.25, z: 2.4 },
    collider: { shape: "box", isTrigger: true },
    properties: {
      collision: false,
      tycoonId: "tycoon_1",
      claimLabel: "Minha Fabrica",
      autoClaimInSolo: true,
    },
  },
  {
    type: "tycoonGenerator",
    label: "Gerador Tycoon",
    icon: "factory",
    description: "Maquina que gera dinheiro para o tycoon.",
    color: "#38bdf8",
    defaultScale: { x: 1.6, y: 1.3, z: 1.6 },
    collider: { shape: "box" },
    properties: {
      collision: true,
      tycoonId: "tycoon_1",
      generatorId: "generator_1",
      incomePerTick: 5,
      tickInterval: 2,
      targetCollectorId: "collector_1",
      requiresPurchase: false,
      startsEnabled: true,
      maxStoredAmount: 500,
    },
  },
  {
    type: "tycoonCollector",
    label: "Coletor Tycoon",
    icon: "hand-coins",
    description: "Area que transfere dinheiro pendente para o jogador.",
    color: "#facc15",
    defaultScale: { x: 2.2, y: 0.35, z: 2.2 },
    collider: { shape: "box", isTrigger: true },
    properties: {
      collision: false,
      tycoonId: "tycoon_1",
      collectorId: "collector_1",
      collectRadius: 2,
      capacity: 1000,
      autoCollect: true,
      collectCooldown: 0.5,
    },
  },
  {
    type: "tycoonBuyButton",
    label: "Botao de Compra",
    icon: "shopping-cart",
    description: "Botao que gasta dinheiro e libera itens do tycoon.",
    color: "#f97316",
    defaultScale: { x: 1.25, y: 0.25, z: 1.25 },
    collider: { shape: "box", isTrigger: true },
    properties: {
      collision: false,
      tycoonId: "tycoon_1",
      purchaseId: "purchase_1",
      cost: 25,
      unlockObjectIds: [],
      unlockGroupId: "",
      unlockButtonIds: [],
      requiredPurchaseIds: [],
      hideAfterPurchase: true,
      purchasedMessage: "Comprado!",
      insufficientFundsMessage: "Dinheiro insuficiente.",
      oneTime: true,
    },
  },
  {
    type: "tycoonUnlockable",
    label: "Item Tycoon",
    icon: "package-open",
    description: "Objeto que comeca bloqueado e aparece apos compra.",
    color: "#a78bfa",
    defaultScale: { x: 2, y: 1, z: 2 },
    collider: { shape: "box" },
    properties: {
      collision: true,
      tycoonId: "tycoon_1",
      purchaseId: "",
      groupId: "group_1",
      startsLocked: true,
      lockedCollision: false,
      unlockedMessage: "Item desbloqueado!",
    },
  },
  {
    type: "tycoonUpgrade",
    label: "Upgrade Tycoon",
    icon: "trending-up",
    description: "Compra que melhora geradores ou capacidade do coletor.",
    color: "#06b6d4",
    defaultScale: { x: 1.25, y: 0.35, z: 1.25 },
    collider: { shape: "box", isTrigger: true },
    properties: {
      collision: false,
      tycoonId: "tycoon_1",
      upgradeId: "upgrade_1",
      cost: 80,
      targetGeneratorIds: [],
      incomeMultiplier: 1.5,
      intervalMultiplier: 1,
      collectorCapacityBonus: 0,
      requiredPurchaseIds: [],
      maxLevel: 1,
      hideAfterPurchase: true,
    },
  },
  {
    type: "tycoonBarrier",
    label: "Barreira Tycoon",
    icon: "shield",
    description: "Barreira compravel que libera passagem apos desbloquear.",
    color: "#ef4444",
    defaultScale: { x: 3, y: 2.4, z: 0.25 },
    collider: { shape: "box" },
    properties: {
      collision: true,
      tycoonId: "tycoon_1",
      purchaseId: "barrier_1",
      startsLocked: true,
      lockedCollision: true,
      lockedColor: "#ef4444",
      unlockedColor: "#22c55e",
      opacity: 0.58,
      material: "glass",
    },
  },
  {
    type: "model",
    label: "Modelo 3D",
    icon: "upload",
    description: "Modelo importado pelo criador.",
    color: "#7c3aed",
    defaultScale: { x: 1, y: 1, z: 1 },
    collider: { shape: "mesh" },
    properties: { collision: true },
  },
];

export function getObjectCatalogItem(type: string): ObjectCatalogItem {
  return OBJECT_CATALOG.find((item) => item.type === type) ?? OBJECT_CATALOG[0];
}

export function createMapObject(
  type: BuiltInObjectType,
  position: Vector3,
  overrides: Partial<MapObject> = {}
): MapObject {
  const item = getObjectCatalogItem(type);
  const id = overrides.id ?? createId(type);
  const properties: MapObjectProperties = {
    color: item.color,
    ...item.properties,
    ...overrides.properties,
  };

  if (type === "door") {
    properties.doorId =
      typeof overrides.properties?.doorId === "string" && overrides.properties.doorId.length > 0
        ? overrides.properties.doorId
        : id;
  }

  if (type === "checkpoint") {
    properties.checkpointId =
      typeof overrides.properties?.checkpointId === "string" &&
      overrides.properties.checkpointId.length > 0
        ? overrides.properties.checkpointId
        : id;
  }

  if (type === "teleporter") {
    properties.teleporterId =
      typeof overrides.properties?.teleporterId === "string" &&
      overrides.properties.teleporterId.length > 0
        ? overrides.properties.teleporterId
        : id;
  }

  if (type === "capturePoint") {
    properties.pointId =
      typeof overrides.properties?.pointId === "string" && overrides.properties.pointId.length > 0
        ? overrides.properties.pointId
        : id;
  }

  if (type === "tycoonOwnerClaim") {
    properties.tycoonId =
      typeof overrides.properties?.tycoonId === "string" && overrides.properties.tycoonId.length > 0
        ? overrides.properties.tycoonId
        : id;
  }

  if (type === "tycoonGenerator") {
    properties.generatorId =
      typeof overrides.properties?.generatorId === "string" &&
      overrides.properties.generatorId.length > 0
        ? overrides.properties.generatorId
        : id;
  }

  if (type === "tycoonCollector") {
    properties.collectorId =
      typeof overrides.properties?.collectorId === "string" &&
      overrides.properties.collectorId.length > 0
        ? overrides.properties.collectorId
        : id;
  }

  if (type === "tycoonBuyButton" || type === "tycoonBarrier") {
    properties.purchaseId =
      typeof overrides.properties?.purchaseId === "string" &&
      overrides.properties.purchaseId.length > 0
        ? overrides.properties.purchaseId
        : id;
  }

  if (type === "tycoonUpgrade") {
    properties.upgradeId =
      typeof overrides.properties?.upgradeId === "string" &&
      overrides.properties.upgradeId.length > 0
        ? overrides.properties.upgradeId
        : id;
  }

  return {
    id,
    type,
    name: overrides.name ?? item.label,
    position: { ...position },
    rotation: overrides.rotation ?? { x: 0, y: 0, z: 0 },
    scale: overrides.scale ?? { ...item.defaultScale },
    assetId: overrides.assetId,
    collider: overrides.collider ?? item.collider,
    properties,
  };
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
