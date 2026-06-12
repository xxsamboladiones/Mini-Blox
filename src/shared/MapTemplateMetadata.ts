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
    name: "Jardim Inicial",
    description: "Jardim sandbox limpo, bonito e seguro para iniciar uma criacao premium.",
    icon: "sprout",
    tags: ["official", "premium", "sandbox", "garden", "beginner"],
    category: "sandbox",
    difficulty: "beginner",
  },
  {
    id: "obby",
    name: "Obby Jardim Suspenso",
    description: "Obby suspenso em jardim com checkpoints, moedas guia e saltos progressivos.",
    icon: "route",
    tags: ["official", "premium", "obby", "garden", "checkpoint"],
    category: "obby",
    difficulty: "beginner",
  },
  {
    id: "coin",
    name: "Caca as Moedas Douradas",
    description: "Trilha de coleta dourada com rotas laterais, recompensa e final claro.",
    icon: "coins",
    tags: ["official", "premium", "collect", "gold", "exploration"],
    category: "coinWorld",
    difficulty: "beginner",
  },
  {
    id: "door",
    name: "Templo dos Botoes",
    description: "Templo puzzle com botoes, portas e chave em sequencia legivel.",
    icon: "door-open",
    tags: ["official", "premium", "puzzle", "button", "temple"],
    category: "puzzle",
    difficulty: "beginner",
  },
  {
    id: "checkpoint",
    name: "Corrida nas Nuvens",
    description: "Percurso aereo com checkpoints antes dos perigos e saltos possiveis.",
    icon: "cloud",
    tags: ["official", "premium", "platform", "clouds", "checkpoint"],
    category: "challenge",
    difficulty: "beginner",
  },
  {
    id: "mechanics",
    name: "Escola de Mecanicas Mini Blox",
    description: "Escola jogavel com estacoes claras para aprender cada mecanica.",
    icon: "graduation-cap",
    tags: ["official", "premium", "tutorial", "mechanics", "school"],
    category: "mechanics",
    difficulty: "beginner",
  },
  {
    id: "combatArena",
    name: "Arena Treino de Combate",
    description: "Arena de treino com arma inicial, inimigos, cura e objetivo direto.",
    icon: "swords",
    tags: ["official", "premium", "combat", "training", "enemy"],
    category: "challenge",
    difficulty: "intermediate",
  },
  {
    id: "combatDungeon",
    name: "Dungeon dos Slimes",
    description: "Dungeon compacta com salas de inimigos, curas, portas e boss final.",
    icon: "swords",
    tags: ["official", "premium", "combat", "dungeon", "slime"],
    category: "dungeon",
    difficulty: "advanced",
  },
  {
    id: "guideMission",
    name: "Museu dos Blocos",
    description: "Museu guiado com NPC, objetivos, coleta, chave, combate leve e final.",
    icon: "landmark",
    tags: ["official", "premium", "museum", "npc", "objective"],
    category: "logic",
    difficulty: "beginner",
  },
  {
    id: "localTeamArena",
    name: "Coliseu dos Cubos",
    description: "Coliseu local com dois times, spawns simetricos, inimigos e placar.",
    icon: "flag",
    tags: ["official", "premium", "team", "coliseum", "combat"],
    category: "challenge",
    difficulty: "intermediate",
  },
  {
    id: "localCapturePoint",
    name: "Capture a Torre",
    description: "Arena local com duas bases e torre central de captura acessivel.",
    icon: "circle-dot",
    tags: ["official", "premium", "capture", "team", "tower"],
    category: "challenge",
    difficulty: "intermediate",
  },
  {
    id: "multiplayerPvpArena",
    name: "Duelo nas Pontes",
    description: "Arena multiplayer de pontes com rotas claras, times e respawn rapido.",
    icon: "swords",
    tags: ["official", "premium", "multiplayer", "pvp", "bridges"],
    category: "challenge",
    difficulty: "intermediate",
  },
  {
    id: "multiplayerCoopEnemies",
    name: "Coop Fortaleza dos Inimigos",
    description: "Fortaleza cooperativa para derrotar inimigos sincronizados e abrir caminho.",
    icon: "shield",
    tags: ["official", "premium", "multiplayer", "coop", "fortress"],
    category: "challenge",
    difficulty: "intermediate",
  },
  {
    id: "weaponArsenal",
    name: "Fabrica Neon Tycoon",
    description: "Tycoon neon com geradores, coletor, upgrades e compras em progressao.",
    icon: "factory",
    tags: ["official", "premium", "tycoon", "neon", "factory"],
    category: "tycoon",
    difficulty: "beginner",
  },
  {
    id: "pvpArsenal",
    name: "Estacao Espacial",
    description: "Arena espacial de times com armas, bases e linhas de combate legiveis.",
    icon: "rocket",
    tags: ["official", "premium", "space", "multiplayer", "weapons"],
    category: "neon",
    difficulty: "advanced",
  },
  {
    id: "competitiveCoin",
    name: "Fazenda Tycoon",
    description: "Tycoon rural simples com fluxo de caixa, botoes e progresso visual.",
    icon: "wheat",
    tags: ["official", "premium", "tycoon", "farm", "economy"],
    category: "tycoon",
    difficulty: "beginner",
  },
  {
    id: "objectiveArena",
    name: "Laboratorio de Energia Tycoon",
    description: "Tycoon de laboratorio com geradores de energia, upgrade e barreira final.",
    icon: "zap",
    tags: ["official", "premium", "tycoon", "lab", "energy"],
    category: "tycoon",
    difficulty: "intermediate",
  },
  {
    id: "keyPuzzle",
    name: "Ruinas com Chaves",
    description: "Ruinas puzzle com chaves antes das portas e salas sem softlock.",
    icon: "key-round",
    tags: ["official", "premium", "puzzle", "keys", "ruins"],
    category: "dungeon",
    difficulty: "intermediate",
  },
  {
    id: "logic",
    name: "Circuito de Plataformas Moveis",
    description: "Circuito tecnico com logica visual, plataformas, portas e checkpoints.",
    icon: "workflow",
    tags: ["official", "premium", "mechanics", "logic", "platform"],
    category: "logic",
    difficulty: "intermediate",
  },
  {
    id: "forest",
    name: "Bosque Encantado",
    description: "Bosque grande com trilha principal, ruinas, chaves, segredos e templo final.",
    icon: "tree-pine",
    tags: ["official", "premium", "forest", "exploration", "magic"],
    category: "forest",
    difficulty: "advanced",
  },
  {
    id: "desert",
    name: "Deserto dos Saltos",
    description: "Deserto de ruinas com saltos, perigos, teleportes e puzzle final.",
    icon: "sun",
    tags: ["official", "premium", "desert", "platform", "ruins"],
    category: "desert",
    difficulty: "advanced",
  },
  {
    id: "neonObby",
    name: "Obby Neon Vertical",
    description: "Obby neon vertical com checkpoints, brilho e leitura clara da rota.",
    icon: "zap",
    tags: ["official", "premium", "obby", "neon", "vertical"],
    category: "neon",
    difficulty: "intermediate",
  },
  {
    id: "megaObby",
    name: "Mega Showcase Profissional",
    description: "Showcase grande de plataformas, checkpoints, hazards e decoracao legivel.",
    icon: "sparkles",
    tags: ["official", "premium", "showcase", "obby", "large"],
    category: "obby",
    difficulty: "advanced",
  },
  {
    id: "megaCoinWorld",
    name: "Portal das Ilhas",
    description: "Mundo de ilhas com teleportes, moedas, chaves e rotas organizadas.",
    icon: "landmark",
    tags: ["official", "premium", "islands", "portal", "collect"],
    category: "island",
    difficulty: "intermediate",
  },
  {
    id: "keyDungeon",
    name: "Castelo das Portas",
    description: "Castelo sequencial com chaves, portas, salas claras e final seguro.",
    icon: "castle",
    tags: ["official", "premium", "castle", "doors", "keys"],
    category: "dungeon",
    difficulty: "intermediate",
  },
  {
    id: "testCity",
    name: "Cidade Mini Blox",
    description: "Cidade premium com ruas, predios, moedas, portas, botoes e teleportes.",
    icon: "map",
    tags: ["official", "premium", "city", "showcase", "large"],
    category: "city",
    difficulty: "advanced",
  },
  {
    id: "adventureIsland",
    name: "Ilha Pirata",
    description: "Ilha grande com pontes, segredos, chaves, moedas e aventura final.",
    icon: "tree-pine",
    tags: ["official", "premium", "pirate", "island", "large"],
    category: "island",
    difficulty: "advanced",
  },
  {
    id: "basicTycoon",
    name: "Mina de Cristal Tycoon",
    description: "Tycoon de mina com geradores, coletor, upgrades, barreira e trofeu final.",
    icon: "gem",
    tags: ["official", "premium", "tycoon", "crystal", "economy"],
    category: "tycoon",
    difficulty: "beginner",
  },
  {
    id: "stressTest",
    name: "Stress Test Bonito",
    description: "Stress test organizado e visualmente limpo para validar escala e performance.",
    icon: "sparkles",
    tags: ["official", "premium", "stress", "performance", "showcase"],
    category: "stress",
    difficulty: "stress",
  },
] as const satisfies readonly MapTemplateDefinition[];

export type MapTemplateId = (typeof MAP_TEMPLATE_METADATA)[number]["id"];
