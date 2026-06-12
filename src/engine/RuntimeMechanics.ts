import * as THREE from "three";
import { getWeaponDefinition, getWeaponLabel } from "../shared/ItemCatalog";
import {
  applyObjectAppearanceToThree,
  applyObjectTransformToThree,
} from "./ObjectFactory";
import { PhysicsSystem } from "./PhysicsSystem";
import { PlayerController } from "./PlayerController";
import { RuntimeHud, type GameModeSummary, type VictoryActions } from "./RuntimeHud";
import { LogicRuntime } from "./LogicRuntime";
import { ObjectiveRuntime } from "./ObjectiveRuntime";
import { GameModeRuntime } from "./GameModeRuntime";
import { clampEnemyHealth } from "./mechanics/EnemyMechanics";
import {
  isDamageZoneObject,
} from "./mechanics/DamageZoneMechanics";
import { TycoonSystem } from "./mechanics/TycoonSystem";
import { RuntimeTycoonSystem } from "./runtime/RuntimeTycoonSystem";
import { RUNTIME_INTERACTION_PRIORITIES } from "./runtime/core/RuntimeInteraction";
import { RuntimeSystemManager } from "./runtime/core/RuntimeSystemManager";
import { RuntimePickupSystem } from "./runtime/systems/RuntimePickupSystem";
import {
  RuntimeDoorButtonSystem,
  type DoorCloseOptions,
  type DoorOpenOptions,
} from "./runtime/systems/RuntimeDoorButtonSystem";
import { RuntimeHazardCheckpointSystem } from "./runtime/systems/RuntimeHazardCheckpointSystem";
import { RuntimeMovementObjectSystem } from "./runtime/systems/RuntimeMovementObjectSystem";
import {
  RuntimeEnemySystem,
  type EnemyRuntimeState,
} from "./runtime/systems/RuntimeEnemySystem";
import { RuntimeProjectileSystem } from "./runtime/systems/RuntimeProjectileSystem";
import {
  RuntimeCombatBridgeSystem,
  createEquippedWeaponFromDefinition,
  type EquippedWeapon,
} from "./runtime/systems/RuntimeCombatBridgeSystem";
import type { GameMap } from "../shared/types/MapSchema";
import type {
  EnemyNetState,
  EnemyPositionUpdate,
  PlayerAttackPayload,
  PlayerAttackVisualPayload,
  PlayerHealRequestPayload,
  PlayerNetState,
  SharedWorldState,
  WorldEvent,
} from "../shared/types/MultiplayerSchema";
import type { MapObject, Vector3 } from "../shared/types/ObjectSchema";
import type { ItemPickupObject } from "../shared/types/ItemSchema";
import type { AudioSystem } from "./AudioSystem";
import type { FeedbackSystem } from "./FeedbackSystem";

type RuntimeMechanicsOptions = {
  onRestart: () => void;
  onEdit: () => void;
  onMenu: () => void;
  onWorldEvent?: (event: WorldEvent) => void;
  multiplayer?: MultiplayerRuntimeOptions;
  onComplete?: (coinsCollected: number) => void;
  getElapsedTime?: () => number;
};

type MultiplayerRuntimeOptions = {
  isHost: () => boolean;
  getLocalPlayerId: () => string | null;
  getRemotePlayers: () => PlayerNetState[];
  onEnemyHit: (enemyObjectId: string, damage: number, weaponId?: string) => void;
  onEnemyPositionUpdate: (enemies: EnemyPositionUpdate[]) => void;
  onPlayerAttack: (payload: PlayerAttackPayload) => void;
  onPlayerAttackVisual: (payload: PlayerAttackVisualPayload) => void;
  onPlayerDamageReport: (damage: number, source: "enemy" | "hazard" | "logic") => void;
  onPlayerHealRequest: (payload: PlayerHealRequestPayload) => void;
};

type DialogueState = {
  objectId: string;
  speaker: string;
  lines: string[];
  index: number;
};

const DEFAULT_VOID_DEATH_OFFSET = 25;
const RESPAWN_VERTICAL_OFFSET = 0.25;

export class RuntimeMechanics {
  private currentRespawnPoint: Vector3;
  private readonly voidDeathEnabled: boolean;
  private readonly voidDeathY: number;
  private readonly logicInsideObjectIds = new Set<string>();
  private readonly logicDisabledObjectIds = new Set<string>();
  private readonly runtimeSystems = new RuntimeSystemManager();
  private suppressWorldEvents = false;
  private deathCooldown = 0;
  private messageCooldown = 0;
  private activeDialogue: DialogueState | null = null;
  private isGameFinished = false;
  private readonly pickupSystem: RuntimePickupSystem;
  private readonly doorButtonSystem: RuntimeDoorButtonSystem;
  private readonly hazardCheckpointSystem: RuntimeHazardCheckpointSystem;
  private readonly movementObjectSystem: RuntimeMovementObjectSystem;
  private readonly enemySystem: RuntimeEnemySystem;
  private readonly projectileSystem: RuntimeProjectileSystem<EquippedWeapon>;
  private readonly combatBridgeSystem: RuntimeCombatBridgeSystem;
  private readonly logicRuntime: LogicRuntime;
  private readonly objectiveRuntime: ObjectiveRuntime;
  private readonly gameModeRuntime: GameModeRuntime;
  private tycoonSystem: TycoonSystem | null = null;

  constructor(
    private readonly map: GameMap,
    private readonly world: THREE.Group,
    private readonly objectViews: Map<string, THREE.Object3D>,
    private readonly player: PlayerController,
    private readonly hud: RuntimeHud,
    private readonly physicsSystem: PhysicsSystem,
    private readonly audio: AudioSystem,
    private readonly feedback: FeedbackSystem,
    private readonly options: RuntimeMechanicsOptions
  ) {
    this.currentRespawnPoint = { ...map.spawnPoint };
    this.voidDeathEnabled = map.gameplaySettings?.voidDeathEnabled !== false;
    this.voidDeathY = resolveVoidDeathY(map);
    this.physicsSystem.setCollidersFromObjects(this.map, this.objectViews);
    this.enemySystem = new RuntimeEnemySystem({
      map: this.map,
      objectViews: this.objectViews,
      physicsSystem: this.physicsSystem,
      hud: this.hud,
      audio: this.audio,
      feedback: this.feedback,
      enableLifecycleUpdate: false,
      isHost: () => this.options.multiplayer?.isHost() === true,
      isMultiplayerEnabled: () => this.isMultiplayerEnabled(),
      getLocalPlayerId: () => this.options.multiplayer?.getLocalPlayerId() ?? null,
      getRemotePlayers: () => this.options.multiplayer?.getRemotePlayers() ?? [],
      getPlayerPosition: () => this.player.getPosition(),
      isLocalPlayerAlive: () => !this.player.isDead(),
      getPlayerBounds: () => this.player.getBounds(),
      getDeathCooldown: () => this.deathCooldown,
      damagePlayer: (amount, message, position) => this.damagePlayer(amount, message, position),
      onEnemyPositionUpdate: (enemies) => this.options.multiplayer?.onEnemyPositionUpdate(enemies),
      setObjectRuntimeEnabled: (objectId, enabled) => {
        if (enabled) {
          this.logicDisabledObjectIds.delete(objectId);
        } else {
          this.logicDisabledObjectIds.add(objectId);
        }
      },
      onEnemyDefeated: (defeatedCount, totalEnemies) =>
        this.objectiveRuntime.onEnemyDefeated(defeatedCount, totalEnemies),
      onGameModeEnemyDefeated: (defeatedCount, totalEnemies) =>
        this.gameModeRuntime.onEnemyDefeated(defeatedCount, totalEnemies),
      onLogicEvent: (event) => this.logicRuntime.dispatch(event),
    });
    this.projectileSystem = new RuntimeProjectileSystem<EquippedWeapon>({
      world: this.world,
      objectViews: this.objectViews,
      enableLifecycleUpdate: false,
      getEnemyStates: () => this.enemySystem.getEnemyStates(),
      getRemotePlayers: () => this.options.multiplayer?.getRemotePlayers() ?? [],
      isMultiplayerEnabled: () => this.isMultiplayerEnabled(),
      damageEnemy: (state, amount) => this.damageEnemy(state, amount),
      onEnemyHit: (enemyObjectId, damage, weaponId) =>
        this.options.multiplayer?.onEnemyHit(enemyObjectId, damage, weaponId),
      onPlayerAttack: (payload) => this.options.multiplayer?.onPlayerAttack(payload),
    });
    this.combatBridgeSystem = new RuntimeCombatBridgeSystem({
      hud: this.hud,
      audio: this.audio,
      feedback: this.feedback,
      enableLifecycleUpdate: false,
      objectViews: this.objectViews,
      projectileSystem: this.projectileSystem,
      getEnemyStates: () => this.enemySystem.getEnemyStates(),
      getRemotePlayers: () => this.options.multiplayer?.getRemotePlayers() ?? [],
      getPlayerPosition: () => this.player.getPosition(),
      getPlayerForwardDirection: () => this.player.getForwardDirection(),
      setPlayerEquippedWeapon: (weaponId) => this.player.setEquippedWeapon(weaponId),
      playPlayerAttackFeedback: (attackType) => this.player.playAttackFeedback(attackType),
      isGameFinished: () => this.isGameFinished,
      getDeathCooldown: () => this.deathCooldown,
      getMessageCooldown: () => this.messageCooldown,
      setMessageCooldown: (cooldownSeconds) => {
        this.messageCooldown = cooldownSeconds;
      },
      isMultiplayerEnabled: () => this.isMultiplayerEnabled(),
      damageEnemy: (state, amount) => this.damageEnemy(state, amount),
      onEnemyHit: (enemyObjectId, damage, weaponId) =>
        this.options.multiplayer?.onEnemyHit(enemyObjectId, damage, weaponId),
      onPlayerAttack: (payload) => this.options.multiplayer?.onPlayerAttack(payload),
      onPlayerAttackVisual: (payload) => this.options.multiplayer?.onPlayerAttackVisual(payload),
    });
    this.pickupSystem = new RuntimePickupSystem({
      map: this.map,
      world: this.world,
      objectViews: this.objectViews,
      hud: this.hud,
      audio: this.audio,
      feedback: this.feedback,
      getPlayerBounds: () => this.player.getBounds(),
      isSharedWorldEnabled: () => this.isSharedWorldEnabled(),
      isMultiplayerEnabled: () => this.isMultiplayerEnabled(),
      emitWorldEvent: (event) => this.emitWorldEvent(event),
      onPlayerHealRequest: (payload) => this.options.multiplayer?.onPlayerHealRequest(payload),
      healPlayer: (amount) => this.healPlayer(amount),
      equipWeapon: (itemId) => this.combatBridgeSystem.equipWeapon(itemId),
      onCoinCollected: (totalCoins, amount) => {
        this.objectiveRuntime.onCoinCollected(totalCoins);
        this.gameModeRuntime.onCoinCollected(totalCoins, amount);
      },
      onKeyCollected: (keyId) => this.objectiveRuntime.onKeyCollected(keyId),
      onLogicEvent: (event) => this.logicRuntime.dispatch(event),
    });
    this.doorButtonSystem = new RuntimeDoorButtonSystem({
      map: this.map,
      objectViews: this.objectViews,
      physicsSystem: this.physicsSystem,
      hud: this.hud,
      audio: this.audio,
      feedback: this.feedback,
      hasKey: (keyId) => this.pickupSystem.hasKey(keyId),
      getKeyLabel: (keyId) => this.pickupSystem.getKeyLabel(keyId),
      showMissingKeyMessage: (keyLabel) => this.showMissingKeyMessage(keyLabel),
      emitWorldEvent: (event) => this.emitWorldEvent(event),
      onDoorOpened: (doorId) => this.objectiveRuntime.onDoorOpened(doorId),
      onButtonActivated: (objectId) => this.objectiveRuntime.onButtonActivated(objectId),
      onLogicEvent: (event) => this.logicRuntime.dispatch(event),
    });
    this.hazardCheckpointSystem = new RuntimeHazardCheckpointSystem({
      map: this.map,
      objectViews: this.objectViews,
      hud: this.hud,
      audio: this.audio,
      feedback: this.feedback,
      getPlayerBounds: () => this.player.getBounds(),
      getDeathCooldown: () => this.deathCooldown,
      setDamageCooldown: (cooldownSeconds) => {
        this.deathCooldown = cooldownSeconds;
      },
      isPlayerDead: () => this.player.isDead(),
      setRespawnPoint: (position) => {
        this.currentRespawnPoint = { ...position };
      },
      damagePlayer: (amount, message, position) => this.damagePlayer(amount, message, position),
      killPlayer: (message, position) => this.killPlayer(message, position),
    });
    this.movementObjectSystem = new RuntimeMovementObjectSystem({
      map: this.map,
      objectViews: this.objectViews,
      physicsSystem: this.physicsSystem,
      hud: this.hud,
      audio: this.audio,
      feedback: this.feedback,
      getPlayerBounds: () => this.player.getBounds(),
      getPlayerPosition: () => this.player.getPosition(),
      setPlayerPosition: (position) => this.player.setPosition(position),
      resetPlayerVelocity: () => this.player.resetVelocity(),
      applyPlayerImpulseY: (force) => this.player.applyImpulseY(force),
      playJumpPadFeedback: () => this.player.playJumpPadFeedback(),
    });
    this.runtimeSystems.register(this.hazardCheckpointSystem);
    this.runtimeSystems.register(this.movementObjectSystem);
    this.runtimeSystems.register(this.pickupSystem, {
      interactionPriority: RUNTIME_INTERACTION_PRIORITIES.pickup,
      worldEventPriority: RUNTIME_INTERACTION_PRIORITIES.pickup,
    });
    this.runtimeSystems.register(this.doorButtonSystem, {
      interactionPriority: RUNTIME_INTERACTION_PRIORITIES.doorButton,
      worldEventPriority: RUNTIME_INTERACTION_PRIORITIES.doorButton,
    });
    this.hud.setHealth(this.player.getHealth(), this.player.getMaxHealth());
    this.hud.setWeapon(null);
    this.player.setEquippedWeapon(null);
    this.logicRuntime = new LogicRuntime(this.map, {
      hasKey: (keyId) => this.pickupSystem.hasKey(keyId),
      getCoinCount: () => this.pickupSystem.getCoinCount(),
      isDoorOpen: (doorId) => this.doorButtonSystem.isDoorOpenById(doorId),
      showMessage: (message) => this.hud.showMessage(message, 2600),
      openDoor: (doorId) => this.doorButtonSystem.openDoorById(doorId),
      closeDoor: (doorId) => this.doorButtonSystem.closeDoorById(doorId),
      teleportPlayer: (targetObjectId) => this.teleportPlayerToObject(targetObjectId),
      giveCoins: (amount) => this.pickupSystem.giveCoins(amount),
      setCheckpoint: (objectId) => this.setCheckpointFromObject(objectId),
      finishMap: () => this.finishMap(),
      setObjectEnabled: (objectId, enabled) => this.setObjectEnabled(objectId, enabled),
      isEnemyDefeated: (objectId) => this.enemySystem.isEnemyDefeated(objectId),
      getDefeatedEnemyCount: () => this.enemySystem.getDefeatedEnemyCount(),
      hasWeapon: (weaponId) => this.combatBridgeSystem.hasWeapon(weaponId),
      getHealth: () => this.player.getHealth(),
      spawnEnemy: (objectId) => this.enemySystem.spawnEnemy(objectId),
      healPlayer: (amount) => {
        const healed = this.healPlayer(amount);
        this.hud.showMessage(healed > 0 ? `Vida +${Math.round(healed)}` : "Vida ja esta cheia");
      },
      damagePlayer: (amount) =>
        this.damagePlayer(amount, "Logica causou dano", this.player.getPosition(), false),
      giveWeapon: (weaponId) => {
        this.combatBridgeSystem.equipWeapon(weaponId);
        this.pickupSystem.setWeaponInventoryItem(weaponId);
        this.hud.showMessage(`${getWeaponLabel(weaponId)} equipada`);
      },
      completeObjective: (objectiveId) => this.objectiveRuntime.completeObjective(objectiveId),
      showDialogue: (objectId, message) => this.showDialogueLine(objectId, message),
      addScore: (amount) => this.gameModeRuntime.addScore(amount),
      addTeamScore: (teamId, amount) => this.gameModeRuntime.addTeamScore(teamId, amount),
      setTeam: (teamId) => this.gameModeRuntime.setTeam(teamId),
      endRound: (result) => this.gameModeRuntime.endRound(result),
      getObjectById: (objectId) =>
        this.map.objects.find((mapObject) => mapObject.id === objectId) ?? null,
      getTycoonCash: () => this.tycoonSystem?.getCash() ?? 0,
      isTycoonPurchaseCompleted: (purchaseId) =>
        this.tycoonSystem?.isPurchaseCompleted(purchaseId) ?? false,
      getTycoonUpgradeLevel: (upgradeId) => this.tycoonSystem?.getUpgradeLevel(upgradeId) ?? 0,
      getClaimedTycoonId: () => this.tycoonSystem?.getClaimedTycoonId() ?? null,
      giveTycoonCash: (amount) => this.tycoonSystem?.addCash(amount),
      removeTycoonCash: (amount) => this.tycoonSystem?.removeCash(amount),
      completeTycoonPurchase: (purchaseId) =>
        this.tycoonSystem?.completePurchaseById(purchaseId, {
          bypassCost: true,
          emitWorldEvent: true,
          showFeedback: true,
        }) ?? false,
      setTycoonGeneratorEnabled: (generatorId, enabled) =>
        this.tycoonSystem?.setGeneratorEnabled(generatorId, enabled) ?? false,
      unlockTycoonGroup: (groupId) => this.tycoonSystem?.unlockGroup(groupId) ?? false,
    });
    this.objectiveRuntime = new ObjectiveRuntime(this.map, this.hud, this.audio, this.feedback, {
      onObjectiveCompleted: (objective) => {
        this.gameModeRuntime.onObjectiveCompleted(this.objectiveRuntime.getRequiredSummary());
        this.logicRuntime.dispatch({ type: "onObjectiveCompleted", objectiveId: objective.id });
      },
    });
    this.gameModeRuntime = new GameModeRuntime(this.map, this.hud, this.objectViews, {
      onWin: (message, summary) => this.completeGame(message, summary),
      onLogicEvent: (event) => this.logicRuntime.dispatch(event),
      onTeamChanged: (team) => this.player.setTeamColor(team?.color ?? null),
    });
    this.runtimeSystems.register(this.enemySystem);
    this.runtimeSystems.register(this.projectileSystem);
    this.runtimeSystems.register(this.combatBridgeSystem);
    const tycoonSystem = new TycoonSystem(
      this.map,
      this.objectViews,
      this.physicsSystem,
      this.hud,
      this.audio,
      this.feedback,
      {
        isMultiplayer: () => this.isMultiplayerEnabled(),
        emitWorldEvent: (event) => this.emitWorldEvent(event),
        onLogicEvent: (event) => this.logicRuntime.dispatch(event),
        onPurchaseCompleted: (purchaseId) =>
          this.objectiveRuntime.onTycoonPurchaseCompleted(purchaseId),
        onCashCollected: (totalCash, amount) =>
          this.objectiveRuntime.onTycoonCashCollected(totalCash, amount),
        onCompleted: () => this.objectiveRuntime.onTycoonCompleted(),
        onProgressChanged: (summary) => this.gameModeRuntime.onTycoonProgress(summary),
      }
    );
    this.tycoonSystem = tycoonSystem;
    this.runtimeSystems.register(
      new RuntimeTycoonSystem(
        tycoonSystem,
        () => this.player.getBounds(),
        () => this.player.getPosition()
      ),
      {
        interactionPriority: RUNTIME_INTERACTION_PRIORITIES.tycoon,
        worldEventPriority: RUNTIME_INTERACTION_PRIORITIES.tycoon,
      }
    );
    this.runtimeSystems.start();
    this.currentRespawnPoint = this.gameModeRuntime.getRespawnPoint(this.currentRespawnPoint);
    this.player.setPosition(this.currentRespawnPoint);
    this.player.resetVelocity();
    this.logicRuntime.start();
  }

  dispose(): void {
    this.projectileSystem.clearProjectiles();
    this.activeDialogue = null;
    this.runtimeSystems.dispose();
  }

  update(deltaSeconds: number): void {
    if (this.isGameFinished) {
      return;
    }

    this.deathCooldown = Math.max(0, this.deathCooldown - deltaSeconds);
    this.messageCooldown = Math.max(0, this.messageCooldown - deltaSeconds);
    this.combatBridgeSystem.updateCombat(deltaSeconds);
    this.runtimeSystems.update(deltaSeconds);
    this.projectileSystem.updateProjectiles(deltaSeconds);

    if (this.updateVoidDeath()) {
      return;
    }

    const playerBounds = this.player.getBounds();

    this.enemySystem.updateEnemyBehavior(deltaSeconds, playerBounds);
    this.updateLogicObjectEntryEvents(playerBounds);
    this.gameModeRuntime.update(deltaSeconds, playerBounds, this.player.getPosition());

    if (this.isGameFinished) {
      return;
    }

    for (const mapObject of this.map.objects) {
      if (this.logicDisabledObjectIds.has(mapObject.id)) {
        continue;
      }

      if (
        mapObject.type === "checkpoint" ||
        isDamageZoneObject(mapObject) ||
        mapObject.type === "messageZone"
      ) {
        this.hazardCheckpointSystem.updateObject(mapObject, playerBounds);
      } else if (mapObject.type === "coin" || mapObject.type === "key") {
        this.pickupSystem.updateObject(mapObject, playerBounds);
      } else if (mapObject.type === "button" || mapObject.type === "door") {
        this.doorButtonSystem.updateObject(mapObject, playerBounds);
      } else if (
        mapObject.type === "disappearingBlock" ||
        mapObject.type === "jumpPad" ||
        mapObject.type === "teleporter"
      ) {
        this.movementObjectSystem.updateObject(mapObject, playerBounds, deltaSeconds);
      } else if (mapObject.type === "finish" || mapObject.type === "goal") {
        this.updateFinish(mapObject, playerBounds);
      }
    }
  }

  getInteractionHint(objectId: string): string | null {
    const runtimeHint = this.runtimeSystems.getInteractionHint(objectId);
    if (runtimeHint) {
      return runtimeHint;
    }

    const target = this.getObjectById(objectId);

    if (!target) {
      return null;
    }

    if (target.type === "npc") {
      const range = Math.max(1, getNumber(target.properties?.interactionRange, 4));
      const playerPosition = toThreeVector(this.player.getPosition());
      const targetPosition = toThreeVector(target.position);

      if (distance2DVector(playerPosition, targetPosition) > range) {
        return null;
      }

      const name = getString(target.properties?.npcName, target.name ?? "NPC");
      return `Falar com ${name}`;
    }

    return null;
  }

  interactWithObject(objectId: string): boolean {
    if (this.runtimeSystems.interactWithObject(objectId)) {
      return true;
    }

    const target = this.getObjectById(objectId);

    if (!target) {
      return false;
    }

    if (target.type === "npc") {
      return this.interactWithNpc(target);
    }

    return false;
  }

  private interactWithNpc(target: MapObject): boolean {
    if (this.activeDialogue?.objectId === target.id) {
      if (this.activeDialogue.index < this.activeDialogue.lines.length - 1) {
        this.activeDialogue.index += 1;
        this.hud.showDialogue(
          this.activeDialogue.speaker,
          this.activeDialogue.lines[this.activeDialogue.index],
          this.activeDialogue.index < this.activeDialogue.lines.length - 1
        );
      } else {
        this.activeDialogue = null;
        this.hud.hideDialogue();
      }

      return true;
    }

    const speaker = getString(target.properties?.npcName, target.name ?? "NPC");
    const lines = getNpcDialogueLines(
      target,
      target.properties?.showQuestHint !== false ? this.objectiveRuntime.getCurrentHint() : null
    );
    this.activeDialogue = {
      objectId: target.id,
      speaker,
      lines,
      index: 0,
    };
    this.audio.play("message");
    this.feedback.spawn("npc", target.position, speaker);
    this.hud.showDialogue(speaker, lines[0], lines.length > 1);
    this.logicRuntime.dispatch({ type: "onNpcInteracted", objectId: target.id });
    return true;
  }

  private showDialogueLine(objectId: string, message: string): void {
    const target = this.map.objects.find((mapObject) => mapObject.id === objectId);
    const speaker = target
      ? getString(target.properties?.npcName, target.name ?? "NPC")
      : "Sistema";
    this.activeDialogue = {
      objectId,
      speaker,
      lines: [message],
      index: 0,
    };
    this.audio.play("message");

    if (target) {
      this.feedback.spawn("npc", target.position, speaker);
    }

    this.hud.showDialogue(speaker, message, false);
  }

  attack(): boolean {
    return this.combatBridgeSystem.attack();
  }

  restart(): void {
    this.logicInsideObjectIds.clear();
    this.logicDisabledObjectIds.clear();
    this.deathCooldown = 0;
    this.messageCooldown = 0;
    this.combatBridgeSystem.reset();
    this.projectileSystem.clearProjectiles();
    this.activeDialogue = null;
    this.isGameFinished = false;
    this.currentRespawnPoint = { ...this.map.spawnPoint };
    this.hud.hideVictory();
    this.hud.hideDefeat();
    this.hud.hideDialogue();
    this.player.resetHealth();
    this.hud.setHealth(this.player.getHealth(), this.player.getMaxHealth());
    this.hud.setWeapon(null);
    this.gameModeRuntime.reset();

    for (const mapObject of this.map.objects) {
      const view = this.objectViews.get(mapObject.id);

      if (!view) {
        continue;
      }

      view.visible = true;
      applyObjectTransformToThree(view, mapObject);
      applyObjectAppearanceToThree(view, mapObject);
    }

    this.physicsSystem.setCollidersFromObjects(this.map, this.objectViews);
    this.runtimeSystems.reset();
    this.currentRespawnPoint = this.gameModeRuntime.getRespawnPoint({ ...this.map.spawnPoint });
    this.player.setPosition(this.currentRespawnPoint);
    this.player.resetVelocity();
    this.logicRuntime.reset();
    this.objectiveRuntime.reset();
    this.logicRuntime.start();
  }

  openDoorById(doorId: string, options: DoorOpenOptions = {}): boolean {
    return this.doorButtonSystem.openDoorById(doorId, options);
  }

  closeDoorById(doorId: string, options: DoorCloseOptions = {}): boolean {
    return this.doorButtonSystem.closeDoorById(doorId, options);
  }

  isDoorOpenById(doorId: string): boolean {
    return this.doorButtonSystem.isDoorOpenById(doorId);
  }

  applySharedWorldState(state: SharedWorldState): void {
    this.withSuppressedWorldEvents(() => {
      for (const doorId of state.openedDoorIds) {
        this.applyWorldEvent({ type: "doorOpened", doorId });
      }

      for (const objectId of state.activatedButtonIds) {
        this.applyWorldEvent({ type: "buttonActivated", objectId });
      }

      for (const objectId of state.collectedCoinObjectIds) {
        this.applyWorldEvent({ type: "coinCollected", objectId });
      }

      for (const objectId of state.collectedItemObjectIds) {
        this.applyWorldEvent({ type: "itemCollected", objectId });
      }

      for (const purchaseId of state.tycoonPurchasedIds ?? []) {
        this.tycoonSystem?.applySharedPurchase(purchaseId);
      }

      for (const upgradeId of state.tycoonUpgradeIds ?? []) {
        this.tycoonSystem?.applySharedUpgrade(upgradeId);
      }
    });
  }

  applyWorldEvent(event: WorldEvent): boolean {
    return this.withSuppressedWorldEvents(() => {
      if (
        event.type === "doorOpened" ||
        event.type === "doorClosed" ||
        event.type === "buttonActivated" ||
        event.type === "coinCollected" ||
        event.type === "itemCollected" ||
        event.type === "tycoonPurchase" ||
        event.type === "tycoonUpgrade"
      ) {
        return this.runtimeSystems.applyWorldEvent(event);
      }

      return false;
    });
  }

  applyEnemyState(enemies: Record<string, EnemyNetState>): void {
    for (const enemy of Object.values(enemies)) {
      this.applyEnemyUpdated(enemy, false);
    }
  }

  applyEnemyUpdated(enemy: EnemyNetState, showFeedback = true): void {
    this.enemySystem.applyEnemyUpdated(enemy, showFeedback);
  }

  applyEnemyDefeated(enemyObjectId: string, showFeedback = true): void {
    this.enemySystem.applyEnemyDefeated(enemyObjectId, showFeedback);
  }

  applyLocalPlayerHealth(health: number, message?: string, damageAmount?: number): void {
    this.player.setHealth(health, this.player.getMaxHealth());
    this.hud.setHealth(this.player.getHealth(), this.player.getMaxHealth());

    if (message) {
      this.hud.showMessage(message);
      this.player.playDamageFeedback();
      this.audio.play("damage");
      this.feedback.spawn(
        "damage",
        this.player.getPosition(),
        damageAmount && damageAmount > 0 ? `-${Math.round(damageAmount)}` : undefined
      );
    }
  }

  applyLocalPlayerHealed(health: number, amount: number): void {
    this.player.setHealth(health, this.player.getMaxHealth());
    this.hud.setHealth(this.player.getHealth(), this.player.getMaxHealth());
    this.audio.play("item");
    this.feedback.spawn("item", this.player.getPosition(), `+${Math.round(amount)}`);
    this.hud.showMessage(amount > 0 ? `Cura +${Math.round(amount)}` : "Vida atualizada");
  }

  applyLocalPlayerDefeated(message = "Voce foi derrotado. Respawn em instantes."): void {
    this.player.setHealth(0, this.player.getMaxHealth());
    this.hud.setHealth(0, this.player.getMaxHealth());
    this.hud.showMessage(message);
    this.hud.showDefeat(message, undefined, this.getSummaryWithElapsed(), 2600);
    this.player.playDamageFeedback();
    this.audio.play("death");
    this.feedback.spawn("death", this.player.getPosition());
    this.deathCooldown = Math.max(0.4, this.gameModeRuntime.getRespawnDelay());
  }

  applyLocalPlayerRespawned(position: Vector3, health: number): void {
    this.player.setHealth(health, this.player.getMaxHealth());
    this.hud.setHealth(this.player.getHealth(), this.player.getMaxHealth());
    this.player.setPosition({
      x: position.x,
      y: position.y + RESPAWN_VERTICAL_OFFSET,
      z: position.z,
    });
    this.player.resetVelocity();
    this.player.playRespawnFeedback();
    this.deathCooldown = 0;
    this.hud.hideDefeat();
    this.audio.play("checkpoint");
    this.feedback.spawn("checkpoint", position, "Respawn");
    this.hud.showMessage("Voce voltou para a arena.");
  }

  getEquippedWeaponId(): string | null {
    return this.combatBridgeSystem.getEquippedWeaponId();
  }

  applyRemoteAttackVisual(payload: PlayerAttackVisualPayload): void {
    const definition = getWeaponDefinition(payload.weaponId);
    if (!definition || definition.weaponClass !== "ranged") {
      return;
    }

    const direction = toThreeVector(payload.direction);
    if (direction.lengthSq() <= 0.0001) {
      return;
    }

    this.projectileSystem.spawnProjectile(
      payload.origin,
      direction.normalize(),
      createEquippedWeaponFromDefinition(definition),
      false
    );
  }

  getScore(): number {
    return this.gameModeRuntime.getSummary().score;
  }

  teleportPlayerToObject(targetObjectId: string): boolean {
    const target = this.map.objects.find((mapObject) => mapObject.id === targetObjectId);

    if (!target) {
      return false;
    }

    this.player.setPosition(target.position);
    this.player.resetVelocity();
    this.audio.play("teleporter");
    this.feedback.spawn("teleport", target.position);
    this.hud.showMessage("Teleporte");
    return true;
  }

  giveCoins(amount: number): void {
    this.pickupSystem.giveCoins(amount);
  }

  private damagePlayer(
    amount: number,
    message: string,
    position?: Vector3,
    emitLogicEvent = true
  ): void {
    const previousHealth = this.player.getHealth();
    const currentHealth = this.player.damage(Math.max(0, amount));
    const damageDone = Math.max(0, previousHealth - currentHealth);

    this.hud.setHealth(currentHealth, this.player.getMaxHealth());
    this.audio.play("damage");
    this.feedback.spawn(
      "damage",
      position ?? this.player.getPosition(),
      damageDone > 0 ? `-${Math.round(damageDone)}` : undefined
    );

    if (emitLogicEvent && damageDone > 0) {
      this.logicRuntime.dispatch({ type: "onPlayerDamaged", amount: damageDone });
    }

    if (this.isMultiplayerEnabled() && damageDone > 0) {
      this.options.multiplayer?.onPlayerDamageReport(damageDone, "enemy");
    }

    if (currentHealth <= 0) {
      if (this.isMultiplayerEnabled()) {
        this.hud.showMessage("Voce foi derrotado. Respawn em instantes.");
        this.hud.showDefeat("Voce foi derrotado", undefined, this.getSummaryWithElapsed(), 2600);
        this.audio.play("death");
        this.feedback.spawn("death", position ?? this.player.getPosition());
        this.gameModeRuntime.onPlayerDeath();
        this.deathCooldown = Math.max(0.4, this.gameModeRuntime.getRespawnDelay());
        return;
      }

      this.killPlayer("Voce morreu", position ?? this.player.getPosition());
      return;
    }

    if (damageDone > 0) {
      this.hud.showMessage(`${message} (-${Math.round(damageDone)})`);
    }
  }

  private healPlayer(amount: number): number {
    const previousHealth = this.player.getHealth();
    const currentHealth = this.player.heal(Math.max(0, amount));
    this.hud.setHealth(currentHealth, this.player.getMaxHealth());
    return Math.max(0, currentHealth - previousHealth);
  }

  setCheckpointFromObject(objectId: string): boolean {
    return this.hazardCheckpointSystem.setCheckpointFromObject(objectId);
  }

  finishMap(message = "Voce venceu!"): void {
    if (this.isGameFinished) {
      return;
    }

    if (
      (this.map.gameplaySettings?.requireObjectivesToFinish ||
        this.gameModeRuntime.requiresObjectivesToFinish()) &&
      !this.objectiveRuntime.areRequiredObjectivesComplete()
    ) {
      const summary = this.objectiveRuntime.getRequiredSummary();

      if (this.messageCooldown <= 0) {
        this.hud.showMessage(`Conclua os objetivos: ${summary.completed}/${summary.total}.`);
        this.messageCooldown = 1.5;
      }

      return;
    }

    this.gameModeRuntime.handleFinishReached(message, this.objectiveRuntime.getRequiredSummary());
  }

  private completeGame(message: string, summary?: GameModeSummary): void {
    if (this.isGameFinished) {
      return;
    }

    this.isGameFinished = true;
    this.options.onComplete?.(this.pickupSystem.getCoinCount());
    this.audio.play("victory");
    this.feedback.spawn("victory");
    this.hud.showVictory(
      message,
      this.pickupSystem.getCoinCount(),
      this.getRuntimeActions(),
      this.getSummaryWithElapsed(summary)
    );
  }

  private getRuntimeActions(): VictoryActions {
    return {
      onRestart: this.options.onRestart,
      onEdit: this.options.onEdit,
      onMenu: this.options.onMenu,
    };
  }

  private getSummaryWithElapsed(summary = this.gameModeRuntime.getSummary()): GameModeSummary {
    const elapsedTimeSeconds = this.options.getElapsedTime?.();

    if (typeof elapsedTimeSeconds !== "number" || !Number.isFinite(elapsedTimeSeconds)) {
      return summary;
    }

    return {
      ...summary,
      elapsedTimeSeconds,
    };
  }

  setObjectEnabled(objectId: string, enabled: boolean): boolean {
    const mapObject = this.map.objects.find((candidate) => candidate.id === objectId);
    const view = this.objectViews.get(objectId);

    if (!mapObject || !view) {
      return false;
    }

    if (enabled) {
      this.logicDisabledObjectIds.delete(objectId);
      view.visible = true;
      applyObjectTransformToThree(view, mapObject);
      applyObjectAppearanceToThree(view, mapObject);

      if (
        mapObject.type === "door" &&
        this.isDoorOpenById(getString(mapObject.properties?.doorId, mapObject.id))
      ) {
        this.physicsSystem.removeCollider(mapObject.id);
      } else {
        this.physicsSystem.updateColliderForObject(mapObject, view);
      }
    } else {
      this.logicDisabledObjectIds.add(objectId);
      this.logicInsideObjectIds.delete(objectId);
      view.visible = false;
      this.physicsSystem.removeCollider(objectId);
    }

    return true;
  }

  private updateLogicObjectEntryEvents(playerBounds: THREE.Box3): void {
    for (const mapObject of this.map.objects) {
      if (this.logicDisabledObjectIds.has(mapObject.id)) {
        this.logicInsideObjectIds.delete(mapObject.id);
        continue;
      }

      const inside = this.intersects(mapObject, playerBounds);

      if (!inside) {
        this.logicInsideObjectIds.delete(mapObject.id);
        continue;
      }

      if (this.logicInsideObjectIds.has(mapObject.id)) {
        continue;
      }

      this.logicInsideObjectIds.add(mapObject.id);
      this.objectiveRuntime.onObjectReached(mapObject.id);
      this.logicRuntime.dispatch({ type: "onPlayerEnterObject", objectId: mapObject.id });
    }
  }

  private updateFinish(mapObject: MapObject, playerBounds: THREE.Box3): void {
    if (!this.intersects(mapObject, playerBounds)) {
      return;
    }

    this.objectiveRuntime.onObjectReached(mapObject.id);

    if (
      mapObject.properties?.requiresAllCoins &&
      this.pickupSystem.getCollectedCoinCount() < this.pickupSystem.getTotalCoinObjects()
    ) {
      if (this.messageCooldown <= 0) {
        this.hud.showMessage("Colete todas as moedas para finalizar.");
        this.messageCooldown = 1.5;
      }

      return;
    }

    const message = getString(mapObject.properties?.message, "Voce venceu!");
    this.finishMap(message);
  }

  private damageEnemy(state: EnemyRuntimeState, amount: number): void {
    const view = this.objectViews.get(state.mapObject.id);
    const hitPosition = view ? fromThreeVector(view.position) : state.mapObject.position;
    state.health = clampEnemyHealth(state.health - Math.max(0, amount), state.maxHealth);
    this.audio.play("hit");
    this.feedback.spawn("damage", hitPosition, `-${Math.round(amount)}`);

    if (state.health > 0) {
      this.hud.showMessage(`Inimigo: ${Math.ceil(state.health)}/${state.maxHealth}`);
      return;
    }

    this.enemySystem.applyEnemyDefeated(state.mapObject.id);
  }

  private updateVoidDeath(): boolean {
    if (!this.voidDeathEnabled || this.deathCooldown > 0) {
      return false;
    }

    const playerPosition = this.player.getPosition();

    if (playerPosition.y > this.voidDeathY) {
      return false;
    }

    this.killPlayer("Voce caiu no vazio", playerPosition);
    return true;
  }

  private killPlayer(message: string, position: Vector3): void {
    if (this.deathCooldown > 0) {
      return;
    }

    this.player.damage(this.player.getMaxHealth());
    this.hud.setHealth(this.player.getHealth(), this.player.getMaxHealth());
    this.hud.showMessage(message);
    this.audio.play("death");
    this.feedback.spawn("death", position);
    this.gameModeRuntime.onPlayerDeath();
    this.respawnPlayer();
    this.hud.showDefeat(message, this.getRuntimeActions(), this.getSummaryWithElapsed(), 3200);
  }

  private respawnPlayer(): void {
    this.deathCooldown = Math.max(0.2, this.gameModeRuntime.getRespawnDelay());
    this.player.resetHealth();
    this.hud.setHealth(this.player.getHealth(), this.player.getMaxHealth());
    const respawnPoint = this.gameModeRuntime.getRespawnPoint(this.currentRespawnPoint);
    this.player.setPosition({
      x: respawnPoint.x,
      y: respawnPoint.y + RESPAWN_VERTICAL_OFFSET,
      z: respawnPoint.z,
    });
    this.player.resetVelocity();
    this.player.playRespawnFeedback();
  }

  private showMissingKeyMessage(keyLabel: string | null): void {
    if (this.messageCooldown > 0) {
      return;
    }

    this.hud.showMessage(
      keyLabel ? `Voce precisa da chave: ${keyLabel}` : "Voce precisa de uma chave."
    );
    this.messageCooldown = 1.1;
  }

  private intersects(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    const view = this.objectViews.get(mapObject.id);

    if (!view || !view.visible) {
      return false;
    }

    const objectBounds = new THREE.Box3().setFromObject(view);
    objectBounds.expandByScalar(0.18);
    return objectBounds.intersectsBox(playerBounds);
  }

  private getObjectById(objectId: string): MapObject | ItemPickupObject | null {
    return (
      this.pickupSystem.getRuntimePickup(objectId) ??
      this.map.objects.find((mapObject) => mapObject.id === objectId) ??
      null
    );
  }

  private isSharedWorldEnabled(): boolean {
    return typeof this.options.onWorldEvent === "function";
  }

  private isMultiplayerEnabled(): boolean {
    return Boolean(this.options.multiplayer);
  }

  private emitWorldEvent(event: WorldEvent): void {
    if (this.suppressWorldEvents) {
      return;
    }

    this.options.onWorldEvent?.(event);
  }

  private withSuppressedWorldEvents<T>(callback: () => T): T {
    const previous = this.suppressWorldEvents;
    this.suppressWorldEvents = true;

    try {
      return callback();
    } finally {
      this.suppressWorldEvents = previous;
    }
  }
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function resolveVoidDeathY(map: GameMap): number {
  const configuredY = map.gameplaySettings?.voidDeathY;

  if (typeof configuredY === "number" && Number.isFinite(configuredY)) {
    return configuredY;
  }

  return map.spawnPoint.y - DEFAULT_VOID_DEATH_OFFSET;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function getNpcDialogueLines(mapObject: MapObject, objectiveHint: string | null): string[] {
  const dialogue = getStringArray(mapObject.properties?.dialogue);
  const legacyDialog = getString(mapObject.properties?.dialog, "");
  const lines =
    dialogue.length > 0 ? dialogue : legacyDialog.trim().length > 0 ? [legacyDialog] : ["Ola!"];

  if (!objectiveHint) {
    return lines;
  }

  return [...lines, `Objetivo atual: ${objectiveHint}`];
}

function toThreeVector(vector: Vector3): THREE.Vector3 {
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

function fromThreeVector(vector: THREE.Vector3): Vector3 {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

function distance2DVector(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
