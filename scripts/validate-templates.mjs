import * as esbuild from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MIN_OBJECTS = {
  empty: 80,
  obby: 180,
  coin: 250,
  door: 300,
  checkpoint: 300,
  mechanics: 400,
  combatArena: 150,
  combatDungeon: 220,
  guideMission: 160,
  keyPuzzle: 350,
  logic: 250,
  forest: 500,
  desert: 500,
  neonObby: 500,
  megaObby: 700,
  megaCoinWorld: 800,
  keyDungeon: 700,
  testCity: 1000,
  adventureIsland: 900,
  stressTest: 1500
};

const REQUIRED_MINIMUMS = {
  obby: { coins: 20, checkpoints: 4, damage: 3, jumpPads: 2, movingPlatforms: 1, disappearingBlocks: 2 },
  coin: { coins: 50, checkpoints: 2, teleporters: 2, keys: 1, doors: 1 },
  door: { doors: 10, buttons: 10, keys: 3, logic: 8 },
  checkpoint: { checkpoints: 12, damage: 15, jumpPads: 8, disappearingBlocks: 8, movingPlatforms: 6 },
  mechanics: { checkpoints: 1, damage: 1, jumpPads: 1, teleporters: 2, movingPlatforms: 1, disappearingBlocks: 1, doors: 1, buttons: 1, keys: 1 },
  combatArena: { coins: 12, checkpoints: 1, enemies: 3, itemSpawners: 3, messageZones: 3, doors: 1, logic: 3 },
  combatDungeon: { coins: 25, checkpoints: 4, enemies: 8, itemSpawners: 4, messageZones: 5, doors: 3, logic: 6 },
  guideMission: { coins: 16, npcs: 1, objectives: 6, enemies: 2, itemSpawners: 2, keys: 1, doors: 1, logic: 4 },
  keyPuzzle: { keys: 6, doors: 10, buttons: 8, logic: 10 },
  logic: { logic: 20, coins: 20, doors: 6, buttons: 6, keys: 2, checkpoints: 5, teleporters: 2 },
  forest: { coins: 80, checkpoints: 5, keys: 3, doors: 4, teleporters: 4 },
  desert: { coins: 70, checkpoints: 5, doors: 6, buttons: 6, teleporters: 6 },
  neonObby: { coins: 80, checkpoints: 12, damage: 20, jumpPads: 15, movingPlatforms: 10, disappearingBlocks: 15 },
  megaObby: { coins: 100, checkpoints: 15, damage: 20, jumpPads: 20, movingPlatforms: 15, disappearingBlocks: 20 },
  megaCoinWorld: { coins: 180, teleporters: 8, keys: 8, doors: 10 },
  keyDungeon: { keys: 10, doors: 20, buttons: 20, logic: 30, coins: 100 },
  testCity: { coins: 100, doors: 10, buttons: 10, teleporters: 8, checkpoints: 8 },
  adventureIsland: { coins: 150, checkpoints: 8, keys: 8, doors: 12, teleporters: 8, jumpPads: 10, movingPlatforms: 8 },
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
    logic: 50
  }
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
      logLevel: "silent"
    });

    const templatesModule = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
    const { MAP_TEMPLATES, createMapFromTemplate } = templatesModule;
    const errors = [];
    const warnings = [];
    const summaries = [];

    for (const template of MAP_TEMPLATES) {
      const map = createMapFromTemplate(template.id);
      const summary = summarizeMap(template, map);
      summaries.push(summary);
      errors.push(...validateTemplate(template, map, summary));
      warnings.push(...collectLevelDesignWarnings(template, map, summary));
    }

    console.table(summaries.map((summary) => ({
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
      dano: summary.damage,
      jumpPads: summary.jumpPads,
      teleportes: summary.teleporters,
      moveis: summary.movingPlatforms,
      somem: summary.disappearingBlocks,
      mensagens: summary.messageZones,
      placas: summary.signs,
      logica: summary.logic,
      void: summary.voidDeath,
      voidY: summary.voidY,
      jsonKB: summary.jsonKB
    })));

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
    damage: count("damage"),
    jumpPads: count("jumpPad"),
    teleporters: count("teleporter"),
    movingPlatforms: count("movingPlatform"),
    disappearingBlocks: count("disappearingBlock"),
    messageZones: count("messageZone"),
    signs: count("sign"),
    logic: Array.isArray(map.logic) ? map.logic.length : 0,
    voidDeath: map.gameplaySettings?.voidDeathEnabled === false ? "off" : "on",
    voidY: Number(getVoidDeathY(map).toFixed(1)),
    jsonKB: Number((jsonBytes / 1024).toFixed(1))
  };
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
  const expectedMin = MIN_OBJECTS[template.id];

  if (!template.id) {
    errors.push(`${template.name}: template sem id.`);
  }

  if (!template.name) {
    errors.push(`${template.id}: template sem name.`);
  }

  if (!map.id || !map.name) {
    errors.push(`${template.id}: mapa sem id/name.`);
  }

  if (!isVector(map.spawnPoint)) {
    errors.push(`${template.id}: spawnPoint invalido.`);
  }

  if (!map.objects.some((object) => object.type === "finish" || object.type === "goal")) {
    errors.push(`${template.id}: nao possui final.`);
  }

  if (expectedMin && summary.objects < expectedMin) {
    errors.push(`${template.id}: objetos abaixo do minimo (${summary.objects}/${expectedMin}).`);
  }

  if (summary.objects >= 300 && summary.checkpoints < 1) {
    errors.push(`${template.id}: mapa grande sem checkpoint.`);
  }

  for (const object of map.objects) {
    if (!object.id) {
      errors.push(`${template.id}: objeto sem id.`);
      continue;
    }

    if (objectIds.has(object.id)) {
      errors.push(`${template.id}: id duplicado de objeto ${object.id}.`);
    }

    objectIds.add(object.id);

    if (!isVector(object.position)) {
      errors.push(`${template.id}: ${object.id} com position invalido.`);
    }

    if (object.rotation !== undefined && !isVector(object.rotation)) {
      errors.push(`${template.id}: ${object.id} com rotation invalido.`);
    }

    if (object.scale !== undefined && !isPositiveScale(object.scale)) {
      errors.push(`${template.id}: ${object.id} com scale invalido ou nao positivo.`);
    }

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

    if (object.type === "teleporter") {
      const teleporterId = getString(object.properties?.teleporterId, object.id);

      if (teleporterIds.has(teleporterId)) {
        errors.push(`${template.id}: teleporterId duplicado ${teleporterId}.`);
      }

      teleporterIds.add(teleporterId);
    }
  }

  for (const object of map.objects) {
    const targetDoorId = getString(object.properties?.targetDoorId, "") || getString(object.properties?.buttonTargetId, "");
    const requiredKeyId = getString(object.properties?.requiredKeyId, "");
    const targetTeleporterId = getString(object.properties?.targetTeleporterId, "");

    if (targetDoorId && !doorIds.has(targetDoorId)) {
      errors.push(`${template.id}: ${object.id} aponta targetDoorId inexistente ${targetDoorId}.`);
    }

    if (requiredKeyId && !keyIds.has(requiredKeyId)) {
      errors.push(`${template.id}: ${object.id} aponta requiredKeyId inexistente ${requiredKeyId}.`);
    }

    if (targetTeleporterId && !teleporterIds.has(targetTeleporterId)) {
      errors.push(`${template.id}: ${object.id} aponta targetTeleporterId inexistente ${targetTeleporterId}.`);
    }
  }

  const requirements = REQUIRED_MINIMUMS[template.id] ?? {};

  for (const [key, min] of Object.entries(requirements)) {
    if (summary[key] < min) {
      errors.push(`${template.id}: ${key} abaixo do minimo (${summary[key]}/${min}).`);
    }
  }

  errors.push(...validateObjectives(template.id, map, {
    objectIds,
    doorIds,
    keyIds,
    enemyIds,
    objectiveIds
  }));

  for (const rule of map.logic ?? []) {
    errors.push(...validateLogicRule(template.id, rule, objectIds, doorIds, keyIds, enemyIds, npcIds, objectiveIds, map));
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

    if ((objective.type === "collectCoins" || objective.type === "defeatEnemies") &&
      (!Number.isFinite(objective.targetAmount) || objective.targetAmount < 1)
    ) {
      errors.push(`${templateId}: objetivo ${objective.id} precisa de targetAmount positivo.`);
    }

    if ((objective.type === "reachObject" || objective.type === "activateButton") &&
      !refs.objectIds.has(objective.targetObjectId)
    ) {
      errors.push(`${templateId}: objetivo ${objective.id} aponta objeto inexistente ${objective.targetObjectId}.`);
    }

    if (objective.type === "collectKey" && !refs.keyIds.has(objective.targetKeyId)) {
      errors.push(`${templateId}: objetivo ${objective.id} aponta chave inexistente ${objective.targetKeyId}.`);
    }

    if (objective.type === "openDoor" && !refs.doorIds.has(objective.targetDoorId)) {
      errors.push(`${templateId}: objetivo ${objective.id} aponta porta inexistente ${objective.targetDoorId}.`);
    }
  }

  if (map.gameplaySettings?.requireObjectivesToFinish && objectives.every((objective) => objective.required === false)) {
    errors.push(`${templateId}: exige objetivos para finalizar, mas nenhum objetivo e obrigatorio.`);
  }

  return errors;
}

function validateLevelDesign(template, map, summary, refs) {
  const errors = [];
  const expectedSigns = getExpectedSignCount(summary.objects);
  const coins = getObjectsByType(map, "coin");
  const damageZones = getObjectsByType(map, "damage");
  const checkpoints = getObjectsByType(map, "checkpoint");
  const buttons = getObjectsByType(map, "button");
  const doors = getObjectsByType(map, "door");
  const keys = getObjectsByType(map, "key");
  const teleporters = getObjectsByType(map, "teleporter");

  errors.push(...validateVoidGameplay(template.id, map));

  if (summary.signs < expectedSigns) {
    errors.push(`${template.id}: poucas placas de orientacao (${summary.signs}/${expectedSigns}).`);
  }

  if (damageZones.length > 0 && checkpoints.length < Math.ceil(damageZones.length / 4)) {
    errors.push(`${template.id}: perigos sem checkpoints suficientes (${checkpoints.length}/${Math.ceil(damageZones.length / 4)}).`);
  }

  if (damageZones.some((damage) => distance2D(damage.position, map.spawnPoint) < 8)) {
    errors.push(`${template.id}: zona de dano muito perto do spawn.`);
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
    const targetDoorId = getString(button.properties?.targetDoorId, "") || getString(button.properties?.buttonTargetId, "");
    const door = doors.find((candidate) => getDoorId(candidate) === targetDoorId);

    if (targetDoorId && door && distance2D(button.position, door.position) > 34) {
      errors.push(`${template.id}: botao ${button.id} esta distante demais da porta ${targetDoorId}.`);
    }
  }

  for (const door of doors) {
    const requiredKeyId = getString(door.properties?.requiredKeyId, "");
    const key = keys.find((candidate) => getKeyId(candidate) === requiredKeyId);

    if (requiredKeyId && key && !isPlacedBeforeOrNear(key, door)) {
      errors.push(`${template.id}: chave ${requiredKeyId} parece estar depois da porta que ela abre.`);
    }
  }

  for (const teleporter of teleporters) {
    const targetTeleporterId = getString(teleporter.properties?.targetTeleporterId, "");
    const target = teleporters.find((candidate) => getTeleporterId(candidate) === targetTeleporterId);

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
  const initialFloors = map.objects.filter((object) =>
    isFloorSupportObject(object) && distance2D(object.position, map.spawnPoint) <= 12
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
    errors.push(`${templateId}: possui piso gigante que parece chao global (${globalFloors.map((object) => object.id).join(", ")}).`);
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
  const jumpPads = getObjectsByType(map, "jumpPad");
  const finishObjects = map.objects.filter((object) => object.type === "finish" || object.type === "goal");
  const signs = getObjectsByType(map, "sign");
  const walkableObjects = map.objects.filter((object) =>
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
    const targetDoorId = getString(button.properties?.targetDoorId, "") || getString(button.properties?.buttonTargetId, "");

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
      warnings.push(`${template.id}: porta ${doorId} nao parece estar ligada a botao, chave ou regra.`);
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
      warnings.push(`${template.id}: ${farCoins.length} moeda(s) parecem longe de plataformas/caminhos.`);
    }
  }

  for (const checkpoint of checkpoints) {
    if (damageZones.some((damage) => distance2D(checkpoint.position, damage.position) < 2.2)) {
      warnings.push(`${template.id}: checkpoint ${checkpoint.id} esta muito perto de uma zona de dano.`);
    }

    if (walkableObjects.length > 0 && getNearestDistance(checkpoint, walkableObjects) > 10) {
      warnings.push(`${template.id}: checkpoint ${checkpoint.id} parece longe do caminho principal.`);
    }
  }

  for (const button of buttons) {
    const targetDoorId = getString(button.properties?.targetDoorId, "") || getString(button.properties?.buttonTargetId, "");
    const door = doors.find((candidate) => getDoorId(candidate) === targetDoorId);

    if (door && distance2D(button.position, door.position) > 22 && !hasSignNearConnection(signs, button.position, door.position)) {
      warnings.push(`${template.id}: botao ${button.id} esta distante da porta ${targetDoorId} sem placa proxima.`);
    }
  }

  for (const jumpPad of jumpPads) {
    if (!hasJumpPadDestination(jumpPad, walkableObjects)) {
      warnings.push(`${template.id}: jumpPad ${jumpPad.id} nao tem plataforma de destino obvia.`);
    }
  }

  for (const finish of finishObjects) {
    if (walkableObjects.length > 0 && getNearestDistance(finish, walkableObjects) > 8) {
      warnings.push(`${template.id}: final ${finish.id} parece longe de uma plataforma alcancavel.`);
    }
  }

  if ((template.id === "obby" || template.id === "neonObby" || template.id === "megaObby") &&
    checkpoints.length < Math.ceil((damageZones.length + jumpPads.length + movingPlatformCount(summary) + summary.disappearingBlocks) / 4)
  ) {
    warnings.push(`${template.id}: obby com poucos checkpoints para a quantidade de desafios.`);
  }

  const decorativeCount = map.objects.filter((object) =>
    object.type === "tree" ||
    object.type === "rock" ||
    object.type === "crate" ||
    object.type === "barrel" ||
    object.type === "lamp" ||
    object.type === "arch" ||
    object.type === "pillar"
  ).length;

  if (summary.objects >= 350 && decorativeCount > 180 && summary.signs < 8) {
    warnings.push(`${template.id}: muita decoracao com pouca sinalizacao (${decorativeCount} decorativos, ${summary.signs} placas).`);
  }

  const interactiveCount = summary.doors + summary.buttons + summary.keys + summary.teleporters + summary.messageZones;

  if (interactiveCount >= 25 && summary.logic < 5) {
    warnings.push(`${template.id}: muitos objetos interativos com pouca logica associada (${interactiveCount} interativos, ${summary.logic} regras).`);
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

  const requiredTriggers = ["onMapStart", "onPlayerEnterObject", "onButtonActivated", "onCoinCollected", "onKeyCollected"];
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
    "disableObject"
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
  return map.objects.filter((object) => isFloorSupportObject(object) && isObjectUnderSpawn(map.spawnPoint, object));
}

function isFloorSupportObject(object) {
  return object.type === "platform" ||
    object.type === "cube" ||
    object.type === "ramp" ||
    object.type === "movingPlatform" ||
    object.type === "disappearingBlock" ||
    object.type === "model";
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

  if (object.type === "platform" || object.type === "movingPlatform" || object.type === "disappearingBlock") {
    return { x: 6, y: 0.4, z: 6 };
  }

  if (object.type === "ramp") {
    return { x: 2, y: 1, z: 2 };
  }

  return { x: 1, y: 1, z: 1 };
}

function getVoidDeathY(map) {
  return typeof map.gameplaySettings?.voidDeathY === "number" && Number.isFinite(map.gameplaySettings.voidDeathY)
    ? map.gameplaySettings.voidDeathY
    : map.spawnPoint.y - 25;
}

function getSpread(objects) {
  const xs = objects.map((object) => object.position.x);
  const zs = objects.map((object) => object.position.z);

  return {
    x: Math.max(...xs) - Math.min(...xs),
    z: Math.max(...zs) - Math.min(...zs)
  };
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function getNearestDistance(object, candidates) {
  return candidates.reduce((nearest, candidate) => Math.min(nearest, distance2D(object.position, candidate.position)), Infinity);
}

function hasSignNearConnection(signs, from, to) {
  const mid = {
    x: (from.x + to.x) / 2,
    y: Math.max(from.y, to.y),
    z: (from.z + to.z) / 2
  };

  return signs.some((sign) =>
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

    return distance >= 2.5 &&
      distance <= 18 &&
      verticalDelta >= -0.5 &&
      verticalDelta <= 7.5;
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

function validateLogicRule(templateId, rule, objectIds, doorIds, keyIds, enemyIds, npcIds, objectiveIds, map) {
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
      errors.push(`${templateId}: regra ${rule.id} trigger aponta objeto inexistente ${rule.trigger.objectId}.`);
    }

    if (rule.trigger.type === "onEnemyDefeated" && !enemyIds.has(rule.trigger.objectId)) {
      errors.push(`${templateId}: regra ${rule.id} onEnemyDefeated aponta inimigo inexistente ${rule.trigger.objectId}.`);
    }

    if (rule.trigger.type === "onNpcInteracted" && !npcIds.has(rule.trigger.objectId)) {
      errors.push(`${templateId}: regra ${rule.id} onNpcInteracted aponta NPC inexistente ${rule.trigger.objectId}.`);
    }
  }

  if (rule.trigger.type === "onObjectiveCompleted" && !objectiveIds.has(rule.trigger.objectiveId)) {
    errors.push(`${templateId}: regra ${rule.id} onObjectiveCompleted aponta objetivo inexistente ${rule.trigger.objectiveId}.`);
  }

  if (rule.trigger.type === "onKeyCollected" && !keyIds.has(rule.trigger.keyId)) {
    errors.push(`${templateId}: regra ${rule.id} trigger aponta chave inexistente ${rule.trigger.keyId}.`);
  }

  if (rule.trigger.type === "onItemCollected" && !isValidItemType(rule.trigger.itemType)) {
    errors.push(`${templateId}: regra ${rule.id} onItemCollected usa item invalido ${rule.trigger.itemType}.`);
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
      errors.push(`${templateId}: regra ${rule.id} enemyDefeated aponta inimigo inexistente ${condition.objectId}.`);
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
    if ((action.type === "openDoor" || action.type === "closeDoor") && !doorIds.has(action.doorId)) {
      errors.push(`${templateId}: regra ${rule.id} ${action.type} aponta porta inexistente ${action.doorId}.`);
    }

    if (action.type === "teleportPlayer" && !objectIds.has(action.targetObjectId)) {
      errors.push(`${templateId}: regra ${rule.id} teleportPlayer aponta objeto inexistente ${action.targetObjectId}.`);
    }

    if (action.type === "setCheckpoint") {
      const target = map.objects.find((object) => object.id === action.objectId);

      if (!target || target.type !== "checkpoint") {
        errors.push(`${templateId}: regra ${rule.id} setCheckpoint aponta checkpoint inexistente ${action.objectId}.`);
      }
    }

    if ((action.type === "enableObject" || action.type === "disableObject") && !objectIds.has(action.objectId)) {
      errors.push(`${templateId}: regra ${rule.id} ${action.type} aponta objeto inexistente ${action.objectId}.`);
    }

    if (action.type === "spawnEnemy" && !enemyIds.has(action.objectId)) {
      errors.push(`${templateId}: regra ${rule.id} spawnEnemy aponta inimigo inexistente ${action.objectId}.`);
    }

    if (action.type === "giveCoins" && !Number.isFinite(action.amount)) {
      errors.push(`${templateId}: regra ${rule.id} giveCoins invalido.`);
    }

    if ((action.type === "healPlayer" || action.type === "damagePlayer") && !Number.isFinite(action.amount)) {
      errors.push(`${templateId}: regra ${rule.id} ${action.type} invalido.`);
    }

    if (action.type === "giveWeapon" && !isValidWeaponId(action.weaponId)) {
      errors.push(`${templateId}: regra ${rule.id} giveWeapon invalido ${action.weaponId}.`);
    }

    if (action.type === "completeObjective" && !objectiveIds.has(action.objectiveId)) {
      errors.push(`${templateId}: regra ${rule.id} completeObjective aponta objetivo inexistente ${action.objectiveId}.`);
    }

    if (action.type === "showDialogue") {
      if (!npcIds.has(action.objectId)) {
        errors.push(`${templateId}: regra ${rule.id} showDialogue aponta NPC inexistente ${action.objectId}.`);
      }

      if (typeof action.message !== "string" || action.message.length === 0) {
        errors.push(`${templateId}: regra ${rule.id} showDialogue sem mensagem.`);
      }
    }
  }

  return errors;
}

function isValidItemType(value) {
  return value === "health" || value === "coin" || value === "weapon_basic";
}

function isValidWeaponId(value) {
  return value === "basic_sword";
}

function isValidObjectiveType(value) {
  return value === "collectCoins" ||
    value === "reachObject" ||
    value === "collectKey" ||
    value === "activateButton" ||
    value === "openDoor" ||
    value === "defeatEnemies" ||
    value === "customLogic";
}

function isVector(value) {
  return value &&
    Number.isFinite(value.x) &&
    Number.isFinite(value.y) &&
    Number.isFinite(value.z);
}

function isPositiveScale(value) {
  return isVector(value) &&
    value.x > 0 &&
    value.y > 0 &&
    value.z > 0;
}

function getString(value, fallback) {
  return typeof value === "string" ? value : fallback;
}

await main();
