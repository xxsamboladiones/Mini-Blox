import * as THREE from "three";
import { getWeaponDefinition, getWeaponLabel, normalizeWeaponId } from "../shared/ItemCatalog";
import {
  applyObjectAppearanceToThree,
  applyObjectTransformToThree,
  disposeObject3D,
} from "./ObjectFactory";
import { PhysicsSystem } from "./PhysicsSystem";
import { PlayerController } from "./PlayerController";
import { RuntimeHud, type GameModeSummary, type VictoryActions } from "./RuntimeHud";
import { createWeaponProjectileVisual } from "./WeaponVisualFactory";
import { LogicRuntime } from "./LogicRuntime";
import { ObjectiveRuntime } from "./ObjectiveRuntime";
import { GameModeRuntime } from "./GameModeRuntime";
import {
  clampEnemyHealth,
  getEnemyRuntimeConfig,
  isEnemyAlive,
  shouldEnemyAttackPlayer,
} from "./mechanics/EnemyMechanics";
import {
  isDamageZoneObject,
} from "./mechanics/DamageZoneMechanics";
import { TycoonSystem } from "./mechanics/TycoonSystem";
import {
  advanceProjectile,
  createProjectile,
  isProjectileExpired,
  isProjectileNearPosition,
  type ActiveProjectile,
} from "./mechanics/ProjectileMechanics";
import { RuntimeCombatSystem } from "./runtime/RuntimeCombatSystem";
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
import type {
  ItemPickupObject,
  WeaponAttackType,
  WeaponClass,
  WeaponDefinition,
} from "../shared/types/ItemSchema";
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

type EnemyRuntimeState = {
  mapObject: MapObject;
  spawnPosition: THREE.Vector3;
  health: number;
  maxHealth: number;
  attackCooldown: number;
  patrolTarget: 0 | 1;
  targetPosition: THREE.Vector3;
  targetRotationY: number;
  netState: EnemyNetState["state"];
};

type EquippedWeapon = {
  id: string;
  itemId: string;
  label: string;
  weaponClass: WeaponClass;
  attackType: WeaponAttackType;
  damage: number;
  range: number;
  cooldown: number;
  projectileSpeed: number;
  coneDot: number;
};

type DialogueState = {
  objectId: string;
  speaker: string;
  lines: string[];
  index: number;
};

const DEFAULT_VOID_DEATH_OFFSET = 25;
const RESPAWN_VERTICAL_OFFSET = 0.25;
const UP = new THREE.Vector3(0, 1, 0);
const DEFAULT_WEAPON: EquippedWeapon = {
  id: "basic_sword",
  itemId: "weapon_basic",
  label: "Espada Basica",
  weaponClass: "melee",
  attackType: "slash",
  damage: 18,
  range: 1.85,
  cooldown: 0.65,
  projectileSpeed: 0,
  coneDot: 0.18,
};

export class RuntimeMechanics {
  private currentRespawnPoint: Vector3;
  private readonly voidDeathEnabled: boolean;
  private readonly voidDeathY: number;
  private readonly logicInsideObjectIds = new Set<string>();
  private readonly logicDisabledObjectIds = new Set<string>();
  private readonly defeatedEnemyIds = new Set<string>();
  private readonly combatSystem = new RuntimeCombatSystem();
  private readonly runtimeSystems = new RuntimeSystemManager();
  private readonly activeProjectiles = new Map<string, ActiveProjectile<EquippedWeapon>>();
  private projectileSequence = 0;
  private readonly enemyStates = new Map<string, EnemyRuntimeState>();
  private suppressWorldEvents = false;
  private deathCooldown = 0;
  private messageCooldown = 0;
  private enemySyncAccumulator = 0;
  private equippedWeapon: EquippedWeapon | null = null;
  private activeDialogue: DialogueState | null = null;
  private allEnemiesDefeatedDispatched = false;
  private isGameFinished = false;
  private readonly pickupSystem: RuntimePickupSystem;
  private readonly doorButtonSystem: RuntimeDoorButtonSystem;
  private readonly hazardCheckpointSystem: RuntimeHazardCheckpointSystem;
  private readonly movementObjectSystem: RuntimeMovementObjectSystem;
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
    this.initializeBehaviorStates();
    this.physicsSystem.setCollidersFromObjects(this.map, this.objectViews);
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
      equipWeapon: (itemId) => this.equipWeapon(itemId),
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
      isEnemyDefeated: (objectId) => this.defeatedEnemyIds.has(objectId),
      getDefeatedEnemyCount: () => this.defeatedEnemyIds.size,
      hasWeapon: (weaponId) => this.hasWeapon(weaponId),
      getHealth: () => this.player.getHealth(),
      spawnEnemy: (objectId) => this.spawnEnemy(objectId),
      healPlayer: (amount) => {
        const healed = this.healPlayer(amount);
        this.hud.showMessage(healed > 0 ? `Vida +${Math.round(healed)}` : "Vida ja esta cheia");
      },
      damagePlayer: (amount) =>
        this.damagePlayer(amount, "Logica causou dano", this.player.getPosition(), false),
      giveWeapon: (weaponId) => {
        this.equipWeapon(weaponId);
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
    this.clearProjectiles();
    this.enemyStates.clear();
    this.activeDialogue = null;
    this.runtimeSystems.dispose();
  }

  update(deltaSeconds: number): void {
    if (this.isGameFinished) {
      return;
    }

    this.deathCooldown = Math.max(0, this.deathCooldown - deltaSeconds);
    this.messageCooldown = Math.max(0, this.messageCooldown - deltaSeconds);
    this.combatSystem.update(deltaSeconds);
    this.updateWeaponCooldownHud();
    this.runtimeSystems.update(deltaSeconds);
    this.updateProjectiles(deltaSeconds);

    if (this.updateVoidDeath()) {
      return;
    }

    const playerBounds = this.player.getBounds();

    this.updateEnemies(deltaSeconds, playerBounds);
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
    if (this.isGameFinished || this.deathCooldown > 0) {
      return false;
    }

    if (!this.equippedWeapon) {
      if (this.messageCooldown <= 0) {
        this.hud.showMessage("Pegue uma arma para atacar.");
        this.messageCooldown = 1;
      }

      return false;
    }

    if (!this.combatSystem.canAttack()) {
      return false;
    }

    const weapon = this.equippedWeapon;
    const direction = this.player.getForwardDirection();
    const origin = this.getAttackOrigin(direction);
    this.combatSystem.beginAttack(weapon);
    this.updateWeaponCooldownHud();
    this.audio.play(weapon.attackType === "shoot" ? "blaster" : "attack");
    this.player.playAttackFeedback(weapon.attackType);
    this.feedback.spawn("attack", this.player.getPosition());

    if (this.isMultiplayerEnabled()) {
      this.options.multiplayer?.onPlayerAttackVisual({
        weaponId: weapon.id,
        attackType: weapon.attackType,
        origin,
        direction: fromThreeVector(direction),
      });
    }

    if (weapon.weaponClass === "ranged") {
      this.spawnProjectile(origin, direction, weapon, true);
      return true;
    }

    const hit = this.findEnemyInAttackRange(weapon.range, weapon.coneDot);

    if (hit) {
      if (this.isMultiplayerEnabled()) {
        this.options.multiplayer?.onEnemyHit(hit.mapObject.id, weapon.damage, weapon.id);
      } else {
        this.damageEnemy(hit, weapon.damage);
      }
      return true;
    }

    if (this.isMultiplayerEnabled()) {
      const remoteHit = this.findRemotePlayerInAttackRange(weapon.range, weapon.coneDot);
      if (remoteHit) {
        this.options.multiplayer?.onPlayerAttack({
          weaponId: weapon.id,
          origin,
          direction: fromThreeVector(direction),
          range: weapon.range,
          damage: weapon.damage,
          targetPlayerId: remoteHit.id,
          attackType: weapon.attackType,
        });
      }
    }

    return true;
  }

  restart(): void {
    this.logicInsideObjectIds.clear();
    this.logicDisabledObjectIds.clear();
    this.defeatedEnemyIds.clear();
    this.deathCooldown = 0;
    this.messageCooldown = 0;
    this.combatSystem.reset();
    this.enemySyncAccumulator = 0;
    this.equippedWeapon = null;
    this.player.setEquippedWeapon(null);
    this.clearProjectiles();
    this.activeDialogue = null;
    this.allEnemiesDefeatedDispatched = false;
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

    this.initializeBehaviorStates();
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
    const state = this.enemyStates.get(enemy.objectId);
    const view = this.objectViews.get(enemy.objectId);

    if (!state || !view) {
      return;
    }

    const wasAlive = isEnemyAlive(state.health, view.visible);
    const previousHealth = state.health;
    state.health = clampEnemyHealth(enemy.health, enemy.maxHealth);
    state.maxHealth = Math.max(1, enemy.maxHealth);
    state.netState = enemy.state;
    state.targetPosition.set(enemy.position.x, enemy.position.y, enemy.position.z);
    state.targetRotationY = enemy.rotationY;

    if (this.options.multiplayer?.isHost()) {
      view.position.copy(state.targetPosition);
      view.rotation.y = state.targetRotationY;
    }

    if (!enemy.alive || state.health <= 0 || enemy.state === "dead") {
      this.applyEnemyDefeated(enemy.objectId, showFeedback && wasAlive);
      return;
    }

    view.visible = true;
    if (showFeedback && wasAlive && state.health < previousHealth) {
      const damageDone = previousHealth - state.health;
      this.audio.play("hit");
      this.feedback.spawn("damage", fromThreeVector(view.position), `-${Math.ceil(damageDone)}`);
      this.hud.showMessage(`Inimigo: ${Math.ceil(state.health)}/${state.maxHealth}`);
    }
  }

  applyEnemyDefeated(enemyObjectId: string, showFeedback = true): void {
    const state = this.enemyStates.get(enemyObjectId);
    const view = this.objectViews.get(enemyObjectId);

    if (!state || this.defeatedEnemyIds.has(enemyObjectId)) {
      return;
    }

    state.health = 0;
    state.netState = "dead";
    if (view) {
      view.visible = false;
      this.physicsSystem.removeCollider(enemyObjectId);
    }

    this.defeatedEnemyIds.add(enemyObjectId);

    if (showFeedback) {
      this.hud.showMessage("Inimigo derrotado");
      this.audio.play("item");
      this.feedback.spawn(
        "item",
        view ? fromThreeVector(view.position) : state.mapObject.position,
        "Inimigo -"
      );
    }

    this.dispatchEnemyDefeated(enemyObjectId);
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
    return this.equippedWeapon?.id ?? null;
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

    this.spawnProjectile(
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

  private equipWeapon(itemId: string): void {
    const definition = getWeaponDefinition(itemId);
    const weapon = definition ? createEquippedWeaponFromDefinition(definition) : DEFAULT_WEAPON;

    this.equippedWeapon = weapon;
    this.player.setEquippedWeapon(weapon.id);
    this.hud.setWeapon({
      label: weapon.label,
      typeLabel: getWeaponHudTypeLabel(weapon),
      cooldownProgress: 1,
    });
  }

  private hasWeapon(weaponId: string): boolean {
    return this.equippedWeapon?.id === normalizeWeaponId(weaponId);
  }

  private spawnEnemy(objectId: string): boolean {
    const state = this.enemyStates.get(objectId);
    const view = this.objectViews.get(objectId);

    if (!state || !view) {
      return false;
    }

    const config = getEnemyRuntimeConfig(state.mapObject);
    const maxHealth = config.maxHealth;
    state.health = maxHealth;
    state.maxHealth = maxHealth;
    state.attackCooldown = 0;
    state.patrolTarget = 1;
    state.targetPosition.copy(state.spawnPosition);
    state.targetRotationY = getNumber(state.mapObject.rotation?.y, 0);
    state.netState = config.behavior;
    view.visible = true;
    applyObjectTransformToThree(view, state.mapObject);
    applyObjectAppearanceToThree(view, state.mapObject);
    this.logicDisabledObjectIds.delete(objectId);
    this.defeatedEnemyIds.delete(objectId);
    this.allEnemiesDefeatedDispatched = false;
    this.feedback.spawn("item", state.mapObject.position, "Inimigo");
    this.hud.showMessage("Inimigo reativado");
    return true;
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

  private initializeBehaviorStates(): void {
    this.enemyStates.clear();

    for (const mapObject of this.map.objects) {
      if (mapObject.type === "enemy") {
        const view = this.objectViews.get(mapObject.id);
        const config = getEnemyRuntimeConfig(mapObject);
        const maxHealth = config.maxHealth;

        if (view) {
          view.visible = true;
          applyObjectTransformToThree(view, mapObject);
          applyObjectAppearanceToThree(view, mapObject);
        }

        this.enemyStates.set(mapObject.id, {
          mapObject,
          spawnPosition: toThreeVector(mapObject.position),
          health: maxHealth,
          maxHealth,
          attackCooldown: 0,
          patrolTarget: 1,
          targetPosition: toThreeVector(mapObject.position),
          targetRotationY: getNumber(mapObject.rotation?.y, 0),
          netState: config.behavior,
        });
      }
    }
  }

  private updateEnemies(deltaSeconds: number, playerBounds: THREE.Box3): void {
    const playerPosition = toThreeVector(this.player.getPosition());
    const isMultiplayer = this.isMultiplayerEnabled();
    const isHost = isMultiplayer && this.options.multiplayer?.isHost() === true;
    const shouldSyncEnemyPositions = isHost && (this.enemySyncAccumulator += deltaSeconds) >= 0.14;
    const enemyPositionUpdates: EnemyPositionUpdate[] = [];

    for (const state of this.enemyStates.values()) {
      const view = this.objectViews.get(state.mapObject.id);

      if (!view || !view.visible || state.health <= 0) {
        continue;
      }

      state.attackCooldown = Math.max(0, state.attackCooldown - deltaSeconds);
      const config = getEnemyRuntimeConfig(state.mapObject);
      let target: THREE.Vector3 | null = null;
      let targetPlayerId: string | undefined;

      if (isMultiplayer && !isHost) {
        this.interpolateEnemyView(state, view, deltaSeconds);
      } else {
        if (config.behavior === "chase") {
          const targetCandidate = this.getClosestEnemyTarget(view.position, config.detectionRange);
          if (targetCandidate) {
            target = toThreeVector(targetCandidate.position);
            targetPlayerId = targetCandidate.playerId;
          }
        } else if (config.behavior === "patrol") {
          const patrolOffset = getThreeVector(state.mapObject.properties?.patrolOffset, {
            x: 4,
            y: 0,
            z: 0,
          });
          target =
            state.patrolTarget === 1
              ? state.spawnPosition.clone().add(patrolOffset)
              : state.spawnPosition.clone();

          if (distance2DVector(view.position, target) <= 0.22) {
            state.patrolTarget = state.patrolTarget === 1 ? 0 : 1;
          }
        }

        if (target && config.speed > 0) {
          const direction = target.clone().sub(view.position);
          direction.y = 0;

          if (direction.lengthSq() > 0.0001) {
            direction.normalize();
            const step = Math.min(
              config.speed * deltaSeconds,
              distance2DVector(view.position, target)
            );
            view.position.addScaledVector(direction, step);
            view.position.y = state.spawnPosition.y;
            view.rotation.y = Math.atan2(direction.x, direction.z) + Math.PI;
          }
        }

        state.targetPosition.copy(view.position);
        state.targetRotationY = view.rotation.y;
        state.netState = target ? config.behavior : "idle";

        if (shouldSyncEnemyPositions) {
          enemyPositionUpdates.push({
            objectId: state.mapObject.id,
            position: fromThreeVector(view.position),
            rotationY: view.rotation.y,
            state: state.netState,
            targetPlayerId,
          });
        }
      }

      const enemyBounds = new THREE.Box3().setFromObject(view);
      enemyBounds.expandByScalar(0.1);
      const distanceToPlayer = distance2DVector(view.position, playerPosition);

      if (
        shouldEnemyAttackPlayer({
          distanceToPlayer,
          attackRange: config.attackRange,
          intersectsPlayer: enemyBounds.intersectsBox(playerBounds),
          attackCooldown: state.attackCooldown,
          deathCooldown: this.deathCooldown,
        })
      ) {
        state.attackCooldown = config.attackCooldown;
        this.damagePlayer(config.damage, "Inimigo causou dano", state.mapObject.position);
      }
    }

    if (shouldSyncEnemyPositions) {
      this.enemySyncAccumulator = 0;
      if (enemyPositionUpdates.length > 0) {
        this.options.multiplayer?.onEnemyPositionUpdate(enemyPositionUpdates);
      }
    }
  }

  private findEnemyInAttackRange(range: number, coneDot: number): EnemyRuntimeState | null {
    const playerPosition = toThreeVector(this.player.getPosition());
    const facing = this.player.getForwardDirection();
    let bestState: EnemyRuntimeState | null = null;
    let bestDistance = Infinity;

    for (const state of this.enemyStates.values()) {
      const view = this.objectViews.get(state.mapObject.id);

      if (!view || !view.visible || state.health <= 0) {
        continue;
      }

      const offsetToEnemy = view.position.clone().sub(playerPosition);
      offsetToEnemy.y = 0;
      const distance = offsetToEnemy.length();

      if (distance > range + 0.7 || distance <= 0.0001) {
        continue;
      }

      const dot = offsetToEnemy.clone().normalize().dot(facing);

      if (dot < coneDot && distance > 0.85) {
        continue;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        bestState = state;
      }
    }

    return bestState;
  }

  private findRemotePlayerInAttackRange(range: number, coneDot: number): PlayerNetState | null {
    const playerPosition = toThreeVector(this.player.getPosition());
    const facing = this.player.getForwardDirection();
    let bestPlayer: PlayerNetState | null = null;
    let bestDistance = Infinity;

    for (const remotePlayer of this.options.multiplayer?.getRemotePlayers() ?? []) {
      if (!remotePlayer.isAlive) {
        continue;
      }

      const offsetToPlayer = toThreeVector(remotePlayer.position).sub(playerPosition);
      offsetToPlayer.y = 0;
      const distance = offsetToPlayer.length();

      if (distance > range + 0.7 || distance <= 0.0001) {
        continue;
      }

      const dot = offsetToPlayer.clone().normalize().dot(facing);
      if (dot < coneDot && distance > 0.85) {
        continue;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        bestPlayer = remotePlayer;
      }
    }

    return bestPlayer;
  }

  private spawnProjectile(
    origin: Vector3,
    direction: THREE.Vector3,
    weapon: EquippedWeapon,
    local: boolean
  ): void {
    const mesh = createWeaponProjectileVisual(weapon.id);
    const id = `projectile-${Date.now()}-${this.projectileSequence++}`;
    const projectile = createProjectile(id, mesh, origin, direction, weapon, local);

    if (!projectile) {
      disposeObject3D(mesh);
      return;
    }

    this.world.add(mesh);
    this.activeProjectiles.set(id, projectile);
  }

  private updateProjectiles(deltaSeconds: number): void {
    if (this.activeProjectiles.size === 0) {
      return;
    }

    const removeIds: string[] = [];

    for (const projectile of this.activeProjectiles.values()) {
      advanceProjectile(projectile, deltaSeconds);

      if (projectile.local) {
        const enemyHit = this.findEnemyHitByProjectile(projectile);
        if (enemyHit) {
          if (this.isMultiplayerEnabled()) {
            this.options.multiplayer?.onEnemyHit(
              enemyHit.mapObject.id,
              projectile.weapon.damage,
              projectile.weapon.id
            );
          } else {
            this.damageEnemy(enemyHit, projectile.weapon.damage);
          }
          removeIds.push(projectile.id);
          continue;
        }

        if (this.isMultiplayerEnabled()) {
          const remoteHit = this.findRemotePlayerHitByProjectile(projectile);
          if (remoteHit) {
            this.options.multiplayer?.onPlayerAttack({
              weaponId: projectile.weapon.id,
              origin: projectile.origin,
              direction: fromThreeVector(projectile.direction),
              range: projectile.weapon.range,
              damage: projectile.weapon.damage,
              targetPlayerId: remoteHit.id,
              attackType: projectile.weapon.attackType,
            });
            removeIds.push(projectile.id);
            continue;
          }
        }
      }

      if (isProjectileExpired(projectile)) {
        removeIds.push(projectile.id);
      }
    }

    for (const id of removeIds) {
      this.removeProjectile(id);
    }
  }

  private findEnemyHitByProjectile(projectile: ActiveProjectile): EnemyRuntimeState | null {
    let closest: EnemyRuntimeState | null = null;
    let closestDistance = Infinity;

    for (const state of this.enemyStates.values()) {
      const view = this.objectViews.get(state.mapObject.id);
      if (!view || !view.visible || state.health <= 0) {
        continue;
      }

      if (!isProjectileNearPosition(projectile.mesh.position, view.position, 0.72, 1.7)) {
        continue;
      }

      const horizontalDistance = distance2DVector(projectile.mesh.position, view.position);
      if (horizontalDistance < closestDistance) {
        closestDistance = horizontalDistance;
        closest = state;
      }
    }

    return closest;
  }

  private findRemotePlayerHitByProjectile(projectile: ActiveProjectile): PlayerNetState | null {
    let closest: PlayerNetState | null = null;
    let closestDistance = Infinity;

    for (const remotePlayer of this.options.multiplayer?.getRemotePlayers() ?? []) {
      if (!remotePlayer.isAlive) {
        continue;
      }

      const remotePosition = toThreeVector(remotePlayer.position);
      remotePosition.y += 0.9;
      if (!isProjectileNearPosition(projectile.mesh.position, remotePosition, 0.68, 1.35)) {
        continue;
      }

      const horizontalDistance = distance2DVector(projectile.mesh.position, remotePosition);
      if (horizontalDistance < closestDistance) {
        closestDistance = horizontalDistance;
        closest = remotePlayer;
      }
    }

    return closest;
  }

  private removeProjectile(projectileId: string): void {
    const projectile = this.activeProjectiles.get(projectileId);
    if (!projectile) {
      return;
    }

    this.world.remove(projectile.mesh);
    disposeObject3D(projectile.mesh);
    this.activeProjectiles.delete(projectileId);
  }

  private clearProjectiles(): void {
    for (const projectileId of [...this.activeProjectiles.keys()]) {
      this.removeProjectile(projectileId);
    }
  }

  private getAttackOrigin(direction: THREE.Vector3): Vector3 {
    const position = toThreeVector(this.player.getPosition());
    const forward = direction.clone();
    forward.y = 0;

    if (forward.lengthSq() <= 0.0001) {
      forward.set(0, 0, -1);
    }

    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize();
    position.addScaledVector(forward, 0.72);
    position.addScaledVector(right, 0.24);
    position.y += 1.08;
    return fromThreeVector(position);
  }

  private updateWeaponCooldownHud(): void {
    if (!this.equippedWeapon) {
      return;
    }

    const progress = this.combatSystem.getWeaponCooldownProgress(this.equippedWeapon);
    this.hud.setWeaponCooldown(progress);
  }

  private interpolateEnemyView(
    state: EnemyRuntimeState,
    view: THREE.Object3D,
    deltaSeconds: number
  ): void {
    const alpha = Math.min(1, deltaSeconds * 8);
    view.position.lerp(state.targetPosition, alpha);
    view.rotation.y = THREE.MathUtils.lerp(view.rotation.y, state.targetRotationY, alpha);
  }

  private getClosestEnemyTarget(
    enemyPosition: THREE.Vector3,
    detectionRange: number
  ): { playerId?: string; position: Vector3 } | null {
    const localPlayerId = this.options.multiplayer?.getLocalPlayerId() ?? undefined;
    const candidates: Array<{ playerId?: string; position: Vector3; alive: boolean }> = [
      {
        playerId: localPlayerId,
        position: this.player.getPosition(),
        alive: !this.player.isDead(),
      },
      ...(this.options.multiplayer?.getRemotePlayers() ?? []).map((player) => ({
        playerId: player.id,
        position: player.position,
        alive: player.isAlive,
      })),
    ];
    let best: { playerId?: string; position: Vector3 } | null = null;
    let bestDistance = Infinity;

    for (const candidate of candidates) {
      if (!candidate.alive) {
        continue;
      }

      const distance = distance2DVector(enemyPosition, toThreeVector(candidate.position));
      if (distance <= detectionRange && distance < bestDistance) {
        bestDistance = distance;
        best = { playerId: candidate.playerId, position: candidate.position };
      }
    }

    return best;
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

    if (view) {
      view.visible = false;
    }

    this.physicsSystem.removeCollider(state.mapObject.id);
    this.defeatedEnemyIds.add(state.mapObject.id);
    this.hud.showMessage("Inimigo derrotado");
    this.audio.play("item");
    this.feedback.spawn("item", hitPosition, "Inimigo -");
    this.dispatchEnemyDefeated(state.mapObject.id);
  }

  private dispatchEnemyDefeated(objectId: string): void {
    const totalEnemies = this.getTotalEnemyObjects();
    this.objectiveRuntime.onEnemyDefeated(this.defeatedEnemyIds.size, totalEnemies);
    this.gameModeRuntime.onEnemyDefeated(this.defeatedEnemyIds.size, totalEnemies);
    this.logicRuntime.dispatch({ type: "onEnemyDefeated", objectId });
    this.logicRuntime.dispatch({ type: "onAnyEnemyDefeated", objectId });

    if (
      totalEnemies > 0 &&
      !this.allEnemiesDefeatedDispatched &&
      this.defeatedEnemyIds.size >= totalEnemies
    ) {
      this.allEnemiesDefeatedDispatched = true;
      this.logicRuntime.dispatch({ type: "onAllEnemiesDefeated" });
    }
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

  private getTotalEnemyObjects(): number {
    return this.map.objects.filter((mapObject) => mapObject.type === "enemy").length;
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

function createEquippedWeaponFromDefinition(definition: WeaponDefinition): EquippedWeapon {
  return {
    id: definition.combatId,
    itemId: definition.id === "sword" ? "weapon_basic" : definition.id,
    label: definition.name,
    weaponClass: definition.weaponClass,
    attackType: definition.attackType,
    damage: definition.damage,
    range: definition.range,
    cooldown: definition.cooldown,
    projectileSpeed: Math.max(0, definition.projectileSpeed ?? 0),
    coneDot: Math.max(-1, Math.min(1, definition.coneDot ?? 0.18)),
  };
}

function getWeaponHudTypeLabel(weapon: EquippedWeapon): string {
  const mode = weapon.weaponClass === "ranged" ? "Ranged" : "Melee";
  return `${mode} - ${weapon.damage} dmg - ${weapon.cooldown.toFixed(2)}s`;
}

function getVector(value: unknown, fallback: Vector3): Vector3 {
  if (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    "z" in value &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    typeof value.z === "number"
  ) {
    return { x: value.x, y: value.y, z: value.z };
  }

  return { ...fallback };
}

function getThreeVector(value: unknown, fallback: Vector3): THREE.Vector3 {
  const vector = getVector(value, fallback);
  return toThreeVector(vector);
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
