import { createMapObject } from "./ObjectCatalog";
import { createEmptyGameMap, type AmbientMusic, type GameMap, type MapObjective, type VisualTheme } from "./types/MapSchema";
import { getThemeVisualSettings } from "./VisualSettings";
import type { BuiltInObjectType, MapObject, MapObjectProperties, Vector3 } from "./types/ObjectSchema";
import type { LogicAction, LogicCondition, LogicRule, LogicTrigger } from "./types/ScriptSchema";

type TemplateStyle =
  | "sandbox"
  | "obby"
  | "coinWorld"
  | "puzzle"
  | "challenge"
  | "mechanics"
  | "dungeon"
  | "logic"
  | "forest"
  | "desert"
  | "neon"
  | "city"
  | "island"
  | "stress";

type TemplateConfig = {
  id: string;
  name: string;
  description: string;
  icon: string;
  style: TemplateStyle;
  theme: VisualTheme;
  ambientMusic: AmbientMusic;
  tags: string[];
  minObjects: number;
  sections: number;
  areas: number;
  coins: number;
  doors: number;
  buttons: number;
  keys: number;
  checkpoints: number;
  damageZones: number;
  jumpPads: number;
  teleporters: number;
  movingPlatforms: number;
  disappearingBlocks: number;
  messageZones: number;
  logicRules: number;
  decorations: number;
  buildings?: number;
};

type Palette = {
  ground: string;
  platform: string;
  accent: string;
  secondary: string;
  hazard: string;
  decor: string;
  sign: string;
  door: string;
  glow?: boolean;
};

type ObjectOptions = {
  id?: string;
  name?: string;
  scale?: Vector3;
  rotation?: Vector3;
  properties?: MapObjectProperties;
};

type RoutePoint = Vector3 & {
  label: string;
  difficulty?: number;
};

const TEMPLATE_CONFIGS = [
  {
    id: "empty",
    name: "Mapa vazio",
    description: "Sandbox grande e limpo com grid visual, areas livres, placas e final distante.",
    icon: "square",
    style: "sandbox",
    theme: "classic",
    ambientMusic: "none",
    tags: ["sandbox", "grande", "classic"],
    minObjects: 110,
    sections: 5,
    areas: 6,
    coins: 8,
    doors: 0,
    buttons: 0,
    keys: 0,
    checkpoints: 2,
    damageZones: 0,
    jumpPads: 0,
    teleporters: 0,
    movingPlatforms: 0,
    disappearingBlocks: 0,
    messageZones: 4,
    logicRules: 1,
    decorations: 60
  },
  {
    id: "obby",
    name: "Obby basico",
    description: "Obby linear planejado com tutorial, dificuldade progressiva, checkpoints e final claro.",
    icon: "route",
    style: "obby",
    theme: "classic",
    ambientMusic: "adventure",
    tags: ["obby", "iniciante", "linear"],
    minObjects: 180,
    sections: 10,
    areas: 3,
    coins: 32,
    doors: 0,
    buttons: 0,
    keys: 0,
    checkpoints: 5,
    damageZones: 4,
    jumpPads: 3,
    teleporters: 2,
    movingPlatforms: 2,
    disappearingBlocks: 3,
    messageZones: 8,
    logicRules: 2,
    decorations: 34
  },
  {
    id: "coin",
    name: "Coleta de moedas",
    description: "Mapa semiaberto de exploracao com trilhas de moedas, bosque, ruina e ilha secreta.",
    icon: "coins",
    style: "coinWorld",
    theme: "grass",
    ambientMusic: "calm",
    tags: ["moedas", "coleta", "grass", "exploracao"],
    minObjects: 250,
    sections: 7,
    areas: 5,
    coins: 66,
    doors: 2,
    buttons: 2,
    keys: 1,
    checkpoints: 3,
    damageZones: 1,
    jumpPads: 1,
    teleporters: 2,
    movingPlatforms: 0,
    disappearingBlocks: 0,
    messageZones: 8,
    logicRules: 3,
    decorations: 118
  },
  {
    id: "door",
    name: "Porta e botao",
    description: "Puzzle grande de salas, portas, botoes, atalhos, chaves e logica visual.",
    icon: "door-open",
    style: "puzzle",
    theme: "classic",
    ambientMusic: "dark",
    tags: ["porta", "botao", "puzzle", "logica"],
    minObjects: 370,
    sections: 10,
    areas: 8,
    coins: 30,
    doors: 10,
    buttons: 10,
    keys: 3,
    checkpoints: 4,
    damageZones: 3,
    jumpPads: 2,
    teleporters: 4,
    movingPlatforms: 2,
    disappearingBlocks: 3,
    messageZones: 8,
    logicRules: 10,
    decorations: 120
  },
  {
    id: "checkpoint",
    name: "Checkpoint + zona de morte",
    description: "Mapa grande de desafio com respawn justo, perigos, saltos e risco por moedas.",
    icon: "flag",
    style: "challenge",
    theme: "desert",
    ambientMusic: "adventure",
    tags: ["checkpoint", "perigo", "desafio"],
    minObjects: 380,
    sections: 12,
    areas: 3,
    coins: 55,
    doors: 2,
    buttons: 2,
    keys: 1,
    checkpoints: 12,
    damageZones: 15,
    jumpPads: 8,
    teleporters: 2,
    movingPlatforms: 6,
    disappearingBlocks: 8,
    messageZones: 10,
    logicRules: 7,
    decorations: 130
  },
  {
    id: "mechanics",
    name: "Mapa de Mecanicas",
    description: "Laboratorio gigante com secoes separadas para testar cada mecanica pronta.",
    icon: "sparkles",
    style: "mechanics",
    theme: "neon",
    ambientMusic: "neon",
    tags: ["mecanicas", "demo", "laboratorio"],
    minObjects: 480,
    sections: 12,
    areas: 12,
    coins: 50,
    doors: 6,
    buttons: 6,
    keys: 4,
    checkpoints: 8,
    damageZones: 8,
    jumpPads: 8,
    teleporters: 6,
    movingPlatforms: 6,
    disappearingBlocks: 8,
    messageZones: 14,
    logicRules: 14,
    decorations: 160
  },
  {
    id: "combatArena",
    name: "Arena de Combate",
    description: "Arena compacta para testar vida, arma basica, inimigos e spawners de cura.",
    icon: "swords",
    style: "challenge",
    theme: "dark",
    ambientMusic: "adventure",
    tags: ["combate", "arena", "acao"],
    minObjects: 170,
    sections: 4,
    areas: 3,
    coins: 18,
    doors: 1,
    buttons: 0,
    keys: 0,
    checkpoints: 1,
    damageZones: 0,
    jumpPads: 0,
    teleporters: 0,
    movingPlatforms: 0,
    disappearingBlocks: 0,
    messageZones: 4,
    logicRules: 3,
    decorations: 92
  },
  {
    id: "combatDungeon",
    name: "Dungeon de Combate",
    description: "Dungeon compacta com arma basica, salas de inimigos, curas, portas por logica e boss final.",
    icon: "swords",
    style: "dungeon",
    theme: "dark",
    ambientMusic: "dark",
    tags: ["combate", "dungeon", "acao"],
    minObjects: 240,
    sections: 5,
    areas: 5,
    coins: 30,
    doors: 3,
    buttons: 0,
    keys: 0,
    checkpoints: 4,
    damageZones: 0,
    jumpPads: 0,
    teleporters: 0,
    movingPlatforms: 0,
    disappearingBlocks: 0,
    messageZones: 5,
    logicRules: 6,
    decorations: 92
  },
  {
    id: "guideMission",
    name: "Missao do Guia",
    description: "Missao curta com NPC guia, objetivos no HUD, moedas, chave, inimigos e final.",
    icon: "user-round",
    style: "forest",
    theme: "grass",
    ambientMusic: "calm",
    tags: ["missao", "npc", "objetivos"],
    minObjects: 180,
    sections: 5,
    areas: 5,
    coins: 24,
    doors: 1,
    buttons: 1,
    keys: 1,
    checkpoints: 2,
    damageZones: 0,
    jumpPads: 0,
    teleporters: 0,
    movingPlatforms: 0,
    disappearingBlocks: 0,
    messageZones: 5,
    logicRules: 5,
    decorations: 82
  },
  {
    id: "keyPuzzle",
    name: "Puzzle com Chave",
    description: "Escape room grande com seis chaves, varias salas, dicas e portas encadeadas.",
    icon: "key-round",
    style: "dungeon",
    theme: "dark",
    ambientMusic: "dark",
    tags: ["puzzle", "chave", "escape"],
    minObjects: 430,
    sections: 10,
    areas: 10,
    coins: 40,
    doors: 10,
    buttons: 8,
    keys: 6,
    checkpoints: 5,
    damageZones: 4,
    jumpPads: 2,
    teleporters: 2,
    movingPlatforms: 2,
    disappearingBlocks: 4,
    messageZones: 10,
    logicRules: 12,
    decorations: 150
  },
  {
    id: "logic",
    name: "Mapa com Logica",
    description: "Laboratorio sequencial de logica visual, com uma mecanica clara por sala.",
    icon: "workflow",
    style: "logic",
    theme: "neon",
    ambientMusic: "neon",
    tags: ["logica", "tutorial", "demo"],
    minObjects: 250,
    sections: 11,
    areas: 11,
    coins: 28,
    doors: 8,
    buttons: 8,
    keys: 3,
    checkpoints: 6,
    damageZones: 1,
    jumpPads: 0,
    teleporters: 2,
    movingPlatforms: 0,
    disappearingBlocks: 0,
    messageZones: 11,
    logicRules: 22,
    decorations: 72
  },
  {
    id: "forest",
    name: "Bosque Simples",
    description: "Floresta grande exploravel com trilha principal, ruina escondida, chaves e templo final.",
    icon: "tree-pine",
    style: "forest",
    theme: "grass",
    ambientMusic: "calm",
    tags: ["bosque", "grass", "exploracao"],
    minObjects: 640,
    sections: 10,
    areas: 8,
    coins: 80,
    doors: 4,
    buttons: 4,
    keys: 3,
    checkpoints: 5,
    damageZones: 4,
    jumpPads: 4,
    teleporters: 4,
    movingPlatforms: 3,
    disappearingBlocks: 4,
    messageZones: 8,
    logicRules: 8,
    decorations: 360
  },
  {
    id: "desert",
    name: "Deserto",
    description: "Ruinas enormes no deserto com templos, corredores, obby, teleporte e puzzle.",
    icon: "sun",
    style: "desert",
    theme: "desert",
    ambientMusic: "adventure",
    tags: ["deserto", "ruinas", "templo"],
    minObjects: 650,
    sections: 10,
    areas: 9,
    coins: 70,
    doors: 6,
    buttons: 6,
    keys: 4,
    checkpoints: 5,
    damageZones: 8,
    jumpPads: 4,
    teleporters: 6,
    movingPlatforms: 4,
    disappearingBlocks: 5,
    messageZones: 12,
    logicRules: 10,
    decorations: 360
  },
  {
    id: "neonObby",
    name: "Neon Obby",
    description: "Obby neon gigante com glow, muitos perigos, jump pads, plataformas moveis e final chamativo.",
    icon: "zap",
    style: "neon",
    theme: "neon",
    ambientMusic: "neon",
    tags: ["neon", "obby", "glow"],
    minObjects: 650,
    sections: 16,
    areas: 4,
    coins: 80,
    doors: 4,
    buttons: 4,
    keys: 2,
    checkpoints: 12,
    damageZones: 20,
    jumpPads: 15,
    teleporters: 4,
    movingPlatforms: 10,
    disappearingBlocks: 15,
    messageZones: 16,
    logicRules: 10,
    decorations: 260
  },
  {
    id: "megaObby",
    name: "Mega Obby Extremo",
    description: "Obby extremo de escala gigante para testar runtime, checkpoints e hazards em sequencia.",
    icon: "route",
    style: "obby",
    theme: "neon",
    ambientMusic: "neon",
    tags: ["mega", "obby", "stress"],
    minObjects: 850,
    sections: 18,
    areas: 4,
    coins: 100,
    doors: 6,
    buttons: 6,
    keys: 3,
    checkpoints: 15,
    damageZones: 20,
    jumpPads: 20,
    teleporters: 6,
    movingPlatforms: 15,
    disappearingBlocks: 20,
    messageZones: 18,
    logicRules: 14,
    decorations: 360
  },
  {
    id: "megaCoinWorld",
    name: "Mundo de Coleta Gigante",
    description: "Mundo aberto enorme com oito areas, muitas moedas, chaves, portas e teleportes.",
    icon: "coins",
    style: "coinWorld",
    theme: "grass",
    ambientMusic: "calm",
    tags: ["mega", "moedas", "exploracao"],
    minObjects: 920,
    sections: 12,
    areas: 8,
    coins: 180,
    doors: 10,
    buttons: 10,
    keys: 8,
    checkpoints: 8,
    damageZones: 8,
    jumpPads: 8,
    teleporters: 8,
    movingPlatforms: 8,
    disappearingBlocks: 8,
    messageZones: 12,
    logicRules: 18,
    decorations: 480
  },
  {
    id: "keyDungeon",
    name: "Dungeon de Chaves",
    description: "Dungeon gigante com muitas chaves, portas, botoes, moedas e logica encadeada.",
    icon: "key-round",
    style: "dungeon",
    theme: "dark",
    ambientMusic: "dark",
    tags: ["dungeon", "chaves", "puzzle"],
    minObjects: 850,
    sections: 14,
    areas: 12,
    coins: 100,
    doors: 20,
    buttons: 20,
    keys: 10,
    checkpoints: 10,
    damageZones: 10,
    jumpPads: 6,
    teleporters: 8,
    movingPlatforms: 8,
    disappearingBlocks: 8,
    messageZones: 16,
    logicRules: 32,
    decorations: 360
  },
  {
    id: "testCity",
    name: "Cidade de Teste",
    description: "Cidade local com predios, ruas, portas, botoes, checkpoints, moedas e teleportes.",
    icon: "map",
    style: "city",
    theme: "classic",
    ambientMusic: "adventure",
    tags: ["cidade", "teste", "escala"],
    minObjects: 1200,
    sections: 10,
    areas: 10,
    coins: 100,
    doors: 10,
    buttons: 10,
    keys: 5,
    checkpoints: 8,
    damageZones: 8,
    jumpPads: 6,
    teleporters: 8,
    movingPlatforms: 8,
    disappearingBlocks: 6,
    messageZones: 14,
    logicRules: 18,
    decorations: 300,
    buildings: 25
  },
  {
    id: "adventureIsland",
    name: "Ilha de Aventura",
    description: "Ilha enorme com biomas, pontes, segredos, chaves, portas, teleportes e final.",
    icon: "tree-pine",
    style: "island",
    theme: "grass",
    ambientMusic: "adventure",
    tags: ["ilha", "aventura", "exploracao"],
    minObjects: 1050,
    sections: 12,
    areas: 8,
    coins: 150,
    doors: 12,
    buttons: 12,
    keys: 8,
    checkpoints: 8,
    damageZones: 10,
    jumpPads: 10,
    teleporters: 8,
    movingPlatforms: 8,
    disappearingBlocks: 8,
    messageZones: 14,
    logicRules: 18,
    decorations: 560
  },
  {
    id: "stressTest",
    name: "Stress Test Completo",
    description: "Mapa massivo para testar editor, outliner, runtime, colisores, logica e JSON grande.",
    icon: "sparkles",
    style: "stress",
    theme: "neon",
    ambientMusic: "neon",
    tags: ["stress", "escala", "teste"],
    minObjects: 1500,
    sections: 20,
    areas: 14,
    coins: 250,
    doors: 30,
    buttons: 30,
    keys: 15,
    checkpoints: 20,
    damageZones: 30,
    jumpPads: 30,
    teleporters: 20,
    movingPlatforms: 20,
    disappearingBlocks: 20,
    messageZones: 30,
    logicRules: 50,
    decorations: 640,
    buildings: 20
  }
] as const satisfies readonly TemplateConfig[];

export type MapTemplateId = (typeof TEMPLATE_CONFIGS)[number]["id"];

export type MapTemplateDefinition = {
  id: MapTemplateId;
  name: string;
  description: string;
  icon: string;
};

export const MAP_TEMPLATES: MapTemplateDefinition[] = TEMPLATE_CONFIGS.map((template) => ({
  id: template.id,
  name: template.name,
  description: template.description,
  icon: template.icon
}));

const TEMPLATE_BY_ID = TEMPLATE_CONFIGS.reduce((record, template) => {
  record[template.id] = template;
  return record;
}, {} as Record<MapTemplateId, TemplateConfig>);

const PALETTES: Record<VisualTheme, Palette> = {
  classic: {
    ground: "#edf4fb",
    platform: "#d0d7de",
    accent: "#3b82f6",
    secondary: "#94a3b8",
    hazard: "#ef4444",
    decor: "#64748b",
    sign: "#d6a15d",
    door: "#a06cd5"
  },
  grass: {
    ground: "#73c66f",
    platform: "#7bc96f",
    accent: "#22c55e",
    secondary: "#3f8f46",
    hazard: "#ef4444",
    decor: "#476d3d",
    sign: "#d6a15d",
    door: "#8b5e34"
  },
  desert: {
    ground: "#e8c16d",
    platform: "#d9a441",
    accent: "#f59e0b",
    secondary: "#c0843e",
    hazard: "#dc2626",
    decor: "#a16207",
    sign: "#d6a15d",
    door: "#b7791f"
  },
  neon: {
    ground: "#111827",
    platform: "#00f5ff",
    accent: "#ff2bd6",
    secondary: "#8b5cf6",
    hazard: "#ff005d",
    decor: "#22d3ee",
    sign: "#39ff14",
    door: "#8b5cf6",
    glow: true
  },
  dark: {
    ground: "#1f2937",
    platform: "#334155",
    accent: "#a78bfa",
    secondary: "#64748b",
    hazard: "#b91c1c",
    decor: "#475569",
    sign: "#d6a15d",
    door: "#7c3aed"
  }
};

export function createMapFromTemplate(templateId: MapTemplateId = "empty"): GameMap {
  const config = TEMPLATE_BY_ID[templateId] ?? TEMPLATE_BY_ID.empty;
  const map = createGeneratedMap(config);
  applyObjectivePreset(map, config);
  return map;
}

function createGeneratedMap(config: TemplateConfig): GameMap {
  if (config.id === "empty") {
    return createDesignedSandboxMap(config);
  }

  if (config.id === "obby") {
    return createDesignedObbyMap(config);
  }

  if (config.id === "coin") {
    return createDesignedCoinMap(config);
  }

  if (config.id === "logic") {
    return createDesignedLogicMap(config);
  }

  if (config.id === "combatArena") {
    return createDesignedCombatArenaMap(config);
  }

  if (config.id === "combatDungeon") {
    return createDesignedCombatDungeonMap(config);
  }

  if (config.id === "guideMission") {
    return createDesignedGuideMissionMap(config);
  }

  if (isDesignedGuidedTemplate(config.id)) {
    return createDesignedGuidedMap(config);
  }

  const builder = new TemplateBuilder(config);
  const route = buildTemplateLayout(builder, config);

  createMainPath(builder, config, route);
  addOptionalLevelDesign(builder, config, route);
  generateGameplaySystems(builder, config, route);
  generateTemplateSpecificDecor(builder, config, route);
  const final = createFinalArea(builder, config, route);
  generateLogicPuzzle(builder, config, route, final);
  ensureObjectCount(builder, config.minObjects, config.style, route);

  return builder.map;
}

function applyObjectivePreset(map: GameMap, config: TemplateConfig): void {
  if ((map.objectives ?? []).length > 0) {
    return;
  }

  const final = map.objects.find((object) => object.type === "finish" || object.type === "goal");
  const coins = map.objects.filter((object) => object.type === "coin");
  const keys = map.objects.filter((object) => object.type === "key");
  const buttons = map.objects.filter((object) => object.type === "button");
  const doors = map.objects.filter((object) => object.type === "door");
  const enemies = map.objects.filter((object) => object.type === "enemy");
  const objectives: MapObjective[] = [];

  const addReachFinal = (id: string, title = "Chegue ao final"): void => {
    if (!final) {
      return;
    }

    objectives.push({
      id,
      title,
      type: "reachObject",
      targetObjectId: final.id,
      required: true,
      visible: true,
      completedMessage: "Final encontrado."
    });
  };

  if (config.id === "obby") {
    objectives.push({
      id: "obby_collect_guides",
      title: "Colete moedas guia",
      description: "Moedas mostram a linha segura do obby.",
      type: "collectCoins",
      targetAmount: Math.min(18, Math.max(1, coins.length)),
      required: false,
      visible: true,
      completedMessage: "Boa coleta pelo caminho."
    });
    addReachFinal("obby_finish", "Complete o Obby Basico");
  } else if (config.id === "coin") {
    objectives.push({
      id: "coin_collect_main",
      title: "Colete 35 moedas",
      description: "Siga a rota principal e explore laterais.",
      type: "collectCoins",
      targetAmount: Math.min(35, Math.max(1, coins.length)),
      required: true,
      visible: true,
      completedMessage: "Moedas principais coletadas."
    });

    const rewardKey = keys.find((key) => getKeyObjectId(key) === "coin_ruin_key") ?? keys[0];

    if (rewardKey) {
      objectives.push({
        id: "coin_optional_key",
        title: "Pegue a chave da ruina",
        description: "Ela libera uma recompensa lateral.",
        type: "collectKey",
        targetKeyId: getKeyObjectId(rewardKey),
        required: false,
        visible: true,
        completedMessage: "Chave opcional encontrada."
      });
    }

    addReachFinal("coin_finish", "Finalize a coleta");
  } else if (config.id === "combatArena") {
    objectives.push({
      id: "arena_weapon",
      title: "Pegue a arma basica",
      description: "O spawner azul fica na entrada.",
      type: "customLogic",
      required: true,
      visible: true,
      completedMessage: "Arma pronta."
    });
    objectives.push({
      id: "arena_defeat_all",
      title: "Derrote os inimigos",
      type: "defeatEnemies",
      targetAmount: Math.max(1, enemies.length),
      required: true,
      visible: true,
      completedMessage: "Arena limpa."
    });
    addReachFinal("arena_finish", "Entre no final da arena");
  } else if (config.id === "logic") {
    objectives.push({
      id: "logic_collect_room",
      title: "Colete 8 moedas da sala",
      type: "collectCoins",
      targetAmount: 8,
      required: true,
      visible: true,
      completedMessage: "Condição coinsAtLeast cumprida."
    });

    const masterKey = keys.find((key) => getKeyObjectId(key) === "logic_master_key") ?? keys.at(-1);

    if (masterKey) {
      objectives.push({
        id: "logic_master_key",
        title: "Pegue a chave master",
        type: "collectKey",
        targetKeyId: getKeyObjectId(masterKey),
        required: true,
        visible: true,
        completedMessage: "Chave master coletada."
      });
    }

    const finalDoor = doors.find((door) => getDoorId(door) === "logic_lab_door_8") ?? doors.at(-1);

    if (finalDoor) {
      objectives.push({
        id: "logic_open_final_door",
        title: "Abra a porta final",
        type: "openDoor",
        targetDoorId: getDoorId(finalDoor),
        required: true,
        visible: true,
        completedMessage: "Porta final aberta."
      });
    }

    addReachFinal("logic_finish", "Use finishMap no terminal");
  } else if (config.id === "mechanics") {
    objectives.push({
      id: "mechanics_collect",
      title: "Colete 10 moedas",
      type: "collectCoins",
      targetAmount: Math.min(10, Math.max(1, coins.length)),
      required: false,
      visible: true,
      completedMessage: "Moedas de teste coletadas."
    });

    if (buttons[0]) {
      objectives.push({
        id: "mechanics_press_button",
        title: "Teste um botao",
        type: "activateButton",
        targetObjectId: buttons[0].id,
        required: false,
        visible: true,
        completedMessage: "Botao testado."
      });
    }

    if (keys[0]) {
      objectives.push({
        id: "mechanics_get_key",
        title: "Pegue uma chave",
        type: "collectKey",
        targetKeyId: getKeyObjectId(keys[0]),
        required: false,
        visible: true,
        completedMessage: "Chave testada."
      });
    }

    addReachFinal("mechanics_finish", "Passe pelo laboratorio");
  }

  if (objectives.length === 0) {
    return;
  }

  map.objectives = objectives;
  map.gameplaySettings = {
    ...(map.gameplaySettings ?? {}),
    requireObjectivesToFinish: true
  };
}

function isDesignedGuidedTemplate(templateId: string): boolean {
  return [
    "door",
    "checkpoint",
    "mechanics",
    "keyPuzzle",
    "forest",
    "desert",
    "neonObby",
    "megaObby",
    "megaCoinWorld",
    "keyDungeon",
    "testCity",
    "adventureIsland",
    "stressTest"
  ].includes(templateId);
}

function createDesignedSandboxMap(config: TemplateConfig): GameMap {
  const builder = new TemplateBuilder(config);
  const route: RoutePoint[] = [];

  addSpawn(builder, { x: 0, y: 0.72, z: 4 });

  const editHub = addDesignedPlatform(builder, { x: 0, y: 0.2, z: 0 }, {
    name: "Area principal limpa de edicao",
    width: 18,
    length: 16,
    color: "#dbeafe",
    edgeCount: 7,
    supports: 2
  });
  route.push({ ...editHub.position, label: "Area de edicao principal" });
  createSign(builder, { x: -7, y: 0.2, z: 5.6 }, "Mapa vazio: base limpa para criar.");
  createMessageZone(builder, { x: 0, y: 1.05, z: 1.4 }, "Use esta area como ponto de partida. As outras ilhas mostram testes basicos.", {
    name: "Mensagem inicial do mapa vazio",
    scale: { x: 7, y: 1.4, z: 2.4 }
  });
  createCheckpoint(builder, { x: 6.8, y: 0.75, z: 4.8 }, "Checkpoint da area inicial");

  const buildPad = addDesignedPlatform(builder, { x: -18, y: 0.2, z: -18 }, {
    name: "Area livre para construir",
    width: 16,
    length: 16,
    color: "#e0f2fe",
    edgeCount: 6,
    supports: 2
  });
  route.push({ ...buildPad.position, label: "Area livre de construcao" });
  createTrailBridge(builder, editHub.position, buildPad.position, "Ligacao para area livre", "#93c5fd");
  createSign(builder, { x: -24, y: 0.2, z: -12.6 }, "Area livre: apague, duplique ou construa.");
  createMessageZone(builder, { x: -18, y: 1.05, z: -17.2 }, "Area sem puzzle: boa para testar cubos, rampas e modelos.", {
    name: "Mensagem area livre",
    scale: { x: 6, y: 1.4, z: 2.2 }
  });

  const movementPad = addDesignedPlatform(builder, { x: 18, y: 0.2, z: -18 }, {
    name: "Area de teste de movimento",
    width: 15,
    length: 14,
    color: "#dcfce7",
    edgeCount: 6,
    supports: 2
  });
  route.push({ ...movementPad.position, label: "Teste de movimento" });
  createTrailBridge(builder, editHub.position, movementPad.position, "Ligacao para teste de movimento", "#86efac");
  createSign(builder, { x: 12, y: 0.2, z: -12.5 }, "Teste: moedas marcam uma rota simples.");
  createCoinLine(builder, { x: 5, y: 1.15, z: -4 }, { x: 18, y: 1.15, z: -18 }, 8, "Moeda guia do mapa vazio");
  createCheckpoint(builder, { x: 23.5, y: 0.75, z: -14.4 }, "Checkpoint de teste de movimento");

  const puzzlePad = addDesignedPlatform(builder, { x: 0, y: 0.2, z: -36 }, {
    name: "Area de exemplo de fluxo",
    width: 16,
    length: 14,
    color: "#fef3c7",
    edgeCount: 6,
    supports: 2
  });
  route.push({ ...puzzlePad.position, label: "Exemplo de fluxo" });
  createTrailBridge(builder, buildPad.position, puzzlePad.position, "Ligacao da area livre ao exemplo", "#fde68a");
  createTrailBridge(builder, movementPad.position, puzzlePad.position, "Ligacao do teste ao exemplo", "#fde68a");
  createSign(builder, { x: -6.2, y: 0.2, z: -31 }, "Exemplo: este setor mostra como sinalizar um objetivo.");
  createMessageZone(builder, { x: 0, y: 1.05, z: -35.2 }, "Exemplo de fluxo: placa, moedas, checkpoint e final proximo.", {
    name: "Mensagem exemplo de fluxo",
    scale: { x: 6.4, y: 1.4, z: 2.2 }
  });
  createBlock(builder, { x: -5.6, y: 0.7, z: -38.8 }, {
    name: "Marcador editavel esquerdo",
    scale: { x: 1, y: 1, z: 1 },
    properties: { color: "#60a5fa", collision: false }
  });
  createBlock(builder, { x: 5.6, y: 0.7, z: -38.8 }, {
    name: "Marcador editavel direito",
    scale: { x: 1, y: 1, z: 1 },
    properties: { color: "#34d399", collision: false }
  });

  const finalPad = addDesignedPlatform(builder, { x: 0, y: 0.2, z: -54 }, {
    name: "Area final opcional",
    width: 14,
    length: 12,
    color: "#bbf7d0",
    edgeCount: 5,
    supports: 2
  });
  route.push({ ...finalPad.position, label: "Final opcional" });
  createTrailBridge(builder, puzzlePad.position, finalPad.position, "Ligacao para final opcional", "#bbf7d0");
  createSign(builder, { x: -5.4, y: 0.2, z: -50 }, "Final opcional: teste o runtime rapidamente.");
  const final = createFinish(builder, { x: 0, y: 1.25, z: -57 }, {
    name: "Final opcional do mapa vazio",
    properties: { message: "Mapa vazio testado com sucesso!" }
  });

  addPathPosts(builder, editHub.position, puzzlePad.position, 5, "Marcador de eixo principal do sandbox", "#bfdbfe");
  addDesignedTemplateDecor(builder, config, route);
  ensureObjectCount(builder, config.minObjects, config.style, route);
  builder.addLogic("Boas-vindas do mapa vazio", { type: "onMapStart" }, [], [
    { type: "showMessage", message: "Mapa vazio: base limpa com areas de teste e final opcional." }
  ]);
  builder.addLogic("Finaliza mapa vazio opcional", { type: "onPlayerEnterObject", objectId: final.id }, [{ type: "once" }], [
    { type: "finishMap" }
  ]);

  return builder.map;
}

function createDesignedObbyMap(config: TemplateConfig): GameMap {
  const builder = new TemplateBuilder(config);
  const route: RoutePoint[] = [];
  const sectionColors = ["#60a5fa", "#34d399", "#fbbf24", "#fb7185", "#a78bfa", "#22d3ee"];

  addSpawn(builder, { x: 0, y: 0.7, z: 4 });
  const start = addDesignedPlatform(builder, { x: 0, y: 0.2, z: 2 }, {
    name: "Area inicial do obby",
    width: 12,
    length: 10,
    color: sectionColors[0],
    edgeCount: 5
  });
  route.push({ ...start.position, label: "Area inicial" });
  createSign(builder, { x: -4.8, y: 0.2, z: 5.2 }, "Obby Basico: siga as moedas.");
  createMessageZone(builder, { x: 0, y: 1.05, z: 2.2 }, "Siga as moedas. Cada placa apresenta uma nova mecanica.", {
    name: "Tutorial inicial do obby"
  });

  const tutorial = addDesignedPlatform(builder, { x: 0, y: 0.2, z: -8 }, {
    name: "Tutorial de movimento",
    width: 9,
    length: 10,
    color: sectionColors[0],
    edgeCount: 5
  });
  route.push({ ...tutorial.position, label: "Tutorial" });
  createSign(builder, { x: -3.8, y: 0.2, z: -4.6 }, "Tutorial: avance e pule com calma.");
  createCheckpoint(builder, { x: 3.6, y: 0.65, z: -6.4 }, "Checkpoint tutorial");
  createCoinLine(builder, { x: 0, y: 1.15, z: -1 }, { x: 0, y: 1.15, z: -12 }, 6, "Moeda guia tutorial");

  const easyJumps = [
    { x: 0, z: -18, width: 5.2 },
    { x: 2.2, z: -25, width: 4.6 },
    { x: -2.2, z: -32, width: 4.2 },
    { x: 0, z: -39, width: 4.2 }
  ];
  easyJumps.forEach((pad, index) => {
    const point = addDesignedPlatform(builder, { x: pad.x, y: 0.2, z: pad.z }, {
      name: `Salto facil ${index + 1}`,
      width: pad.width,
      length: 4.6,
      color: sectionColors[1],
      edgeCount: 3,
      supports: 2
    });
    route.push({ ...point.position, label: `Salto facil ${index + 1}`, difficulty: 1 });
    createCoin(builder, { x: pad.x, y: 1.35, z: pad.z }, `Moeda salto facil ${index + 1}`);
  });
  createSign(builder, { x: -4.2, y: 0.2, z: -16.2 }, "Saltos faceis: as moedas marcam a aterrissagem.");

  const mediumEntry = addDesignedPlatform(builder, { x: 0, y: 0.2, z: -48 }, {
    name: "Entrada da primeira zona de morte",
    width: 8,
    length: 6,
    color: sectionColors[2],
    edgeCount: 4
  });
  route.push({ ...mediumEntry.position, label: "Primeira zona de morte", difficulty: 2 });
  createCheckpoint(builder, { x: -3.1, y: 0.65, z: -46.5 }, "Checkpoint antes do perigo");
  createSign(builder, { x: 3.2, y: 0.2, z: -45.4 }, "Perigo: caia so se quiser reiniciar.");
  createDamageZone(builder, { x: 0, y: 0.12, z: -57 }, {
    name: "Zona de morte dos saltos medios",
    scale: { x: 16, y: 0.25, z: 18 }
  });
  [
    { x: -3.2, z: -55 },
    { x: 3.2, z: -61 },
    { x: 0, z: -67 }
  ].forEach((pad, index) => {
    addDesignedPlatform(builder, { x: pad.x, y: 1.1, z: pad.z }, {
      name: `Salto medio ${index + 1}`,
      width: 4.2,
      length: 4.2,
      color: sectionColors[2],
      edgeCount: 2,
      supports: 2
    });
    createCoin(builder, { x: pad.x, y: 2.15, z: pad.z }, `Moeda salto medio ${index + 1}`);
  });
  createRewardCluster(builder, { x: 5.2, y: 2.1, z: -60 }, 5, "Moeda opcional de risco");

  const jumpPadBase = addDesignedPlatform(builder, { x: 0, y: 1.1, z: -76 }, {
    name: "Base do jump pad",
    width: 8,
    length: 6,
    color: sectionColors[3],
    edgeCount: 4
  });
  route.push({ ...jumpPadBase.position, label: "Jump pad", difficulty: 2 });
  createCheckpoint(builder, { x: -3.2, y: 1.55, z: -74.2 }, "Checkpoint antes do jump pad");
  createSign(builder, { x: 3.2, y: 1.1, z: -73.8 }, "Jump pad: mire na plataforma azul.");
  createJumpPad(builder, { x: 0, y: 1.45, z: -77.6 }, {
    name: "Jump pad principal",
    properties: { force: 16, color: "#38bdf8" }
  });
  createJumpPad(builder, { x: -2.7, y: 1.45, z: -78.3 }, {
    name: "Jump pad lateral de moedas",
    properties: { force: 13, color: "#fbbf24" }
  });
  const highLanding = addDesignedPlatform(builder, { x: 0, y: 3.2, z: -88 }, {
    name: "Aterrissagem alta",
    width: 8,
    length: 7,
    color: sectionColors[3],
    edgeCount: 4
  });
  route.push({ ...highLanding.position, label: "Aterrissagem do jump pad", difficulty: 3 });
  createCoinLine(builder, { x: 0, y: 4.2, z: -80.5 }, { x: 0, y: 4.2, z: -88.5 }, 5, "Moeda arco jump pad");

  createSign(builder, { x: -4.2, y: 3.2, z: -93.6 }, "Blocos que somem: pule sem parar.");
  createCheckpoint(builder, { x: 3.4, y: 3.65, z: -93.2 }, "Checkpoint blocos que somem");
  createDamageZone(builder, { x: 0, y: 0.2, z: -104 }, {
    name: "Zona de morte dos blocos que somem",
    scale: { x: 14, y: 0.25, z: 20 }
  });
  [
    { x: -2.4, z: -100 },
    { x: 0, z: -107 },
    { x: 2.4, z: -114 }
  ].forEach((pad, index) => {
    createDisappearingBlock(builder, { x: pad.x, y: 3.25, z: pad.z }, {
      name: `Bloco que some planejado ${index + 1}`,
      scale: { x: 3.8, y: 0.42, z: 3.8 },
      properties: {
        color: sectionColors[4],
        delayBeforeDisappear: 0.85,
        respawnDelay: 2.2
      }
    });
    createCoin(builder, { x: pad.x, y: 4.25, z: pad.z }, `Moeda bloco que some ${index + 1}`);
  });

  const movingEntry = addDesignedPlatform(builder, { x: 0, y: 3.2, z: -123 }, {
    name: "Entrada da plataforma movel",
    width: 8,
    length: 6,
    color: sectionColors[4],
    edgeCount: 4
  });
  route.push({ ...movingEntry.position, label: "Plataforma movel", difficulty: 4 });
  createSign(builder, { x: -4, y: 3.2, z: -121 }, "Plataforma movel: espere, entre, saia.");
  createMovingPlatform(builder, { x: 0, y: 3.35, z: -132 }, {
    name: "Plataforma movel principal",
    scale: { x: 4.6, y: 0.38, z: 4.6 },
    properties: {
      color: "#22c55e",
      startOffset: { x: -4, y: 0, z: 0 },
      endOffset: { x: 4, y: 0, z: -6 },
      speed: 1.1,
      loop: true
    }
  });
  createMovingPlatform(builder, { x: -5.4, y: 3.35, z: -138 }, {
    name: "Plataforma movel opcional de moedas",
    scale: { x: 3.8, y: 0.34, z: 3.8 },
    properties: {
      color: "#f59e0b",
      startOffset: { x: 0, y: 0, z: 0 },
      endOffset: { x: 6, y: 0, z: 0 },
      speed: 1,
      loop: true
    }
  });
  createRewardCluster(builder, { x: -5.4, y: 4.2, z: -138 }, 6, "Moeda plataforma movel opcional");

  const finalEntry = addDesignedPlatform(builder, { x: 0, y: 3.2, z: -146 }, {
    name: "Entrada do desafio final",
    width: 8,
    length: 6,
    color: sectionColors[5],
    edgeCount: 4
  });
  route.push({ ...finalEntry.position, label: "Desafio final", difficulty: 5 });
  createCheckpoint(builder, { x: 3.2, y: 3.65, z: -144.2 }, "Checkpoint desafio final");
  createDamageZone(builder, { x: 0, y: 0.2, z: -157 }, {
    name: "Zona de morte final",
    scale: { x: 15, y: 0.25, z: 20 }
  });
  createCoinLine(builder, { x: 0, y: 4.15, z: -146 }, { x: 0, y: 4.15, z: -162 }, 8, "Moeda guia final");
  [
    { x: -2, z: -153 },
    { x: 2, z: -160 },
    { x: 0, z: -167 }
  ].forEach((pad, index) => {
    addDesignedPlatform(builder, { x: pad.x, y: 3.2, z: pad.z }, {
      name: `Plataforma final estreita ${index + 1}`,
      width: 4.2,
      length: 5,
      color: sectionColors[5],
      edgeCount: 2,
      supports: 2
    });
  });

  const finishPlatform = addDesignedPlatform(builder, { x: 0, y: 3.2, z: -176 }, {
    name: "Plataforma de vitoria do obby",
    width: 10,
    length: 8,
    color: "#22c55e",
    edgeCount: 5
  });
  route.push({ ...finishPlatform.position, label: "Final", difficulty: 5 });
  createSign(builder, { x: -4, y: 3.2, z: -174 }, "Final: voce dominou o obby.");
  createMessageZone(builder, { x: 0, y: 4.05, z: -175.4 }, "Fim do Obby Basico. O caminho inteiro foi feito para treino progressivo.", {
    name: "Mensagem final do obby"
  });
  const final = createFinish(builder, { x: 0, y: 4.15, z: -179 }, {
    name: "Final do Obby Basico",
    properties: { message: "Obby Basico concluido!" }
  });
  builder.addLogic("Mensagem inicial do obby", { type: "onMapStart" }, [], [
    { type: "showMessage", message: "Obby Basico: siga a rota azul ate o final." }
  ]);
  builder.addLogic("Finaliza Obby Basico", { type: "onPlayerEnterObject", objectId: final.id }, [{ type: "once" }], [
    { type: "finishMap" }
  ]);

  return builder.map;
}

function createDesignedCoinMap(config: TemplateConfig): GameMap {
  const builder = new TemplateBuilder(config);
  addSpawn(builder, { x: 0, y: 0.72, z: 3.5 });

  const plaza = addDesignedPlatform(builder, { x: 0, y: 0.2, z: 0 }, {
    name: "Praca inicial da coleta",
    width: 18,
    length: 16,
    color: "#7ddf8f",
    edgeCount: 7
  });
  createSign(builder, { x: -7.2, y: 0.2, z: 5.2 }, "Objetivo: siga as moedas douradas.");
  createMessageZone(builder, { x: 0, y: 1.05, z: 1.5 }, "Coleta de Moedas: trilhas guiam, areas laterais recompensam.", {
    name: "Mensagem da praca inicial"
  });
  createCheckpoint(builder, { x: 6.4, y: 0.65, z: 4.5 }, "Checkpoint praca inicial");

  const route: RoutePoint[] = [
    { ...plaza.position, label: "Praca inicial" },
    { x: -10, y: 0.2, z: -14, label: "Trilha principal" },
    { x: -24, y: 0.2, z: -28, label: "Bosque lateral" },
    { x: 4, y: 0.2, z: -36, label: "Area elevada" },
    { x: 24, y: 0.2, z: -30, label: "Ruina da chave" },
    { x: 14, y: 0.2, z: -54, label: "Area final" }
  ];

  for (let index = 1; index < route.length; index += 1) {
    createTrailBridge(builder, route[index - 1], route[index], `Trilha principal ${index}`, "#b9f38a");
    createNaturalBorder(builder, route[index - 1], route[index], 5 + (index % 3), `Borda natural ${index}`);
  }

  addDesignedPlatform(builder, route[1], {
    name: "Bifurcacao sinalizada",
    width: 11,
    length: 10,
    color: "#a7f3d0",
    edgeCount: 5
  });
  createSign(builder, { x: -14, y: 0.2, z: -11.2 }, "Trilha principal: moedas em linha.");
  createCoinLine(builder, { x: 0, y: 1.12, z: -3 }, { x: -10, y: 1.12, z: -14 }, 10, "Moeda trilha principal A");
  createCoinLine(builder, { x: -10, y: 1.12, z: -14 }, { x: -24, y: 1.12, z: -28 }, 10, "Moeda trilha principal B");

  addDesignedPlatform(builder, route[2], {
    name: "Clareira do bosque lateral",
    width: 15,
    length: 13,
    color: "#86efac",
    edgeCount: 6
  });
  createSign(builder, { x: -31, y: 0.2, z: -24 }, "Bosque: procure moedas entre as arvores.");
  createCheckpoint(builder, { x: -18, y: 0.65, z: -24 }, "Checkpoint bosque lateral");
  createCoinCluster(builder, { x: -24, y: 1.1, z: -28 }, 14, 5.2, "Moeda escondida no bosque");
  createForestPocket(builder, route[2], "Bosque lateral planejado");

  addDesignedPlatform(builder, { x: 4, y: 1.8, z: -39 }, {
    name: "Plataforma elevada de moedas",
    width: 13,
    length: 10,
    color: "#bef264",
    edgeCount: 5
  });
  createSign(builder, { x: -1.6, y: 0.2, z: -34 }, "Jump pad: area alta tem moedas raras.");
  createJumpPad(builder, { x: 1, y: 0.55, z: -33.5 }, {
    name: "Jump pad para area elevada",
    properties: { force: 13, color: "#38bdf8" }
  });
  createCoinLine(builder, { x: 0.5, y: 2.85, z: -36 }, { x: 8, y: 2.85, z: -42 }, 9, "Moeda elevada");

  addDesignedPlatform(builder, route[4], {
    name: "Ruina da chave opcional",
    width: 16,
    length: 14,
    color: "#d9c8a9",
    edgeCount: 5
  });
  createSign(builder, { x: 17, y: 0.2, z: -24.5 }, "Ruina: a chave abre a sala de recompensa.");
  createRuinCluster(builder, route[4]);
  const rewardKeyId = "coin_ruin_key";
  const rewardDoorId = "coin_reward_door";
  createKey(builder, { x: 19, y: 1.25, z: -28 }, {
    name: "Chave da ruina",
    properties: {
      keyId: rewardKeyId,
      label: "Chave da recompensa",
      color: "#22c55e"
    }
  });
  createDoor(builder, { x: 27.5, y: 1.65, z: -34 }, {
    name: "Porta da recompensa",
    rotation: { x: 0, y: Math.PI / 2, z: 0 },
    properties: {
      doorId: rewardDoorId,
      requiredKeyId: rewardKeyId,
      color: "#22c55e"
    }
  });
  createButton(builder, { x: 22, y: 0.35, z: -24 }, {
    name: "Botao da sala de recompensa",
    properties: {
      targetDoorId: rewardDoorId,
      buttonTargetId: rewardDoorId,
      color: "#22c55e",
      oneTime: true
    }
  });
  addDesignedPlatform(builder, { x: 33, y: 0.2, z: -34 }, {
    name: "Sala de recompensa da ruina",
    width: 10,
    length: 10,
    color: "#bbf7d0",
    edgeCount: 4
  });
  createCoinCluster(builder, { x: 33, y: 1.1, z: -34 }, 12, 3.8, "Moeda recompensa da porta");

  const teleporterAId = "coin_secret_entry";
  const teleporterBId = "coin_secret_island";
  addDesignedPlatform(builder, { x: -2, y: 0.2, z: -47 }, {
    name: "Base sinalizada do teleporte secreto",
    width: 8,
    length: 8,
    color: "#ddd6fe",
    edgeCount: 4,
    supports: 2
  });
  createTrailBridge(builder, { x: -2, y: 0.2, z: -47 }, route[5], "Trilha do teleporte secreto ate o final", "#ddd6fe");
  createSign(builder, { x: -6, y: 0.2, z: -47 }, "Teleporte: ilha secreta de moedas.");
  createTeleporter(builder, { x: -2, y: 0.55, z: -47 }, {
    name: "Teleporte para ilha secreta",
    properties: {
      teleporterId: teleporterAId,
      targetTeleporterId: teleporterBId,
      color: "#8b5cf6"
    }
  });
  addDesignedPlatform(builder, { x: -38, y: 0.2, z: -52 }, {
    name: "Ilha secreta",
    width: 14,
    length: 12,
    color: "#93c5fd",
    edgeCount: 5
  });
  createTeleporter(builder, { x: -34, y: 0.55, z: -50 }, {
    name: "Retorno da ilha secreta",
    properties: {
      teleporterId: teleporterBId,
      targetTeleporterId: teleporterAId,
      color: "#8b5cf6"
    }
  });
  createSign(builder, { x: -44, y: 0.2, z: -48 }, "Ilha secreta: recompensa por explorar.");
  createCoinCluster(builder, { x: -38, y: 1.1, z: -52 }, 12, 4.6, "Moeda ilha secreta");
  createForestPocket(builder, { x: -38, y: 0.2, z: -52 }, "Borda da ilha secreta");

  addDesignedPlatform(builder, route[5], {
    name: "Praca final da coleta",
    width: 16,
    length: 14,
    color: "#fde68a",
    edgeCount: 6
  });
  createCheckpoint(builder, { x: 8, y: 0.65, z: -51 }, "Checkpoint area final");
  createCoinLine(builder, { x: 24, y: 1.12, z: -30 }, { x: 14, y: 1.12, z: -54 }, 9, "Moeda trilha para final");
  createRewardCluster(builder, { x: 18, y: 1.15, z: -57 }, 4, "Moeda final extra");
  createSign(builder, { x: 8, y: 0.2, z: -58 }, "Final: volte depois para achar todos os segredos.");
  createTree(builder, { x: 20.5, y: 0, z: -58.5 }, { name: "Landmark natural do final", scale: scalar(1.35) });
  createRock(builder, { x: 8.4, y: 0, z: -59.2 }, { name: "Pedra guia do final" });
  const final = createFinish(builder, { x: 14, y: 1.25, z: -59 }, {
    name: "Final da Coleta de Moedas",
    properties: { message: "Coleta de Moedas concluida!" }
  });
  builder.addLogic("Boas-vindas da coleta", { type: "onMapStart" }, [], [
    { type: "showMessage", message: "Coleta de Moedas: moedas em trilha indicam caminho, moedas agrupadas indicam segredo." }
  ]);
  builder.addLogic("Recompensa da chave opcional", { type: "onKeyCollected", keyId: rewardKeyId }, [], [
    { type: "showMessage", message: "Chave da ruina coletada. Procure a porta verde." }
  ]);
  builder.addLogic("Finaliza Coleta de Moedas", { type: "onPlayerEnterObject", objectId: final.id }, [{ type: "once" }], [
    { type: "finishMap" }
  ]);

  return builder.map;
}

function createDesignedLogicMap(config: TemplateConfig): GameMap {
  const builder = new TemplateBuilder(config);
  const roomCenters = Array.from({ length: 11 }, (_, index) => ({
    x: index % 2 === 0 ? 0 : 16,
    y: 0.2,
    z: 2 - index * 14,
    label: `Sala ${index}`
  }));
  const roomLabels = [
    "Entrada do Laboratorio",
    "onMapStart",
    "onPlayerEnterObject",
    "Botao abre porta",
    "Moedas e coinsAtLeast",
    "Chave e hasKey",
    "Teleporte",
    "enableObject / disableObject",
    "once",
    "Checkpoint por logica",
    "finishMap"
  ];

  addSpawn(builder, { x: 0, y: 0.75, z: 5 });

  roomCenters.forEach((center, index) => {
    createLabRoom(builder, center, roomLabels[index], index);

    if (index > 0) {
      createTrailBridge(builder, roomCenters[index - 1], center, `Corredor do laboratorio ${index}`, "#1e3a8a");
    }
  });

  const roomZones = roomCenters.map((center, index) => createMessageZone(builder, { x: center.x, y: 1.05, z: center.z + 1.2 }, getLogicRoomMessage(index), {
    id: `logic_room_${index}_zone`,
    name: `Zona didatica ${roomLabels[index]}`,
    scale: { x: 5.2, y: 1.4, z: 2.4 },
    properties: { color: "#60a5fa", opacity: 0.25 }
  }));

  const checkpoints = [0, 2, 4, 6, 8, 9].map((roomIndex) => createCheckpoint(builder, {
    x: roomCenters[roomIndex].x + 4.6,
    y: 0.65,
    z: roomCenters[roomIndex].z + 3.6
  }, `Checkpoint logica ${roomIndex + 1}`));

  const doorIds = Array.from({ length: 8 }, (_, index) => `logic_lab_door_${index + 1}`);
  const doors = doorIds.map((doorId, index) => {
    const from = roomCenters[index + 1];
    const to = roomCenters[index + 2];
    const mid = {
      x: (from.x + to.x) / 2,
      y: 1.65,
      z: (from.z + to.z) / 2
    };
    return createDoor(builder, mid, {
      name: `Porta logica ${index + 1}`,
      rotation: { x: 0, y: Math.atan2(to.x - from.x, to.z - from.z), z: 0 },
      properties: {
        doorId,
        color: index % 2 === 0 ? "#38bdf8" : "#a78bfa",
        openOffset: { x: 0, y: 3.8, z: 0 }
      }
    });
  });

  const buttons = doorIds.map((doorId, index) => {
    const room = roomCenters[Math.min(index + 1, roomCenters.length - 2)];
    return createButton(builder, {
      x: room.x - 4.6,
      y: 0.35,
      z: room.z - 2.4
    }, {
      name: `Botao logico ${index + 1}`,
      properties: {
        targetDoorId: doorId,
        buttonTargetId: doorId,
        oneTime: index !== 6,
        color: index % 2 === 0 ? "#38bdf8" : "#a78bfa"
      }
    });
  });

  const coinObjects: MapObject[] = [];
  [
    { x: roomCenters[4].x - 3, z: roomCenters[4].z - 1 },
    { x: roomCenters[4].x, z: roomCenters[4].z - 1 },
    { x: roomCenters[4].x + 3, z: roomCenters[4].z - 1 },
    { x: roomCenters[4].x - 3, z: roomCenters[4].z + 2.5 },
    { x: roomCenters[4].x, z: roomCenters[4].z + 2.5 },
    { x: roomCenters[4].x + 3, z: roomCenters[4].z + 2.5 },
    { x: roomCenters[4].x - 1.5, z: roomCenters[4].z - 4 },
    { x: roomCenters[4].x + 1.5, z: roomCenters[4].z - 4 }
  ].forEach((position, index) => {
    coinObjects.push(createCoin(builder, { x: position.x, y: 1.15, z: position.z }, `Moeda logica coinsAtLeast ${index + 1}`));
  });
  createCoinLine(builder, { x: roomCenters[1].x - 3, y: 1.12, z: roomCenters[1].z + 2 }, { x: roomCenters[3].x + 3, y: 1.12, z: roomCenters[3].z + 2 }, 10, "Moeda guia laboratorio");
  createCoinCluster(builder, { x: roomCenters[10].x, y: 1.12, z: roomCenters[10].z + 1 }, 10, 3.4, "Moeda recompensa final logica");

  const keyBlueId = "logic_blue_key";
  const keyGreenId = "logic_green_key";
  const keyMasterId = "logic_master_key";
  const keyBlue = createKey(builder, { x: roomCenters[5].x - 2.8, y: 1.25, z: roomCenters[5].z + 1.5 }, {
    name: "Chave azul do hasKey",
    properties: { keyId: keyBlueId, label: "Chave Azul", color: "#38bdf8" }
  });
  const keyGreen = createKey(builder, { x: roomCenters[7].x + 3, y: 1.25, z: roomCenters[7].z + 1.8 }, {
    name: "Chave verde de controle",
    properties: { keyId: keyGreenId, label: "Chave Verde", color: "#22c55e" }
  });
  const keyMaster = createKey(builder, { x: roomCenters[8].x - 3, y: 1.25, z: roomCenters[8].z + 1.8 }, {
    name: "Chave master final",
    properties: { keyId: keyMasterId, label: "Chave Master", color: "#fbbf24" }
  });
  doors[4].properties = {
    ...doors[4].properties,
    requiredKeyId: keyBlueId,
    color: "#38bdf8"
  };
  doors[7].properties = {
    ...doors[7].properties,
    requiredKeyId: keyMasterId,
    color: "#fbbf24"
  };

  const teleporterAId = "logic_teleporter_a";
  const teleporterBId = "logic_teleporter_b";
  const teleporterA = createTeleporter(builder, { x: roomCenters[6].x - 3.3, y: 0.55, z: roomCenters[6].z }, {
    name: "Teleporte laboratorio A",
    properties: {
      teleporterId: teleporterAId,
      targetTeleporterId: teleporterBId,
      color: "#8b5cf6"
    }
  });
  const teleporterB = createTeleporter(builder, { x: roomCenters[6].x + 3.3, y: 0.55, z: roomCenters[6].z - 3.2 }, {
    name: "Teleporte laboratorio B",
    properties: {
      teleporterId: teleporterBId,
      targetTeleporterId: teleporterAId,
      color: "#8b5cf6"
    }
  });
  createSign(builder, { x: roomCenters[2].x - 5.3, y: 0.25, z: roomCenters[2].z + 0.2 }, "Entre na sala: a regra abre a proxima porta.");
  createSign(builder, { x: roomCenters[3].x - 5.3, y: 0.25, z: roomCenters[3].z + 0.2 }, "Pressione o botao para liberar a sala de moedas.");
  createSign(builder, { x: roomCenters[4].x - 5.3, y: 0.25, z: roomCenters[4].z + 0.2 }, "Colete 8 moedas desta sala.");
  createSign(builder, { x: roomCenters[5].x - 5.3, y: 0.25, z: roomCenters[5].z + 0.2 }, "Pegue a chave azul antes da porta azul.");
  createSign(builder, { x: roomCenters[6].x - 5.3, y: 0.25, z: roomCenters[6].z + 0.2 }, "Teleporte marcado: entrada e destino na mesma sala.");
  createSign(builder, { x: roomCenters[7].x - 5.3, y: 0.25, z: roomCenters[7].z + 0.2 }, "Chave verde e botao controlam o bloco.");
  createSign(builder, { x: roomCenters[8].x - 5.3, y: 0.25, z: roomCenters[8].z + 0.2 }, "Pegue a chave master antes da porta final.");

  const controlledBlock = createBlock(builder, { x: roomCenters[7].x, y: 1, z: roomCenters[7].z - 1 }, {
    id: "logic_controlled_block",
    name: "Bloco controlado por enable disable",
    scale: { x: 1.8, y: 1.8, z: 1.8 },
    properties: {
      color: "#f97316",
      collision: false,
      material: "glow",
      emissive: "#f97316"
    }
  });
  const onceReward = createBlock(builder, { x: roomCenters[8].x + 3.8, y: 0.85, z: roomCenters[8].z - 1 }, {
    id: "logic_once_reward",
    name: "Recompensa visual once",
    scale: { x: 1.4, y: 1.4, z: 1.4 },
    properties: {
      color: "#22c55e",
      collision: false,
      material: "glow",
      emissive: "#22c55e"
    }
  });
  const final = createFinish(builder, { x: roomCenters[10].x, y: 1.25, z: roomCenters[10].z - 4.2 }, {
    name: "Terminal final finishMap",
    properties: {
      color: "#39ff14",
      material: "glow",
      emissive: "#39ff14",
      message: "Laboratorio de Logica concluido!"
    }
  });

  builder.addLogic("01 onMapStart mostra boas-vindas", { type: "onMapStart" }, [], [
    { type: "showMessage", message: "Laboratorio de Logica: siga as salas em ordem." }
  ]);
  builder.addLogic("02 entrar na sala mostra mensagem", { type: "onPlayerEnterObject", objectId: roomZones[2].id }, [], [
    { type: "showMessage", message: "onPlayerEnterObject detectou sua entrada." }
  ]);
  builder.addLogic("03 sala onMapStart libera primeira porta", { type: "onPlayerEnterObject", objectId: roomZones[1].id }, [{ type: "once" }], [
    { type: "openDoor", doorId: doorIds[0] }
  ]);
  builder.addLogic("04 botao abre porta proxima", { type: "onButtonActivated", objectId: buttons[1].id }, [], [
    { type: "openDoor", doorId: doorIds[1] }
  ]);
  builder.addLogic("05 botao tambem da feedback", { type: "onButtonActivated", objectId: buttons[1].id }, [], [
    { type: "showMessage", message: "Botao ativado: a porta ao lado abriu." }
  ]);
  builder.addLogic("06 botao da sala de botao libera moedas", { type: "onButtonActivated", objectId: buttons[2].id }, [], [
    { type: "openDoor", doorId: doorIds[2] }
  ]);
  builder.addLogic("06 moeda coletada da bonus", { type: "onCoinCollected", objectId: coinObjects[0].id }, [], [
    { type: "giveCoins", amount: 2 }
  ]);
  builder.addLogic("07 coinsAtLeast abre porta", { type: "onCoinCollected", objectId: coinObjects[7].id }, [{ type: "coinsAtLeast", amount: 8 }], [
    { type: "openDoor", doorId: doorIds[3] }
  ]);
  builder.addLogic("08 coinsAtLeast avisa objetivo", { type: "onCoinCollected", objectId: coinObjects[3].id }, [{ type: "once" }], [
    { type: "showMessage", message: "Colete 8 moedas desta sala para liberar a porta." }
  ]);
  builder.addLogic("09 hasKey abre porta azul", { type: "onKeyCollected", keyId: keyBlueId }, [{ type: "hasKey", keyId: keyBlueId }], [
    { type: "openDoor", doorId: doorIds[4] }
  ]);
  builder.addLogic("10 chave azul mostra feedback", { type: "onKeyCollected", keyId: keyBlueId }, [], [
    { type: "showMessage", message: "Chave azul coletada: hasKey agora e verdadeiro." }
  ]);
  builder.addLogic("11 botao teleporta jogador", { type: "onButtonActivated", objectId: buttons[4].id }, [], [
    { type: "teleportPlayer", targetObjectId: teleporterB.id }
  ]);
  builder.addLogic("12 destino do teleporte abre porta", { type: "onPlayerEnterObject", objectId: roomZones[6].id }, [{ type: "once" }], [
    { type: "openDoor", doorId: doorIds[5] }
  ]);
  builder.addLogic("13 chave verde habilita bloco", { type: "onKeyCollected", keyId: keyGreenId }, [], [
    { type: "enableObject", objectId: controlledBlock.id }
  ]);
  builder.addLogic("14 botao desabilita bloco", { type: "onButtonActivated", objectId: buttons[6].id }, [], [
    { type: "disableObject", objectId: controlledBlock.id }
  ]);
  builder.addLogic("15 botao de controle abre porta", { type: "onButtonActivated", objectId: buttons[6].id }, [], [
    { type: "openDoor", doorId: doorIds[6] }
  ]);
  builder.addLogic("16 once mostra mensagem uma vez", { type: "onPlayerEnterObject", objectId: roomZones[8].id }, [{ type: "once" }], [
    { type: "showMessage", message: "Condicao once: esta mensagem nao deve repetir." }
  ]);
  builder.addLogic("17 once habilita recompensa visual", { type: "onPlayerEnterObject", objectId: roomZones[8].id }, [{ type: "once" }], [
    { type: "enableObject", objectId: onceReward.id }
  ]);
  builder.addLogic("18 checkpoint por logica", { type: "onPlayerEnterObject", objectId: roomZones[9].id }, [{ type: "once" }], [
    { type: "setCheckpoint", objectId: checkpoints[5].id }
  ]);
  builder.addLogic("19 checkpoint confirma progresso final", { type: "onPlayerEnterObject", objectId: roomZones[9].id }, [], [
    { type: "showMessage", message: "Checkpoint atualizado por logica. Siga para o terminal final." }
  ]);
  builder.addLogic("20 doorIsOpen confirma porta", { type: "onButtonActivated", objectId: buttons[7].id }, [{ type: "doorIsOpen", doorId: doorIds[7] }], [
    { type: "showMessage", message: "doorIsOpen confirmou que a porta final esta aberta." }
  ]);
  builder.addLogic("21 closeDoor demonstra fechamento", { type: "onButtonActivated", objectId: buttons[6].id }, [], [
    { type: "closeDoor", doorId: doorIds[5] }
  ]);
  builder.addLogic("22 chave master explica final", { type: "onKeyCollected", keyId: keyMasterId }, [], [
    { type: "showMessage", message: "Chave master coletada. A porta final abriu." },
    { type: "openDoor", doorId: doorIds[7] }
  ]);
  builder.addLogic("23 finishMap no terminal final", { type: "onPlayerEnterObject", objectId: final.id }, [{ type: "once" }], [
    { type: "finishMap" }
  ]);

  void keyBlue;
  void keyGreen;
  void keyMaster;
  void teleporterA;

  return builder.map;
}

function createDesignedCombatArenaMap(config: TemplateConfig): GameMap {
  const builder = new TemplateBuilder(config);
  const route: RoutePoint[] = [];

  addSpawn(builder, { x: 0, y: 0.75, z: 8 });
  const startPad = addDesignedPlatform(builder, { x: 0, y: 0.2, z: 6 }, {
    name: "Entrada segura da arena",
    width: 12,
    length: 8,
    color: "#334155",
    edgeCount: 5,
    supports: 2
  });
  route.push({ ...startPad.position, label: "Entrada segura" });
  createSign(builder, { x: -4.6, y: 0.2, z: 8.8 }, "Pegue a arma. Clique esquerdo ataca.");
  createMessageZone(builder, { x: 0, y: 1.1, z: 7.4 }, "Pegue a arma azul e use clique esquerdo para derrotar inimigos.", {
    name: "Tutorial de arma basica",
    scale: { x: 6.8, y: 1.4, z: 2 }
  });
  createItemSpawner(builder, { x: 0, y: 0.55, z: 5.4 }, {
    name: "Spawner da arma basica",
    properties: {
      spawnItemType: "weapon_basic",
      itemPool: ["weapon_basic"],
      spawnMode: "fixed",
      respawnTime: 0,
      amount: 1,
      color: "#38bdf8",
      collision: false
    }
  });
  createCheckpoint(builder, { x: 4.6, y: 0.75, z: 6.4 }, "Checkpoint da arena");

  const arena = addDesignedPlatform(builder, { x: 0, y: 0.2, z: -5 }, {
    name: "Arena principal de combate",
    width: 24,
    length: 22,
    color: "#1f2937",
    edgeCount: 9,
    supports: 4
  });
  route.push({ ...arena.position, label: "Arena principal" });
  createTrailBridge(builder, startPad.position, arena.position, "Entrada para arena de combate", "#475569");
  createSign(builder, { x: -9.4, y: 0.2, z: 3 }, "Derrote os inimigos. Curas ficam nas laterais.");
  createMessageZone(builder, { x: 0, y: 1.1, z: 0.6 }, "Inimigos perseguem quando chegam perto. Use as curas se precisar.", {
    name: "Dica de combate da arena",
    scale: { x: 8, y: 1.4, z: 2.2 }
  });

  const leftHealPad = addDesignedPlatform(builder, { x: -14, y: 0.2, z: -4 }, {
    name: "Pedestal de cura esquerdo",
    width: 5,
    length: 5,
    color: "#3f1f2f",
    edgeCount: 3,
    supports: 1
  });
  const rightHealPad = addDesignedPlatform(builder, { x: 14, y: 0.2, z: -4 }, {
    name: "Pedestal de cura direito",
    width: 5,
    length: 5,
    color: "#3f1f2f",
    edgeCount: 3,
    supports: 1
  });
  route.push({ ...leftHealPad.position, label: "Cura esquerda" });
  route.push({ ...rightHealPad.position, label: "Cura direita" });
  createTrailBridge(builder, arena.position, leftHealPad.position, "Ponte para cura esquerda", "#64748b");
  createTrailBridge(builder, arena.position, rightHealPad.position, "Ponte para cura direita", "#64748b");
  createItemSpawner(builder, { x: -14, y: 0.55, z: -4 }, {
    name: "Spawner de cura esquerdo",
    properties: {
      spawnItemType: "health",
      itemPool: ["health_pack"],
      spawnMode: "fixed",
      respawnTime: 8,
      amount: 35,
      color: "#ef4444",
      collision: false
    }
  });
  createItemSpawner(builder, { x: 14, y: 0.55, z: -4 }, {
    name: "Spawner de cura direito",
    properties: {
      spawnItemType: "health",
      itemPool: ["health_pack"],
      spawnMode: "fixed",
      respawnTime: 12,
      amount: 35,
      color: "#ef4444",
      collision: false
    }
  });
  createMessageZone(builder, { x: 0, y: 1.1, z: -6.8 }, "Curas reaparecem depois de alguns segundos. Reiniciar reseta inimigos e itens.", {
    name: "Dica de cura e reset da arena",
    scale: { x: 7.5, y: 1.4, z: 2 }
  });

  const enemyPositions: Vector3[] = [
    { x: -6, y: 0.45, z: -4 },
    { x: 6, y: 0.45, z: -4 },
    { x: -4, y: 0.45, z: -10 },
    { x: 4, y: 0.45, z: -10 },
    { x: 0, y: 0.45, z: -13 }
  ];
  enemyPositions.forEach((position, index) => {
    createEnemy(builder, position, {
      name: `Inimigo basico ${index + 1}`,
      properties: {
        behavior: index < 2 ? "patrol" : "chase",
        patrolOffset: index === 0 ? { x: 3, y: 0, z: 0 } : { x: -3, y: 0, z: 0 },
        health: index === 4 ? 75 : 50,
        damage: index === 4 ? 14 : 10,
        speed: index === 4 ? 2.2 : 1.8,
        detectionRange: 10,
        attackRange: 1.55,
        attackCooldown: 1,
        color: index === 4 ? "#b91c1c" : "#ef4444",
        collision: false
      }
    });
  });

  createCoinLine(builder, { x: 0, y: 1.1, z: 2.8 }, { x: 0, y: 1.1, z: -12 }, 10, "Moeda de recompensa da arena");
  createCoinLine(builder, { x: -10, y: 1.1, z: -4 }, { x: -14, y: 1.1, z: -4 }, 4, "Moeda rota de cura esquerda");
  createCoinLine(builder, { x: 10, y: 1.1, z: -4 }, { x: 14, y: 1.1, z: -4 }, 4, "Moeda rota de cura direita");

  createBlock(builder, { x: -11.8, y: 0.7, z: -5 }, {
    name: "Barreira baixa esquerda da arena",
    scale: { x: 0.6, y: 1, z: 16 },
    properties: { color: "#111827", collision: true }
  });
  createBlock(builder, { x: 11.8, y: 0.7, z: -5 }, {
    name: "Barreira baixa direita da arena",
    scale: { x: 0.6, y: 1, z: 16 },
    properties: { color: "#111827", collision: true }
  });
  createBlock(builder, { x: -6.6, y: 0.9, z: -15.8 }, {
    name: "Muro final esquerdo da arena",
    scale: { x: 5.8, y: 1.4, z: 0.6 },
    properties: { color: "#111827", collision: true }
  });
  createBlock(builder, { x: 6.6, y: 0.9, z: -15.8 }, {
    name: "Muro final direito da arena",
    scale: { x: 5.8, y: 1.4, z: 0.6 },
    properties: { color: "#111827", collision: true }
  });
  const finalDoor = createDoor(builder, { x: 0, y: 1.65, z: -15.8 }, {
    name: "Porta final da arena",
    scale: { x: 3.2, y: 3.2, z: 0.35 },
    properties: {
      doorId: "arena_final_door",
      color: "#22c55e",
      doorState: "closed",
      startsOpen: false,
      openOffset: { x: 0, y: 4, z: 0 },
      collision: true
    }
  });
  createSign(builder, { x: 7.6, y: 0.2, z: -14.2 }, "Derrote todos os inimigos para abrir a porta final.");

  const finalPad = addDesignedPlatform(builder, { x: 0, y: 0.2, z: -23 }, {
    name: "Plataforma final da arena",
    width: 12,
    length: 8,
    color: "#14532d",
    edgeCount: 5,
    supports: 2
  });
  route.push({ ...finalPad.position, label: "Final da arena" });
  createTrailBridge(builder, arena.position, finalPad.position, "Saida para final da arena", "#22c55e");
  createSign(builder, { x: -4.6, y: 0.2, z: -20.4 }, "Entre no final quando terminar o teste.");
  const final = createFinish(builder, { x: 0, y: 1.25, z: -24.8 }, {
    name: "Final da arena de combate",
    properties: { message: "Arena de combate concluida!" }
  });

  addPathPosts(builder, startPad.position, finalPad.position, 8, "Marcador vermelho da rota de combate", "#ef4444");
  addDesignedTemplateDecor(builder, config, route);
  ensureObjectCount(builder, config.minObjects, config.style, route);
  builder.addLogic("Mensagem inicial da arena", { type: "onMapStart" }, [], [
    { type: "showMessage", message: "Arena de Combate: pegue a arma, lute e teste as curas." }
  ]);
  builder.addLogic("Arma coletada na arena", { type: "onItemCollected", itemType: "weapon_basic" }, [{ type: "once" }], [
    { type: "showMessage", message: "Arma equipada. Clique esquerdo para atacar." },
    { type: "completeObjective", objectiveId: "arena_weapon" }
  ]);
  builder.addLogic("Todos inimigos abrem porta final", { type: "onAllEnemiesDefeated" }, [{ type: "once" }], [
    { type: "showMessage", message: "Todos os inimigos foram derrotados. Porta final aberta!" },
    { type: "openDoor", doorId: getDoorId(finalDoor) }
  ]);
  builder.addLogic("Finaliza arena de combate", { type: "onPlayerEnterObject", objectId: final.id }, [{ type: "once" }], [
    { type: "finishMap" }
  ]);

  return builder.map;
}

function createDesignedCombatDungeonMap(config: TemplateConfig): GameMap {
  const builder = new TemplateBuilder(config);
  const route: RoutePoint[] = [];

  addSpawn(builder, { x: 0, y: 0.75, z: 8 });
  const entrance = addDesignedPlatform(builder, { x: 0, y: 0.2, z: 6 }, {
    name: "Entrada da dungeon de combate",
    width: 12,
    length: 8,
    color: "#334155",
    edgeCount: 5,
    supports: 2
  });
  route.push({ ...entrance.position, label: "Entrada" });
  createSign(builder, { x: -4.6, y: 0.2, z: 8.4 }, "Pegue a arma antes da primeira sala.");
  createMessageZone(builder, { x: 0, y: 1.1, z: 7.1 }, "Dungeon de Combate: pegue a arma e limpe cada sala para abrir a proxima porta.", {
    name: "Mensagem inicial da dungeon de combate",
    scale: { x: 7, y: 1.4, z: 2 }
  });
  createItemSpawner(builder, { x: 0, y: 0.55, z: 5.2 }, {
    name: "Arma inicial da dungeon",
    properties: {
      spawnItemType: "weapon_basic",
      itemPool: ["weapon_basic"],
      respawnTime: 0,
      amount: 1,
      color: "#38bdf8",
      collision: false
    }
  });
  createCheckpoint(builder, { x: 4.6, y: 0.75, z: 6.2 }, "Checkpoint da entrada da dungeon");

  const rooms = [
    {
      label: "Sala 1",
      center: { x: 0, y: 0.2, z: -6 },
      color: "#1f2937",
      enemies: [
        { x: -4, y: 0.45, z: -5.5 },
        { x: 0, y: 0.45, z: -9 },
        { x: 4, y: 0.45, z: -5.5 }
      ],
      doorZ: -13,
      doorId: "dungeon_combat_door_1",
      reward: "Porta 1 aberta."
    },
    {
      label: "Sala 2",
      center: { x: 0, y: 0.2, z: -22 },
      color: "#2d1f32",
      enemies: [
        { x: -4.8, y: 0.45, z: -20.5 },
        { x: 0, y: 0.45, z: -24.8 },
        { x: 4.8, y: 0.45, z: -20.5 }
      ],
      doorZ: -29,
      doorId: "dungeon_combat_door_2",
      reward: "Porta 2 aberta."
    },
    {
      label: "Sala do boss",
      center: { x: 0, y: 0.2, z: -38 },
      color: "#311b1b",
      enemies: [
        { x: -5, y: 0.45, z: -36 },
        { x: 5, y: 0.45, z: -36 },
        { x: -3, y: 0.45, z: -41 },
        { x: 3, y: 0.45, z: -41 }
      ],
      doorZ: -45,
      doorId: "dungeon_combat_final_door",
      reward: "Boss derrotado. Porta final aberta."
    }
  ];
  const roomEnemies: MapObject[][] = [];
  const doors: MapObject[] = [];

  rooms.forEach((room, roomIndex) => {
    const platform = addDesignedPlatform(builder, room.center, {
      name: `${room.label} da dungeon de combate`,
      width: roomIndex === 2 ? 18 : 16,
      length: 12,
      color: room.color,
      edgeCount: 6,
      supports: 2
    });
    route.push({ ...platform.position, label: room.label });

    const previous = roomIndex === 0 ? entrance.position : rooms[roomIndex - 1].center;
    createTrailBridge(builder, previous, room.center, `Corredor para ${room.label}`, "#475569");
    createSign(builder, { x: -6.3, y: 0.2, z: room.center.z + 4.2 }, `${room.label}: derrote todos para abrir a porta.`);
    createMessageZone(builder, { x: 0, y: 1.1, z: room.center.z + 3 }, `${room.label}: inimigos contam para a logica da porta.`, {
      name: `Mensagem ${room.label}`,
      scale: { x: 7, y: 1.35, z: 2 }
    });
    createCheckpoint(builder, { x: 6, y: 0.75, z: room.center.z + 4.2 }, `Checkpoint ${room.label}`);
    createItemSpawner(builder, { x: -6, y: 0.55, z: room.center.z - 3.6 }, {
      name: `Cura ${room.label}`,
      properties: {
        spawnItemType: "health",
        itemPool: ["health_pack"],
        respawnTime: 10,
        amount: roomIndex === 2 ? 45 : 30,
        color: "#ef4444",
        collision: false
      }
    });

    const enemies = room.enemies.map((position, enemyIndex) => createEnemy(builder, position, {
      name: roomIndex === 2 && enemyIndex === room.enemies.length - 1 ? "Boss da dungeon" : `${room.label} inimigo ${enemyIndex + 1}`,
      properties: {
        behavior: enemyIndex === 0 ? "patrol" : "chase",
        patrolOffset: enemyIndex === 0 ? { x: 4, y: 0, z: 0 } : { x: 0, y: 0, z: 0 },
        health: roomIndex === 2 && enemyIndex === room.enemies.length - 1 ? 120 : 50 + roomIndex * 10,
        damage: roomIndex === 2 && enemyIndex === room.enemies.length - 1 ? 16 : 10 + roomIndex * 2,
        speed: roomIndex === 2 ? 2.2 : 1.9,
        detectionRange: 10,
        attackRange: 1.55,
        attackCooldown: 1,
        color: roomIndex === 2 && enemyIndex === room.enemies.length - 1 ? "#b91c1c" : "#ef4444",
        collision: false
      }
    }));
    roomEnemies.push(enemies);

    createCoinLine(builder, { x: -4.5, y: 1.1, z: room.center.z }, { x: 4.5, y: 1.1, z: room.center.z }, 6, `Recompensa ${room.label}`);

    const door = createDoor(builder, { x: 0, y: 1.65, z: room.doorZ }, {
      name: `${room.label} porta de saida`,
      scale: { x: 3.2, y: 3.2, z: 0.35 },
      properties: {
        doorId: room.doorId,
        color: roomIndex === 2 ? "#22c55e" : "#8b5cf6",
        doorState: "closed",
        startsOpen: false,
        openOffset: { x: 0, y: 4, z: 0 },
        collision: true
      }
    });
    doors.push(door);
    createBlock(builder, { x: -5.8, y: 0.9, z: room.doorZ }, {
      name: `${room.label} muro esquerdo`,
      scale: { x: 5, y: 1.4, z: 0.6 },
      properties: { color: "#111827", collision: true }
    });
    createBlock(builder, { x: 5.8, y: 0.9, z: room.doorZ }, {
      name: `${room.label} muro direito`,
      scale: { x: 5, y: 1.4, z: 0.6 },
      properties: { color: "#111827", collision: true }
    });
  });

  const finalPad = addDesignedPlatform(builder, { x: 0, y: 0.2, z: -54 }, {
    name: "Camara final da dungeon de combate",
    width: 14,
    length: 9,
    color: "#14532d",
    edgeCount: 5,
    supports: 2
  });
  route.push({ ...finalPad.position, label: "Camara final" });
  createTrailBridge(builder, rooms[2].center, finalPad.position, "Corredor para camara final", "#22c55e");
  createSign(builder, { x: -5.2, y: 0.2, z: -50.4 }, "A porta final abre quando a dungeon estiver limpa.");
  createMessageZone(builder, { x: 0, y: 1.1, z: -52.2 }, "Camara final: entre no trofeu para concluir a dungeon.", {
    name: "Mensagem final da dungeon de combate",
    scale: { x: 7, y: 1.35, z: 2 }
  });
  createCoinLine(builder, { x: -4, y: 1.1, z: -53 }, { x: 4, y: 1.1, z: -53 }, 8, "Tesouro final da dungeon");
  const final = createFinish(builder, { x: 0, y: 1.25, z: -56 }, {
    name: "Final da dungeon de combate",
    properties: { message: "Dungeon de combate concluida!" }
  });

  addPathPosts(builder, entrance.position, finalPad.position, 10, "Marcador da dungeon de combate", "#a78bfa");
  addDesignedTemplateDecor(builder, config, route);
  ensureObjectCount(builder, config.minObjects, config.style, route);

  builder.addLogic("Arma coletada na dungeon", { type: "onItemCollected", itemType: "weapon_basic" }, [{ type: "once" }], [
    { type: "showMessage", message: "Arma equipada. Limpe a primeira sala." }
  ]);
  roomEnemies.forEach((enemies, index) => {
    builder.addLogic(`${rooms[index].label} abre porta`, { type: "onAnyEnemyDefeated" }, [
      { type: "once" },
      ...enemies.map((enemy) => ({ type: "enemyDefeated" as const, objectId: enemy.id }))
    ], [
      { type: "showMessage", message: rooms[index].reward },
      { type: "openDoor", doorId: getDoorId(doors[index]) }
    ]);
  });
  builder.addLogic("Todos inimigos da dungeon derrotados", { type: "onAllEnemiesDefeated" }, [{ type: "once" }], [
    { type: "showMessage", message: "Dungeon limpa. Siga para a vitoria!" }
  ]);
  builder.addLogic("Finaliza dungeon de combate", { type: "onPlayerEnterObject", objectId: final.id }, [{ type: "once" }], [
    { type: "finishMap" }
  ]);

  return builder.map;
}

function createDesignedGuideMissionMap(config: TemplateConfig): GameMap {
  const builder = new TemplateBuilder(config);
  const route: RoutePoint[] = [];

  builder.map.gameplaySettings = {
    ...(builder.map.gameplaySettings ?? {}),
    requireObjectivesToFinish: true
  };

  addSpawn(builder, { x: 0, y: 0.72, z: 5 });
  const village = addDesignedPlatform(builder, { x: 0, y: 0.2, z: 2 }, {
    name: "Aldeia inicial da missao",
    width: 16,
    length: 12,
    color: "#86efac",
    edgeCount: 6,
    supports: 2
  });
  route.push({ ...village.position, label: "Aldeia inicial" });
  createSign(builder, { x: -6.4, y: 0.2, z: 5.2 }, "Fale com o Guia e siga o HUD.");
  const guide = createNpc(builder, { x: 2.2, y: 0.35, z: 2.8 }, {
    id: "guide_mission_npc",
    name: "Guia da Missao",
    properties: {
      npcName: "Guia",
      color: "#14b8a6",
      dialog: "Bem-vindo! Complete os objetivos no HUD.",
      dialogue: [
        "Bem-vindo! Complete os objetivos no HUD.",
        "Primeiro colete moedas na trilha.",
        "Depois encontre a chave azul e abra o portao."
      ],
      interactionRange: 4.5,
      showQuestHint: true,
      collision: false
    }
  });
  createMessageZone(builder, { x: 0, y: 1.05, z: 2.2 }, "Missao do Guia: pressione E olhando para o NPC para falar.", {
    name: "Mensagem inicial da missao",
    scale: { x: 7, y: 1.4, z: 2.2 }
  });
  createCheckpoint(builder, { x: -5.6, y: 0.65, z: 4.8 }, "Checkpoint da aldeia");

  const coinTrail = addDesignedPlatform(builder, { x: -12, y: 0.2, z: -12 }, {
    name: "Trilha de moedas da missao",
    width: 14,
    length: 12,
    color: "#bbf7d0",
    edgeCount: 5,
    supports: 2
  });
  route.push({ ...coinTrail.position, label: "Trilha de moedas" });
  createTrailBridge(builder, village.position, coinTrail.position, "Ponte da aldeia para trilha", "#bbf7d0");
  createSign(builder, { x: -17.6, y: 0.2, z: -8.2 }, "Colete 10 moedas para cumprir a etapa.");
  createCoinLine(builder, { x: -2, y: 1.12, z: 0 }, { x: -12, y: 1.12, z: -12 }, 10, "Moeda da trilha guiada");
  createCoinCluster(builder, { x: -15, y: 1.1, z: -15 }, 6, 3.4, "Moeda extra da trilha");

  const keyArea = addDesignedPlatform(builder, { x: 10, y: 0.2, z: -24 }, {
    name: "Clareira da chave azul",
    width: 14,
    length: 12,
    color: "#dbeafe",
    edgeCount: 5,
    supports: 2
  });
  route.push({ ...keyArea.position, label: "Clareira da chave" });
  createTrailBridge(builder, coinTrail.position, keyArea.position, "Ponte para chave azul", "#bfdbfe");
  createSign(builder, { x: 4.5, y: 0.2, z: -20 }, "A chave azul abre o portao.");
  const keyId = "guide_blue_key";
  createKey(builder, { x: 10, y: 1.25, z: -24 }, {
    name: "Chave azul da missao",
    properties: { keyId, label: "Chave Azul", color: "#3b82f6" }
  });
  createCheckpoint(builder, { x: 15, y: 0.65, z: -21 }, "Checkpoint da chave azul");

  const gateArea = addDesignedPlatform(builder, { x: 0, y: 0.2, z: -40 }, {
    name: "Portao da missao",
    width: 16,
    length: 12,
    color: "#e0f2fe",
    edgeCount: 5,
    supports: 2
  });
  route.push({ ...gateArea.position, label: "Portao" });
  createTrailBridge(builder, keyArea.position, gateArea.position, "Ponte para portao", "#93c5fd");
  createSign(builder, { x: -6.2, y: 0.2, z: -36.4 }, "Encoste na porta com a chave.");
  const door = createDoor(builder, { x: 0, y: 1.65, z: -43.7 }, {
    name: "Portao azul da missao",
    properties: {
      doorId: "guide_gate",
      requiredKeyId: keyId,
      color: "#3b82f6",
      doorState: "closed",
      startsOpen: false,
      collision: true
    }
  });
  createButton(builder, { x: 5.4, y: 0.35, z: -39 }, {
    name: "Botao de dica do portao",
    properties: {
      targetDoorId: getDoorId(door),
      buttonTargetId: getDoorId(door),
      oneTime: true,
      color: "#3b82f6"
    }
  });

  const combatArea = addDesignedPlatform(builder, { x: 0, y: 0.2, z: -56 }, {
    name: "Arena pequena da missao",
    width: 18,
    length: 14,
    color: "#bbf7d0",
    edgeCount: 6,
    supports: 2
  });
  route.push({ ...combatArea.position, label: "Arena pequena" });
  createTrailBridge(builder, gateArea.position, combatArea.position, "Ponte para arena pequena", "#86efac");
  createSign(builder, { x: -7.4, y: 0.2, z: -51.6 }, "Pegue a arma e derrote 2 inimigos.");
  createItemSpawner(builder, { x: -4, y: 0.55, z: -54 }, {
    name: "Arma basica da missao",
    properties: {
      spawnItemType: "weapon_basic",
      itemPool: ["weapon_basic"],
      respawnTime: 0,
      amount: 1,
      color: "#38bdf8",
      collision: false
    }
  });
  createItemSpawner(builder, { x: 5.8, y: 0.55, z: -58 }, {
    name: "Cura da missao",
    properties: {
      spawnItemType: "health",
      itemPool: ["health_pack"],
      respawnTime: 8,
      amount: 25,
      color: "#ef4444",
      collision: false
    }
  });
  [
    { x: -1.5, y: 0.45, z: -58 },
    { x: 3.5, y: 0.45, z: -60 }
  ].forEach((position, index) => {
    createEnemy(builder, position, {
      name: `Inimigo da missao ${index + 1}`,
      properties: {
        behavior: "chase",
        health: 40,
        damage: 8,
        speed: 1.6,
        detectionRange: 9,
        color: "#ef4444",
        collision: false
      }
    });
  });

  const finalPad = addDesignedPlatform(builder, { x: 0, y: 0.2, z: -72 }, {
    name: "Final da missao guiada",
    width: 14,
    length: 10,
    color: "#fde68a",
    edgeCount: 5,
    supports: 2
  });
  route.push({ ...finalPad.position, label: "Final" });
  createTrailBridge(builder, combatArea.position, finalPad.position, "Ponte para final da missao", "#fde68a");
  createSign(builder, { x: -5.6, y: 0.2, z: -68.2 }, "Final: conclua todos os objetivos.");
  const final = createFinish(builder, { x: 0, y: 1.25, z: -74.5 }, {
    name: "Final da Missao do Guia",
    properties: { message: "Missao do Guia concluida!" }
  });

  createForestPocket(builder, village.position, "Aldeia decorada da missao");
  createForestPocket(builder, keyArea.position, "Clareira decorada da missao");
  addPathPosts(builder, village.position, finalPad.position, 8, "Marcador verde da missao", "#22c55e");
  addDesignedTemplateDecor(builder, config, route);
  ensureObjectCount(builder, config.minObjects, config.style, route);

  builder.addObjective({
    id: "guide_talk",
    title: "Fale com o Guia",
    description: "Olhe para o NPC e pressione E.",
    type: "customLogic",
    required: true,
    visible: true,
    completedMessage: "Guia encontrado."
  });
  builder.addObjective({
    id: "guide_collect_coins",
    title: "Colete 10 moedas",
    description: "A trilha dourada leva ate a chave.",
    type: "collectCoins",
    targetAmount: 10,
    required: true,
    visible: true,
    completedMessage: "Moedas coletadas."
  });
  builder.addObjective({
    id: "guide_key",
    title: "Pegue a chave azul",
    type: "collectKey",
    targetKeyId: keyId,
    required: true,
    visible: true,
    completedMessage: "Chave azul obtida."
  });
  builder.addObjective({
    id: "guide_gate_open",
    title: "Abra o portao azul",
    type: "openDoor",
    targetDoorId: getDoorId(door),
    required: true,
    visible: true,
    completedMessage: "Portao aberto."
  });
  builder.addObjective({
    id: "guide_defeat_enemies",
    title: "Derrote 2 inimigos",
    type: "defeatEnemies",
    targetAmount: 2,
    required: true,
    visible: true,
    completedMessage: "Arena limpa."
  });
  builder.addObjective({
    id: "guide_finish",
    title: "Entre no final",
    type: "reachObject",
    targetObjectId: final.id,
    required: true,
    visible: true,
    completedMessage: "Missao completa."
  });

  builder.addLogic("Boas-vindas Missao do Guia", { type: "onMapStart" }, [], [
    { type: "showMessage", message: "Missao do Guia: fale com o NPC e siga os objetivos." }
  ]);
  builder.addLogic("Falar com Guia completa objetivo", { type: "onNpcInteracted", objectId: guide.id }, [{ type: "once" }], [
    { type: "completeObjective", objectiveId: "guide_talk" },
    { type: "showMessage", message: "O Guia marcou sua missao no HUD." }
  ]);
  builder.addLogic("Arma coletada na missao", { type: "onItemCollected", itemType: "weapon_basic" }, [{ type: "once" }], [
    { type: "showMessage", message: "Arma equipada. Clique esquerdo para atacar." }
  ]);
  builder.addLogic("Finaliza Missao do Guia", { type: "onPlayerEnterObject", objectId: final.id }, [{ type: "once" }], [
    { type: "finishMap" }
  ]);

  return builder.map;
}

type DesignedSector = {
  label: string;
  position: Vector3;
  width: number;
  length: number;
  color: string;
  sign: string;
  message?: string;
  checkpoint?: boolean;
};

function createDesignedGuidedMap(config: TemplateConfig): GameMap {
  const builder = new TemplateBuilder(config);
  const sectors = getDesignedSectors(config);
  const route = createDesignedSectorRoute(builder, config, sectors);

  generateGameplaySystems(builder, config, route);
  addDesignedTemplateDecor(builder, config, route);
  const final = createFinalArea(builder, config, route);
  reinforceFinalApproach(builder, config, route, final);
  generateLogicPuzzle(builder, config, route, final);
  ensureObjectCount(builder, config.minObjects, config.style, route);

  return builder.map;
}

function createDesignedSectorRoute(
  builder: TemplateBuilder,
  config: TemplateConfig,
  sectors: DesignedSector[]
): RoutePoint[] {
  const route: RoutePoint[] = [];
  const first = sectors[0] ?? {
    label: "Entrada",
    position: { x: 0, y: 0.2, z: 0 },
    width: 12,
    length: 10,
    color: builder.palette.platform,
    sign: `Inicio: ${config.name}`
  };

  addSpawn(builder, { x: first.position.x, y: first.position.y + 0.52, z: first.position.z + Math.min(4, first.length / 2 - 1) });

  sectors.forEach((sector, index) => {
    addDesignedPlatform(builder, sector.position, {
      name: `${config.name} - ${sector.label}`,
      width: sector.width,
      length: sector.length,
      color: sector.color,
      edgeCount: getSectorEdgeCount(config, index),
      supports: getSectorSupportCount(config, index),
      material: builder.palette.glow ? "glow" : "default"
    });

    route.push({
      ...sector.position,
      label: sector.label,
      difficulty: Math.min(5, 1 + Math.floor(index / Math.max(1, Math.ceil(sectors.length / 5))))
    });

    createSign(builder, offset(sector.position, -sector.width / 2 + 2.2, 0.12, sector.length / 2 - 1.6), sector.sign);
    createMessageZone(builder, offset(sector.position, 0, 1.05, Math.min(3, sector.length / 2 - 2)), sector.message ?? sector.sign, {
      name: `Mensagem - ${sector.label}`,
      scale: { x: Math.min(7, sector.width * 0.55), y: 1.35, z: 2.2 }
    });

    if (sector.checkpoint) {
      createCheckpoint(builder, offset(sector.position, sector.width / 2 - 2.8, 0.75, sector.length / 2 - 2.4), `Checkpoint - ${sector.label}`);
    }

    decorateDesignedSector(builder, config, sector, index);

    if (index > 0) {
      createTrailBridge(builder, sectors[index - 1].position, sector.position, `Ligacao clara ${index}: ${sectors[index - 1].label} para ${sector.label}`, getBridgeColor(config, index));
      addPathPosts(builder, sectors[index - 1].position, sector.position, getPathPostCount(config), `Marcador de caminho ${config.name} ${index}`, getBridgeColor(config, index));
    }
  });

  return route;
}

function getDesignedSectors(config: TemplateConfig): DesignedSector[] {
  switch (config.id) {
    case "door":
      return createSectorBlueprints(config, [
        "Sala inicial: botao abre a porta ao lado.",
        "Sala 2: botao laranja abre a porta laranja distante.",
        "Sala 3: pegue a chave azul antes da porta azul.",
        "Sala 4: combine botao e chave para seguir.",
        "Sala opcional: moedas recompensam a leitura.",
        "Sala final: a ultima porta revela o final."
      ], { columns: 2, spacingX: 22, spacingZ: 18, width: 16, length: 14, startZ: 0 });
    case "checkpoint":
      return createSectorBlueprints(config, [
        "Tutorial de checkpoint: ative a bandeira.",
        "Perigo simples: veja a zona de morte antes de pular.",
        "Plataformas sobre vazio: avance por partes.",
        "Jump pad sobre perigo: mire na aterrissagem.",
        "Blocos que desaparecem: nao pare em cima deles.",
        "Plataforma movel: espere o ciclo.",
        "Desafio final: checkpoints justos ate a vitoria."
      ], { columns: 1, spacingX: 0, spacingZ: 17, width: 13, length: 12, startZ: 0 });
    case "mechanics":
      return createSectorBlueprints(config, [
        "Moedas: trilha dourada guia o jogador.",
        "Checkpoint: respawn volta para a bandeira.",
        "Zona de morte: perigo visivel reinicia a tentativa.",
        "Porta + botao: conexao curta e sinalizada.",
        "Chave + porta: chave antes da porta.",
        "Jump pad: impulso para a plataforma alta.",
        "Teleporte: entrada e saida marcadas.",
        "Plataforma movel: espere e atravesse.",
        "Bloco que desaparece: teste de tempo.",
        "Zona de mensagem: feedback por area.",
        "Logica visual: regras conectam objetos.",
        "Final: conclua o museu jogavel."
      ], { columns: 3, spacingX: 20, spacingZ: 18, width: 15, length: 13, startZ: 0 });
    case "keyPuzzle":
      return createSectorBlueprints(config, [
        "Entrada: leia as dicas antes de abrir portas.",
        "Chave azul: primeira chave sem risco.",
        "Porta azul: use a chave que acabou de pegar.",
        "Chave vermelha: protegida por mini desafio.",
        "Atalho por botao: libere retorno seguro.",
        "Chave verde opcional: recompensa de exploracao.",
        "Sala do teleporte: entenda entrada e destino.",
        "Porta final: use final_key e finalize."
      ], { columns: 2, spacingX: 22, spacingZ: 18, width: 16, length: 14, startZ: 0 });
    case "forest":
      return createSectorBlueprints(config, [
        "Entrada do bosque: arvores formam a trilha.",
        "Trilha principal: moedas indicam o caminho.",
        "Clareira central: ponto de orientacao.",
        "Ruina escondida: procure a chave entre pedras.",
        "Caminho opcional: risco pequeno por moedas.",
        "Teleporte secreto: ida e volta sinalizadas.",
        "Templo final: objetivo visivel na clareira."
      ], { columns: 2, spacingX: 28, spacingZ: 24, width: 20, length: 18, startZ: 0 });
    case "desert":
      return createSectorBlueprints(config, [
        "Oasis inicial: comece seguro.",
        "Corredor de pilares: siga entre os marcos.",
        "Ruinas abertas: moedas em rotas laterais.",
        "Sala de botao: porta e botao por cor.",
        "Porta com chave: a chave vem antes.",
        "Teleporte entre ruinas: destino marcado.",
        "Obby curto sobre perigo: queda mata.",
        "Templo final: final no altar grande."
      ], { columns: 2, spacingX: 28, spacingZ: 24, width: 20, length: 18, startZ: 0 });
    case "neonObby":
      return createSectorBlueprints(config, [
        "Entrada neon: siga a linha glow.",
        "Saltos glow: plataformas por cor.",
        "Jump pads: impulso para cima.",
        "Blocos que desaparecem: tempo curto.",
        "Plataformas moveis: espere o padrao.",
        "Caminho estreito perigoso: moedas opcionais.",
        "Area opcional de moedas: risco e recompensa.",
        "Desafio final neon: final chamativo."
      ], { columns: 1, spacingX: 0, spacingZ: 16, width: 12, length: 11, startZ: 0 });
    case "megaObby":
      return createSectorBlueprints(config, [
        "Setor 1: aquecimento linear.",
        "Setor 2: saltos largos.",
        "Setor 3: perigo lateral.",
        "Setor 4: jump pads.",
        "Setor 5: blocos temporarios.",
        "Setor 6: plataformas moveis.",
        "Setor 7: caminho estreito.",
        "Setor 8: rota opcional dificil.",
        "Setor 9: combinacao de mecanicas.",
        "Setor 10: final extremo."
      ], { columns: 1, spacingX: 0, spacingZ: 17, width: 13, length: 12, startZ: 0 });
    case "megaCoinWorld":
      return createSectorBlueprints(config, [
        "Praca central: escolha uma trilha.",
        "Bosque de moedas: trilha principal.",
        "Ruina da chave: recompensa lateral.",
        "Mirante elevado: moedas raras.",
        "Lago secreto: teleporte sinalizado.",
        "Caverna de porta: chave antes do bloqueio.",
        "Ilha de recompensa: moedas agrupadas.",
        "Final central: volte pela rota principal."
      ], { columns: 3, spacingX: 30, spacingZ: 26, width: 22, length: 20, startZ: 0 });
    case "keyDungeon":
      return createSectorBlueprints(config, [
        "Entrada da dungeon: dica e primeira chave.",
        "Sala azul: porta azul.",
        "Sala vermelha: chave protegida.",
        "Sala verde: botao abre atalho.",
        "Sala amarela: moedas opcionais.",
        "Sala roxa: duas portas em sequencia.",
        "Sala prata: teleporte de retorno.",
        "Sala ouro: chave antes da porta.",
        "Sala sombra: risco por recompensa.",
        "Sala final: ultima chave e final."
      ], { columns: 2, spacingX: 22, spacingZ: 18, width: 16, length: 14, startZ: 0 });
    case "testCity":
      return createSectorBlueprints(config, [
        "Praca central: spawn e mapa da cidade.",
        "Rua de moedas: rota guiada.",
        "Bairro dos predios: telhados acessiveis.",
        "Distrito de portas: botoes por cor.",
        "Beco de chaves: chaves antes das portas.",
        "Atalho de teleporte: entrada e saida claras.",
        "Obby urbano: telhados e plataformas.",
        "Praca final: objetivo visivel."
      ], { columns: 2, spacingX: 34, spacingZ: 28, width: 26, length: 24, startZ: 0 });
    case "adventureIsland":
      return createSectorBlueprints(config, [
        "Praia inicial: caminho seguro.",
        "Floresta da ilha: trilha por moedas.",
        "Ruina antiga: chave escondida.",
        "Caverna: perigo curto e checkpoint.",
        "Ilha secreta: teleporte sinalizado.",
        "Montanha: jump pads e plataformas.",
        "Ponte do templo: desafio final.",
        "Templo final: altar de vitoria."
      ], { columns: 2, spacingX: 32, spacingZ: 26, width: 22, length: 20, startZ: 0 });
    case "stressTest":
      return createSectorBlueprints(config, [
        "Setor de moedas: coleta em trilhas.",
        "Setor de portas e botoes: pares sinalizados.",
        "Setor de chaves: cada chave antes da porta.",
        "Setor de teleportes: rede ida e volta.",
        "Setor de obby: saltos e vazio.",
        "Setor de plataformas moveis: ciclos claros.",
        "Setor de logica: mensagens e regras.",
        "Setor final: objetivo unico."
      ], { columns: 2, spacingX: 34, spacingZ: 28, width: 24, length: 22, startZ: 0 });
    default:
      return createSectorBlueprints(config, getSectionPlan(config), { columns: 2, spacingX: 24, spacingZ: 20, width: 16, length: 14, startZ: 0 });
  }
}

function createSectorBlueprints(
  config: TemplateConfig,
  labels: string[],
  layout: { columns: number; spacingX: number; spacingZ: number; width: number; length: number; startZ: number }
): DesignedSector[] {
  return labels.map((label, index) => {
    const column = layout.columns <= 1 ? 0 : index % layout.columns;
    const row = layout.columns <= 1 ? index : Math.floor(index / layout.columns);
    const x = layout.columns <= 1 ? 0 : (column - (layout.columns - 1) / 2) * layout.spacingX;
    const z = layout.columns <= 1 ? layout.startZ - index * layout.spacingZ : layout.startZ - row * layout.spacingZ;
    const color = getDesignedSectorColor(config, index);

    return {
      label: getShortSectorLabel(label),
      position: { x, y: 0.2 + getSectorHeight(config, index), z },
      width: layout.width + getSectorSizeBonus(config, index),
      length: layout.length + getSectorSizeBonus(config, index),
      color,
      sign: label,
      message: `${config.name}: ${label}`,
      checkpoint: shouldPlaceDesignedCheckpoint(config, index, labels.length)
    };
  });
}

function getShortSectorLabel(label: string): string {
  return label.split(":")[0] ?? label;
}

function getSectorHeight(config: TemplateConfig, index: number): number {
  if (config.id === "neonObby" || config.id === "megaObby" || config.id === "checkpoint") {
    return Math.floor(index / 3) * 0.55;
  }

  if (config.id === "adventureIsland") {
    return index >= 5 ? 0.7 : 0;
  }

  return 0;
}

function getSectorSizeBonus(config: TemplateConfig, index: number): number {
  if (config.id === "testCity" || config.id === "stressTest") {
    return index % 2 === 0 ? 2 : 0;
  }

  if (config.id === "megaCoinWorld" || config.id === "adventureIsland") {
    return index % 3 === 0 ? 2 : 0;
  }

  return 0;
}

function getDesignedSectorColor(config: TemplateConfig, index: number): string {
  const neon = ["#00f5ff", "#ff2bd6", "#39ff14", "#8b5cf6", "#f59e0b", "#38bdf8"];
  const forest = ["#86efac", "#65a30d", "#22c55e", "#a3e635", "#4ade80", "#bef264"];
  const desert = ["#f5d38a", "#d9a441", "#c0843e", "#f59e0b", "#b7791f", "#fde68a"];
  const classic = ["#93c5fd", "#c4b5fd", "#a7f3d0", "#fde68a", "#fca5a5", "#bfdbfe"];

  if (config.theme === "neon") {
    return neon[index % neon.length];
  }

  if (config.style === "forest" || config.style === "coinWorld" || config.style === "island") {
    return forest[index % forest.length];
  }

  if (config.style === "desert") {
    return desert[index % desert.length];
  }

  if (config.style === "dungeon") {
    return ["#334155", "#475569", "#1f2937", "#64748b", "#312e81"][index % 5];
  }

  return classic[index % classic.length];
}

function shouldPlaceDesignedCheckpoint(config: TemplateConfig, index: number, total: number): boolean {
  if (index === 0 || index === total - 1) {
    return true;
  }

  if (config.style === "challenge" || config.id === "neonObby" || config.id === "megaObby") {
    return true;
  }

  return index % 2 === 0;
}

function getSectorEdgeCount(config: TemplateConfig, index: number): number {
  if (config.id === "testCity" || config.id === "stressTest" || config.id === "megaCoinWorld") {
    return 7;
  }

  if (config.id === "neonObby" || config.id === "megaObby") {
    return 5 + (index % 2);
  }

  return 5;
}

function getSectorSupportCount(config: TemplateConfig, index: number): number {
  if (config.style === "forest" || config.style === "desert") {
    return 2;
  }

  if (config.id === "neonObby" || config.id === "megaObby" || config.id === "checkpoint") {
    return 4;
  }

  return index % 3 === 0 ? 4 : 2;
}

function getPathPostCount(config: TemplateConfig): number {
  if (config.id === "testCity" || config.id === "stressTest") {
    return 7;
  }

  if (config.id === "forest" || config.id === "desert" || config.id === "adventureIsland") {
    return 6;
  }

  return 4;
}

function getBridgeColor(config: TemplateConfig, index: number): string {
  if (config.theme === "neon") {
    return index % 2 === 0 ? "#39ff14" : "#00f5ff";
  }

  if (config.style === "forest" || config.style === "island" || config.style === "coinWorld") {
    return index % 2 === 0 ? "#86efac" : "#bbf7d0";
  }

  if (config.style === "desert") {
    return "#f5d38a";
  }

  return config.style === "dungeon" ? "#475569" : builderSafePaletteColor(config, "secondary");
}

function builderSafePaletteColor(config: TemplateConfig, key: keyof Palette): string {
  const value = PALETTES[config.theme][key];
  return typeof value === "string" ? value : PALETTES[config.theme].secondary;
}

function decorateDesignedSector(builder: TemplateBuilder, config: TemplateConfig, sector: DesignedSector, index: number): void {
  if (config.style === "forest" || config.style === "coinWorld" || config.style === "island") {
    addNaturalSectorBorder(builder, sector, config.id === "megaCoinWorld" ? 18 : 14, `${sector.label} borda natural`);
    if (index % 2 === 1) {
      createRuinCluster(builder, offset(sector.position, 0, 0, -sector.length * 0.18));
    }
    return;
  }

  if (config.style === "desert") {
    addDesertSectorGuides(builder, sector, index);
    return;
  }

  if (config.style === "city" || config.style === "stress") {
    addCitySectorDetails(builder, sector, index, config.id === "stressTest" ? 5 : 4);
    return;
  }

  if (config.style === "dungeon" || config.style === "puzzle") {
    addRoomWalls(builder, sector, index);
    return;
  }

  if (config.style === "mechanics" || config.style === "neon" || config.style === "challenge" || config.style === "obby") {
    addTechnicalSectorMarkers(builder, sector, index);
  }
}

function addNaturalSectorBorder(builder: TemplateBuilder, sector: DesignedSector, count: number, name: string): void {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    const radiusX = sector.width / 2 + 3.2 + (index % 2) * 1.1;
    const radiusZ = sector.length / 2 + 3.2 + (index % 3 === 0 ? 1.4 : 0);
    const position = {
      x: sector.position.x + Math.cos(angle) * radiusX,
      y: 0,
      z: sector.position.z + Math.sin(angle) * radiusZ
    };

    if (index % 4 === 0) {
      createRock(builder, position, { name: `${name} pedra ${index + 1}` });
    } else {
      createTree(builder, position, { name: `${name} arvore ${index + 1}`, scale: scalar(0.95 + (index % 4) * 0.14) });
    }
  }
}

function addDesertSectorGuides(builder: TemplateBuilder, sector: DesignedSector, index: number): void {
  const frontZ = sector.position.z + sector.length / 2 - 2.2;
  createArch(builder, { x: sector.position.x, y: 0, z: frontZ }, {
    name: `Arco guia ${sector.label}`,
    rotation: { x: 0, y: index % 2 === 0 ? Math.PI / 2 : 0, z: 0 }
  });

  for (let pillar = 0; pillar < 8; pillar += 1) {
    const side = pillar % 2 === 0 ? -1 : 1;
    const row = Math.floor(pillar / 2);
    createPillar(builder, {
      x: sector.position.x + side * (sector.width / 2 - 1.4),
      y: 0,
      z: sector.position.z - sector.length / 2 + 2.4 + row * 3.4
    }, { name: `Pilar guia ${sector.label} ${pillar + 1}` });
  }
}

function addCitySectorDetails(builder: TemplateBuilder, sector: DesignedSector, index: number, buildingCount: number): void {
  createBlock(builder, offset(sector.position, 0, 0.38, 0), {
    name: `Faixa da rua ${sector.label}`,
    scale: { x: 1, y: 0.06, z: sector.length - 2 },
    properties: { color: "#f8fafc", collision: false }
  });

  for (let building = 0; building < buildingCount; building += 1) {
    const side = building % 2 === 0 ? -1 : 1;
    const row = Math.floor(building / 2);
    createReadableBuilding(builder, {
      x: sector.position.x + side * (sector.width / 2 - 4),
      y: sector.position.y,
      z: sector.position.z - sector.length / 2 + 4.5 + row * 7
    }, index * 10 + building, 3 + ((index + building) % 4));
  }

  createLamp(builder, offset(sector.position, -sector.width / 2 + 2, 0, -sector.length / 2 + 2), `Poste ${sector.label} A`, false);
  createLamp(builder, offset(sector.position, sector.width / 2 - 2, 0, sector.length / 2 - 2), `Poste ${sector.label} B`, false);
}

function createReadableBuilding(builder: TemplateBuilder, position: Vector3, index: number, floors: number): void {
  const width = 4.4 + (index % 3) * 0.8;

  for (let floor = 0; floor < floors; floor += 1) {
    createBlock(builder, {
      x: position.x,
      y: 0.92 + floor * 1.38,
      z: position.z
    }, {
      name: `Predio legivel ${index + 1} andar ${floor + 1}`,
      scale: { x: width, y: 1.26, z: 4.2 },
      properties: { color: floor % 2 === 0 ? "#64748b" : "#94a3b8" }
    });

    for (const side of [-1, 1]) {
      createBlock(builder, {
        x: position.x + side * (width / 2 + 0.03),
        y: 1.04 + floor * 1.38,
        z: position.z - 0.9
      }, {
        name: `Janela predio ${index + 1} ${floor + 1}.${side > 0 ? "D" : "E"}`,
        scale: { x: 0.08, y: 0.38, z: 0.7 },
        properties: { color: "#bfdbfe", collision: false, material: "glass", opacity: 0.68 }
      });
    }
  }

  createPlatform(builder, {
    x: position.x,
    y: 0.58 + floors * 1.38,
    z: position.z
  }, {
    name: `Telhado acessivel ${index + 1}`,
    scale: { x: width + 0.6, y: 0.24, z: 4.8 },
    properties: { color: "#334155" }
  });
}

function addRoomWalls(builder: TemplateBuilder, sector: DesignedSector, index: number): void {
  const wallColor = index % 2 === 0 ? "#334155" : "#1f2937";
  createBlock(builder, offset(sector.position, -sector.width / 2 - 0.15, 1.15, 0), {
    name: `Parede esquerda ${sector.label}`,
    scale: { x: 0.3, y: 2.2, z: sector.length },
    properties: { color: wallColor }
  });
  createBlock(builder, offset(sector.position, sector.width / 2 + 0.15, 1.15, 0), {
    name: `Parede direita ${sector.label}`,
    scale: { x: 0.3, y: 2.2, z: sector.length },
    properties: { color: wallColor }
  });
  createBlock(builder, offset(sector.position, 0, 1.15, -sector.length / 2 - 0.15), {
    name: `Parede fundo ${sector.label}`,
    scale: { x: sector.width, y: 2.2, z: 0.3 },
    properties: { color: wallColor }
  });
  createLamp(builder, offset(sector.position, -sector.width / 2 + 2.4, 0, sector.length / 2 - 2.4), `Luz de sala ${sector.label}`, index % 2 === 0);
  createCrate(builder, offset(sector.position, sector.width / 2 - 2.6, 0, -sector.length / 2 + 2.4), { name: `Caixa guia ${sector.label}` });
}

function addTechnicalSectorMarkers(builder: TemplateBuilder, sector: DesignedSector, index: number): void {
  const markerColor = index % 2 === 0 ? builder.palette.accent : builder.palette.secondary;

  for (let marker = 0; marker < 4; marker += 1) {
    const sideX = marker < 2 ? -1 : 1;
    const sideZ = marker % 2 === 0 ? -1 : 1;
    createBlock(builder, {
      x: sector.position.x + sideX * (sector.width / 2 - 1.3),
      y: sector.position.y + 0.9,
      z: sector.position.z + sideZ * (sector.length / 2 - 1.3)
    }, {
      name: `Marco tecnico ${sector.label} ${marker + 1}`,
      scale: { x: 0.58, y: 1.25, z: 0.58 },
      properties: {
        color: markerColor,
        collision: false,
        material: builder.palette.glow ? "glow" : "default",
        emissive: builder.palette.glow ? markerColor : undefined
      }
    });
  }
}

function addDesignedTemplateDecor(builder: TemplateBuilder, config: TemplateConfig, route: RoutePoint[]): void {
  const signCount = Math.max(route.length, getDesignedMinimumSigns(config.minObjects));

  for (let index = 0; index < signCount; index += 1) {
    const point = getRoutePoint(route, index, signCount);
    createSign(builder, offset(point, index % 2 === 0 ? 4.2 : -4.2, 0.12, -3.2), getSectionText(config, index));
  }

  addDecorations(builder, config.decorations, config.style, route);

  if (config.style === "mechanics" || config.style === "logic" || config.style === "stress") {
    addMechanicsSigns(builder, route);
  }
}

function getDesignedMinimumSigns(minObjects: number): number {
  if (minObjects >= 1200) {
    return 20;
  }

  if (minObjects >= 900) {
    return 16;
  }

  if (minObjects >= 600) {
    return 12;
  }

  if (minObjects >= 300) {
    return 8;
  }

  return 4;
}

function reinforceFinalApproach(
  builder: TemplateBuilder,
  config: TemplateConfig,
  route: RoutePoint[],
  final: MapObject
): void {
  const last = getRoutePoint(route, route.length - 1, 1);
  createCoinLine(builder, offset(last, 0, 1.1, -1), offset(final.position, 0, 0, 1.4), Math.min(10, Math.max(4, Math.ceil(config.coins / 20))), `Moeda guia final ${config.name}`);
  createSign(builder, offset(final.position, -3.8, -1.05, 3.4), "Final visivel: conclua depois do ultimo desafio.");

  if (config.doors > 0) {
    const finalDoorId = `${config.id}_final_gate`;
    const finalKeyId = config.keys > 0 ? getKeyId(Math.min(config.keys - 1, 5)) : "";

    createDoor(builder, offset(final.position, 0, 0.35, 3.6), {
      name: `Porta final sinalizada - ${config.name}`,
      properties: {
        doorId: finalDoorId,
        requiredKeyId: finalKeyId,
        color: builder.palette.door,
        openOffset: { x: 0, y: 3.8, z: 0 }
      }
    });
    createButton(builder, offset(last, 2.6, 0.35, -2.2), {
      name: `Botao da porta final - ${config.name}`,
      properties: {
        targetDoorId: finalDoorId,
        buttonTargetId: finalDoorId,
        oneTime: true,
        color: builder.palette.accent
      }
    });
    createSign(builder, offset(last, 3.8, 0.12, -0.8), finalKeyId ? `Porta final usa ${finalKeyId}.` : "Botao final abre a ultima porta.");
  }
}

function addDesignedPlatform(
  builder: TemplateBuilder,
  position: Vector3,
  options: {
    name: string;
    width: number;
    length: number;
    color: string;
    edgeCount?: number;
    supports?: number;
    material?: MapObjectProperties["material"];
  }
): MapObject {
  const platform = createPlatform(builder, position, {
    name: options.name,
    scale: { x: options.width, y: 0.4, z: options.length },
    properties: {
      color: options.color,
      material: options.material ?? (builder.palette.glow ? "glow" : "default"),
      emissive: builder.palette.glow ? options.color : undefined
    }
  });

  addEdgeMarkers(builder, position, options.width, options.length, options.edgeCount ?? 4, `${options.name} guia`, options.color);
  addSupportColumns(builder, position, options.width, options.length, options.supports ?? 4, `${options.name} suporte`);
  return platform;
}

function addEdgeMarkers(
  builder: TemplateBuilder,
  center: Vector3,
  width: number,
  length: number,
  count: number,
  name: string,
  color: string
): void {
  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0.5 : index / (count - 1);
    const z = center.z - length / 2 + t * length;

    createBlock(builder, { x: center.x - width / 2 + 0.35, y: center.y + 0.55, z }, {
      name: `${name} esquerda ${index + 1}`,
      scale: { x: 0.34, y: 0.7, z: 0.34 },
      properties: {
        color,
        collision: false,
        material: builder.palette.glow ? "glow" : "default",
        emissive: builder.palette.glow ? color : undefined
      }
    });
    createBlock(builder, { x: center.x + width / 2 - 0.35, y: center.y + 0.55, z }, {
      name: `${name} direita ${index + 1}`,
      scale: { x: 0.34, y: 0.7, z: 0.34 },
      properties: {
        color,
        collision: false,
        material: builder.palette.glow ? "glow" : "default",
        emissive: builder.palette.glow ? color : undefined
      }
    });
  }
}

function addSupportColumns(
  builder: TemplateBuilder,
  center: Vector3,
  width: number,
  length: number,
  count: number,
  name: string
): void {
  const corners = [
    { x: center.x - width * 0.36, z: center.z - length * 0.36 },
    { x: center.x + width * 0.36, z: center.z - length * 0.36 },
    { x: center.x - width * 0.36, z: center.z + length * 0.36 },
    { x: center.x + width * 0.36, z: center.z + length * 0.36 }
  ];

  for (let index = 0; index < Math.min(count, corners.length); index += 1) {
    createBlock(builder, { x: corners[index].x, y: center.y - 0.75, z: corners[index].z }, {
      name: `${name} ${index + 1}`,
      scale: { x: 0.5, y: 1.5, z: 0.5 },
      properties: {
        color: builder.palette.decor,
        collision: false
      }
    });
  }
}

function createTrailBridge(builder: TemplateBuilder, from: Vector3, to: Vector3, name: string, color: string): MapObject {
  const mid = {
    x: (from.x + to.x) / 2,
    y: Math.max(from.y, to.y),
    z: (from.z + to.z) / 2
  };
  const yaw = Math.atan2(to.x - from.x, to.z - from.z);
  const length = Math.max(4, distance2D(from, to));

  const bridge = createPlatform(builder, mid, {
    name,
    rotation: { x: 0, y: yaw, z: 0 },
    scale: { x: 4.2, y: 0.32, z: length },
    properties: {
      color,
      collision: true
    }
  });
  addPathPosts(builder, from, to, 4, `${name} marcador`, color);
  return bridge;
}

function addPathPosts(builder: TemplateBuilder, from: Vector3, to: Vector3, count: number, name: string, color: string): void {
  const normal = getNormal2D(from, to);

  for (let index = 0; index < count; index += 1) {
    const point = lerpVector(from, to, (index + 0.5) / count);
    [-1, 1].forEach((side) => {
      createBlock(builder, {
        x: point.x + normal.x * side * 2.5,
        y: Math.max(from.y, to.y) + 0.52,
        z: point.z + normal.z * side * 2.5
      }, {
        name: `${name} ${index + 1}.${side > 0 ? "D" : "E"}`,
        scale: { x: 0.3, y: 0.72, z: 0.3 },
        properties: {
          color,
          collision: false,
          material: "default"
        }
      });
    });
  }
}

function createCoinLine(builder: TemplateBuilder, from: Vector3, to: Vector3, count: number, name: string): void {
  for (let index = 0; index < count; index += 1) {
    const point = lerpVector(from, to, count === 1 ? 0.5 : index / (count - 1));
    createCoin(builder, point, `${name} ${index + 1}`);
  }
}

function createCoinCluster(builder: TemplateBuilder, center: Vector3, count: number, radius: number, name: string): void {
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    const ring = index % 3 === 0 ? radius * 0.55 : radius;

    createCoin(builder, {
      x: center.x + Math.cos(angle) * ring,
      y: center.y,
      z: center.z + Math.sin(angle) * ring
    }, `${name} ${index + 1}`);
  }
}

function createNaturalBorder(builder: TemplateBuilder, from: Vector3, to: Vector3, count: number, name: string): void {
  const normal = getNormal2D(from, to);

  for (let index = 0; index < count; index += 1) {
    const point = lerpVector(from, to, (index + 0.5) / count);
    const left = { x: point.x - normal.x * 6.4, y: 0, z: point.z - normal.z * 6.4 };
    const right = { x: point.x + normal.x * 6.4, y: 0, z: point.z + normal.z * 6.4 };

    if (index % 3 === 0) {
      createRock(builder, left, { name: `${name} pedra ${index + 1}` });
      createRock(builder, right, { name: `${name} pedra par ${index + 1}` });
    } else {
      createTree(builder, left, { name: `${name} arvore ${index + 1}`, scale: scalar(1 + (index % 2) * 0.15) });
      createTree(builder, right, { name: `${name} arvore par ${index + 1}`, scale: scalar(1.12) });
    }
  }
}

function createForestPocket(builder: TemplateBuilder, center: Vector3, name: string): void {
  const points = [
    { x: -7, z: -5 },
    { x: -5, z: 5 },
    { x: 0, z: 7 },
    { x: 5, z: 5 },
    { x: 7, z: -5 },
    { x: -2, z: -7 },
    { x: 3, z: -7 }
  ];

  points.forEach((point, index) => {
    createTree(builder, { x: center.x + point.x, y: 0, z: center.z + point.z }, {
      name: `${name} arvore ${index + 1}`,
      scale: scalar(1 + (index % 3) * 0.12)
    });
  });
}

function createRuinCluster(builder: TemplateBuilder, center: Vector3): void {
  createArch(builder, { x: center.x - 5.2, y: 0, z: center.z - 4 }, { name: "Arco da ruina da chave" });
  createPillar(builder, { x: center.x + 5.2, y: 0, z: center.z - 4 }, { name: "Pilar frontal da ruina" });
  createPillar(builder, { x: center.x + 5.2, y: 0, z: center.z + 4 }, { name: "Pilar traseiro da ruina" });
  createBlock(builder, { x: center.x, y: 0.85, z: center.z + 5.8 }, {
    name: "Parede baixa da ruina",
    scale: { x: 8, y: 1.3, z: 0.45 },
    properties: { color: "#bca881" }
  });
  createRock(builder, { x: center.x - 6.2, y: 0, z: center.z + 3.2 }, { name: "Pedra guia da ruina" });
  createCrate(builder, { x: center.x + 1.5, y: 0, z: center.z - 4.4 }, { name: "Caixa de pista da ruina" });
}

function createLabRoom(builder: TemplateBuilder, center: Vector3, label: string, index: number): void {
  const colors = ["#1d4ed8", "#2563eb", "#0ea5e9", "#7c3aed", "#16a34a", "#f59e0b"];
  const color = colors[index % colors.length];

  addDesignedPlatform(builder, center, {
    name: `Sala laboratorio - ${label}`,
    width: 14,
    length: 11,
    color,
    edgeCount: 5,
    supports: 0,
    material: "glow"
  });
  createSign(builder, { x: center.x - 5.2, y: center.y + 0.05, z: center.z + 4.5 }, `${index}. ${label}`);
  createLamp(builder, { x: center.x - 5.6, y: 0, z: center.z - 4.2 }, `Luz esquerda ${label}`, true);
  createLamp(builder, { x: center.x + 5.6, y: 0, z: center.z - 4.2 }, `Luz direita ${label}`, true);

  createBlock(builder, { x: center.x - 7.2, y: 1.1, z: center.z }, {
    name: `Parede esquerda ${label}`,
    scale: { x: 0.3, y: 2.1, z: 8.6 },
    properties: {
      color: "#172554",
      material: "glow",
      emissive: "#1e40af"
    }
  });
  createBlock(builder, { x: center.x + 7.2, y: 1.1, z: center.z }, {
    name: `Parede direita ${label}`,
    scale: { x: 0.3, y: 2.1, z: 8.6 },
    properties: {
      color: "#172554",
      material: "glow",
      emissive: "#1e40af"
    }
  });
  createBlock(builder, { x: center.x - 3.7, y: 1.1, z: center.z + 5.5 }, {
    name: `Parede entrada esquerda ${label}`,
    scale: { x: 3.2, y: 2, z: 0.3 },
    properties: {
      color: "#1e3a8a",
      material: "glow",
      emissive: "#1e3a8a"
    }
  });
  createBlock(builder, { x: center.x + 3.7, y: 1.1, z: center.z + 5.5 }, {
    name: `Parede entrada direita ${label}`,
    scale: { x: 3.2, y: 2, z: 0.3 },
    properties: {
      color: "#1e3a8a",
      material: "glow",
      emissive: "#1e3a8a"
    }
  });
}

function getLogicRoomMessage(index: number): string {
  const messages = [
    "Entrada: este laboratorio demonstra a logica visual em ordem.",
    "onMapStart roda automaticamente quando o mapa inicia.",
    "onPlayerEnterObject detecta o jogador entrando em uma zona.",
    "onButtonActivated conecta um botao a uma porta proxima.",
    "coinsAtLeast espera o jogador coletar moedas suficientes.",
    "hasKey valida uma chave antes de abrir a proxima porta.",
    "teleportPlayer e teleportes fisicos movem o jogador com feedback.",
    "enableObject e disableObject mostram objetos aparecendo ou sumindo.",
    "once impede que uma regra rode varias vezes.",
    "setCheckpoint muda o respawn por logica.",
    "finishMap encerra o mapa no terminal final."
  ];

  return messages[index] ?? "Sala de logica.";
}

function lerpVector(from: Vector3, to: Vector3, t: number): Vector3 {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t
  };
}

function getNormal2D(from: Vector3, to: Vector3): { x: number; z: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.max(0.001, Math.hypot(dx, dz));

  return {
    x: -dz / length,
    z: dx / length
  };
}

function buildTemplateLayout(builder: TemplateBuilder, config: TemplateConfig): RoutePoint[] {
  const route: RoutePoint[] = [];

  addSpawn(builder, { x: 0, y: 0.7, z: 3.5 });
  createPlatform(builder, { x: 0, y: 0.2, z: 1.5 }, {
    name: "Plataforma inicial segura",
    scale: { x: 14, y: 0.4, z: 12 }
  });
  createSign(builder, { x: -4.4, y: 0.2, z: 4.2 }, `Inicio: ${config.name}`);

  if (config.style === "sandbox") {
    route.push(...generateSandbox(builder, config));
    return route;
  }

  if (config.style === "city") {
    route.push(...generateCityBlock(builder, {
      blocks: config.areas,
      buildings: config.buildings ?? 25
    }));
    return route;
  }

  if (config.style === "island") {
    route.push(...generateIsland(builder, { areas: config.areas, sections: config.sections }));
    return route;
  }

  if (config.style === "forest") {
    route.push(...generateForest(builder, { areas: config.areas, dense: true }));
  } else if (config.style === "desert") {
    route.push(...generateDesertRuins(builder, { areas: config.areas }));
  } else if (config.style === "coinWorld") {
    route.push(...generateOpenWorld(builder, config));
  } else if (config.style === "dungeon" || config.style === "puzzle") {
    route.push(...generateDungeonRoom(builder, { rooms: config.areas, dark: config.theme === "dark" }));
  } else if (config.style === "mechanics" || config.style === "logic") {
    route.push(...generateMechanicsLab(builder, config));
  }

  route.push(...generatePlatformPath(builder, {
    sections: config.sections,
    start: { x: 0, y: 0.2, z: -6 },
    spacing: config.style === "neon" || config.style === "obby" ? 8 : 10,
    width: config.style === "puzzle" || config.style === "dungeon" ? 8 : 5,
    label: config.style
  }));

  return route;
}

function generateGameplaySystems(builder: TemplateBuilder, config: TemplateConfig, route: RoutePoint[]): void {
  createCoinTrailToGuidePlayer(builder, route, Math.ceil(config.coins * 0.68));
  distributeIntentionalRewards(builder, route, Math.max(0, config.coins - Math.ceil(config.coins * 0.68)));
  createCheckpointBeforeChallenge(builder, route, config.checkpoints);
  createDangerChallenge(builder, route, config.damageZones);
  generateJumpPads(builder, route, config.jumpPads);
  generateMovingPlatforms(builder, route, config.movingPlatforms);
  generateDisappearingBlocks(builder, route, config.disappearingBlocks);
  createTeleporterPairWithSigns(builder, route, config.teleporters);
  generateMessageZones(builder, route, config.messageZones);
  createKeyBeforeDoorSequence(builder, route, {
    doors: config.doors,
    buttons: config.buttons,
    keys: config.keys
  });
}

function generateTemplateSpecificDecor(builder: TemplateBuilder, config: TemplateConfig, route: RoutePoint[]): void {
  const sectionSigns = Math.max(0, Math.min(config.sections, Math.ceil(config.messageZones * 0.8)));

  for (let index = 0; index < sectionSigns; index += 1) {
    const point = getRoutePoint(route, index, sectionSigns);
    createSign(builder, offset(point, -2.8, 0.1, 2.7), getSectionText(config, index));
  }

  if (config.style === "forest" || config.style === "coinWorld" || config.style === "island") {
    generateForest(builder, { areas: Math.max(3, Math.ceil(config.areas / 2)), dense: true });
  }

  if (config.style === "desert") {
    generateDesertRuins(builder, { areas: Math.max(4, config.areas) });
  }

  if (config.style === "dungeon" || config.style === "puzzle" || config.style === "logic") {
    generateDungeonRoom(builder, { rooms: Math.max(4, Math.ceil(config.areas / 2)), dark: config.theme === "dark" });
  }

  if (config.style === "city" || config.style === "stress") {
    generateCityBlock(builder, {
      blocks: Math.max(4, Math.ceil(config.areas / 2)),
      buildings: Math.max(10, config.buildings ?? 16)
    });
  }

  if (config.style === "mechanics" || config.style === "logic") {
    addMechanicsSigns(builder, route);
  }

  addDecorations(builder, config.decorations, config.style, route);
}

function createMainPath(builder: TemplateBuilder, config: TemplateConfig, route: RoutePoint[]): void {
  const plan = getSectionPlan(config);

  route.forEach((point, index) => {
    if (index === 0) {
      createLandmark(builder, point, "Entrada clara", config.style);
    } else if (index === route.length - 1) {
      createLandmark(builder, point, "Ultima area antes do final", config.style);
    } else if (index % 3 === 0) {
      createLandmark(builder, point, plan[index % plan.length], config.style);
    }

    if (index > 0) {
      const previous = route[index - 1];
      createCorridor(builder, previous, point, `Corredor guiado ${index}`);
    }
  });
}

function addOptionalLevelDesign(builder: TemplateBuilder, config: TemplateConfig, route: RoutePoint[]): void {
  if (config.style === "sandbox") {
    return;
  }

  const optionalCount = config.minObjects >= 800 ? 4 : config.minObjects >= 500 ? 3 : 2;

  for (let index = 0; index < optionalCount; index += 1) {
    const anchor = getRoutePoint(route, index + 1, optionalCount + 2);
    createOptionalPath(builder, anchor, index, config.style);
  }

  if (config.teleporters > 0 || config.keys > 0 || config.coins > 50) {
    const secretAnchor = getRoutePoint(route, Math.max(1, Math.floor(route.length * 0.62)), 1);
    createSecretArea(builder, secretAnchor, config.style);
  }
}

function generateSandbox(builder: TemplateBuilder, config: TemplateConfig): RoutePoint[] {
  const route: RoutePoint[] = [];
  const size = 18;

  for (let x = -2; x <= 2; x += 1) {
    for (let z = -2; z <= 2; z += 1) {
      const position = { x: x * size, y: 0.16, z: z * size - 20 };
      createPlatform(builder, position, {
        name: `Area livre ${x + 3}-${z + 3}`,
        scale: { x: 16, y: 0.32, z: 16 },
        properties: {
          color: x === 0 && z === 0 ? builder.palette.platform : "#e2e8f0"
        }
      });
      route.push({ ...position, label: "Area livre" });
    }
  }

  for (let index = 0; index < 52; index += 1) {
    const row = Math.floor(index / 13);
    const column = index % 13;
    const x = -36 + column * 6;
    const z = -58 + row * 12;
    createBlock(builder, { x, y: 0.43, z }, {
      name: `Marcador de grid ${index + 1}`,
      scale: { x: 0.28, y: 0.28, z: 10 },
      properties: {
        color: index % 2 === 0 ? "#94a3b8" : "#cbd5e1",
        collision: false
      }
    });
  }

  createSign(builder, { x: -8, y: 0.2, z: -10 }, "Use as areas vazias para construir.");
  createSign(builder, { x: 12, y: 0.2, z: -28 }, "Grid visual: apague ou duplique livremente.");
  createMessageZone(builder, { x: 0, y: 1.1, z: -10 }, "Sandbox grande: salve, exporte e teste o editor com muitos objetos.");
  createPlatform(builder, { x: 0, y: 0.2, z: -76 }, {
    name: "Area do final opcional",
    scale: { x: 10, y: 0.4, z: 10 }
  });
  route.push({ x: 0, y: 0.2, z: -76, label: config.name });
  return route;
}

function createOptionalPath(builder: TemplateBuilder, anchor: RoutePoint, index: number, style: TemplateStyle): void {
  const direction = index % 2 === 0 ? 1 : -1;
  const sideStart = offset(anchor, direction * 6, 0.12, -1.5);
  const sideEnd = offset(anchor, direction * 12, 0.22, -5.5);
  const label = getOptionalLabel(style, index);

  createSign(builder, offset(sideStart, direction * 1.5, 0.1, 1.7), `Opcional: ${label}`);
  createPlatform(builder, sideStart, {
    name: `Entrada opcional ${index + 1}`,
    scale: { x: 4.8, y: 0.32, z: 3.2 },
    properties: {
      color: builder.palette.secondary,
      material: builder.palette.glow ? "glow" : "default"
    }
  });
  generateBridge(builder, { ...anchor, label: "principal" }, { ...sideStart, label }, `Ponte opcional ${index + 1}`);
  createPlatform(builder, sideEnd, {
    name: `Recompensa opcional ${index + 1}`,
    scale: { x: 5.5, y: 0.34, z: 4.4 },
    properties: {
      color: builder.palette.accent,
      material: builder.palette.glow ? "glow" : "default",
      emissive: builder.palette.glow ? builder.palette.accent : undefined
    }
  });
  createRewardCluster(builder, offset(sideEnd, 0, 0, 0), 5 + index, `Moedas opcionais ${index + 1}`);

  if (style === "obby" || style === "neon" || style === "challenge") {
    createDangerChallenge(builder, [
      { ...sideEnd, label: `Risco opcional ${index + 1}` }
    ], 1);
  }
}

function createSecretArea(builder: TemplateBuilder, anchor: RoutePoint, style: TemplateStyle): void {
  const secret = offset(anchor, -14, 0.35, -10);

  createSign(builder, offset(anchor, -4.2, 0.1, -3.2), "Segredo visivel: procure o caminho lateral.");
  createPlatform(builder, secret, {
    name: "Area secreta recompensadora",
    scale: { x: 8, y: 0.38, z: 8 },
    properties: {
      color: style === "neon" ? "#39ff14" : builder.palette.accent,
      material: builder.palette.glow ? "glow" : "default",
      emissive: builder.palette.glow ? "#39ff14" : undefined
    }
  });
  createRewardCluster(builder, secret, 10, "Moeda secreta");
  createLandmark(builder, secret, "Segredo", style);
}

function createRewardCluster(builder: TemplateBuilder, center: Vector3, count: number, label: string): void {
  for (let index = 0; index < count; index += 1) {
    const angle = (index / Math.max(1, count)) * Math.PI * 2;
    const radius = 1.4 + (index % 2) * 0.75;
    createCoin(builder, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + 1.1,
      z: center.z + Math.sin(angle) * radius
    }, `${label} ${index + 1}`);
  }
}

function createCheckpointBeforeChallenge(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  for (let index = 0; index < count; index += 1) {
    const point = getRoutePoint(route, index, count);
    const safePosition = offset(point, -2.1, 0.75, 2.4);
    createCheckpoint(builder, safePosition, `Checkpoint antes de ${point.label}`);

    if (index % 2 === 0) {
      createSign(builder, offset(safePosition, -1.7, 0.1, 1.3), "Checkpoint antes do desafio.");
    }
  }
}

function createDangerChallenge(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  const challengeRoute = route.length > 1 ? route.slice(1) : route;

  for (let index = 0; index < count; index += 1) {
    const point = getRoutePoint(challengeRoute, index, count);
    const side = index % 2 === 0 ? 1 : -1;
    createDamageZone(builder, offset(point, side * 3.6, -0.16, -0.25), {
      name: `Perigo justo ${index + 1}`,
      scale: { x: 3.6, y: 0.25, z: 3.4 }
    });

    if (index % 4 === 0) {
      createSign(builder, offset(point, side * 4.8, 0.1, 2.8), "Perigo visivel: risco opcional ou desafio sinalizado.");
    }
  }
}

function createCoinTrailToGuidePlayer(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  generateCoinTrail(builder, route, count);
}

function distributeIntentionalRewards(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  let remaining = count;
  let cluster = 0;

  while (remaining > 0) {
    const point = getRoutePoint(route, cluster + 1, Math.max(2, Math.ceil(count / 6)));
    const amount = Math.min(6, remaining);
    createRewardCluster(builder, offset(point, cluster % 2 === 0 ? 4.5 : -4.5, 0.05, -2.8), amount, `Recompensa ${cluster + 1}`);
    remaining -= amount;
    cluster += 1;
  }
}

function createTeleporterPairWithSigns(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  generateTeleporterNetwork(builder, route, count);

  const teleporters = getObjects(builder, "teleporter").slice(-count);
  teleporters.forEach((teleporter, index) => {
    createSign(builder, offset(teleporter.position, 1.6, 0.1, 1.6), `Teleporte ${Math.floor(index / 2) + 1}: atalho sinalizado.`);
  });
}

function createKeyBeforeDoorSequence(
  builder: TemplateBuilder,
  route: RoutePoint[],
  options: { doors: number; buttons: number; keys: number }
): void {
  generateKeyDoorChain(builder, route, options);

  const doors = getObjects(builder, "door").slice(-options.doors);
  const buttons = getObjects(builder, "button").slice(-options.buttons);
  const keys = getObjects(builder, "key").slice(-options.keys);

  keys.forEach((key, index) => {
    createSign(builder, offset(key.position, 1.4, 0.1, 1.2), `Pegue a ${getKeyLabel(index)} antes da porta.`);
  });

  buttons.forEach((button, index) => {
    const targetDoorId = typeof button.properties?.targetDoorId === "string" ? button.properties.targetDoorId : "";
    const door = doors.find((candidate) => getDoorId(candidate) === targetDoorId);

    if (door) {
      createButtonDoorPuzzle(builder, button, door, index);
    }
  });
}

function createButtonDoorPuzzle(builder: TemplateBuilder, button: MapObject, door: MapObject, index: number): void {
  const mid = {
    x: (button.position.x + door.position.x) / 2,
    y: Math.max(button.position.y, door.position.y) + 0.15,
    z: (button.position.z + door.position.z) / 2
  };
  createSign(builder, offset(button.position, 1.2, 0.1, 1.2), `Botao ${index + 1} abre porta visivel.`);
  createBlock(builder, mid, {
    name: `Linha visual botao-porta ${index + 1}`,
    scale: { x: 0.18, y: 0.08, z: Math.max(1.5, Math.abs(button.position.z - door.position.z)) },
    properties: {
      color: "#f97316",
      collision: false,
      material: builder.palette.glow ? "glow" : "default"
    }
  });
}

function createLandmark(builder: TemplateBuilder, point: Vector3, label: string, style: TemplateStyle): void {
  if (style === "forest" || style === "coinWorld" || style === "island") {
    createTree(builder, offset(point, 4.8, 0, 4.8), { name: `Marco natural - ${label}`, scale: scalar(1.45) });
    createRock(builder, offset(point, -4.2, 0, 4.2), { name: `Pedra guia - ${label}` });
  } else if (style === "desert") {
    createArch(builder, offset(point, 0, 0, 5.7), { name: `Arco guia - ${label}` });
    createPillar(builder, offset(point, -4.5, 0, 4.8), { name: `Pilar guia - ${label}` });
    createPillar(builder, offset(point, 4.5, 0, 4.8), { name: `Pilar guia par - ${label}` });
  } else if (style === "city" || style === "stress") {
    createLamp(builder, offset(point, -4.8, 0, 4.8), `Poste guia - ${label}`, false);
    createCrate(builder, offset(point, 4.8, 0, 4.8), { name: `Marco urbano - ${label}` });
  } else {
    createBlock(builder, offset(point, -4.5, 0.8, 4.6), {
      name: `Marco visual - ${label}`,
      scale: { x: 0.8, y: 1.6, z: 0.8 },
      properties: {
        color: builder.palette.accent,
        collision: false,
        material: builder.palette.glow ? "glow" : "default",
        emissive: builder.palette.glow ? builder.palette.accent : undefined
      }
    });
  }
}

function createCorridor(builder: TemplateBuilder, from: RoutePoint, to: RoutePoint, name: string): void {
  const mid = {
    x: (from.x + to.x) / 2,
    y: Math.max(from.y, to.y) + 0.08,
    z: (from.z + to.z) / 2
  };
  const yaw = Math.atan2(to.x - from.x, to.z - from.z);
  const length = Math.max(4, distance2D(from, to) - 6);

  createBlock(builder, offset(mid, -2.4 * Math.cos(yaw), 0.12, 2.4 * Math.sin(yaw)), {
    name: `${name} borda esquerda`,
    rotation: { x: 0, y: yaw, z: 0 },
    scale: { x: 0.28, y: 0.24, z: length },
    properties: {
      color: builder.palette.secondary,
      collision: false
    }
  });
  createBlock(builder, offset(mid, 2.4 * Math.cos(yaw), 0.12, -2.4 * Math.sin(yaw)), {
    name: `${name} borda direita`,
    rotation: { x: 0, y: yaw, z: 0 },
    scale: { x: 0.28, y: 0.24, z: length },
    properties: {
      color: builder.palette.secondary,
      collision: false
    }
  });
}

function generatePlatformPath(
  builder: TemplateBuilder,
  options: { sections: number; start: Vector3; spacing: number; width: number; label: string }
): RoutePoint[] {
  const route: RoutePoint[] = [];
  let previous: RoutePoint | null = null;

  for (let index = 0; index < options.sections; index += 1) {
    const plan = getSectionPlan(builder.config);
    const x = Math.sin(index * 0.82) * 8 + (index % 5 === 4 ? 6 : 0);
    const y = options.start.y + (index % 6 === 5 ? 1.15 : 0) + Math.floor(index / 6) * 0.22;
    const z = options.start.z - index * options.spacing;
    const point: RoutePoint = {
      x,
      y,
      z,
      label: plan[index % plan.length] ?? `${options.label} secao ${index + 1}`,
      difficulty: Math.min(5, 1 + Math.floor(index / Math.max(1, options.sections / 5)))
    };

    createObbySectionWithDifficulty(builder, point, index, options.width, point.difficulty ?? 1);

    if (previous) {
      generateBridge(builder, previous, point, `Ponte ${index}`);
    }

    if (index % 4 === 2) {
      generateStairs(builder, offset(point, -3.5, 0, 2.8), 4, index % 2 === 0 ? 1 : -1);
    }

    route.push(point);
    previous = point;
  }

  return route;
}

function generateObbySection(builder: TemplateBuilder, point: RoutePoint, index: number, width: number): void {
  const glow = builder.palette.glow;
  const colors = [builder.palette.platform, builder.palette.accent, builder.palette.secondary];

  createPlatform(builder, point, {
    name: `Secao jogavel ${index + 1}`,
    scale: { x: width, y: 0.38, z: width },
    properties: {
      color: colors[index % colors.length],
      material: glow ? "glow" : "default",
      emissive: glow ? colors[index % colors.length] : undefined
    }
  });

  createPlatform(builder, offset(point, width * 0.9, 0.18, -2.6), {
    name: `Rota opcional ${index + 1}`,
    scale: { x: Math.max(2.8, width * 0.52), y: 0.32, z: 2.6 },
    properties: {
      color: index % 2 === 0 ? builder.palette.secondary : builder.palette.accent,
      material: glow ? "glow" : "default"
    }
  });

  if (index % 3 === 1) {
    createRamp(builder, offset(point, -width * 0.72, 0.25, 1.4), {
      name: `Rampa de ligacao ${index + 1}`,
      scale: { x: 2.2, y: 1.2, z: 2.8 }
    });
  }
}

function generateBridge(builder: TemplateBuilder, from: RoutePoint, to: RoutePoint, name: string): void {
  const mid = {
    x: (from.x + to.x) / 2,
    y: Math.max(from.y, to.y),
    z: (from.z + to.z) / 2
  };
  const length = Math.max(4, distance2D(from, to) - 5.5);

  createPlatform(builder, mid, {
    name,
    scale: { x: 2.4, y: 0.28, z: length },
    rotation: { x: 0, y: Math.atan2(to.x - from.x, to.z - from.z), z: 0 },
    properties: {
      color: builder.palette.secondary,
      material: builder.palette.glow ? "glow" : "default"
    }
  });
}

function createObbySectionWithDifficulty(
  builder: TemplateBuilder,
  point: RoutePoint,
  index: number,
  width: number,
  difficulty: number
): void {
  generateObbySection(builder, point, index, Math.max(3.2, width - Math.max(0, difficulty - 2) * 0.35));

  if (difficulty >= 3) {
    createSign(builder, offset(point, 2.8, 0.1, 2.6), `Dificuldade ${difficulty}: checkpoint antes, moedas opcionais no risco.`);
  }
}

function generateCoinTrail(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  for (let index = 0; index < count; index += 1) {
    const point = getRoutePoint(route, index, count);
    const side = index % 2 === 0 ? 1 : -1;
    const orbit = (index % 5) - 2;
    createCoin(builder, {
      x: point.x + side * (1.25 + Math.abs(orbit) * 0.45),
      y: point.y + 1.05 + (index % 4 === 0 ? 0.55 : 0),
      z: point.z + orbit * 0.9
    }, `Moeda ${index + 1}`);
  }
}

function generateCoinCircle(builder: TemplateBuilder, center: Vector3, count: number, radius: number, label: string): void {
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    createCoin(builder, {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + 1.05,
      z: center.z + Math.sin(angle) * radius
    }, `${label} ${index + 1}`);
  }
}

function generateCheckpointLine(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  for (let index = 0; index < count; index += 1) {
    const point = getRoutePoint(route, index, count);
    createCheckpoint(builder, offset(point, -1.8, 0.75, -1.8), `Checkpoint ${index + 1}`);
  }
}

function generateDamageZones(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  for (let index = 0; index < count; index += 1) {
    const point = getRoutePoint(route, index, count);
    createDamageZone(builder, offset(point, index % 2 === 0 ? 3.4 : -3.4, -0.05, 0.8), {
      name: `Zona de morte ${index + 1}`,
      scale: { x: 3.4, y: 0.25, z: 3.2 }
    });
  }
}

function generateJumpPads(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  for (let index = 0; index < count; index += 1) {
    const point = getRoutePoint(route, index, count);
    const padPosition = offset(point, 0, 0.08, index % 2 === 0 ? 1.8 : -1.8);
    const landingPosition = offset(point, 0, 1.25, -5.8);
    createJumpPad(builder, padPosition, {
      name: `Jump Pad ${index + 1}`,
      properties: {
        force: 11 + (index % 4) * 1.5
      }
    });
    createPlatform(builder, landingPosition, {
      name: `Aterrissagem do Jump Pad ${index + 1}`,
      scale: { x: 4.6, y: 0.32, z: 4.2 },
      properties: {
        color: builder.palette.accent,
        material: builder.palette.glow ? "glow" : "default",
        emissive: builder.palette.glow ? builder.palette.accent : undefined
      }
    });

    if (index % 3 === 0) {
      createCoinLine(builder, offset(padPosition, 0, 1.2, -0.8), offset(landingPosition, 0, 1.15, 0), 4, `Moeda guia jump pad ${index + 1}`);
    }
  }
}

function generateMovingPlatforms(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  for (let index = 0; index < count; index += 1) {
    const point = getRoutePoint(route, index, count);
    const side = index % 2 === 0 ? 1 : -1;
    const platformPosition = offset(point, side * 6.2, 0.65, -2);
    createPlatform(builder, offset(point, side * 2.8, 0.22, -2), {
      name: `Entrada da plataforma movel ${index + 1}`,
      scale: { x: 3.4, y: 0.28, z: 3.2 },
      properties: { color: builder.palette.secondary }
    });
    createPlatform(builder, offset(point, side * 9.6, 0.22, -2), {
      name: `Saida da plataforma movel ${index + 1}`,
      scale: { x: 3.4, y: 0.28, z: 3.2 },
      properties: { color: builder.palette.secondary }
    });
    createMovingPlatform(builder, platformPosition, {
      name: `Plataforma movel ${index + 1}`,
      scale: { x: 3.5, y: 0.35, z: 2.4 },
      properties: {
        startOffset: { x: -2.8 * side, y: 0, z: 0 },
        endOffset: { x: 2.8 * side, y: 0, z: 0 },
        speed: 1 + (index % 4) * 0.25,
        loop: true
      }
    });
  }
}

function generateDisappearingBlocks(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  for (let index = 0; index < count; index += 1) {
    const point = getRoutePoint(route, index, count);
    createDisappearingBlock(builder, offset(point, (index % 3 - 1) * 1.8, 0.55, -3.6), {
      name: `Bloco que desaparece ${index + 1}`,
      properties: {
        delayBeforeDisappear: 0.75 + (index % 3) * 0.15,
        respawnDelay: 2 + (index % 4) * 0.35
      }
    });
  }
}

function generateTeleporterNetwork(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  const pairCount = Math.floor(count / 2);

  for (let index = 0; index < pairCount; index += 1) {
    const a = getRoutePoint(route, index, pairCount);
    const b = getRoutePoint(route, pairCount - index - 1, pairCount);
    const idA = `${builder.config.id}_tp_${index + 1}_a`;
    const idB = `${builder.config.id}_tp_${index + 1}_b`;
    createTeleporter(builder, offset(a, 4.2, 0.35, 2.2), {
      id: `${idA}_object`,
      name: `Teleporte ${index + 1} A`,
      properties: {
        teleporterId: idA,
        targetTeleporterId: idB
      }
    });
    createTeleporter(builder, offset(b, -4.2, 0.35, -2.2), {
      id: `${idB}_object`,
      name: `Teleporte ${index + 1} B`,
      properties: {
        teleporterId: idB,
        targetTeleporterId: idA
      }
    });
  }
}

function generateMessageZones(builder: TemplateBuilder, route: RoutePoint[], count: number): void {
  for (let index = 0; index < count; index += 1) {
    const point = getRoutePoint(route, index, count);
    createMessageZone(builder, offset(point, 0, 1.05, 3.2), getSectionText(builder.config, index), {
      name: `Mensagem ${index + 1}`,
      scale: { x: 5, y: 1.4, z: 2.2 }
    });
  }
}

function generateKeyDoorChain(
  builder: TemplateBuilder,
  route: RoutePoint[],
  options: { doors: number; buttons: number; keys: number }
): void {
  const keyIds = Array.from({ length: options.keys }, (_, index) => getKeyId(index));
  const doorIds: string[] = [];

  for (let index = 0; index < options.doors; index += 1) {
    const point = getRoutePoint(route, index, Math.max(1, options.doors));
    const doorId = `${builder.config.id}_door_${index + 1}`;
    const requiresKey = keyIds.length > 0 && (index < keyIds.length || index >= options.buttons);
    const requiredKeyId = requiresKey ? keyIds[index % keyIds.length] : "";
    doorIds.push(doorId);

    if (index < keyIds.length) {
      createKey(builder, offset(point, index % 2 === 0 ? -3.8 : 3.8, 1.25, -0.8), {
        name: `Chave ${getKeyLabel(index)}`,
        properties: {
          keyId: keyIds[index],
          label: `Chave ${getKeyLabel(index)}`,
          color: getKeyColor(index)
        }
      });
    }

    createDoor(builder, offset(point, 0, 1.65, -4.1), {
      name: `Porta ${index + 1}`,
      properties: {
        doorId,
        requiredKeyId,
        openOffset: { x: 0, y: 3.8, z: 0 },
        color: builder.palette.door
      }
    });
  }

  for (let index = 0; index < options.buttons; index += 1) {
    const doorIndex = options.doors > 0 ? index % options.doors : 0;
    const point = getRoutePoint(route, doorIndex, Math.max(1, options.doors));
    const targetDoorId = doorIds[doorIndex] ?? "";
    createButton(builder, offset(point, index % 2 === 0 ? 2.8 : -2.8, 0.35, 1.8), {
      name: `Botao ${index + 1}`,
      properties: {
        targetDoorId,
        buttonTargetId: targetDoorId,
        oneTime: true
      }
    });
  }
}

function generateForest(builder: TemplateBuilder, options: { areas: number; dense: boolean }): RoutePoint[] {
  const route: RoutePoint[] = [];
  const count = options.areas * (options.dense ? 24 : 12);

  for (let area = 0; area < options.areas; area += 1) {
    const center = { x: (area % 4 - 1.5) * 24, y: 0.2, z: -22 - Math.floor(area / 4) * 28 };
    createPlatform(builder, center, {
      name: `Clareira ${area + 1}`,
      scale: { x: 18, y: 0.36, z: 18 },
      properties: { color: builder.palette.ground }
    });
    generateCoinCircle(builder, center, Math.min(8, Math.max(3, area + 3)), 5.2, `Moeda da clareira ${area + 1}`);
    route.push({ ...center, label: `Clareira ${area + 1}` });
  }

  for (let index = 0; index < count; index += 1) {
    const area = index % options.areas;
    const ring = Math.floor(index / options.areas);
    const center = route[area];
    const angle = index * 2.3999632297;
    const radius = 8 + (ring % 7) * 2.2;
    const position = {
      x: center.x + Math.cos(angle) * radius,
      y: 0,
      z: center.z + Math.sin(angle) * radius
    };

    if (index % 5 === 0) {
      createRock(builder, position, { name: `Pedra do bosque ${index + 1}` });
    } else {
      createTree(builder, position, {
        name: `Arvore do bosque ${index + 1}`,
        scale: scalar(1 + (index % 4) * 0.18)
      });
    }
  }

  return route;
}

function generateDesertRuins(builder: TemplateBuilder, options: { areas: number }): RoutePoint[] {
  const route: RoutePoint[] = [];

  for (let area = 0; area < options.areas; area += 1) {
    const center = { x: (area % 3 - 1) * 28, y: 0.2, z: -24 - Math.floor(area / 3) * 30 };
    createPlatform(builder, center, {
      name: `Patio de ruina ${area + 1}`,
      scale: { x: 20, y: 0.36, z: 18 },
      properties: { color: builder.palette.ground }
    });
    createArch(builder, offset(center, 0, 0.1, 6.8), {
      name: `Arco de ruina ${area + 1}`,
      rotation: { x: 0, y: area % 2 === 0 ? Math.PI / 2 : 0, z: 0 }
    });

    for (let pillar = 0; pillar < 8; pillar += 1) {
      const angle = (pillar / 8) * Math.PI * 2;
      createPillar(builder, {
        x: center.x + Math.cos(angle) * 8,
        y: 0,
        z: center.z + Math.sin(angle) * 6
      }, { name: `Pilar ${area + 1}-${pillar + 1}` });
    }

    route.push({ ...center, label: `Ruina ${area + 1}` });
  }

  return route;
}

function generateDungeonRoom(builder: TemplateBuilder, options: { rooms: number; dark: boolean }): RoutePoint[] {
  const route: RoutePoint[] = [];

  for (let room = 0; room < options.rooms; room += 1) {
    const center = { x: (room % 4 - 1.5) * 20, y: 0.2, z: -18 - Math.floor(room / 4) * 22 };
    createRoom(builder, center, `Sala ${room + 1}`, options.dark);
    createLamp(builder, offset(center, -5.5, 0.2, 5.5), `Lampada sala ${room + 1}`, room % 4 === 0);
    route.push({ ...center, label: `Sala ${room + 1}` });
  }

  return route;
}

function generateOpenWorld(builder: TemplateBuilder, config: TemplateConfig): RoutePoint[] {
  const route: RoutePoint[] = [];
  const areaNames = ["Bosque", "Ruinas", "Area elevada", "Caverna", "Lago", "Ilha secreta", "Mirante", "Clareira"];

  for (let area = 0; area < config.areas; area += 1) {
    const center = { x: (area % 3 - 1) * 30, y: area === 2 ? 1.2 : 0.2, z: -24 - Math.floor(area / 3) * 34 };
    createHubArea(builder, center, areaNames[area] ?? `Area ${area + 1}`, area === 3 ? "#334155" : builder.palette.ground);
    createSign(builder, offset(center, -6, 0.2, 7), areaNames[area] ?? `Area ${area + 1}`);
    route.push({ ...center, label: areaNames[area] ?? `Area ${area + 1}` });
  }

  return route;
}

function generateMechanicsLab(builder: TemplateBuilder, config: TemplateConfig): RoutePoint[] {
  const route: RoutePoint[] = [];
  const labels = [
    "Jump Pads",
    "Teleportes",
    "Plataformas moveis",
    "Blocos que somem",
    "Mensagem",
    "Moedas",
    "Checkpoint",
    "Zona de morte",
    "Chave + porta",
    "Botao + porta",
    "Logica visual",
    "Final"
  ];

  for (let index = 0; index < Math.max(config.areas, labels.length); index += 1) {
    const center = { x: (index % 4 - 1.5) * 22, y: 0.2, z: -18 - Math.floor(index / 4) * 24 };
    createPlatform(builder, center, {
      name: `Modulo ${labels[index % labels.length]}`,
      scale: { x: 17, y: 0.36, z: 17 },
      properties: {
        color: index % 2 === 0 ? builder.palette.platform : builder.palette.secondary,
        material: builder.palette.glow ? "glow" : "default"
      }
    });
    createSign(builder, offset(center, -6.2, 0.2, 6.2), `Teste: ${labels[index % labels.length]}`);
    route.push({ ...center, label: labels[index % labels.length] });
  }

  return route;
}

function generateCityBlock(builder: TemplateBuilder, options: { blocks: number; buildings: number }): RoutePoint[] {
  const route: RoutePoint[] = [];

  for (let block = 0; block < options.blocks; block += 1) {
    const center = { x: (block % 4 - 1.5) * 28, y: 0.2, z: -18 - Math.floor(block / 4) * 28 };
    createPlatform(builder, center, {
      name: `Rua ${block + 1}`,
      scale: { x: 24, y: 0.34, z: 24 },
      properties: { color: "#cbd5e1" }
    });
    createBlock(builder, offset(center, 0, 0.38, 0), {
      name: `Faixa central ${block + 1}`,
      scale: { x: 1, y: 0.05, z: 22 },
      properties: { color: "#f8fafc", collision: false }
    });
    route.push({ ...center, label: `Quadra ${block + 1}` });
  }

  for (let building = 0; building < options.buildings; building += 1) {
    const block = route[building % route.length];
    const lane = Math.floor(building / route.length);
    generateBuilding(builder, {
      x: block.x + (building % 2 === 0 ? -8 : 8),
      y: 0.2,
      z: block.z + ((lane % 3) - 1) * 7
    }, building);
  }

  return route;
}

function generateBuilding(builder: TemplateBuilder, position: Vector3, index: number): void {
  const floors = 3 + (index % 5);
  const width = 4 + (index % 3);

  for (let floor = 0; floor < floors; floor += 1) {
    createBlock(builder, {
      x: position.x,
      y: 0.75 + floor * 1.45,
      z: position.z
    }, {
      name: `Predio ${index + 1} andar ${floor + 1}`,
      scale: { x: width, y: 1.35, z: 4.5 },
      properties: {
        color: floor % 2 === 0 ? "#64748b" : "#94a3b8"
      }
    });
  }
}

function generateIsland(builder: TemplateBuilder, options: { areas: number; sections: number }): RoutePoint[] {
  const route: RoutePoint[] = [];

  for (let area = 0; area < options.areas; area += 1) {
    const center = {
      x: Math.cos((area / options.areas) * Math.PI * 2) * 34,
      y: 0.2 + (area % 3) * 0.22,
      z: -42 + Math.sin((area / options.areas) * Math.PI * 2) * 34
    };
    createPlatform(builder, center, {
      name: `Ilha ${area + 1}`,
      scale: { x: 20, y: 0.42, z: 18 },
      properties: { color: area % 2 === 0 ? "#7bc96f" : "#e8c16d" }
    });
    generateTower(builder, offset(center, 5.8, 0, -4.8), 3 + (area % 4), `Torre da ilha ${area + 1}`);
    route.push({ ...center, label: `Ilha ${area + 1}` });
  }

  for (let index = 1; index < route.length; index += 1) {
    generateBridge(builder, route[index - 1], route[index], `Ponte entre ilhas ${index}`);
  }

  route.push(...generatePlatformPath(builder, {
    sections: options.sections,
    start: { x: 0, y: 0.2, z: -8 },
    spacing: 9,
    width: 5,
    label: "ilha"
  }));

  return route;
}

function generateStairs(builder: TemplateBuilder, base: Vector3, steps: number, direction: 1 | -1): void {
  for (let index = 0; index < steps; index += 1) {
    createPlatform(builder, {
      x: base.x,
      y: base.y + 0.12 + index * 0.22,
      z: base.z + direction * index * 1.2
    }, {
      name: `Degrau ${index + 1}`,
      scale: { x: 3.4, y: 0.24, z: 1.1 }
    });
  }
}

function generateTower(builder: TemplateBuilder, position: Vector3, levels: number, name: string): void {
  for (let level = 0; level < levels; level += 1) {
    createBlock(builder, {
      x: position.x,
      y: 0.85 + level * 1.35,
      z: position.z
    }, {
      name: `${name} nivel ${level + 1}`,
      scale: { x: 3.5 - Math.min(1.6, level * 0.22), y: 1.3, z: 3.5 - Math.min(1.6, level * 0.22) },
      properties: { color: builder.palette.secondary }
    });
  }
}

function createRoom(builder: TemplateBuilder, center: Vector3, name: string, dark: boolean): void {
  createPlatform(builder, center, {
    name,
    scale: { x: 16, y: 0.35, z: 16 },
    properties: { color: dark ? "#1f2937" : builder.palette.platform }
  });
  createBlock(builder, offset(center, -8.4, 1.2, 0), {
    name: `Parede esquerda - ${name}`,
    scale: { x: 0.45, y: 2.4, z: 16 }
  });
  createBlock(builder, offset(center, 8.4, 1.2, 0), {
    name: `Parede direita - ${name}`,
    scale: { x: 0.45, y: 2.4, z: 16 }
  });
  createBlock(builder, offset(center, 0, 1.2, -8.4), {
    name: `Parede de fundo - ${name}`,
    scale: { x: 16, y: 2.4, z: 0.45 }
  });
}

function createHubArea(builder: TemplateBuilder, center: Vector3, name: string, color: string): void {
  createPlatform(builder, center, {
    name,
    scale: { x: 22, y: 0.4, z: 22 },
    properties: { color }
  });
  createLandmark(builder, center, name, builder.config.style);
}

function generateLogicPuzzle(
  builder: TemplateBuilder,
  config: TemplateConfig,
  route: RoutePoint[],
  final: MapObject
): void {
  if (config.logicRules <= 0) {
    return;
  }

  const buttons = getObjects(builder, "button");
  const doors = getObjects(builder, "door");
  const keys = getObjects(builder, "key");
  const coins = getObjects(builder, "coin");
  const zones = getObjects(builder, "messageZone");
  const checkpoints = getObjects(builder, "checkpoint");
  const teleporters = getObjects(builder, "teleporter");
  const targetObject = createBlock(builder, offset(getRoutePoint(route, 0, 1), 5.5, 0.6, 5.5), {
    name: "Objeto controlado por logica",
    scale: { x: 1.6, y: 1.2, z: 1.6 },
    properties: {
      color: builder.palette.accent,
      collision: false
    }
  });

  builder.addLogic("Boas-vindas da logica", { type: "onMapStart" }, [], [
    { type: "showMessage", message: `${config.name}: explore as secoes gigantes.` }
  ]);
  let createdRules = 1;

  if (config.style === "logic" || config.style === "stress") {
    builder.addLogic("Finalizacao por logica", { type: "onPlayerEnterObject", objectId: final.id }, [{ type: "once" }], [
      { type: "finishMap" }
    ]);
    createdRules += 1;
  }

  const actionFactories: Array<() => LogicAction[]> = [
    () => [{ type: "showMessage", message: "Zona de mensagem acionada por logica." }],
    () => [{ type: "openDoor", doorId: getDoorId(doors[0]) }],
    () => [{ type: "closeDoor", doorId: getDoorId(doors[0]) }],
    () => [{ type: "teleportPlayer", targetObjectId: teleporters[0]?.id ?? targetObject.id }],
    () => [{ type: "giveCoins", amount: 3 }],
    () => [{ type: "setCheckpoint", objectId: checkpoints[0]?.id ?? targetObject.id }],
    () => [{ type: "enableObject", objectId: targetObject.id }],
    () => [{ type: "disableObject", objectId: targetObject.id }]
  ];

  const triggerFactories: Array<(index: number) => LogicTrigger> = [
    (index) => ({ type: "onPlayerEnterObject", objectId: zones[index % Math.max(1, zones.length)]?.id ?? targetObject.id }),
    (index) => ({ type: "onButtonActivated", objectId: buttons[index % Math.max(1, buttons.length)]?.id ?? targetObject.id }),
    (index) => ({ type: "onCoinCollected", objectId: coins[index % Math.max(1, coins.length)]?.id ?? targetObject.id }),
    (index) => ({ type: "onKeyCollected", keyId: getKeyObjectId(keys[index % Math.max(1, keys.length)]) })
  ];

  const conditionFactories: Array<(index: number) => LogicCondition[]> = [
    () => [{ type: "once" }],
    (index) => keys.length > 0 ? [{ type: "hasKey", keyId: getKeyObjectId(keys[index % keys.length]) }] : [],
    (index) => [{ type: "coinsAtLeast", amount: Math.min(config.coins, 5 + index * 2) }],
    () => doors.length > 0 ? [{ type: "doorIsOpen", doorId: getDoorId(doors[0]) }] : []
  ];

  for (let index = createdRules; index < config.logicRules; index += 1) {
    const trigger = triggerFactories[index % triggerFactories.length](index);
    const conditions = conditionFactories[index % conditionFactories.length](index);
    const actions = actionFactories[index % actionFactories.length]();

    builder.addLogic(`Regra gigante ${index}`, trigger, conditions, actions);
  }
}

function createFinalArea(builder: TemplateBuilder, config: TemplateConfig, route: RoutePoint[]): MapObject {
  const last = getRoutePoint(route, route.length - 1, 1);
  const position = {
    x: last.x,
    y: last.y,
    z: last.z - 9
  };

  createPlatform(builder, position, {
    name: "Plataforma final",
    scale: { x: 12, y: 0.42, z: 12 },
    properties: {
      color: builder.palette.accent,
      material: builder.palette.glow ? "glow" : "default",
      emissive: builder.palette.glow ? builder.palette.accent : undefined
    }
  });
  createSign(builder, offset(position, -4, 0.2, 4), "Final: conclua o mapa.");
  return createFinish(builder, offset(position, 0, 1.25, 0), {
    name: `Final - ${config.name}`,
    properties: {
      message: `${config.name} concluido!`,
      color: builder.palette.glow ? "#39ff14" : "#22c55e",
      material: builder.palette.glow ? "glow" : "default",
      emissive: builder.palette.glow ? "#39ff14" : undefined
    }
  });
}

function addMechanicsSigns(builder: TemplateBuilder, route: RoutePoint[]): void {
  const labels = [
    "onMapStart mostra mensagem.",
    "onPlayerEnterObject detecta entrada.",
    "onButtonActivated abre portas.",
    "onCoinCollected pode dar bonus.",
    "onKeyCollected libera progresso.",
    "enableObject e disableObject mudam a cena."
  ];

  labels.forEach((label, index) => {
    const point = getRoutePoint(route, index, labels.length);
    createSign(builder, offset(point, 3.8, 0.2, -3.8), label);
  });
}

function addDecorations(builder: TemplateBuilder, count: number, style: TemplateStyle, route: RoutePoint[]): void {
  for (let index = 0; index < count; index += 1) {
    const anchor = getRoutePoint(route, index, Math.max(1, count));
    const side = index % 2 === 0 ? 1 : -1;
    const ring = 5.5 + (Math.floor(index / Math.max(1, route.length)) % 5) * 1.8;
    const drift = ((index % 7) - 3) * 0.9;
    const position = {
      x: anchor.x + side * ring,
      y: 0,
      z: anchor.z + drift
    };

    if (style === "forest" || style === "coinWorld" || style === "island") {
      if (index % 6 === 0) {
        createRock(builder, position, { name: `Pedra decorativa ${index + 1}`, scale: scalar(0.7 + (index % 3) * 0.2) });
      } else {
        createTree(builder, position, { name: `Arvore decorativa ${index + 1}`, scale: scalar(0.9 + (index % 5) * 0.16) });
      }
    } else if (style === "desert") {
      if (index % 4 === 0) {
        createPillar(builder, position, { name: `Pilar decorativo ${index + 1}` });
      } else if (index % 4 === 1) {
        createBarrel(builder, position, { name: `Barril decorativo ${index + 1}` });
      } else {
        createRock(builder, position, { name: `Rocha desertica ${index + 1}` });
      }
    } else if (style === "city") {
      if (index % 5 === 0) {
        createLamp(builder, position, `Poste urbano ${index + 1}`, false);
      } else {
        createCrate(builder, position, { name: `Caixa urbana ${index + 1}` });
      }
    } else if (style === "dungeon" || style === "puzzle") {
      if (index % 5 === 0) {
        createBarrel(builder, position, { name: `Barril dungeon ${index + 1}` });
      } else {
        createCrate(builder, position, { name: `Caixa dungeon ${index + 1}` });
      }
    } else {
      createBlock(builder, { x: position.x, y: 0.45, z: position.z }, {
        name: `Marcador decorativo ${index + 1}`,
        scale: { x: 0.9, y: 0.9, z: 0.9 },
        properties: {
          color: index % 2 === 0 ? builder.palette.decor : builder.palette.secondary,
          collision: false,
          material: builder.palette.glow ? "glow" : "default",
          emissive: builder.palette.glow ? builder.palette.decor : undefined
        }
      });
    }
  }
}

function ensureObjectCount(builder: TemplateBuilder, target: number, style: TemplateStyle, route: RoutePoint[]): void {
  let guard = 0;

  while (builder.map.objects.length < target && guard < target * 2) {
    const index = guard;
    const anchor = getRoutePoint(route, index, Math.max(1, target));
    const side = index % 2 === 0 ? 1 : -1;
    const band = 9 + (Math.floor(index / Math.max(1, route.length)) % 8) * 1.8;
    const position = {
      x: anchor.x + side * band,
      y: 0,
      z: anchor.z + ((index % 9) - 4) * 1.1
    };

    if (style === "forest" || style === "coinWorld" || style === "island") {
      if (index % 5 === 0) {
        createRock(builder, position, { name: `Borda natural planejada ${index + 1}`, scale: scalar(0.74 + (index % 3) * 0.12) });
      } else {
        createTree(builder, position, { name: `Arvore de trilha planejada ${index + 1}`, scale: scalar(0.82 + (index % 4) * 0.12) });
      }
    } else if (style === "desert") {
      if (index % 3 === 0) {
        createArch(builder, position, { name: `Arco de leitura da ruina ${index + 1}`, scale: scalar(0.78 + (index % 4) * 0.08) });
      } else {
        createPillar(builder, position, { name: `Pilar de leitura da ruina ${index + 1}`, scale: scalar(0.78 + (index % 4) * 0.1) });
      }
    } else if (style === "city" || style === "stress") {
      if (index % 4 === 0) {
        createLamp(builder, position, `Poste de leitura do setor ${index + 1}`, false);
      } else {
        createCrate(builder, position, { name: `Caixa guia do setor ${index + 1}` });
      }
    } else {
      createBlock(builder, { ...position, y: 0.4 }, {
        name: `Marcador de borda jogavel ${index + 1}`,
        scale: { x: 0.8, y: 0.8, z: 0.8 },
        properties: {
          color: index % 2 === 0 ? builder.palette.secondary : builder.palette.decor,
          collision: false
        }
      });
    }

    guard += 1;
  }
}

class TemplateBuilder {
  readonly map: GameMap;
  readonly palette: Palette;
  private objectIndex = 0;
  private logicIndex = 0;

  constructor(readonly config: TemplateConfig) {
    this.palette = PALETTES[config.theme];
    this.map = createEmptyGameMap(config.name);
    this.map.description = config.description;
    this.map.creatorName = "Criador local";
    this.map.tags = [...config.tags];
    this.map.isPublished = false;
    this.map.visualSettings = getThemeVisualSettings(config.theme);
    this.map.audioSettings = {
      masterVolume: 0.8,
      sfxVolume: 0.9,
      musicVolume: config.ambientMusic === "none" ? 0.25 : 0.36,
      muted: false,
      ambientMusic: config.ambientMusic
    };
    this.map.logic = [];
    this.map.objectives = [];
  }

  add(type: BuiltInObjectType, position: Vector3, options: ObjectOptions = {}): MapObject {
    const object = createMapObject(type, roundVector(position), {
      ...options,
      id: options.id ?? this.nextObjectId(type),
      rotation: options.rotation ?? { x: 0, y: 0, z: 0 },
      scale: options.scale ? roundVector(options.scale) : undefined,
      properties: sanitizeProperties(options.properties)
    });
    this.map.objects.push(object);
    return object;
  }

  addLogic(
    name: string,
    trigger: LogicTrigger,
    conditions: LogicCondition[],
    actions: LogicAction[]
  ): LogicRule {
    const rule: LogicRule = {
      id: this.nextLogicId(),
      name,
      enabled: true,
      trigger,
      conditions,
      actions
    };
    this.map.logic = [...(this.map.logic ?? []), rule];
    return rule;
  }

  addObjective(objective: Omit<MapObjective, "id"> & { id?: string }): MapObjective {
    const nextObjective: MapObjective = {
      ...objective,
      id: objective.id ?? this.nextObjectiveId()
    };
    this.map.objectives = [...(this.map.objectives ?? []), nextObjective];
    return nextObjective;
  }

  private nextObjectId(type: string): string {
    this.objectIndex += 1;
    return `${this.config.id}_${sanitizeId(type)}_${String(this.objectIndex).padStart(5, "0")}`;
  }

  private nextLogicId(): string {
    this.logicIndex += 1;
    return `${this.config.id}_logic_${String(this.logicIndex).padStart(3, "0")}`;
  }

  private nextObjectiveId(): string {
    return `${this.config.id}_objective_${String((this.map.objectives ?? []).length + 1).padStart(3, "0")}`;
  }
}

function addSpawn(builder: TemplateBuilder, position: Vector3): MapObject {
  const spawn = builder.add("spawn", position, {
    id: `${builder.config.id}_spawn`,
    name: "Spawn principal"
  });
  builder.map.spawnPoint = { ...spawn.position };
  return spawn;
}

function createBlock(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("cube", position, mergeObjectOptions({
    name: "Bloco",
    scale: { x: 1, y: 1, z: 1 },
    properties: {
      color: builder.palette.decor,
      collision: true
    }
  }, options));
}

function createPlatform(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("platform", position, mergeObjectOptions({
    name: "Plataforma",
    scale: { x: 6, y: 0.4, z: 6 },
    properties: {
      color: builder.palette.platform,
      collision: true
    }
  }, options));
}

function createRamp(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("ramp", position, mergeObjectOptions({
    name: "Rampa",
    properties: {
      color: builder.palette.secondary
    }
  }, options));
}

function createCoin(builder: TemplateBuilder, position: Vector3, name: string): MapObject {
  return builder.add("coin", position, {
    name,
    properties: {
      color: "#ffd166",
      value: 1,
      coinValue: 1
    }
  });
}

function createCheckpoint(builder: TemplateBuilder, position: Vector3, name: string): MapObject {
  return builder.add("checkpoint", position, {
    name,
    properties: {
      checkpointId: sanitizeId(name),
      activatedColor: "#22c55e"
    }
  });
}

function createDoor(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("door", position, mergeObjectOptions({
    name: "Porta",
    scale: { x: 3, y: 3.4, z: 0.35 },
    properties: {
      color: builder.palette.door,
      doorState: "closed",
      startsOpen: false,
      openOffset: { x: 0, y: 3.8, z: 0 }
    }
  }, options));
}

function createButton(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("button", position, mergeObjectOptions({
    name: "Botao",
    properties: {
      color: "#f97316",
      oneTime: true
    }
  }, options));
}

function createKey(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("key", position, mergeObjectOptions({
    name: "Chave",
    properties: {
      color: "#3b82f6",
      keyId: "blue_key",
      label: "Chave Azul"
    }
  }, options));
}

function createTeleporter(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("teleporter", position, mergeObjectOptions({
    name: "Teleporte",
    properties: {
      color: builder.palette.accent,
      cooldown: 1
    }
  }, options));
}

function createMessageZone(
  builder: TemplateBuilder,
  position: Vector3,
  message: string,
  options: ObjectOptions = {}
): MapObject {
  return builder.add("messageZone", position, mergeObjectOptions({
    name: "Zona de mensagem",
    scale: { x: 4, y: 1.4, z: 2 },
    properties: {
      message,
      oneTime: true,
      color: "#60a5fa",
      opacity: 0.35
    }
  }, options));
}

function createSign(builder: TemplateBuilder, position: Vector3, text: string, options: ObjectOptions = {}): MapObject {
  return builder.add("sign", position, mergeObjectOptions({
    name: `Placa - ${text.slice(0, 20)}`,
    properties: {
      text,
      color: builder.palette.sign,
      collision: false
    }
  }, options));
}

function createTree(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("tree", position, mergeObjectOptions({
    name: "Arvore",
    properties: {
      collision: false
    }
  }, options));
}

function createRock(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("rock", position, mergeObjectOptions({
    name: "Pedra",
    properties: {
      color: "#7f8c8d",
      collision: false
    }
  }, options));
}

function createLamp(builder: TemplateBuilder, position: Vector3, name: string, lightEnabled: boolean): MapObject {
  return builder.add("lamp", position, {
    name,
    properties: {
      color: builder.palette.glow ? builder.palette.accent : "#fef08a",
      emissive: builder.palette.glow ? builder.palette.accent : "#fff7aa",
      lightEnabled,
      lightIntensity: lightEnabled ? 1.2 : 0,
      lightRange: lightEnabled ? 8 : 0,
      collision: false
    }
  });
}

function createMovingPlatform(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("movingPlatform", position, mergeObjectOptions({
    name: "Plataforma movel",
    scale: { x: 3, y: 0.35, z: 2.4 },
    properties: {
      color: "#38bdf8",
      startOffset: { x: -2, y: 0, z: 0 },
      endOffset: { x: 2, y: 0, z: 0 },
      speed: 1,
      loop: true
    }
  }, options));
}

function createDisappearingBlock(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("disappearingBlock", position, mergeObjectOptions({
    name: "Bloco que some",
    scale: { x: 2, y: 0.45, z: 2 },
    properties: {
      color: "#f59e0b",
      delayBeforeDisappear: 0.5,
      respawnDelay: 3
    }
  }, options));
}

function createDamageZone(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("damage", position, mergeObjectOptions({
    name: "Zona de morte",
    scale: { x: 3, y: 0.25, z: 3 },
    properties: {
      color: builder.palette.hazard,
      mode: "kill",
      collision: false,
      opacity: 0.46
    }
  }, options));
}

function createFinish(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("finish", position, mergeObjectOptions({
    name: "Final",
    properties: {
      message: "Voce venceu!",
      requiresAllCoins: false
    }
  }, options));
}

function createJumpPad(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("jumpPad", position, mergeObjectOptions({
    name: "Jump Pad",
    properties: {
      color: "#22c55e",
      force: 12,
      cooldown: 0.4
    }
  }, options));
}

function createEnemy(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("enemy", position, mergeObjectOptions({
    name: "Inimigo",
    properties: {
      color: "#ef4444",
      enemyType: "basic",
      health: 50,
      damage: 10,
      speed: 2,
      detectionRange: 8,
      attackRange: 1.5,
      attackCooldown: 1,
      behavior: "chase",
      patrolOffset: { x: 4, y: 0, z: 0 },
      collision: false
    }
  }, options));
}

function createNpc(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("npc", position, mergeObjectOptions({
    name: "NPC Guia",
    properties: {
      color: "#4ecdc4",
      npcName: "Guia",
      dialog: "Ola! Siga os objetivos no HUD.",
      dialogue: [
        "Ola! Siga os objetivos no HUD.",
        "Pegue moedas, encontre a chave e avance para o final."
      ],
      interactionRange: 4,
      showQuestHint: true,
      collision: false
    }
  }, options));
}

function createItemSpawner(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("itemSpawner", position, mergeObjectOptions({
    name: "Spawner de Item",
    properties: {
      color: "#06b6d4",
      spawnItemType: "weapon_basic",
      itemPool: ["weapon_basic"],
      spawnMode: "fixed",
      respawnTime: 10,
      spawnOnStart: true,
      maxSpawnedItems: 1,
      amount: 25,
      collision: false
    }
  }, options));
}

function createCrate(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("crate", position, mergeObjectOptions({
    name: "Caixa",
    properties: { collision: false }
  }, options));
}

function createBarrel(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("barrel", position, mergeObjectOptions({
    name: "Barril",
    properties: { collision: false }
  }, options));
}

function createArch(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("arch", position, mergeObjectOptions({
    name: "Arco",
    properties: { color: builder.palette.secondary }
  }, options));
}

function createPillar(builder: TemplateBuilder, position: Vector3, options: ObjectOptions = {}): MapObject {
  return builder.add("pillar", position, mergeObjectOptions({
    name: "Pilar",
    properties: { color: builder.palette.secondary }
  }, options));
}

function getObjects(builder: TemplateBuilder, type: string): MapObject[] {
  return builder.map.objects.filter((object) => object.type === type);
}

function getRoutePoint(route: RoutePoint[], index: number, count: number): RoutePoint {
  if (route.length === 0) {
    return { x: 0, y: 0.2, z: -8, label: "fallback" };
  }

  if (count <= 1) {
    return route[Math.min(index, route.length - 1)];
  }

  const routeIndex = Math.min(
    route.length - 1,
    Math.max(0, Math.round((index / Math.max(1, count - 1)) * (route.length - 1)))
  );
  return route[routeIndex];
}

function getDoorId(object: MapObject | undefined): string {
  if (!object) {
    return "";
  }

  return typeof object.properties?.doorId === "string" && object.properties.doorId.length > 0
    ? object.properties.doorId
    : object.id;
}

function getKeyObjectId(object: MapObject | undefined): string {
  if (!object) {
    return "";
  }

  return typeof object.properties?.keyId === "string" && object.properties.keyId.length > 0
    ? object.properties.keyId
    : object.id;
}

function getSectionText(config: TemplateConfig, index: number): string {
  const plan = getSectionPlan(config);
  const topic = plan[index % plan.length];
  const texts = [
    "Siga o caminho principal e procure moedas opcionais.",
    "Checkpoint proximo: arrisque apenas depois de ativar.",
    "Botoes podem abrir atalhos e portas.",
    "Chaves ficam antes das portas importantes.",
    "Teleportes conectam areas distantes.",
    "Moedas dificeis testam controle e camera."
  ];

  return `${topic}: ${texts[index % texts.length]}`;
}

function getSectionPlan(config: TemplateConfig): string[] {
  if (config.id === "empty") {
    return [
      "Area de edicao principal",
      "Exemplo de caminho",
      "Area de testes",
      "Espaco para puzzle",
      "Final opcional"
    ];
  }

  if (config.id === "obby" || config.id === "megaObby") {
    return [
      "Tutorial de movimento",
      "Saltos faceis",
      "Saltos medios",
      "Caminho estreito",
      "Jump pads",
      "Blocos que desaparecem",
      "Plataformas moveis",
      "Desafio combinado",
      "Rota opcional dificil",
      "Sequencia final"
    ];
  }

  if (config.id === "coin" || config.id === "megaCoinWorld") {
    return [
      "Praca inicial",
      "Trilha de moedas",
      "Bosque escondido",
      "Area elevada",
      "Ruinas opcionais",
      "Caverna escura",
      "Ilha secreta",
      "Final central"
    ];
  }

  if (config.id === "door") {
    return [
      "Botao abre porta proxima",
      "Botao abre porta distante",
      "Sala de leitura visual",
      "Chave especial",
      "Botao mais chave",
      "Sala final"
    ];
  }

  if (config.id === "checkpoint") {
    return [
      "Tutorial de respawn",
      "Perigo simples",
      "Plataformas sobre perigo",
      "Jump pad sobre perigo",
      "Blocos temporarios",
      "Plataforma movel",
      "Desafio final"
    ];
  }

  if (config.id === "mechanics") {
    return [
      "Moedas",
      "Checkpoint",
      "Zona de morte",
      "Porta e botao",
      "Chave e porta",
      "Jump pad",
      "Teleporte",
      "Plataforma movel",
      "Bloco que desaparece",
      "Zona de mensagem",
      "Logica visual",
      "Final"
    ];
  }

  if (config.id === "logic") {
    return [
      "onMapStart",
      "onPlayerEnterObject",
      "onButtonActivated",
      "onCoinCollected e giveCoins",
      "coinsAtLeast",
      "hasKey",
      "doorIsOpen",
      "teleportPlayer",
      "setCheckpoint",
      "enableObject e disableObject",
      "once",
      "finishMap"
    ];
  }

  if (config.id === "keyPuzzle" || config.id === "keyDungeon") {
    return [
      "Sala inicial com dica",
      "Chave azul",
      "Porta azul",
      "Chave vermelha protegida",
      "Atalho por botao",
      "Chave verde opcional",
      "Sequencia de portas",
      "Porta final"
    ];
  }

  if (config.id === "forest") {
    return [
      "Entrada do bosque",
      "Trilha principal",
      "Clareira central",
      "Ruina escondida",
      "Caminho opcional",
      "Teleporte secreto",
      "Templo final"
    ];
  }

  if (config.id === "desert") {
    return [
      "Oasis inicial",
      "Corredor de pilares",
      "Ruinas abertas",
      "Sala de botao",
      "Porta com chave",
      "Teleporte entre ruinas",
      "Obby sobre perigo",
      "Templo final"
    ];
  }

  if (config.id === "neonObby") {
    return [
      "Entrada neon",
      "Saltos glow",
      "Jump pads",
      "Blocos que desaparecem",
      "Plataformas moveis",
      "Caminho estreito perigoso",
      "Moedas opcionais",
      "Desafio final neon"
    ];
  }

  if (config.id === "testCity") {
    return [
      "Praca central",
      "Rua de moedas",
      "Predios exploraveis",
      "Distrito de portas",
      "Atalho de teleporte",
      "Zona de obby urbano",
      "Setor final"
    ];
  }

  if (config.id === "adventureIsland") {
    return [
      "Praia inicial",
      "Trilha da ilha",
      "Ponte para ruinas",
      "Caverna de chave",
      "Ilha secreta",
      "Montanha de jump pads",
      "Templo final"
    ];
  }

  if (config.id === "stressTest") {
    return [
      "Setor de moedas",
      "Setor de portas",
      "Setor de botoes",
      "Setor de teleportes",
      "Setor de obby",
      "Setor de logica",
      "Setor final"
    ];
  }

  return [
    "Entrada",
    "Desafio principal",
    "Rota opcional",
    "Chave antes da porta",
    "Atalho",
    "Final"
  ];
}

function getOptionalLabel(style: TemplateStyle, index: number): string {
  const labels: Record<TemplateStyle, string[]> = {
    sandbox: ["Area livre"],
    obby: ["moedas dificeis", "salto de precisao", "atalho arriscado"],
    coinWorld: ["moedas escondidas", "ruina lateral", "ilha pequena"],
    puzzle: ["sala bonus", "atalho de leitura", "moedas atras da porta"],
    challenge: ["moedas sobre perigo", "ponte estreita", "salto de risco"],
    mechanics: ["teste extra", "variante da mecanica", "sala bonus"],
    dungeon: ["sala secreta", "chave opcional", "tesouro lateral"],
    logic: ["regra bonus", "objeto escondido", "moedas condicionais"],
    forest: ["trilha escondida", "ruina lateral", "moedas na clareira"],
    desert: ["oasis lateral", "pilar escondido", "tesouro das ruinas"],
    neon: ["linha de moedas neon", "salto dificil", "atalho glow"],
    city: ["beco lateral", "predio bonus", "rua secundaria"],
    island: ["praia secreta", "ponte lateral", "tesouro da ilha"],
    stress: ["setor extra", "bateria tecnica", "rota de carga"]
  };

  const list = labels[style];
  return list[index % list.length];
}

function getKeyId(index: number): string {
  const ids = [
    "blue_key",
    "red_key",
    "green_key",
    "yellow_key",
    "purple_key",
    "final_key",
    "silver_key",
    "gold_key",
    "temple_key",
    "shadow_key",
    "sky_key",
    "island_key",
    "city_key",
    "lab_key",
    "master_key"
  ];
  return ids[index] ?? `key_${index + 1}`;
}

function getKeyLabel(index: number): string {
  const labels = [
    "Azul",
    "Vermelha",
    "Verde",
    "Amarela",
    "Roxa",
    "Final",
    "Prata",
    "Ouro",
    "Templo",
    "Sombra",
    "Ceu",
    "Ilha",
    "Cidade",
    "Laboratorio",
    "Mestre"
  ];
  return labels[index] ?? `${index + 1}`;
}

function getKeyColor(index: number): string {
  const colors = [
    "#3b82f6",
    "#ef4444",
    "#22c55e",
    "#facc15",
    "#a855f7",
    "#f97316",
    "#cbd5e1",
    "#f59e0b",
    "#38bdf8",
    "#111827",
    "#60a5fa",
    "#10b981",
    "#64748b",
    "#8b5cf6",
    "#ffffff"
  ];
  return colors[index] ?? "#3b82f6";
}

function mergeObjectOptions(base: ObjectOptions, override: ObjectOptions): ObjectOptions {
  return {
    ...base,
    ...override,
    properties: {
      ...base.properties,
      ...override.properties
    }
  };
}

function sanitizeProperties(properties: MapObjectProperties | undefined): MapObjectProperties | undefined {
  if (!properties) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  );
}

function roundVector(vector: Vector3): Vector3 {
  return {
    x: round(vector.x),
    y: round(vector.y),
    z: round(vector.z)
  };
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

function offset(position: Vector3, x: number, y: number, z: number): Vector3 {
  return {
    x: position.x + x,
    y: position.y + y,
    z: position.z + z
  };
}

function scalar(value: number): Vector3 {
  return { x: value, y: value, z: value };
}

function distance2D(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "id";
}
