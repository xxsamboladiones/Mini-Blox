import * as esbuild from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MIN_OBJECTS = {
  empty: 2,
  obby: 30,
  coin: 250,
  door: 28,
  checkpoint: 34,
  mechanics: 42,
  combatArena: 150,
  combatDungeon: 220,
  guideMission: 34,
  localTeamArena: 170,
  localCapturePoint: 160,
  multiplayerPvpArena: 120,
  multiplayerCoopEnemies: 130,
  weaponArsenal: 125,
  pvpArsenal: 135,
  competitiveCoin: 190,
  objectiveArena: 190,
  keyPuzzle: 35,
  logic: 250,
  forest: 500,
  desert: 500,
  neonObby: 39,
  megaObby: 54,
  megaCoinWorld: 77,
  keyDungeon: 64,
  testCity: 1000,
  adventureIsland: 900,
  stressTest: 1500,
};

const REQUIRED_MINIMUMS = {
  obby: {
    coins: 9,
    checkpoints: 3,
    damage: 3,
    jumpPads: 1,
    movingPlatforms: 1,
    disappearingBlocks: 1,
  },
  coin: { coins: 50, checkpoints: 2, teleporters: 2, keys: 1, doors: 1 },
  door: { doors: 3, buttons: 2, keys: 1, logic: 4 },
  checkpoint: {
    checkpoints: 5,
    damage: 3,
    jumpPads: 1,
    disappearingBlocks: 1,
    movingPlatforms: 1,
  },
  mechanics: {
    checkpoints: 1,
    damage: 1,
    jumpPads: 1,
    teleporters: 2,
    movingPlatforms: 1,
    disappearingBlocks: 1,
    doors: 1,
    buttons: 1,
    keys: 1,
  },
  combatArena: {
    coins: 12,
    checkpoints: 1,
    enemies: 3,
    itemSpawners: 3,
    messageZones: 3,
    doors: 1,
    logic: 3,
  },
  combatDungeon: {
    coins: 25,
    checkpoints: 4,
    enemies: 8,
    itemSpawners: 4,
    messageZones: 5,
    doors: 3,
    logic: 6,
  },
  guideMission: {
    coins: 12,
    npcs: 1,
    objectives: 5,
    enemies: 2,
    itemSpawners: 1,
    keys: 1,
    doors: 1,
    logic: 4,
  },
  localTeamArena: {
    checkpoints: 2,
    enemies: 4,
    itemSpawners: 4,
    messageZones: 2,
    teamSpawns: 2,
    logic: 3,
  },
  localCapturePoint: {
    checkpoints: 2,
    itemSpawners: 2,
    messageZones: 1,
    teamSpawns: 2,
    capturePoints: 1,
    logic: 3,
  },
  multiplayerPvpArena: {
    checkpoints: 2,
    itemSpawners: 6,
    messageZones: 1,
    teamSpawns: 2,
    logic: 2,
  },
  multiplayerCoopEnemies: {
    coins: 12,
    checkpoints: 2,
    enemies: 4,
    itemSpawners: 4,
    messageZones: 1,
    doors: 1,
    buttons: 1,
    logic: 2,
  },
  weaponArsenal: {
    coins: 8,
    checkpoints: 2,
    enemies: 3,
    itemSpawners: 6,
    messageZones: 1,
    logic: 2,
  },
  pvpArsenal: {
    checkpoints: 2,
    itemSpawners: 8,
    messageZones: 1,
    teamSpawns: 2,
    jumpPads: 2,
    logic: 2,
  },
  competitiveCoin: { coins: 28, checkpoints: 2, damage: 1, jumpPads: 1, messageZones: 1, logic: 2 },
  objectiveArena: {
    coins: 12,
    checkpoints: 2,
    enemies: 3,
    itemSpawners: 2,
    objectives: 5,
    doors: 1,
    buttons: 1,
    capturePoints: 1,
    logic: 5,
  },
  keyPuzzle: { keys: 4, doors: 4, buttons: 1, logic: 6 },
  logic: { logic: 20, coins: 20, doors: 6, buttons: 6, keys: 2, checkpoints: 5, teleporters: 2 },
  forest: { coins: 80, checkpoints: 5, keys: 3, doors: 4, teleporters: 4 },
  desert: { coins: 70, checkpoints: 5, doors: 6, buttons: 6, teleporters: 6 },
  neonObby: {
    coins: 12,
    checkpoints: 4,
    damage: 4,
    jumpPads: 1,
    movingPlatforms: 1,
    disappearingBlocks: 1,
  },
  megaObby: {
    coins: 20,
    checkpoints: 5,
    damage: 6,
    jumpPads: 1,
    movingPlatforms: 1,
    disappearingBlocks: 1,
  },
  megaCoinWorld: { coins: 50, teleporters: 2, keys: 2, doors: 2 },
  keyDungeon: { keys: 6, doors: 6, buttons: 2, logic: 9, coins: 28 },
  testCity: { coins: 100, doors: 10, buttons: 10, teleporters: 8, checkpoints: 8 },
  adventureIsland: {
    coins: 150,
    checkpoints: 8,
    keys: 8,
    doors: 12,
    teleporters: 8,
    jumpPads: 10,
    movingPlatforms: 8,
  },
  stressTest: {
    coins: 250,
    doors: 30,
    buttons: 30,
    keys: 15,
    checkpoints: 20,
    damage: 30,
    jumpPads: 30,
    teleporters: 20,
    movingPlatforms: 20,
    disappearingBlocks: 20,
    messageZones: 30,
    logic: 50,
  },
};

const TAG_PATTERN = /^[a-z0-9-]+$/;
const TEMPLATE_POSITION_LIMIT = 500;
const TEMPLATE_SCALE_LIMIT = 90;
const TEMPLATE_DAMAGE_LIMIT = 50;
const TEMPLATE_ENEMY_HEALTH_LIMIT = 180;
const TEMPLATE_ENEMY_DAMAGE_LIMIT = 25;
const ENEMY_SPAWN_ERROR_DISTANCE = 6;
const ENEMY_SPAWN_WARNING_DISTANCE = 10;
const TEMPLATE_DESCRIPTION_MIN_LENGTH = 36;

const PRIMARY_TEMPLATE_TAGS = new Set([
  "basic",
  "platform",
  "puzzle",
  "collect",
  "combat",
  "multiplayer",
  "objective",
  "local",
  "exploration",
  "stress",
  "city",
]);

const SHOWCASE_TEMPLATE_IDS = new Set([
  "empty",
  "obby",
  "coin",
  "multiplayerPvpArena",
  "multiplayerCoopEnemies",
]);

const REQUIRED_TEMPLATE_TAGS = {
  empty: ["official", "basic", "showcase"],
  obby: ["official", "platform", "showcase"],
  coin: ["official", "collect", "showcase"],
  door: ["official", "puzzle"],
  checkpoint: ["official", "platform", "checkpoint"],
  mechanics: ["official", "basic", "tutorial", "mechanics"],
  combatArena: ["official", "combat", "enemy"],
  combatDungeon: ["official", "combat", "dungeon", "enemy"],
  guideMission: ["official", "objective", "tutorial"],
  localTeamArena: ["official", "local", "team"],
  localCapturePoint: ["official", "local", "capture"],
  multiplayerPvpArena: ["official", "multiplayer", "pvp", "showcase"],
  multiplayerCoopEnemies: ["official", "multiplayer", "coop", "showcase"],
  weaponArsenal: ["official", "combat", "weapons"],
  pvpArsenal: ["official", "multiplayer", "pvp", "weapons"],
  competitiveCoin: ["official", "collect", "competitive"],
  objectiveArena: ["official", "objective", "combat"],
  keyPuzzle: ["official", "puzzle", "key"],
  logic: ["official", "puzzle", "logic"],
  forest: ["official", "exploration", "large"],
  desert: ["official", "exploration", "desert"],
  neonObby: ["official", "platform", "obby"],
  megaObby: ["official", "platform", "stress", "experimental"],
  megaCoinWorld: ["official", "collect", "stress", "experimental"],
  keyDungeon: ["official", "puzzle", "key", "stress"],
  testCity: ["official", "city", "scale", "experimental"],
  adventureIsland: ["official", "exploration", "adventure"],
  stressTest: ["official", "stress", "experimental", "validation"],
};

async function main() {
  const tempDir = join(tmpdir(), `mini-blox-template-validation-${Date.now()}`);
  const outfile = join(tempDir, "MapTemplates.bundle.mjs");

  await mkdir(tempDir, { recursive: true });

  try {
    await esbuild.build({
      entryPoints: ["src/shared/MapTemplates.ts"],
      outfile,
      bundle: true,
      format: "esm",
      platform: "node",
      logLevel: "silent",
    });

    const templatesModule = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
    const { MAP_TEMPLATES, createMapFromTemplate } = templatesModule;
    const errors = [];
    const warnings = [];
    const summaries = [];
    const catalogResult = validateTemplateCatalog(MAP_TEMPLATES);

    errors.push(...catalogResult.errors);
    warnings.push(...catalogResult.warnings);

    for (const template of MAP_TEMPLATES) {
      const map = createMapFromTemplate(template.id);
      const summary = summarizeMap(template, map);
      summaries.push(summary);
      errors.push(...validateTemplate(template, map, summary));
      warnings.push(...collectLevelDesignWarnings(template, map, summary));
    }

    console.table(
      summaries.map((summary) => ({
        id: summary.id,
        nome: summary.name,
        objetos: summary.objects,
        moedas: summary.coins,
        portas: summary.doors,
        botoes: summary.buttons,
        chaves: summary.keys,
        checkpoints: summary.checkpoints,
        npcs: summary.npcs,
        inimigos: summary.enemies,
        spawners: summary.itemSpawners,
        objetivos: summary.objectives,
        modo: summary.mode,
        times: summary.teams,
        teamSpawns: summary.teamSpawns,
        capturePoints: summary.capturePoints,
        dano: summary.damage,
        jumpPads: summary.jumpPads,
        teleportes: summary.teleporters,
        moveis: summary.movingPlatforms,
        somem: summary.disappearingBlocks,
        mensagens: summary.messageZones,
        placas: summary.signs,
        tags: summary.tags,
        logica: summary.logic,
        void: summary.voidDeath,
        voidY: summary.voidY,
        jsonKB: summary.jsonKB,
      }))
    );

    if (errors.length > 0) {
      console.error(`\n${errors.length} problema(s) encontrado(s):`);
      for (const error of errors) {
        console.error(`- ${error}`);
      }
      process.exitCode = 1;
      return;
    }

    if (warnings.length > 0) {
      console.warn(`\n${warnings.length} warning(s) de level design:`);
      for (const warning of warnings) {
        console.warn(`- ${warning}`);
      }
    }

    console.log(`\nTemplates validados com sucesso: ${summaries.length}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function summarizeMap(template, map) {
  const count = (type) => map.objects.filter((object) => object.type === type).length;
  const jsonBytes = Buffer.byteLength(JSON.stringify(map), "utf8");

  return {
    id: template.id,
    name: template.name,
    objects: map.objects.length,
    coins: count("coin"),
    doors: count("door"),
    buttons: count("button"),
    keys: count("key"),
    checkpoints: count("checkpoint"),
    enemies: count("enemy"),
    npcs: count("npc"),
    itemSpawners: count("itemSpawner"),
    objectives: Array.isArray(map.objectives) ? map.objectives.length : 0,
    mode: map.gameModeSettings?.mode ?? "freeplay",
    teams: Array.isArray(map.teams) ? map.teams.length : 0,
    teamSpawns: count("teamSpawn"),
    capturePoints: count("capturePoint"),
    damage: count("damage"),
    jumpPads: count("jumpPad"),
    teleporters: count("teleporter"),
    movingPlatforms: count("movingPlatform"),
    disappearingBlocks: count("disappearingBlock"),
    messageZones: count("messageZone"),
    signs: count("sign"),
    tags: normalizeTags(map.tags).length,
    logic: Array.isArray(map.logic) ? map.logic.length : 0,
    voidDeath: map.gameplaySettings?.voidDeathEnabled === false ? "off" : "on",
    voidY: Number(getVoidDeathY(map).toFixed(1)),
    jsonKB: Number((jsonBytes / 1024).toFixed(1)),
  };
}

function validateTemplateCatalog(templates) {
  const errors = [];
  const warnings = [];
  const ids = new Set();

  if (!Array.isArray(templates) || templates.length === 0) {
    errors.push("catalogo de templates vazio ou invalido.");
    return { errors, warnings };
  }

  for (const template of templates) {
    const tags = normalizeTags(template?.tags);
    const tagSet = new Set(tags);
    const requiredTags = REQUIRED_TEMPLATE_TAGS[template?.id] ?? ["official"];

    if (!template?.id || typeof template.id !== "string") {
      errors.push(`${template?.name ?? "template"}: template sem id valido.`);
      continue;
    }

    if (ids.has(template.id)) {
      errors.push(`${template.id}: id duplicado no catalogo de templates.`);
    }

    ids.add(template.id);

    if (!template.name || typeof template.name !== "string") {
      errors.push(`${template.id}: template sem name.`);
    }

    if (!template.description || typeof template.description !== "string") {
      errors.push(`${template.id}: template sem description.`);
    } else if (template.description.trim().length < TEMPLATE_DESCRIPTION_MIN_LENGTH) {
      warnings.push(`${template.id}: descricao curta para template oficial.`);
    }

    if (!template.icon || typeof template.icon !== "string") {
      errors.push(`${template.id}: template sem icon.`);
    }

    if (tags.length < 3) {
      errors.push(`${template.id}: template precisa de pelo menos 3 tags oficiais.`);
    }

    if (tags.length !== (Array.isArray(template.tags) ? template.tags.length : 0)) {
      errors.push(`${template.id}: template possui tags vazias ou duplicadas.`);
    }

    for (const tag of tags) {
      if (!TAG_PATTERN.test(tag)) {
        errors.push(`${template.id}: tag invalida "${tag}". Use lowercase ASCII e hifens.`);
      }
    }

    for (const tag of requiredTags) {
      if (!tagSet.has(tag)) {
        errors.push(`${template.id}: tag obrigatoria ausente "${tag}".`);
      }
    }

    if (![...PRIMARY_TEMPLATE_TAGS].some((tag) => tagSet.has(tag))) {
      errors.push(`${template.id}: template sem categoria primaria clara.`);
    }

    if (SHOWCASE_TEMPLATE_IDS.has(template.id) && !tagSet.has("showcase")) {
      errors.push(`${template.id}: showcase oficial sem tag showcase.`);
    }

    if (!SHOWCASE_TEMPLATE_IDS.has(template.id) && tagSet.has("showcase")) {
      errors.push(`${template.id}: tag showcase fora da lista curada.`);
    }
  }

  for (const [templateId, tags] of Object.entries(REQUIRED_TEMPLATE_TAGS)) {
    if (!ids.has(templateId)) {
      errors.push(`${templateId}: template esperado nao existe no catalogo.`);
    }
  }

  return { errors, warnings };
}

function validateTemplate(template, map, summary) {
  const errors = [];
  const objectIds = new Set();
  const doorIds = new Set();
  const keyIds = new Set();
  const teleporterIds = new Set();
  const enemyIds = new Set();
  const npcIds = new Set();
  const objectiveIds = new Set();
  const teamIds = new Set();
  const capturePointIds = new Set();
  const expectedMin = MIN_OBJECTS[template.id];
  const templateTags = normalizeTags(template.tags);
  const templateTagSet = new Set(templateTags);
  const mapTags = normalizeTags(map.tags);
  const mapTagSet = new Set(mapTags);

  if (!template.id) {
    errors.push(`${template.name}: template sem id.`);
  }

  if (!template.name) {
    errors.push(`${template.id}: template sem name.`);
  }

  if (!map.id || !map.name) {
    errors.push(`${template.id}: mapa sem id/name.`);
  }

  if (templateTags.length === 0) {
    errors.push(`${template.id}: definicao de template sem tags.`);
  }

  if (mapTags.length === 0) {
    errors.push(`${template.id}: mapa gerado sem tags.`);
  }

  for (const tag of templateTags) {
    if (!mapTagSet.has(tag)) {
      errors.push(`${template.id}: mapa gerado perdeu a tag "${tag}".`);
    }
  }

  for (const tag of mapTags) {
    if (!templateTagSet.has(tag)) {
      errors.push(`${template.id}: mapa gerado tem tag nao declarada "${tag}".`);
    }
  }

  if (!isVector(map.spawnPoint)) {
    errors.push(`${template.id}: spawnPoint invalido.`);
  } else {
    validateVectorLimit(
      errors,
      template.id,
      "spawnPoint",
      "position",
      map.spawnPoint,
      TEMPLATE_POSITION_LIMIT
    );
  }

  if (
    template.id !== "empty" &&
    !map.objects.some((object) => object.type === "finish" || object.type === "goal")
  ) {
    errors.push(`${template.id}: nao possui final.`);
  }

  if (expectedMin && summary.objects < expectedMin) {
    errors.push(`${template.id}: objetos abaixo do minimo (${summary.objects}/${expectedMin}).`);
  }

  if (summary.objects >= 300 && summary.checkpoints < 1) {
    errors.push(`${template.id}: mapa grande sem checkpoint.`);
  }

  if (Array.isArray(map.teams)) {
    for (const team of map.teams) {
      if (!team?.id || typeof team.id !== "string") {
        errors.push(`${template.id}: time sem id valido.`);
        continue;
      }

      if (teamIds.has(team.id)) {
        errors.push(`${template.id}: teamId duplicado ${team.id}.`);
      }

      teamIds.add(team.id);

      if (!team.name || typeof team.name !== "string") {
        errors.push(`${template.id}: time ${team.id} sem nome.`);
      }

      if (!isVector(team.spawnPoint)) {
        errors.push(`${template.id}: time ${team.id} sem spawnPoint valido.`);
      }
    }
  }

  for (const object of map.objects) {
    if (!object.id) {
      errors.push(`${template.id}: objeto sem id.`);
      continue;
    }

    if (!object.type || typeof object.type !== "string") {
      errors.push(`${template.id}: ${object.id} sem type valido.`);
    }

    if (objectIds.has(object.id)) {
      errors.push(`${template.id}: id duplicado de objeto ${object.id}.`);
    }

    objectIds.add(object.id);

    if (!isVector(object.position)) {
      errors.push(`${template.id}: ${object.id} com position invalido.`);
    } else {
      validateVectorLimit(
        errors,
        template.id,
        object.id,
        "position",
        object.position,
        TEMPLATE_POSITION_LIMIT
      );
    }

    if (object.rotation !== undefined && !isVector(object.rotation)) {
      errors.push(`${template.id}: ${object.id} com rotation invalido.`);
    }

    if (object.scale !== undefined && !isPositiveScale(object.scale)) {
      errors.push(`${template.id}: ${object.id} com scale invalido ou nao positivo.`);
    } else if (object.scale !== undefined) {
      validateVectorLimit(
        errors,
        template.id,
        object.id,
        "scale",
        object.scale,
        TEMPLATE_SCALE_LIMIT
      );
    }

    validateGameplayPropertyBounds(errors, template.id, object);

    if (object.type === "door") {
      const doorId = getString(object.properties?.doorId, object.id);

      if (doorIds.has(doorId)) {
        errors.push(`${template.id}: doorId duplicado ${doorId}.`);
      }

      doorIds.add(doorId);
    }

    if (object.type === "key") {
      keyIds.add(getString(object.properties?.keyId, object.id));
    }

    if (object.type === "enemy") {
      enemyIds.add(object.id);
    }

    if (object.type === "npc") {
      npcIds.add(object.id);
    }

    if (object.type === "teamSpawn") {
      const teamId = getString(object.properties?.teamId, "");

      if (!teamId) {
        errors.push(`${template.id}: teamSpawn ${object.id} sem teamId.`);
      } else if (teamIds.size > 0 && !teamIds.has(teamId)) {
        errors.push(`${template.id}: teamSpawn ${object.id} aponta time inexistente ${teamId}.`);
      }
    }

    if (object.type === "capturePoint") {
      const pointId = getString(object.properties?.pointId, object.id);

      if (!pointId) {
        errors.push(`${template.id}: capturePoint ${object.id} sem pointId.`);
      } else if (capturePointIds.has(pointId)) {
        errors.push(`${template.id}: pointId duplicado ${pointId}.`);
      }

      capturePointIds.add(pointId);
    }

    if (object.type === "teleporter") {
      const teleporterId = getString(object.properties?.teleporterId, object.id);

      if (teleporterIds.has(teleporterId)) {
        errors.push(`${template.id}: teleporterId duplicado ${teleporterId}.`);
      }

      teleporterIds.add(teleporterId);
    }
  }

  for (const object of map.objects) {
    const targetDoorId =
      getString(object.properties?.targetDoorId, "") ||
      getString(object.properties?.buttonTargetId, "");
    const requiredKeyId = getString(object.properties?.requiredKeyId, "");
    const targetTeleporterId = getString(object.properties?.targetTeleporterId, "");

    if (targetDoorId && !doorIds.has(targetDoorId)) {
      errors.push(`${template.id}: ${object.id} aponta targetDoorId inexistente ${targetDoorId}.`);
    }

    if (requiredKeyId && !keyIds.has(requiredKeyId)) {
      errors.push(
        `${template.id}: ${object.id} aponta requiredKeyId inexistente ${requiredKeyId}.`
      );
    }

    if (targetTeleporterId && !teleporterIds.has(targetTeleporterId)) {
      errors.push(
        `${template.id}: ${object.id} aponta targetTeleporterId inexistente ${targetTeleporterId}.`
      );
    }
  }

  const requirements = REQUIRED_MINIMUMS[template.id] ?? {};

  for (const [key, min] of Object.entries(requirements)) {
    if (summary[key] < min) {
      errors.push(`${template.id}: ${key} abaixo do minimo (${summary[key]}/${min}).`);
    }
  }

  errors.push(
    ...validateObjectives(template.id, map, {
      objectIds,
      doorIds,
      keyIds,
      enemyIds,
      objectiveIds,
    })
  );

  errors.push(
    ...validateGameMode(template.id, map, summary, {
      teamIds,
      capturePointIds,
    })
  );

  for (const rule of map.logic ?? []) {
    errors.push(
      ...validateLogicRule(
        template.id,
        rule,
        objectIds,
        doorIds,
        keyIds,
        enemyIds,
        npcIds,
        objectiveIds,
        teamIds,
        capturePointIds,
        map
      )
    );
  }

  errors.push(...validateLevelDesign(template, map, summary, { doorIds, keyIds, teleporterIds }));

  return errors;
}

function validateObjectives(templateId, map, refs) {
  const errors = [];
  const objectives = Array.isArray(map.objectives) ? map.objectives : [];

  for (const objective of objectives) {
    if (!objective.id || typeof objective.id !== "string") {
      errors.push(`${templateId}: objetivo sem id.`);
      continue;
    }

    if (refs.objectiveIds.has(objective.id)) {
      errors.push(`${templateId}: objetivo duplicado ${objective.id}.`);
    }

    refs.objectiveIds.add(objective.id);

    if (!objective.title || typeof objective.title !== "string") {
      errors.push(`${templateId}: objetivo ${objective.id} sem titulo.`);
    }

    if (!isValidObjectiveType(objective.type)) {
      errors.push(`${templateId}: objetivo ${objective.id} tem tipo invalido ${objective.type}.`);
      continue;
    }

    if (
      (objective.type === "collectCoins" || objective.type === "defeatEnemies") &&
      (!Number.isFinite(objective.targetAmount) || objective.targetAmount < 1)
    ) {
      errors.push(`${templateId}: objetivo ${objective.id} precisa de targetAmount positivo.`);
    }

    if (
      (objective.type === "reachObject" || objective.type === "activateButton") &&
      !refs.objectIds.has(objective.targetObjectId)
    ) {
      errors.push(
        `${templateId}: objetivo ${objective.id} aponta objeto inexistente ${objective.targetObjectId}.`
      );
    }

    if (objective.type === "collectKey" && !refs.keyIds.has(objective.targetKeyId)) {
      errors.push(
        `${templateId}: objetivo ${objective.id} aponta chave inexistente ${objective.targetKeyId}.`
      );
    }

    if (objective.type === "openDoor" && !refs.doorIds.has(objective.targetDoorId)) {
      errors.push(
        `${templateId}: objetivo ${objective.id} aponta porta inexistente ${objective.targetDoorId}.`
      );
    }
  }

  if (
    map.gameplaySettings?.requireObjectivesToFinish &&
    objectives.every((objective) => objective.required === false)
  ) {
    errors.push(
      `${templateId}: exige objetivos para finalizar, mas nenhum objetivo e obrigatorio.`
    );
  }

  return errors;
}

function validateGameMode(templateId, map, summary, refs) {
  const errors = [];
  const settings = map.gameModeSettings;
  const validModes = new Set([
    "freeplay",
    "obby",
    "coinCollect",
    "combatArena",
    "objectiveRun",
    "teamBattle",
    "capturePoint",
  ]);
  const validWinConditions = new Set([
    "none",
    "finish",
    "collectCoins",
    "defeatEnemies",
    "completeObjectives",
    "score",
    "capturePoint",
  ]);
  const requiredObjectives = Array.isArray(map.objectives)
    ? map.objectives.filter((objective) => objective.required !== false).length
    : 0;

  if (!settings || typeof settings !== "object") {
    errors.push(`${templateId}: mapa sem gameModeSettings.`);
    return errors;
  }

  if (!validModes.has(settings.mode)) {
    errors.push(`${templateId}: gameModeSettings.mode invalido ${settings.mode}.`);
  }

  const winCondition = settings.winCondition ?? { type: "none" };

  if (!validWinConditions.has(winCondition.type)) {
    errors.push(`${templateId}: winCondition invalida ${winCondition.type}.`);
  }

  if (
    (settings.teamsEnabled || settings.mode === "teamBattle" || settings.mode === "capturePoint") &&
    refs.teamIds.size === 0
  ) {
    errors.push(`${templateId}: modo com times sem times configurados.`);
  }

  if (
    (settings.teamsEnabled || settings.mode === "teamBattle" || settings.mode === "capturePoint") &&
    summary.teamSpawns < Math.max(1, refs.teamIds.size)
  ) {
    errors.push(
      `${templateId}: times sem teamSpawn suficiente (${summary.teamSpawns}/${Math.max(1, refs.teamIds.size)}).`
    );
  }

  if (settings.mode === "capturePoint" && summary.capturePoints < 1) {
    errors.push(`${templateId}: modo capturePoint sem objeto capturePoint.`);
  }

  if (
    settings.mode === "teamBattle" &&
    summary.enemies + summary.capturePoints + summary.coins < 1
  ) {
    errors.push(`${templateId}: teamBattle sem fonte clara de pontuacao.`);
  }

  if (settings.mode === "coinCollect" && summary.coins < 1) {
    errors.push(`${templateId}: coinCollect sem moedas.`);
  }

  if (settings.mode === "combatArena" && summary.enemies < 1) {
    errors.push(`${templateId}: combatArena sem inimigos.`);
  }

  if (settings.mode === "objectiveRun" && requiredObjectives < 1) {
    errors.push(`${templateId}: objectiveRun sem objetivos obrigatorios.`);
  }

  if (settings.requireObjectivesToFinish && requiredObjectives < 1) {
    errors.push(`${templateId}: requireObjectivesToFinish sem objetivos obrigatorios.`);
  }

  if (winCondition.type === "collectCoins") {
    validatePositiveTarget(errors, templateId, winCondition, "collectCoins");

    if (Number.isFinite(winCondition.targetAmount) && winCondition.targetAmount > summary.coins) {
      errors.push(
        `${templateId}: meta de moedas maior que moedas do mapa (${winCondition.targetAmount}/${summary.coins}).`
      );
    }
  }

  if (winCondition.type === "defeatEnemies") {
    validatePositiveTarget(errors, templateId, winCondition, "defeatEnemies");

    if (summary.enemies < 1) {
      errors.push(`${templateId}: derrota de inimigos configurada sem inimigos.`);
    }
  }

  if (winCondition.type === "completeObjectives") {
    validatePositiveTarget(errors, templateId, winCondition, "completeObjectives");

    if (
      Number.isFinite(winCondition.targetAmount) &&
      winCondition.targetAmount > requiredObjectives
    ) {
      errors.push(
        `${templateId}: meta de objetivos maior que objetivos obrigatorios (${winCondition.targetAmount}/${requiredObjectives}).`
      );
    }
  }

  if (winCondition.type === "score" || winCondition.type === "capturePoint") {
    validatePositiveTarget(errors, templateId, winCondition, winCondition.type);
  }

  if (winCondition.type === "capturePoint" && refs.capturePointIds.size < 1) {
    errors.push(`${templateId}: winCondition capturePoint sem capturePoint.`);
  }

  return errors;
}

function validatePositiveTarget(errors, templateId, winCondition, label) {
  if (!Number.isFinite(winCondition.targetAmount) || winCondition.targetAmount < 1) {
    errors.push(`${templateId}: ${label} precisa de targetAmount positivo.`);
  }
}

function validateLevelDesign(template, map, summary, refs) {
  const errors = [];
  const expectedSigns = template.id === "empty" ? 0 : getExpectedSignCount(summary.objects);
  const coins = getObjectsByType(map, "coin");
  const damageZones = getObjectsByType(map, "damage");
  const checkpoints = getObjectsByType(map, "checkpoint");
  const buttons = getObjectsByType(map, "button");
  const doors = getObjectsByType(map, "door");
  const keys = getObjectsByType(map, "key");
  const enemies = getObjectsByType(map, "enemy");
  const teleporters = getObjectsByType(map, "teleporter");
  const tags = normalizeTags(map.tags);

  errors.push(...validateVoidGameplay(template.id, map));

  if (summary.signs < expectedSigns) {
    errors.push(`${template.id}: poucas placas de orientacao (${summary.signs}/${expectedSigns}).`);
  }

  if (damageZones.length > 0 && checkpoints.length < Math.ceil(damageZones.length / 4)) {
    errors.push(
      `${template.id}: perigos sem checkpoints suficientes (${checkpoints.length}/${Math.ceil(damageZones.length / 4)}).`
    );
  }

  if (damageZones.some((damage) => distance2D(damage.position, map.spawnPoint) < 8)) {
    errors.push(`${template.id}: zona de dano muito perto do spawn.`);
  }

  if (
    enemies.some((enemy) => distance2D(enemy.position, map.spawnPoint) < ENEMY_SPAWN_ERROR_DISTANCE)
  ) {
    errors.push(`${template.id}: inimigo muito perto do spawn.`);
  }

  if (tags.includes("pvp") && map.multiplayerSettings?.pvpEnabled !== true) {
    errors.push(`${template.id}: template PvP sem multiplayerSettings.pvpEnabled.`);
  }

  if (tags.includes("multiplayer") && tags.includes("pvp") && summary.teamSpawns < 2) {
    errors.push(`${template.id}: template PvP multiplayer precisa de pelo menos 2 teamSpawns.`);
  }

  if (tags.includes("multiplayer") && tags.includes("coop") && summary.enemies < 1) {
    errors.push(`${template.id}: template coop multiplayer sem inimigos sincronizaveis.`);
  }

  if (coins.length > 20) {
    const coinSpread = getSpread(coins);

    if (coinSpread.x + coinSpread.z < 26) {
      errors.push(`${template.id}: moedas concentradas demais para guiar o jogador.`);
    }
  }

  if (summary.objects >= 400 && coins.length > 0 && checkpoints.length > 0) {
    const routeSpread = getSpread([...coins, ...checkpoints]);

    if (routeSpread.x + routeSpread.z < 35) {
      errors.push(`${template.id}: recompensas/checkpoints nao cobrem bem a rota principal.`);
    }
  }

  for (const button of buttons) {
    const targetDoorId =
      getString(button.properties?.targetDoorId, "") ||
      getString(button.properties?.buttonTargetId, "");
    const door = doors.find((candidate) => getDoorId(candidate) === targetDoorId);

    if (targetDoorId && door && distance2D(button.position, door.position) > 34) {
      errors.push(
        `${template.id}: botao ${button.id} esta distante demais da porta ${targetDoorId}.`
      );
    }
  }

  for (const door of doors) {
    const requiredKeyId = getString(door.properties?.requiredKeyId, "");
    const key = keys.find((candidate) => getKeyId(candidate) === requiredKeyId);

    if (requiredKeyId && key && !isPlacedBeforeOrNear(key, door)) {
      errors.push(
        `${template.id}: chave ${requiredKeyId} parece estar depois da porta que ela abre.`
      );
    }
  }

  for (const teleporter of teleporters) {
    const targetTeleporterId = getString(teleporter.properties?.targetTeleporterId, "");
    const target = teleporters.find(
      (candidate) => getTeleporterId(candidate) === targetTeleporterId
    );

    if (targetTeleporterId && target) {
      const reciprocalTargetId = getString(target.properties?.targetTeleporterId, "");

      if (reciprocalTargetId && reciprocalTargetId !== getTeleporterId(teleporter)) {
        errors.push(`${template.id}: teleporte ${teleporter.id} nao aponta para um par reciproco.`);
      }
    }
  }

  errors.push(...validateReferenceCoverage(template, summary, refs));

  if (template.id === "logic") {
    errors.push(...validateLogicCoverage(template.id, map));
  }

  return errors;
}

function validateReferenceCoverage(template, summary, refs) {
  const errors = [];

  if (summary.doors > 0 && refs.doorIds.size === 0) {
    errors.push(`${template.id}: possui portas sem doorId configurado.`);
  }

  if (summary.keys > 0 && refs.keyIds.size === 0) {
    errors.push(`${template.id}: possui chaves sem keyId configurado.`);
  }

  if (summary.teleporters > 0 && refs.teleporterIds.size < summary.teleporters) {
    errors.push(`${template.id}: nem todos os teleportes possuem teleporterId unico.`);
  }

  return errors;
}

function validateVoidGameplay(templateId, map) {
  const errors = [];
  const voidDeathEnabled = map.gameplaySettings?.voidDeathEnabled !== false;
  const voidDeathY = getVoidDeathY(map);
  const spawnSupports = getSpawnSupports(map);
  const initialFloors = map.objects.filter(
    (object) => isFloorSupportObject(object) && distance2D(object.position, map.spawnPoint) <= 12
  );
  const globalFloors = map.objects.filter((object) => {
    if (!isFloorSupportObject(object)) {
      return false;
    }

    const scale = getObjectScale(object);
    return scale.x >= 70 && scale.z >= 70;
  });

  if (!voidDeathEnabled) {
    errors.push(`${templateId}: voidDeath desativado; templates devem cair no vazio.`);
  }

  if (!Number.isFinite(voidDeathY)) {
    errors.push(`${templateId}: voidDeathY invalido.`);
  } else if (voidDeathY >= map.spawnPoint.y - 1) {
    errors.push(`${templateId}: voidDeathY muito perto/acima do spawn (${voidDeathY}).`);
  }

  if (spawnSupports.length === 0) {
    errors.push(`${templateId}: spawn nasce sem piso real embaixo.`);
  }

  if (initialFloors.length === 0) {
    errors.push(`${templateId}: area inicial sem plataforma/chao real perto do spawn.`);
  }

  if (globalFloors.length > 0) {
    errors.push(
      `${templateId}: possui piso gigante que parece chao global (${globalFloors.map((object) => object.id).join(", ")}).`
    );
  }

  return errors;
}

function collectLevelDesignWarnings(template, map, summary) {
  const warnings = [];
  const coins = getObjectsByType(map, "coin");
  const buttons = getObjectsByType(map, "button");
  const doors = getObjectsByType(map, "door");
  const keys = getObjectsByType(map, "key");
  const teleporters = getObjectsByType(map, "teleporter");
  const checkpoints = getObjectsByType(map, "checkpoint");
  const damageZones = getObjectsByType(map, "damage");
  const enemies = getObjectsByType(map, "enemy");
  const jumpPads = getObjectsByType(map, "jumpPad");
  const capturePoints = getObjectsByType(map, "capturePoint");
  const teamSpawns = getObjectsByType(map, "teamSpawn");
  const tags = normalizeTags(map.tags);
  const finishObjects = map.objects.filter(
    (object) => object.type === "finish" || object.type === "goal"
  );
  const signs = getObjectsByType(map, "sign");
  const walkableObjects = map.objects.filter(
    (object) =>
      object.type === "platform" ||
      object.type === "cube" ||
      object.type === "ramp" ||
      object.type === "movingPlatform" ||
      object.type === "disappearingBlock"
  );
  const buttonTargets = new Set();
  const requiredKeys = new Set();
  const logicDoorIds = new Set();
  const logicKeyIds = new Set();

  for (const button of buttons) {
    const targetDoorId =
      getString(button.properties?.targetDoorId, "") ||
      getString(button.properties?.buttonTargetId, "");

    if (!targetDoorId) {
      warnings.push(`${template.id}: botao ${button.id} nao possui porta alvo.`);
    } else {
      buttonTargets.add(targetDoorId);
    }
  }

  for (const door of doors) {
    const requiredKeyId = getString(door.properties?.requiredKeyId, "");

    if (requiredKeyId) {
      requiredKeys.add(requiredKeyId);
    }
  }

  for (const rule of map.logic ?? []) {
    if (rule.trigger?.type === "onKeyCollected") {
      logicKeyIds.add(rule.trigger.keyId);
    }

    for (const condition of rule.conditions ?? []) {
      if (condition.type === "hasKey") {
        logicKeyIds.add(condition.keyId);
      }

      if (condition.type === "doorIsOpen") {
        logicDoorIds.add(condition.doorId);
      }
    }

    for (const action of rule.actions ?? []) {
      if (action.type === "openDoor" || action.type === "closeDoor") {
        logicDoorIds.add(action.doorId);
      }
    }
  }

  for (const door of doors) {
    const doorId = getDoorId(door);
    const requiredKeyId = getString(door.properties?.requiredKeyId, "");

    if (!buttonTargets.has(doorId) && !requiredKeyId && !logicDoorIds.has(doorId)) {
      warnings.push(
        `${template.id}: porta ${doorId} nao parece estar ligada a botao, chave ou regra.`
      );
    }
  }

  for (const key of keys) {
    const keyId = getKeyId(key);

    if (!requiredKeys.has(keyId) && !logicKeyIds.has(keyId)) {
      warnings.push(`${template.id}: chave ${keyId} nao parece abrir porta nem acionar regra.`);
    }
  }

  for (const teleporter of teleporters) {
    const targetTeleporterId = getString(teleporter.properties?.targetTeleporterId, "");

    if (!targetTeleporterId) {
      warnings.push(`${template.id}: teleporte ${teleporter.id} nao possui destino configurado.`);
    }
  }

  if (walkableObjects.length > 0 && coins.length > 0) {
    const farCoins = coins.filter((coin) => getNearestDistance(coin, walkableObjects) > 12);

    if (farCoins.length > Math.max(2, Math.floor(coins.length * 0.08))) {
      warnings.push(
        `${template.id}: ${farCoins.length} moeda(s) parecem longe de plataformas/caminhos.`
      );
    }
  }

  for (const checkpoint of checkpoints) {
    if (damageZones.some((damage) => distance2D(checkpoint.position, damage.position) < 2.2)) {
      warnings.push(
        `${template.id}: checkpoint ${checkpoint.id} esta muito perto de uma zona de dano.`
      );
    }

    if (walkableObjects.length > 0 && getNearestDistance(checkpoint, walkableObjects) > 10) {
      warnings.push(
        `${template.id}: checkpoint ${checkpoint.id} parece longe do caminho principal.`
      );
    }
  }

  for (const enemy of enemies) {
    const distanceToSpawn = distance2D(enemy.position, map.spawnPoint);

    if (
      distanceToSpawn >= ENEMY_SPAWN_ERROR_DISTANCE &&
      distanceToSpawn < ENEMY_SPAWN_WARNING_DISTANCE
    ) {
      warnings.push(
        `${template.id}: inimigo ${enemy.id} nasce perto do spawn (${distanceToSpawn.toFixed(1)}u).`
      );
    }
  }

  for (const button of buttons) {
    const targetDoorId =
      getString(button.properties?.targetDoorId, "") ||
      getString(button.properties?.buttonTargetId, "");
    const door = doors.find((candidate) => getDoorId(candidate) === targetDoorId);

    if (
      door &&
      distance2D(button.position, door.position) > 22 &&
      !hasSignNearConnection(signs, button.position, door.position)
    ) {
      warnings.push(
        `${template.id}: botao ${button.id} esta distante da porta ${targetDoorId} sem placa proxima.`
      );
    }
  }

  for (const jumpPad of jumpPads) {
    if (!hasJumpPadDestination(jumpPad, walkableObjects)) {
      warnings.push(`${template.id}: jumpPad ${jumpPad.id} nao tem plataforma de destino obvia.`);
    }
  }

  for (const finish of finishObjects) {
    if (walkableObjects.length > 0 && getNearestDistance(finish, walkableObjects) > 8) {
      warnings.push(
        `${template.id}: final ${finish.id} parece longe de uma plataforma alcancavel.`
      );
    }
  }

  for (const capturePoint of capturePoints) {
    if (walkableObjects.length > 0 && getNearestDistance(capturePoint, walkableObjects) > 8) {
      warnings.push(
        `${template.id}: capturePoint ${capturePoint.id} parece longe de uma plataforma alcancavel.`
      );
    }

    if (!signs.some((sign) => distance2D(sign.position, capturePoint.position) <= 12)) {
      warnings.push(
        `${template.id}: capturePoint ${capturePoint.id} sem placa proxima explicando o objetivo.`
      );
    }
  }

  if (
    map.gameModeSettings?.teamsEnabled &&
    teamSpawns.length < Math.max(1, Array.isArray(map.teams) ? map.teams.length : 0)
  ) {
    warnings.push(`${template.id}: modo com times possui poucos teamSpawns visiveis.`);
  }

  if (
    (template.id === "obby" || template.id === "neonObby" || template.id === "megaObby") &&
    checkpoints.length <
      Math.ceil(
        (damageZones.length +
          jumpPads.length +
          movingPlatformCount(summary) +
          summary.disappearingBlocks) /
          4
      )
  ) {
    warnings.push(`${template.id}: obby com poucos checkpoints para a quantidade de desafios.`);
  }

  const decorativeCount = map.objects.filter(
    (object) =>
      object.type === "tree" ||
      object.type === "rock" ||
      object.type === "crate" ||
      object.type === "barrel" ||
      object.type === "lamp" ||
      object.type === "arch" ||
      object.type === "pillar"
  ).length;

  if (summary.objects >= 350 && decorativeCount > 180 && summary.signs < 8) {
    warnings.push(
      `${template.id}: muita decoracao com pouca sinalizacao (${decorativeCount} decorativos, ${summary.signs} placas).`
    );
  }

  const interactiveCount =
    summary.doors + summary.buttons + summary.keys + summary.teleporters + summary.messageZones;

  if (interactiveCount >= 25 && summary.logic < 5) {
    warnings.push(
      `${template.id}: muitos objetos interativos com pouca logica associada (${interactiveCount} interativos, ${summary.logic} regras).`
    );
  }

  if (
    summary.objects >= 1000 &&
    !tags.includes("large") &&
    !tags.includes("stress") &&
    !tags.includes("experimental")
  ) {
    warnings.push(`${template.id}: mapa grande sem tag large, stress ou experimental.`);
  }

  return warnings;
}

function movingPlatformCount(summary) {
  return Number.isFinite(summary.movingPlatforms) ? summary.movingPlatforms : 0;
}

function validateLogicCoverage(templateId, map) {
  const errors = [];
  const triggers = new Set();
  const conditions = new Set();
  const actions = new Set();

  for (const rule of map.logic ?? []) {
    if (typeof rule.trigger?.type === "string") {
      triggers.add(rule.trigger.type);
    }

    for (const condition of rule.conditions ?? []) {
      if (typeof condition.type === "string") {
        conditions.add(condition.type);
      }
    }

    for (const action of rule.actions ?? []) {
      if (typeof action.type === "string") {
        actions.add(action.type);
      }
    }
  }

  const requiredTriggers = [
    "onMapStart",
    "onPlayerEnterObject",
    "onButtonActivated",
    "onCoinCollected",
    "onKeyCollected",
  ];
  const requiredConditions = ["once", "hasKey", "coinsAtLeast", "doorIsOpen"];
  const requiredActions = [
    "showMessage",
    "openDoor",
    "closeDoor",
    "teleportPlayer",
    "giveCoins",
    "setCheckpoint",
    "finishMap",
    "enableObject",
    "disableObject",
  ];

  for (const trigger of requiredTriggers) {
    if (!triggers.has(trigger)) {
      errors.push(`${templateId}: falta trigger de logica ${trigger}.`);
    }
  }

  for (const condition of requiredConditions) {
    if (!conditions.has(condition)) {
      errors.push(`${templateId}: falta condicao de logica ${condition}.`);
    }
  }

  for (const action of requiredActions) {
    if (!actions.has(action)) {
      errors.push(`${templateId}: falta acao de logica ${action}.`);
    }
  }

  return errors;
}

function getExpectedSignCount(objectCount) {
  if (objectCount >= 1200) {
    return 18;
  }

  if (objectCount >= 900) {
    return 14;
  }

  if (objectCount >= 600) {
    return 10;
  }

  if (objectCount >= 300) {
    return 6;
  }

  return 3;
}

function getObjectsByType(map, type) {
  return map.objects.filter((object) => object.type === type);
}

function getSpawnSupports(map) {
  return map.objects.filter(
    (object) => isFloorSupportObject(object) && isObjectUnderSpawn(map.spawnPoint, object)
  );
}

function isFloorSupportObject(object) {
  return (
    object.type === "platform" ||
    object.type === "cube" ||
    object.type === "ramp" ||
    object.type === "movingPlatform" ||
    object.type === "disappearingBlock" ||
    object.type === "model"
  );
}

function isObjectUnderSpawn(spawnPoint, object) {
  const scale = getObjectScale(object);
  const topY = object.position.y + scale.y / 2;
  const withinX = Math.abs(spawnPoint.x - object.position.x) <= scale.x / 2 + 0.35;
  const withinZ = Math.abs(spawnPoint.z - object.position.z) <= scale.z / 2 + 0.35;
  const closeY = spawnPoint.y >= topY - 0.12 && spawnPoint.y <= topY + 1.25;

  return withinX && withinZ && closeY;
}

function getObjectScale(object) {
  if (isPositiveScale(object.scale)) {
    return object.scale;
  }

  if (
    object.type === "platform" ||
    object.type === "movingPlatform" ||
    object.type === "disappearingBlock"
  ) {
    return { x: 6, y: 0.4, z: 6 };
  }

  if (object.type === "ramp") {
    return { x: 2, y: 1, z: 2 };
  }

  return { x: 1, y: 1, z: 1 };
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
}

function validateVectorLimit(errors, templateId, objectId, label, vector, limit) {
  for (const axis of ["x", "y", "z"]) {
    const value = vector[axis];

    if (Math.abs(value) > limit) {
      errors.push(
        `${templateId}: ${objectId} com ${label}.${axis} fora do limite oficial (${value}/${limit}).`
      );
    }
  }
}

function validateGameplayPropertyBounds(errors, templateId, object) {
  if (object.type === "damage") {
    validateOptionalNumberRange(
      errors,
      templateId,
      object.id,
      "damage",
      object.properties?.damage,
      0,
      TEMPLATE_DAMAGE_LIMIT
    );
    validateOptionalNumberRange(
      errors,
      templateId,
      object.id,
      "damagePerSecond",
      object.properties?.damagePerSecond,
      0,
      TEMPLATE_DAMAGE_LIMIT
    );
  }

  if (object.type === "enemy") {
    validateOptionalNumberRange(
      errors,
      templateId,
      object.id,
      "health",
      object.properties?.health,
      1,
      TEMPLATE_ENEMY_HEALTH_LIMIT
    );
    validateOptionalNumberRange(
      errors,
      templateId,
      object.id,
      "damage",
      object.properties?.damage,
      0,
      TEMPLATE_ENEMY_DAMAGE_LIMIT
    );
    validateOptionalNumberRange(
      errors,
      templateId,
      object.id,
      "attackRange",
      object.properties?.attackRange,
      0.1,
      12
    );
    validateOptionalNumberRange(
      errors,
      templateId,
      object.id,
      "detectionRange",
      object.properties?.detectionRange,
      0.5,
      40
    );
    validateOptionalNumberRange(
      errors,
      templateId,
      object.id,
      "attackCooldown",
      object.properties?.attackCooldown,
      0.2,
      8
    );
  }
}

function validateOptionalNumberRange(errors, templateId, objectId, propertyName, value, min, max) {
  if (value === undefined) {
    return;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    errors.push(
      `${templateId}: ${objectId}.${propertyName} fora do intervalo oficial (${value}; ${min}-${max}).`
    );
  }
}

function getVoidDeathY(map) {
  return typeof map.gameplaySettings?.voidDeathY === "number" &&
    Number.isFinite(map.gameplaySettings.voidDeathY)
    ? map.gameplaySettings.voidDeathY
    : map.spawnPoint.y - 25;
}

function getSpread(objects) {
  const xs = objects.map((object) => object.position.x);
  const zs = objects.map((object) => object.position.z);

  return {
    x: Math.max(...xs) - Math.min(...xs),
    z: Math.max(...zs) - Math.min(...zs),
  };
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function getNearestDistance(object, candidates) {
  return candidates.reduce(
    (nearest, candidate) => Math.min(nearest, distance2D(object.position, candidate.position)),
    Infinity
  );
}

function hasSignNearConnection(signs, from, to) {
  const mid = {
    x: (from.x + to.x) / 2,
    y: Math.max(from.y, to.y),
    z: (from.z + to.z) / 2,
  };

  return signs.some(
    (sign) =>
      distance2D(sign.position, from) <= 8 ||
      distance2D(sign.position, to) <= 8 ||
      distance2D(sign.position, mid) <= 8
  );
}

function hasJumpPadDestination(jumpPad, walkableObjects) {
  return walkableObjects.some((object) => {
    if (object.id === jumpPad.id) {
      return false;
    }

    const distance = distance2D(jumpPad.position, object.position);
    const verticalDelta = object.position.y - jumpPad.position.y;

    return distance >= 2.5 && distance <= 18 && verticalDelta >= -0.5 && verticalDelta <= 7.5;
  });
}

function isPlacedBeforeOrNear(key, door) {
  return key.position.z >= door.position.z - 0.5 || distance2D(key.position, door.position) <= 20;
}

function getDoorId(object) {
  return getString(object.properties?.doorId, object.id);
}

function getKeyId(object) {
  return getString(object.properties?.keyId, object.id);
}

function getTeleporterId(object) {
  return getString(object.properties?.teleporterId, object.id);
}

function validateLogicRule(
  templateId,
  rule,
  objectIds,
  doorIds,
  keyIds,
  enemyIds,
  npcIds,
  objectiveIds,
  teamIds,
  capturePointIds,
  map
) {
  const errors = [];

  if (!rule.id || !rule.name) {
    errors.push(`${templateId}: regra sem id/name.`);
  }

  if (!rule.trigger || typeof rule.trigger.type !== "string") {
    errors.push(`${templateId}: regra ${rule.id} sem trigger valido.`);
    return errors;
  }

  if (
    rule.trigger.type === "onPlayerEnterObject" ||
    rule.trigger.type === "onButtonActivated" ||
    rule.trigger.type === "onCoinCollected" ||
    rule.trigger.type === "onEnemyDefeated" ||
    rule.trigger.type === "onNpcInteracted"
  ) {
    if (!objectIds.has(rule.trigger.objectId)) {
      errors.push(
        `${templateId}: regra ${rule.id} trigger aponta objeto inexistente ${rule.trigger.objectId}.`
      );
    }

    if (rule.trigger.type === "onEnemyDefeated" && !enemyIds.has(rule.trigger.objectId)) {
      errors.push(
        `${templateId}: regra ${rule.id} onEnemyDefeated aponta inimigo inexistente ${rule.trigger.objectId}.`
      );
    }

    if (rule.trigger.type === "onNpcInteracted" && !npcIds.has(rule.trigger.objectId)) {
      errors.push(
        `${templateId}: regra ${rule.id} onNpcInteracted aponta NPC inexistente ${rule.trigger.objectId}.`
      );
    }
  }

  if (rule.trigger.type === "onObjectiveCompleted" && !objectiveIds.has(rule.trigger.objectiveId)) {
    errors.push(
      `${templateId}: regra ${rule.id} onObjectiveCompleted aponta objetivo inexistente ${rule.trigger.objectiveId}.`
    );
  }

  if (rule.trigger.type === "onKeyCollected" && !keyIds.has(rule.trigger.keyId)) {
    errors.push(
      `${templateId}: regra ${rule.id} trigger aponta chave inexistente ${rule.trigger.keyId}.`
    );
  }

  if (rule.trigger.type === "onItemCollected" && !isValidItemType(rule.trigger.itemType)) {
    errors.push(
      `${templateId}: regra ${rule.id} onItemCollected usa item invalido ${rule.trigger.itemType}.`
    );
  }

  if (
    rule.trigger.type === "onScoreReached" &&
    (!Number.isFinite(rule.trigger.amount) || rule.trigger.amount < 1)
  ) {
    errors.push(`${templateId}: regra ${rule.id} onScoreReached precisa de amount positivo.`);
  }

  if (rule.trigger.type === "onTeamScoreReached") {
    if (!teamIds.has(rule.trigger.teamId)) {
      errors.push(
        `${templateId}: regra ${rule.id} onTeamScoreReached aponta time inexistente ${rule.trigger.teamId}.`
      );
    }

    if (!Number.isFinite(rule.trigger.amount) || rule.trigger.amount < 1) {
      errors.push(`${templateId}: regra ${rule.id} onTeamScoreReached precisa de amount positivo.`);
    }
  }

  if (rule.trigger.type === "onCapturePointCaptured") {
    if (!capturePointIds.has(rule.trigger.pointId)) {
      errors.push(
        `${templateId}: regra ${rule.id} onCapturePointCaptured aponta ponto inexistente ${rule.trigger.pointId}.`
      );
    }

    if (rule.trigger.teamId && !teamIds.has(rule.trigger.teamId)) {
      errors.push(
        `${templateId}: regra ${rule.id} onCapturePointCaptured aponta time inexistente ${rule.trigger.teamId}.`
      );
    }
  }

  for (const condition of rule.conditions ?? []) {
    if (condition.type === "hasKey" && !keyIds.has(condition.keyId)) {
      errors.push(`${templateId}: regra ${rule.id} hasKey invalido ${condition.keyId}.`);
    }

    if (condition.type === "doorIsOpen" && !doorIds.has(condition.doorId)) {
      errors.push(`${templateId}: regra ${rule.id} doorIsOpen invalido ${condition.doorId}.`);
    }

    if (condition.type === "coinsAtLeast" && !Number.isFinite(condition.amount)) {
      errors.push(`${templateId}: regra ${rule.id} coinsAtLeast invalido.`);
    }

    if (condition.type === "enemyDefeated" && !enemyIds.has(condition.objectId)) {
      errors.push(
        `${templateId}: regra ${rule.id} enemyDefeated aponta inimigo inexistente ${condition.objectId}.`
      );
    }

    if (condition.type === "enemiesDefeatedAtLeast" && !Number.isFinite(condition.amount)) {
      errors.push(`${templateId}: regra ${rule.id} enemiesDefeatedAtLeast invalido.`);
    }

    if (condition.type === "hasWeapon" && !isValidWeaponId(condition.weaponId)) {
      errors.push(`${templateId}: regra ${rule.id} hasWeapon invalido ${condition.weaponId}.`);
    }

    if (condition.type === "healthBelow" && !Number.isFinite(condition.amount)) {
      errors.push(`${templateId}: regra ${rule.id} healthBelow invalido.`);
    }
  }

  for (const action of rule.actions ?? []) {
    if (
      (action.type === "openDoor" || action.type === "closeDoor") &&
      !doorIds.has(action.doorId)
    ) {
      errors.push(
        `${templateId}: regra ${rule.id} ${action.type} aponta porta inexistente ${action.doorId}.`
      );
    }

    if (action.type === "teleportPlayer" && !objectIds.has(action.targetObjectId)) {
      errors.push(
        `${templateId}: regra ${rule.id} teleportPlayer aponta objeto inexistente ${action.targetObjectId}.`
      );
    }

    if (action.type === "setCheckpoint") {
      const target = map.objects.find((object) => object.id === action.objectId);

      if (!target || target.type !== "checkpoint") {
        errors.push(
          `${templateId}: regra ${rule.id} setCheckpoint aponta checkpoint inexistente ${action.objectId}.`
        );
      }
    }

    if (
      (action.type === "enableObject" || action.type === "disableObject") &&
      !objectIds.has(action.objectId)
    ) {
      errors.push(
        `${templateId}: regra ${rule.id} ${action.type} aponta objeto inexistente ${action.objectId}.`
      );
    }

    if (action.type === "spawnEnemy" && !enemyIds.has(action.objectId)) {
      errors.push(
        `${templateId}: regra ${rule.id} spawnEnemy aponta inimigo inexistente ${action.objectId}.`
      );
    }

    if (action.type === "giveCoins" && !Number.isFinite(action.amount)) {
      errors.push(`${templateId}: regra ${rule.id} giveCoins invalido.`);
    }

    if (
      (action.type === "healPlayer" || action.type === "damagePlayer") &&
      !Number.isFinite(action.amount)
    ) {
      errors.push(`${templateId}: regra ${rule.id} ${action.type} invalido.`);
    }

    if (action.type === "giveWeapon" && !isValidWeaponId(action.weaponId)) {
      errors.push(`${templateId}: regra ${rule.id} giveWeapon invalido ${action.weaponId}.`);
    }

    if (action.type === "completeObjective" && !objectiveIds.has(action.objectiveId)) {
      errors.push(
        `${templateId}: regra ${rule.id} completeObjective aponta objetivo inexistente ${action.objectiveId}.`
      );
    }

    if (action.type === "addScore" && !Number.isFinite(action.amount)) {
      errors.push(`${templateId}: regra ${rule.id} addScore invalido.`);
    }

    if (action.type === "addTeamScore") {
      if (!teamIds.has(action.teamId)) {
        errors.push(
          `${templateId}: regra ${rule.id} addTeamScore aponta time inexistente ${action.teamId}.`
        );
      }

      if (!Number.isFinite(action.amount)) {
        errors.push(`${templateId}: regra ${rule.id} addTeamScore invalido.`);
      }
    }

    if (action.type === "setTeam" && !teamIds.has(action.teamId)) {
      errors.push(
        `${templateId}: regra ${rule.id} setTeam aponta time inexistente ${action.teamId}.`
      );
    }

    if (action.type === "endRound" && !isValidRoundResult(action.result)) {
      errors.push(
        `${templateId}: regra ${rule.id} endRound usa resultado invalido ${action.result}.`
      );
    }

    if (action.type === "showDialogue") {
      if (!npcIds.has(action.objectId)) {
        errors.push(
          `${templateId}: regra ${rule.id} showDialogue aponta NPC inexistente ${action.objectId}.`
        );
      }

      if (typeof action.message !== "string" || action.message.length === 0) {
        errors.push(`${templateId}: regra ${rule.id} showDialogue sem mensagem.`);
      }
    }
  }

  return errors;
}

function isValidItemType(value) {
  return (
    value === "health" ||
    value === "coin" ||
    value === "weapon_basic" ||
    value === "weapon_heavy_hammer" ||
    value === "weapon_dagger" ||
    value === "weapon_blaster"
  );
}

function isValidWeaponId(value) {
  return (
    value === "basic_sword" || value === "heavy_hammer" || value === "dagger" || value === "blaster"
  );
}

function isValidRoundResult(value) {
  return value === "win" || value === "lose" || value === "draw";
}

function isValidObjectiveType(value) {
  return (
    value === "collectCoins" ||
    value === "reachObject" ||
    value === "collectKey" ||
    value === "activateButton" ||
    value === "openDoor" ||
    value === "defeatEnemies" ||
    value === "customLogic"
  );
}

function isVector(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function isPositiveScale(value) {
  return isVector(value) && value.x > 0 && value.y > 0 && value.z > 0;
}

function getString(value, fallback) {
  return typeof value === "string" ? value : fallback;
}

await main();
