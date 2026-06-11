export type MapTemplateCategory =
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
  | "tycoon"
  | "stress";

export type MapTemplateDifficulty = "beginner" | "intermediate" | "advanced" | "stress";

export type MapTemplateDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  category: MapTemplateCategory;
  difficulty: MapTemplateDifficulty;
};

export const MAP_TEMPLATE_METADATA = [
  {
    id: "empty",
    name: "Mapa vazio",
    description: "Base realmente limpa para comecar uma criacao sem itens, objetivos ou decoracao.",
    icon: "square",
    tags: ["official", "basic", "sandbox", "showcase", "classic"],
    category: "sandbox",
    difficulty: "beginner",
  },
  {
    id: "obby",
    name: "Obby basico",
    description:
      "Obby linear planejado com tutorial, dificuldade progressiva, checkpoints e final claro.",
    icon: "route",
    tags: ["official", "platform", "obby", "tutorial", "checkpoint", "showcase"],
    category: "obby",
    difficulty: "beginner",
  },
  {
    id: "coin",
    name: "Coleta de moedas",
    description:
      "Mapa semiaberto de exploracao com trilhas de moedas, bosque, ruina e ilha secreta.",
    icon: "coins",
    tags: ["official", "collect", "exploration", "puzzle", "showcase", "grass"],
    category: "coinWorld",
    difficulty: "beginner",
  },
  {
    id: "door",
    name: "Porta e botao",
    description: "Puzzle limpo com salas em linha, botoes perto das portas e uma chave clara.",
    icon: "door-open",
    tags: ["official", "puzzle", "door", "button", "logic", "classic"],
    category: "puzzle",
    difficulty: "beginner",
  },
  {
    id: "checkpoint",
    name: "Checkpoint + zona de morte",
    description: "Desafio curto com checkpoints antes de cada perigo e zonas de morte evitaveis.",
    icon: "flag",
    tags: ["official", "platform", "checkpoint", "hazard", "challenge", "desert"],
    category: "challenge",
    difficulty: "beginner",
  },
  {
    id: "mechanics",
    name: "Mapa de Mecanicas",
    description: "Laboratorio limpo com uma estacao clara para cada mecanica jogavel.",
    icon: "sparkles",
    tags: ["official", "basic", "tutorial", "logic", "mechanics", "neon"],
    category: "mechanics",
    difficulty: "beginner",
  },
  {
    id: "combatArena",
    name: "Arena de Combate",
    description: "Arena compacta para testar vida, arma basica, inimigos e spawners de cura.",
    icon: "swords",
    tags: ["official", "combat", "arena", "enemy", "weapons", "dark"],
    category: "challenge",
    difficulty: "intermediate",
  },
  {
    id: "combatDungeon",
    name: "Dungeon de Combate",
    description:
      "Dungeon compacta com arma basica, salas de inimigos, curas, portas por logica e boss final.",
    icon: "swords",
    tags: ["official", "combat", "dungeon", "enemy", "boss", "dark"],
    category: "dungeon",
    difficulty: "advanced",
  },
  {
    id: "guideMission",
    name: "Missao do Guia",
    description: "Missao curta com NPC guia, objetivos no HUD, moedas, chave, inimigos e final.",
    icon: "user-round",
    tags: ["official", "objective", "tutorial", "npc", "combat", "grass"],
    category: "forest",
    difficulty: "beginner",
  },
  {
    id: "localTeamArena",
    name: "Arena de Times Local",
    description:
      "Arena local com dois times, spawns separados, inimigos pontuaveis e HUD de placar.",
    icon: "flag",
    tags: ["official", "local", "team", "combat", "arena", "dark"],
    category: "challenge",
    difficulty: "intermediate",
  },
  {
    id: "localCapturePoint",
    name: "Capture Point Local",
    description:
      "Arena pequena com dois times locais e ponto central que gera pontuacao ao capturar.",
    icon: "circle-dot",
    tags: ["official", "local", "team", "capture", "arena", "neon"],
    category: "challenge",
    difficulty: "intermediate",
  },
  {
    id: "multiplayerPvpArena",
    name: "Arena Multiplayer PvP",
    description: "Arena pequena publicada para testar PvP basico, respawn e times em sala online.",
    icon: "swords",
    tags: ["official", "multiplayer", "pvp", "team", "arena", "showcase"],
    category: "challenge",
    difficulty: "intermediate",
  },
  {
    id: "multiplayerCoopEnemies",
    name: "Arena Coop Inimigos",
    description:
      "Arena cooperativa curta para testar inimigos sincronizados, moedas, portas e itens compartilhados.",
    icon: "shield",
    tags: ["official", "multiplayer", "coop", "combat", "enemy", "showcase"],
    category: "challenge",
    difficulty: "intermediate",
  },
  {
    id: "weaponArsenal",
    name: "Arsenal de Teste",
    description:
      "Laboratorio curto para testar espada, martelo, adaga e blaster contra inimigos locais.",
    icon: "swords",
    tags: ["official", "combat", "weapons", "test", "enemy", "classic"],
    category: "challenge",
    difficulty: "intermediate",
  },
  {
    id: "pvpArsenal",
    name: "Arena PvP Arsenal",
    description:
      "Arena online com bases, times e quatro armas para testar sincronizacao visual e dano server-side.",
    icon: "swords",
    tags: ["official", "multiplayer", "pvp", "weapons", "team", "neon"],
    category: "challenge",
    difficulty: "advanced",
  },
  {
    id: "competitiveCoin",
    name: "Coleta Competitiva Local",
    description: "Mapa medio de moedas com meta clara, rota principal e placar local de coleta.",
    icon: "coins",
    tags: ["official", "collect", "competitive", "local", "score", "grass"],
    category: "coinWorld",
    difficulty: "intermediate",
  },
  {
    id: "objectiveArena",
    name: "Arena de Objetivos",
    description: "Arena curta com arma, inimigos, captura local, porta e objetivos obrigatorios.",
    icon: "list-checks",
    tags: ["official", "objective", "combat", "arena", "capture", "classic"],
    category: "challenge",
    difficulty: "intermediate",
  },
  {
    id: "keyPuzzle",
    name: "Puzzle com Chave",
    description: "Puzzle sequencial com chaves antes das portas e salas sem bloqueios confusos.",
    icon: "key-round",
    tags: ["official", "puzzle", "key", "door", "dungeon", "dark"],
    category: "dungeon",
    difficulty: "intermediate",
  },
  {
    id: "logic",
    name: "Mapa com Logica",
    description: "Laboratorio sequencial de logica visual, com uma mecanica clara por sala.",
    icon: "workflow",
    tags: ["official", "puzzle", "logic", "tutorial", "mechanics", "neon"],
    category: "logic",
    difficulty: "intermediate",
  },
  {
    id: "forest",
    name: "Bosque Simples",
    description:
      "Floresta grande exploravel com trilha principal, ruina escondida, chaves e templo final.",
    icon: "tree-pine",
    tags: ["official", "exploration", "collect", "puzzle", "large", "grass"],
    category: "forest",
    difficulty: "advanced",
  },
  {
    id: "desert",
    name: "Deserto",
    description: "Ruinas enormes no deserto com templos, corredores, obby, teleporte e puzzle.",
    icon: "sun",
    tags: ["official", "exploration", "puzzle", "platform", "large", "desert"],
    category: "desert",
    difficulty: "advanced",
  },
  {
    id: "neonObby",
    name: "Neon Obby",
    description:
      "Obby neon limpo com checkpoints, brilho, saltos possiveis e perigos fora das plataformas.",
    icon: "zap",
    tags: ["official", "platform", "obby", "checkpoint", "large", "neon"],
    category: "neon",
    difficulty: "intermediate",
  },
  {
    id: "megaObby",
    name: "Mega Obby Extremo",
    description:
      "Obby longo e legivel com checkpoints frequentes, gaps possiveis e hazards abaixo da rota.",
    icon: "route",
    tags: ["official", "platform", "obby", "stress", "experimental", "neon"],
    category: "obby",
    difficulty: "stress",
  },
  {
    id: "megaCoinWorld",
    name: "Mundo de Coleta Gigante",
    description: "Mundo de coleta amplo e organizado por ilhas, com moedas em trilhas legiveis.",
    icon: "coins",
    tags: ["official", "collect", "exploration", "stress", "experimental", "grass"],
    category: "coinWorld",
    difficulty: "stress",
  },
  {
    id: "keyDungeon",
    name: "Dungeon de Chaves",
    description: "Dungeon sequencial com chaves antes das portas, rotas claras e salas jogaveis.",
    icon: "key-round",
    tags: ["official", "puzzle", "key", "door", "stress", "dark"],
    category: "dungeon",
    difficulty: "stress",
  },
  {
    id: "testCity",
    name: "Cidade de Teste",
    description:
      "Cidade local com predios, ruas, portas, botoes, checkpoints, moedas e teleportes.",
    icon: "map",
    tags: ["official", "city", "scale", "experimental", "validation", "classic"],
    category: "city",
    difficulty: "stress",
  },
  {
    id: "adventureIsland",
    name: "Ilha de Aventura",
    description: "Ilha enorme com biomas, pontes, segredos, chaves, portas, teleportes e final.",
    icon: "tree-pine",
    tags: ["official", "exploration", "collect", "adventure", "large", "grass"],
    category: "island",
    difficulty: "advanced",
  },
  {
    id: "basicTycoon",
    name: "Tycoon Basico",
    description:
      "Mini fabrica tycoon com geradores, coletor, botoes de compra, upgrade, barreira e vitoria por progresso.",
    icon: "factory",
    tags: ["official", "tycoon", "economy", "progression", "beginner", "solo"],
    category: "tycoon",
    difficulty: "beginner",
  },
  {
    id: "stressTest",
    name: "Stress Test Completo",
    description:
      "Mapa massivo para testar editor, outliner, runtime, colisores, logica e JSON grande.",
    icon: "sparkles",
    tags: ["official", "stress", "scale", "experimental", "validation", "neon"],
    category: "stress",
    difficulty: "stress",
  },
] as const satisfies readonly MapTemplateDefinition[];

export type MapTemplateId = (typeof MAP_TEMPLATE_METADATA)[number]["id"];
