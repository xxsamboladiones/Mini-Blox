import * as THREE from "three";
import { getItemDefinition, getItemLabel } from "../shared/ItemCatalog";
import {
  applyObjectAppearanceToThree,
  applyObjectTransformToThree,
  createMapObject3D,
  disposeObject3D
} from "./ObjectFactory";
import { PhysicsSystem } from "./PhysicsSystem";
import { PlayerController } from "./PlayerController";
import { RuntimeHud, type VictoryActions } from "./RuntimeHud";
import { LogicRuntime } from "./LogicRuntime";
import { ObjectiveRuntime } from "./ObjectiveRuntime";
import type { GameMap } from "../shared/types/MapSchema";
import type { MapObject, Vector3 } from "../shared/types/ObjectSchema";
import type { InventoryItem, ItemPickupObject, ItemSpawnMode } from "../shared/types/ItemSchema";
import type { AudioSystem } from "./AudioSystem";
import type { FeedbackSystem } from "./FeedbackSystem";

type RuntimeMechanicsOptions = {
  onRestart: () => void;
  onEdit: () => void;
  onMenu: () => void;
  onComplete?: (coinsCollected: number) => void;
};

type ItemSpawnerRuntimeState = {
  spawner: MapObject;
  activePickupIds: Set<string>;
  cooldown: number;
};

type MovingPlatformRuntimeState = {
  mapObject: MapObject;
  basePosition: THREE.Vector3;
  startOffset: THREE.Vector3;
  endOffset: THREE.Vector3;
  progress: number;
  direction: 1 | -1;
};

type DisappearingBlockRuntimeState = {
  mapObject: MapObject;
  phase: "idle" | "waiting" | "hidden";
  timer: number;
};

type EnemyRuntimeState = {
  mapObject: MapObject;
  spawnPosition: THREE.Vector3;
  health: number;
  maxHealth: number;
  attackCooldown: number;
  patrolTarget: 0 | 1;
};

type EquippedWeapon = {
  id: string;
  label: string;
  damage: number;
  range: number;
  cooldown: number;
};

type DialogueState = {
  objectId: string;
  speaker: string;
  lines: string[];
  index: number;
};

const DEFAULT_VOID_DEATH_OFFSET = 25;
const RESPAWN_VERTICAL_OFFSET = 0.25;
const DEFAULT_WEAPON: EquippedWeapon = {
  id: "basic_sword",
  label: "Basica",
  damage: 25,
  range: 2,
  cooldown: 0.5
};

export class RuntimeMechanics {
  private currentRespawnPoint: Vector3;
  private readonly voidDeathEnabled: boolean;
  private readonly voidDeathY: number;
  private readonly collectedCoinIds = new Set<string>();
  private readonly collectedKeyObjectIds = new Set<string>();
  private readonly collectedKeyIds = new Set<string>();
  private readonly keyLabels = new Map<string, string>();
  private readonly openedDoorIds = new Set<string>();
  private readonly activatedButtonIds = new Set<string>();
  private readonly activatedCheckpointIds = new Set<string>();
  private readonly messageZoneTriggeredIds = new Set<string>();
  private readonly messageZoneInsideIds = new Set<string>();
  private readonly logicInsideObjectIds = new Set<string>();
  private readonly logicDisabledObjectIds = new Set<string>();
  private readonly defeatedEnemyIds = new Set<string>();
  private readonly inventory = new Map<string, InventoryItem>();
  private readonly itemSpawnerStates = new Map<string, ItemSpawnerRuntimeState>();
  private readonly runtimePickups = new Map<string, ItemPickupObject>();
  private readonly movingPlatformStates = new Map<string, MovingPlatformRuntimeState>();
  private readonly disappearingBlockStates = new Map<string, DisappearingBlockRuntimeState>();
  private readonly enemyStates = new Map<string, EnemyRuntimeState>();
  private readonly jumpPadCooldowns = new Map<string, number>();
  private readonly teleporterCooldowns = new Map<string, number>();
  private warnedMissingDoorIds = new Set<string>();
  private coinCount = 0;
  private deathCooldown = 0;
  private messageCooldown = 0;
  private attackCooldown = 0;
  private equippedWeapon: EquippedWeapon | null = null;
  private activeDialogue: DialogueState | null = null;
  private allEnemiesDefeatedDispatched = false;
  private isGameFinished = false;
  private readonly initialDoorPositions = new Map<string, THREE.Vector3>();
  private readonly logicRuntime: LogicRuntime;
  private readonly objectiveRuntime: ObjectiveRuntime;

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
    this.captureDoorPositions();
    this.initializeBehaviorStates();
    this.physicsSystem.setCollidersFromObjects(this.map, this.objectViews);
    this.applyInitialDoorState();
    this.initializeItemSpawners();
    this.hud.setCoins(0, this.getTotalCoinObjects());
    this.hud.setHealth(this.player.getHealth(), this.player.getMaxHealth());
    this.hud.setWeapon(null);
    this.updateInventoryHud();
    this.logicRuntime = new LogicRuntime(this.map, {
      hasKey: (keyId) => this.collectedKeyIds.has(keyId),
      getCoinCount: () => this.coinCount,
      isDoorOpen: (doorId) => this.isDoorOpenById(doorId),
      showMessage: (message) => this.hud.showMessage(message, 2600),
      openDoor: (doorId) => this.openDoorById(doorId),
      closeDoor: (doorId) => this.closeDoorById(doorId),
      teleportPlayer: (targetObjectId) => this.teleportPlayerToObject(targetObjectId),
      giveCoins: (amount) => this.giveCoins(amount),
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
      damagePlayer: (amount) => this.damagePlayer(amount, "Logica causou dano", this.player.getPosition(), false),
      giveWeapon: (weaponId) => {
        this.equipWeapon(weaponId);
        this.updateInventoryHud();
        this.hud.showMessage("Arma Basica equipada");
      },
      completeObjective: (objectiveId) => this.objectiveRuntime.completeObjective(objectiveId),
      showDialogue: (objectId, message) => this.showDialogueLine(objectId, message),
      getObjectById: (objectId) => this.map.objects.find((mapObject) => mapObject.id === objectId) ?? null
    });
    this.objectiveRuntime = new ObjectiveRuntime(this.map, this.hud, this.audio, this.feedback, {
      onObjectiveCompleted: (objective) => {
        this.logicRuntime.dispatch({ type: "onObjectiveCompleted", objectiveId: objective.id });
      }
    });
    this.logicRuntime.start();
  }

  update(deltaSeconds: number): void {
    if (this.isGameFinished) {
      return;
    }

    this.deathCooldown = Math.max(0, this.deathCooldown - deltaSeconds);
    this.messageCooldown = Math.max(0, this.messageCooldown - deltaSeconds);
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaSeconds);
    this.updateCooldownMap(this.jumpPadCooldowns, deltaSeconds);
    this.updateCooldownMap(this.teleporterCooldowns, deltaSeconds);
    this.updateMovingPlatforms(deltaSeconds);

    if (this.updateVoidDeath()) {
      return;
    }

    const playerBounds = this.player.getBounds();

    this.updateItemSpawners(deltaSeconds);
    this.updateItemPickups(playerBounds);
    this.updateEnemies(deltaSeconds, playerBounds);
    this.updateLogicObjectEntryEvents(playerBounds);

    if (this.isGameFinished) {
      return;
    }

    for (const mapObject of this.map.objects) {
      if (this.logicDisabledObjectIds.has(mapObject.id)) {
        continue;
      }

      if (mapObject.type === "checkpoint") {
        this.updateCheckpoint(mapObject, playerBounds);
      } else if (mapObject.type === "damage" || mapObject.type === "damageZone") {
        this.updateDamageZone(mapObject, playerBounds);
      } else if (mapObject.type === "coin") {
        this.updateCoin(mapObject, playerBounds);
      } else if (mapObject.type === "key") {
        this.updateKey(mapObject, playerBounds);
      } else if (mapObject.type === "button") {
        this.updateButton(mapObject, playerBounds);
      } else if (mapObject.type === "door") {
        this.updateDoorTouch(mapObject, playerBounds);
      } else if (mapObject.type === "disappearingBlock") {
        this.updateDisappearingBlock(mapObject, playerBounds, deltaSeconds);
      } else if (mapObject.type === "jumpPad") {
        this.updateJumpPad(mapObject, playerBounds);
      } else if (mapObject.type === "teleporter") {
        this.updateTeleporter(mapObject, playerBounds);
      } else if (mapObject.type === "messageZone") {
        this.updateMessageZone(mapObject, playerBounds);
      } else if (mapObject.type === "finish" || mapObject.type === "goal") {
        this.updateFinish(mapObject, playerBounds);
      }
    }
  }

  getInteractionHint(objectId: string): string | null {
    const target = this.getObjectById(objectId);

    if (!target) {
      return null;
    }

    if (target.type === "button") {
      const oneTime = target.properties?.oneTime !== false;
      return oneTime && this.activatedButtonIds.has(target.id) ? null : "Botao";
    }

    if (target.type === "door") {
      const doorId = getString(target.properties?.doorId, target.id);
      return this.openedDoorIds.has(doorId) ? null : "Porta";
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

    if (target.type === "itemPickup") {
      const itemId = typeof target.properties?.itemId === "string" ? target.properties.itemId : "";
      return getItemLabel(itemId);
    }

    return null;
  }

  interactWithObject(objectId: string): boolean {
    const target = this.getObjectById(objectId);

    if (!target) {
      return false;
    }

    if (target.type === "button") {
      return this.activateButton(target);
    }

    if (target.type === "door") {
      return this.openDoor(target);
    }

    if (target.type === "npc") {
      return this.interactWithNpc(target);
    }

    if (target.type === "itemPickup") {
      this.collectItemPickup(target as ItemPickupObject);
      return true;
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
    const lines = getNpcDialogueLines(target, target.properties?.showQuestHint !== false ? this.objectiveRuntime.getCurrentHint() : null);
    this.activeDialogue = {
      objectId: target.id,
      speaker,
      lines,
      index: 0
    };
    this.audio.play("message");
    this.feedback.spawn("npc", target.position, speaker);
    this.hud.showDialogue(speaker, lines[0], lines.length > 1);
    this.logicRuntime.dispatch({ type: "onNpcInteracted", objectId: target.id });
    return true;
  }

  private showDialogueLine(objectId: string, message: string): void {
    const target = this.map.objects.find((mapObject) => mapObject.id === objectId);
    const speaker = target ? getString(target.properties?.npcName, target.name ?? "NPC") : "Sistema";
    this.activeDialogue = {
      objectId,
      speaker,
      lines: [message],
      index: 0
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

    if (this.attackCooldown > 0) {
      return false;
    }

    const weapon = this.equippedWeapon;
    this.attackCooldown = weapon.cooldown;
    this.audio.play("attack");
    this.player.playAttackFeedback();
    this.feedback.spawn("attack", this.player.getPosition());

    const hit = this.findEnemyInAttackRange(weapon.range);

    if (!hit) {
      return true;
    }

    this.damageEnemy(hit, weapon.damage);
    return true;
  }

  restart(): void {
    this.collectedCoinIds.clear();
    this.collectedKeyObjectIds.clear();
    this.collectedKeyIds.clear();
    this.keyLabels.clear();
    this.openedDoorIds.clear();
    this.activatedButtonIds.clear();
    this.activatedCheckpointIds.clear();
    this.messageZoneTriggeredIds.clear();
    this.messageZoneInsideIds.clear();
    this.logicInsideObjectIds.clear();
    this.logicDisabledObjectIds.clear();
    this.defeatedEnemyIds.clear();
    this.jumpPadCooldowns.clear();
    this.teleporterCooldowns.clear();
    this.inventory.clear();
    this.warnedMissingDoorIds = new Set();
    this.coinCount = 0;
    this.deathCooldown = 0;
    this.messageCooldown = 0;
    this.attackCooldown = 0;
    this.equippedWeapon = null;
    this.activeDialogue = null;
    this.allEnemiesDefeatedDispatched = false;
    this.isGameFinished = false;
    this.currentRespawnPoint = { ...this.map.spawnPoint };
    this.hud.hideVictory();
    this.hud.hideDialogue();
    this.hud.setCoins(0, this.getTotalCoinObjects());
    this.player.resetHealth();
    this.hud.setHealth(this.player.getHealth(), this.player.getMaxHealth());
    this.hud.setWeapon(null);
    this.updateInventoryHud();
    this.clearRuntimePickups();

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
    this.applyInitialDoorState();
    this.initializeItemSpawners();
    this.player.setPosition(this.currentRespawnPoint);
    this.player.resetVelocity();
    this.logicRuntime.reset();
    this.objectiveRuntime.reset();
    this.logicRuntime.start();
  }

  openDoorById(doorId: string): boolean {
    const door = this.getDoorById(doorId);
    return door ? this.openDoor(door) : false;
  }

  closeDoorById(doorId: string): boolean {
    const door = this.getDoorById(doorId);

    if (!door) {
      return false;
    }

    const view = this.objectViews.get(door.id);

    if (!view) {
      return false;
    }

    const initialPosition = this.initialDoorPositions.get(door.id);

    if (initialPosition) {
      view.position.copy(initialPosition);
    } else {
      applyObjectTransformToThree(view, door);
    }

    const resolvedDoorId = getString(door.properties?.doorId, door.id);
    this.openedDoorIds.delete(resolvedDoorId);
    this.physicsSystem.updateColliderForObject(door, view, true);
    this.hud.showMessage("Porta fechada");
    this.audio.play("door");
    this.feedback.spawn("door", door.position);
    return true;
  }

  isDoorOpenById(doorId: string): boolean {
    const door = this.getDoorById(doorId);
    const resolvedDoorId = door ? getString(door.properties?.doorId, door.id) : doorId;
    return this.openedDoorIds.has(resolvedDoorId);
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
    if (!Number.isFinite(amount)) {
      return;
    }

    this.coinCount = Math.max(0, this.coinCount + Math.floor(amount));
    this.hud.setCoins(this.coinCount, this.getTotalCoinObjects());
    this.audio.play("coin");
  }

  private damagePlayer(amount: number, message: string, position?: Vector3, emitLogicEvent = true): void {
    const previousHealth = this.player.getHealth();
    const currentHealth = this.player.damage(Math.max(0, amount));
    const damageDone = Math.max(0, previousHealth - currentHealth);

    this.hud.setHealth(currentHealth, this.player.getMaxHealth());
    this.audio.play("damage");
    this.feedback.spawn("damage", position ?? this.player.getPosition());

    if (emitLogicEvent && damageDone > 0) {
      this.logicRuntime.dispatch({ type: "onPlayerDamaged", amount: damageDone });
    }

    if (currentHealth <= 0) {
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
    const normalizedWeaponId = normalizeWeaponId(itemId);
    const catalogItemId = normalizedWeaponId === "basic_sword" ? "weapon_basic" : itemId;
    const definition = getItemDefinition(catalogItemId);
    const weapon = definition && "damage" in definition
      ? {
        id: normalizedWeaponId,
        label: definition.name === "Sword" ? "Basica" : definition.name,
        damage: definition.damage,
        range: definition.range,
        cooldown: definition.cooldown
      }
      : DEFAULT_WEAPON;

    this.equippedWeapon = weapon;
    this.hud.setWeapon(weapon.label);

    const inventoryItemId = normalizedWeaponId === "basic_sword" ? "weapon_basic" : itemId;
    const existingItem = this.inventory.get(inventoryItemId);
    const now = new Date().toISOString();

    if (existingItem) {
      existingItem.quantity = Math.max(1, existingItem.quantity);
      existingItem.collectedAt = now;
    } else {
      this.inventory.set(inventoryItemId, {
        itemId: inventoryItemId,
        quantity: 1,
        collectedAt: now
      });
    }
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

    const maxHealth = Math.max(1, getNumber(state.mapObject.properties?.health, state.maxHealth));
    state.health = maxHealth;
    state.maxHealth = maxHealth;
    state.attackCooldown = 0;
    state.patrolTarget = 1;
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
    const target = this.map.objects.find((mapObject) => mapObject.id === objectId);

    if (!target) {
      return false;
    }

    this.currentRespawnPoint = { ...target.position };
    this.activatedCheckpointIds.add(target.id);

    if (target.type === "checkpoint") {
      const view = this.objectViews.get(target.id);
      const activatedColor = getString(target.properties?.activatedColor, "#22c55e");

      if (view) {
        applyObjectAppearanceToThree(view, {
          ...target,
          properties: {
            ...target.properties,
            color: activatedColor
          }
        });
      }
    }

    this.hud.showMessage("Checkpoint ativado");
    this.audio.play("checkpoint");
    this.feedback.spawn("checkpoint", target.position);
    return true;
  }

  finishMap(message = "Voce venceu!"): void {
    if (this.isGameFinished) {
      return;
    }

    if (this.map.gameplaySettings?.requireObjectivesToFinish && !this.objectiveRuntime.areRequiredObjectivesComplete()) {
      const summary = this.objectiveRuntime.getRequiredSummary();

      if (this.messageCooldown <= 0) {
        this.hud.showMessage(`Conclua os objetivos: ${summary.completed}/${summary.total}.`);
        this.messageCooldown = 1.5;
      }

      return;
    }

    this.isGameFinished = true;
    this.options.onComplete?.(this.coinCount);
    this.audio.play("victory");
    this.feedback.spawn("victory");
    const actions: VictoryActions = {
      onRestart: this.options.onRestart,
      onEdit: this.options.onEdit,
      onMenu: this.options.onMenu
    };
    this.hud.showVictory(message, this.coinCount, actions);
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

      if (mapObject.type === "door" && this.isDoorOpenById(getString(mapObject.properties?.doorId, mapObject.id))) {
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

  private updateCheckpoint(mapObject: MapObject, playerBounds: THREE.Box3): void {
    if (this.activatedCheckpointIds.has(mapObject.id) || !this.intersects(mapObject, playerBounds)) {
      return;
    }

    this.activatedCheckpointIds.add(mapObject.id);
    this.currentRespawnPoint = { ...mapObject.position };
    const activatedColor = getString(mapObject.properties?.activatedColor, "#22c55e");
    const view = this.objectViews.get(mapObject.id);

    if (view) {
      applyObjectAppearanceToThree(view, {
        ...mapObject,
        properties: {
          ...mapObject.properties,
          color: activatedColor
        }
      });
    }

    this.hud.showMessage("Checkpoint ativado");
    this.audio.play("checkpoint");
    this.feedback.spawn("checkpoint", mapObject.position);
  }

  private updateDamageZone(mapObject: MapObject, playerBounds: THREE.Box3): void {
    if (this.deathCooldown > 0 || !this.intersects(mapObject, playerBounds)) {
      return;
    }

    const mode = mapObject.properties?.mode === "damage" ? "damage" : "kill";

    if (mode === "damage") {
      const amount = getNumber(mapObject.properties?.damage, getNumber(mapObject.properties?.damagePerSecond, 25));
      this.damagePlayer(amount, "Cuidado! Voce sofreu dano", mapObject.position);
      this.deathCooldown = this.player.isDead() ? this.deathCooldown : 0.7;
      return;
    }

    this.killPlayer("Voce morreu", mapObject.position);
  }

  private updateCoin(mapObject: MapObject, playerBounds: THREE.Box3): void {
    if (this.collectedCoinIds.has(mapObject.id) || !this.intersects(mapObject, playerBounds)) {
      return;
    }

    this.collectedCoinIds.add(mapObject.id);
    const value = getNumber(mapObject.properties?.value, getNumber(mapObject.properties?.coinValue, 1));
    this.coinCount += value;
    const view = this.objectViews.get(mapObject.id);

    if (view) {
      view.visible = false;
    }

    this.hud.setCoins(this.coinCount, this.getTotalCoinObjects());
    this.hud.showMessage("Moeda coletada");
    this.audio.play("coin");
    this.feedback.spawn("coinCollect", mapObject.position, `+${value}`);
    this.objectiveRuntime.onCoinCollected(this.coinCount);
    this.logicRuntime.dispatch({ type: "onCoinCollected", objectId: mapObject.id });
  }

  private updateKey(mapObject: MapObject, playerBounds: THREE.Box3): void {
    if (this.collectedKeyObjectIds.has(mapObject.id) || !this.intersects(mapObject, playerBounds)) {
      return;
    }

    const keyId = getString(mapObject.properties?.keyId, mapObject.id);
    const label = getString(mapObject.properties?.label, keyId);
    this.collectedKeyObjectIds.add(mapObject.id);
    this.collectedKeyIds.add(keyId);
    this.keyLabels.set(keyId, label);

    const view = this.objectViews.get(mapObject.id);

    if (view) {
      view.visible = false;
    }

    this.updateInventoryHud();
    this.hud.showMessage(`Chave coletada: ${label}`);
    this.audio.play("key");
    this.feedback.spawn("key", mapObject.position, label);
    this.objectiveRuntime.onKeyCollected(keyId);
    this.logicRuntime.dispatch({ type: "onKeyCollected", objectId: mapObject.id, keyId });
  }

  private updateButton(mapObject: MapObject, playerBounds: THREE.Box3): void {
    if (!this.intersects(mapObject, playerBounds)) {
      return;
    }

    this.activateButton(mapObject);
  }

  private updateDoorTouch(mapObject: MapObject, playerBounds: THREE.Box3): void {
    if (!this.hasRequiredKey(mapObject) || !this.intersects(mapObject, playerBounds)) {
      return;
    }

    this.openDoor(mapObject);
  }

  private updateDisappearingBlock(mapObject: MapObject, playerBounds: THREE.Box3, deltaSeconds: number): void {
    const state = this.disappearingBlockStates.get(mapObject.id);

    if (!state) {
      return;
    }

    if (state.phase === "idle" && this.intersects(mapObject, playerBounds)) {
      state.phase = "waiting";
      state.timer = Math.max(0, getNumber(mapObject.properties?.delayBeforeDisappear, 0.5));
    }

    if (state.phase === "waiting") {
      state.timer -= deltaSeconds;

      if (state.timer <= 0) {
        this.hideDisappearingBlock(state);
      }
    } else if (state.phase === "hidden") {
      state.timer -= deltaSeconds;

      if (state.timer <= 0) {
        this.showDisappearingBlock(state);
      }
    }
  }

  private updateJumpPad(mapObject: MapObject, playerBounds: THREE.Box3): void {
    if ((this.jumpPadCooldowns.get(mapObject.id) ?? 0) > 0 || !this.intersects(mapObject, playerBounds)) {
      return;
    }

    this.player.applyImpulseY(Math.max(0, getNumber(mapObject.properties?.force, 12)));
    this.jumpPadCooldowns.set(mapObject.id, Math.max(0.05, getNumber(mapObject.properties?.cooldown, 0.4)));
    this.hud.showMessage("Impulso!");
    this.audio.play("jumpPad");
    this.feedback.spawn("jumpPad", mapObject.position);
    this.player.playJumpPadFeedback();
  }

  private updateTeleporter(mapObject: MapObject, playerBounds: THREE.Box3): void {
    if ((this.teleporterCooldowns.get(mapObject.id) ?? 0) > 0 || !this.intersects(mapObject, playerBounds)) {
      return;
    }

    const targetTeleporterId = getString(mapObject.properties?.targetTeleporterId, "").trim();

    if (!targetTeleporterId) {
      return;
    }

    const target = this.map.objects.find((candidate) => (
      candidate.type === "teleporter" &&
      (candidate.id === targetTeleporterId || candidate.properties?.teleporterId === targetTeleporterId)
    ));

    if (!target) {
      return;
    }

    this.player.setPosition(target.position);
    this.player.resetVelocity();
    const cooldown = Math.max(
      0.2,
      getNumber(mapObject.properties?.cooldown, 1),
      getNumber(target.properties?.cooldown, 1)
    );
    this.teleporterCooldowns.set(mapObject.id, cooldown);
    this.teleporterCooldowns.set(target.id, cooldown);
    this.hud.showMessage("Teleporte");
    this.audio.play("teleporter");
    this.feedback.spawn("teleport", mapObject.position);
    this.feedback.spawn("teleport", target.position);
  }

  private updateMessageZone(mapObject: MapObject, playerBounds: THREE.Box3): void {
    const inside = this.intersects(mapObject, playerBounds);

    if (!inside) {
      this.messageZoneInsideIds.delete(mapObject.id);
      return;
    }

    if (this.messageZoneInsideIds.has(mapObject.id)) {
      return;
    }

    this.messageZoneInsideIds.add(mapObject.id);

    if (mapObject.properties?.oneTime !== false && this.messageZoneTriggeredIds.has(mapObject.id)) {
      return;
    }

    this.messageZoneTriggeredIds.add(mapObject.id);
    this.audio.play("message");
    this.hud.showMessage(getString(mapObject.properties?.message, "Bem-vindo ao mapa!"), 2600);
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

  private activateButton(mapObject: MapObject): boolean {
    const oneTime = mapObject.properties?.oneTime !== false;

    if (oneTime && this.activatedButtonIds.has(mapObject.id)) {
      return false;
    }

    const targetDoorId = getString(
      mapObject.properties?.targetDoorId,
      getString(mapObject.properties?.buttonTargetId, "")
    );

    if (targetDoorId) {
      const door = this.map.objects.find((candidate) => (
        candidate.type === "door" &&
        (candidate.id === targetDoorId || candidate.properties?.doorId === targetDoorId)
      ));

      if (!door) {
        if (!this.warnedMissingDoorIds.has(targetDoorId)) {
          console.warn(`Mini Blox: door "${targetDoorId}" was not found.`);
          this.warnedMissingDoorIds.add(targetDoorId);
        }

        return false;
      }

      if (!this.openDoor(door)) {
        return false;
      }
    }

    this.activatedButtonIds.add(mapObject.id);
    const view = this.objectViews.get(mapObject.id);

    if (view) {
      view.scale.y = Math.max(0.12, view.scale.y * 0.45);
      applyObjectAppearanceToThree(view, {
        ...mapObject,
        properties: {
          ...mapObject.properties,
          color: "#22c55e"
        }
      });
    }

    this.audio.play("button");
    this.feedback.spawn("button", mapObject.position);
    this.objectiveRuntime.onButtonActivated(mapObject.id);
    this.logicRuntime.dispatch({ type: "onButtonActivated", objectId: mapObject.id });
    return true;
  }

  private updateFinish(mapObject: MapObject, playerBounds: THREE.Box3): void {
    if (!this.intersects(mapObject, playerBounds)) {
      return;
    }

    this.objectiveRuntime.onObjectReached(mapObject.id);

    if (mapObject.properties?.requiresAllCoins && this.collectedCoinIds.size < this.getTotalCoinObjects()) {
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
    this.movingPlatformStates.clear();
    this.disappearingBlockStates.clear();
    this.enemyStates.clear();

    for (const mapObject of this.map.objects) {
      if (mapObject.type === "movingPlatform") {
        const state: MovingPlatformRuntimeState = {
          mapObject,
          basePosition: toThreeVector(mapObject.position),
          startOffset: getThreeVector(mapObject.properties?.startOffset, { x: 0, y: 0, z: 0 }),
          endOffset: getThreeVector(mapObject.properties?.endOffset, { x: 5, y: 0, z: 0 }),
          progress: 0,
          direction: 1
        };
        this.movingPlatformStates.set(mapObject.id, state);
        this.applyMovingPlatformPosition(state);
      } else if (mapObject.type === "disappearingBlock") {
        this.disappearingBlockStates.set(mapObject.id, {
          mapObject,
          phase: "idle",
          timer: 0
        });
      } else if (mapObject.type === "enemy") {
        const view = this.objectViews.get(mapObject.id);
        const maxHealth = Math.max(1, getNumber(mapObject.properties?.health, 50));

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
          patrolTarget: 1
        });
      }
    }
  }

  private updateMovingPlatforms(deltaSeconds: number): void {
    for (const state of this.movingPlatformStates.values()) {
      const distance = state.startOffset.distanceTo(state.endOffset);
      const speed = Math.max(0, getNumber(state.mapObject.properties?.speed, 1));

      if (distance <= 0.001 || speed <= 0) {
        this.applyMovingPlatformPosition(state);
        continue;
      }

      state.progress += (deltaSeconds * speed / distance) * state.direction;

      if (state.mapObject.properties?.loop === false) {
        state.progress = Math.min(1, state.progress);
      } else if (state.progress >= 1) {
        state.progress = 2 - state.progress;
        state.direction = -1;
      } else if (state.progress <= 0) {
        state.progress = Math.abs(state.progress);
        state.direction = 1;
      }

      this.applyMovingPlatformPosition(state);
    }
  }

  private applyMovingPlatformPosition(state: MovingPlatformRuntimeState): void {
    const view = this.objectViews.get(state.mapObject.id);

    if (!view) {
      return;
    }

    const offset = state.startOffset.clone().lerp(state.endOffset, THREE.MathUtils.clamp(state.progress, 0, 1));
    view.position.copy(state.basePosition).add(offset);
    this.physicsSystem.updateColliderForObject(state.mapObject, view, true);
  }

  private hideDisappearingBlock(state: DisappearingBlockRuntimeState): void {
    const view = this.objectViews.get(state.mapObject.id);

    if (view) {
      view.visible = false;
    }

    this.physicsSystem.removeCollider(state.mapObject.id);
    this.audio.play("disappearingBlock");
    this.feedback.spawn("disappearingBlock", state.mapObject.position);
    state.phase = "hidden";
    state.timer = Math.max(0, getNumber(state.mapObject.properties?.respawnDelay, 3));
  }

  private showDisappearingBlock(state: DisappearingBlockRuntimeState): void {
    const view = this.objectViews.get(state.mapObject.id);

    if (view) {
      view.visible = true;
      applyObjectTransformToThree(view, state.mapObject);
      applyObjectAppearanceToThree(view, state.mapObject);
      this.physicsSystem.updateColliderForObject(state.mapObject, view, true);
    }

    state.phase = "idle";
    state.timer = 0;
  }

  private updateEnemies(deltaSeconds: number, playerBounds: THREE.Box3): void {
    const playerPosition = toThreeVector(this.player.getPosition());

    for (const state of this.enemyStates.values()) {
      const view = this.objectViews.get(state.mapObject.id);

      if (!view || !view.visible || state.health <= 0) {
        continue;
      }

      state.attackCooldown = Math.max(0, state.attackCooldown - deltaSeconds);
      const behavior = getEnemyBehavior(state.mapObject);
      const speed = Math.max(0, getNumber(state.mapObject.properties?.speed, 2));
      const detectionRange = Math.max(0, getNumber(state.mapObject.properties?.detectionRange, 8));
      const attackRange = Math.max(0.2, getNumber(state.mapObject.properties?.attackRange, 1.5));
      const distanceToPlayer = distance2DVector(view.position, playerPosition);
      let target: THREE.Vector3 | null = null;

      if (behavior === "chase" && distanceToPlayer <= detectionRange) {
        target = playerPosition;
      } else if (behavior === "patrol") {
        const patrolOffset = getThreeVector(state.mapObject.properties?.patrolOffset, { x: 4, y: 0, z: 0 });
        target = state.patrolTarget === 1
          ? state.spawnPosition.clone().add(patrolOffset)
          : state.spawnPosition.clone();

        if (distance2DVector(view.position, target) <= 0.22) {
          state.patrolTarget = state.patrolTarget === 1 ? 0 : 1;
        }
      }

      if (target && speed > 0) {
        const direction = target.clone().sub(view.position);
        direction.y = 0;

        if (direction.lengthSq() > 0.0001) {
          direction.normalize();
          const step = Math.min(speed * deltaSeconds, distance2DVector(view.position, target));
          view.position.addScaledVector(direction, step);
          view.position.y = state.spawnPosition.y;
          view.rotation.y = Math.atan2(direction.x, direction.z) + Math.PI;
        }
      }

      const enemyBounds = new THREE.Box3().setFromObject(view);
      enemyBounds.expandByScalar(0.1);

      if (
        (distanceToPlayer <= attackRange || enemyBounds.intersectsBox(playerBounds)) &&
        state.attackCooldown <= 0 &&
        this.deathCooldown <= 0
      ) {
        const damage = Math.max(1, getNumber(state.mapObject.properties?.damage, 10));
        state.attackCooldown = Math.max(0.2, getNumber(state.mapObject.properties?.attackCooldown, 1));
        this.damagePlayer(damage, "Inimigo causou dano", state.mapObject.position);
      }
    }
  }

  private findEnemyInAttackRange(range: number): EnemyRuntimeState | null {
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

      if (dot < 0.18 && distance > 0.85) {
        continue;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        bestState = state;
      }
    }

    return bestState;
  }

  private damageEnemy(state: EnemyRuntimeState, amount: number): void {
    const view = this.objectViews.get(state.mapObject.id);
    const hitPosition = view ? fromThreeVector(view.position) : state.mapObject.position;
    state.health = Math.max(0, state.health - Math.max(0, amount));
    this.audio.play("hit");
    this.feedback.spawn("damage", hitPosition);

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
    this.feedback.spawn("item", hitPosition, "Derrotado");
    this.dispatchEnemyDefeated(state.mapObject.id);
  }

  private dispatchEnemyDefeated(objectId: string): void {
    const totalEnemies = this.getTotalEnemyObjects();
    this.objectiveRuntime.onEnemyDefeated(this.defeatedEnemyIds.size, totalEnemies);
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

  private updateCooldownMap(cooldowns: Map<string, number>, deltaSeconds: number): void {
    for (const [id, cooldown] of cooldowns) {
      const nextCooldown = Math.max(0, cooldown - deltaSeconds);

      if (nextCooldown <= 0) {
        cooldowns.delete(id);
      } else {
        cooldowns.set(id, nextCooldown);
      }
    }
  }

  private updateItemSpawners(deltaSeconds: number): void {
    for (const state of this.itemSpawnerStates.values()) {
      if (state.activePickupIds.size >= getMaxSpawnedItems(state.spawner)) {
        continue;
      }

      if (!Number.isFinite(state.cooldown)) {
        continue;
      }

      state.cooldown = Math.max(0, state.cooldown - deltaSeconds);

      if (state.cooldown <= 0) {
        this.spawnItemFromSpawner(state);
      }
    }
  }

  private updateItemPickups(playerBounds: THREE.Box3): void {
    for (const pickup of [...this.runtimePickups.values()]) {
      const view = this.objectViews.get(pickup.id);

      if (!view || !view.visible) {
        continue;
      }

      const pickupBounds = new THREE.Box3().setFromObject(view);
      pickupBounds.expandByScalar(0.18);

      if (pickupBounds.intersectsBox(playerBounds)) {
        this.collectItemPickup(pickup);
      }
    }
  }

  private initializeItemSpawners(): void {
    this.itemSpawnerStates.clear();

    for (const mapObject of this.map.objects) {
      if (mapObject.type !== "itemSpawner") {
        continue;
      }

      const spawnOnStart = mapObject.properties?.spawnOnStart !== false;
      const respawnTime = getRespawnTime(mapObject);
      const state: ItemSpawnerRuntimeState = {
        spawner: mapObject,
        activePickupIds: new Set(),
        cooldown: spawnOnStart ? 0 : (respawnTime > 0 ? respawnTime : Number.POSITIVE_INFINITY)
      };
      this.itemSpawnerStates.set(mapObject.id, state);

      if (spawnOnStart) {
        this.spawnItemFromSpawner(state);
      }
    }
  }

  private spawnItemFromSpawner(state: ItemSpawnerRuntimeState): void {
    if (state.activePickupIds.size >= getMaxSpawnedItems(state.spawner)) {
      state.cooldown = Number.POSITIVE_INFINITY;
      return;
    }

    const itemId = chooseItemId(state.spawner);

    if (!itemId) {
      state.cooldown = Number.POSITIVE_INFINITY;
      return;
    }

    const item = getItemDefinition(itemId);
    const pickup: ItemPickupObject = {
      id: createId("itemPickup"),
      type: "itemPickup",
      name: item?.name ?? itemId,
      position: getPickupPosition(state.spawner, state.activePickupIds.size),
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      collider: { shape: "sphere", isTrigger: true, radius: 0.55 },
      properties: {
        color: item?.color ?? "#facc15",
        collision: false,
        itemId,
        sourceSpawnerId: state.spawner.id,
        amount: getSpawnerAmount(state.spawner, itemId),
        healAmount: itemId === "health_pack" || itemId === "health"
          ? getSpawnerAmount(state.spawner, itemId)
          : undefined,
        weaponId: itemId === "weapon_basic" ? "basic_sword" : undefined
      }
    };
    const view = createMapObject3D(pickup);
    view.userData.runtimePickup = true;
    this.runtimePickups.set(pickup.id, pickup);
    this.objectViews.set(pickup.id, view);
    state.activePickupIds.add(pickup.id);
    this.world.add(view);
    state.cooldown = state.activePickupIds.size < getMaxSpawnedItems(state.spawner)
      ? 0
      : Number.POSITIVE_INFINITY;
  }

  private collectItemPickup(pickup: ItemPickupObject): void {
    const itemId = pickup.properties.itemId;
    const amount = getNumber(
      pickup.properties.amount,
      getNumber(pickup.properties.healAmount, itemId === "coin" ? 1 : 25)
    );
    let label = getItemLabel(itemId);
    let feedbackLabel = label;

    this.removeRuntimePickup(pickup.id);
    const sourceSpawnerId = pickup.properties.sourceSpawnerId;

    if (sourceSpawnerId) {
      const state = this.itemSpawnerStates.get(sourceSpawnerId);

      if (state) {
        state.activePickupIds.delete(pickup.id);
        const respawnTime = getRespawnTime(state.spawner);
        state.cooldown = respawnTime > 0 ? respawnTime : Number.POSITIVE_INFINITY;
      }
    }

    if (itemId === "health_pack" || itemId === "health") {
      this.dispatchItemCollected("health");
      const healed = this.healPlayer(amount);
      label = `Cura +${Math.round(healed)}`;
      feedbackLabel = `+${Math.round(healed)} vida`;
      this.hud.showMessage(healed > 0 ? label : "Vida ja esta cheia");
      this.audio.play("item");
      this.feedback.spawn("item", pickup.position, feedbackLabel);
      return;
    }

    if (itemId === "coin") {
      const coinAmount = Math.max(1, Math.floor(amount));
      this.giveCoins(coinAmount);
      this.dispatchItemCollected("coin");
      this.hud.showMessage(`Moeda +${coinAmount}`);
      this.feedback.spawn("coinCollect", pickup.position, `+${coinAmount}`);
      return;
    }

    if (itemId === "weapon_basic" || itemId === "sword") {
      this.equipWeapon(itemId);
      this.dispatchItemCollected("weapon_basic");
      label = "Arma Basica";
      feedbackLabel = "Arma";
    } else {
      this.dispatchItemCollected(itemId);
      const existingItem = this.inventory.get(itemId);
      const now = new Date().toISOString();

      if (existingItem) {
        existingItem.quantity += 1;
        existingItem.collectedAt = now;
      } else {
        this.inventory.set(itemId, {
          itemId,
          quantity: 1,
          collectedAt: now
        });
      }
    }

    this.updateInventoryHud();
    this.hud.showMessage(`${label} coletado`);
    this.audio.play("item");
    this.feedback.spawn("item", pickup.position, feedbackLabel);
  }

  private dispatchItemCollected(itemType: string): void {
    this.logicRuntime.dispatch({ type: "onItemCollected", itemType });
  }

  private clearRuntimePickups(): void {
    for (const pickupId of [...this.runtimePickups.keys()]) {
      this.removeRuntimePickup(pickupId);
    }

    this.runtimePickups.clear();
  }

  private removeRuntimePickup(pickupId: string): void {
    const view = this.objectViews.get(pickupId);

    if (view) {
      this.world.remove(view);
      disposeObject3D(view);
      this.objectViews.delete(pickupId);
    }

    this.runtimePickups.delete(pickupId);
  }

  private updateInventoryHud(): void {
    this.hud.setInventory([...this.inventory.values()].map((item) => ({
      label: getItemLabel(item.itemId),
      quantity: item.quantity
    })));
    this.hud.setKeys([...this.keyLabels.values()]);
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
    this.respawnPlayer();
  }

  private respawnPlayer(): void {
    this.deathCooldown = 0.8;
    this.player.resetHealth();
    this.hud.setHealth(this.player.getHealth(), this.player.getMaxHealth());
    this.player.setPosition({
      x: this.currentRespawnPoint.x,
      y: this.currentRespawnPoint.y + RESPAWN_VERTICAL_OFFSET,
      z: this.currentRespawnPoint.z
    });
    this.player.resetVelocity();
    this.player.playRespawnFeedback();
  }

  private hasRequiredKey(door: MapObject): boolean {
    return getString(door.properties?.requiredKeyId, "").trim().length > 0;
  }

  private canOpenDoorWithKey(door: MapObject, showMessage: boolean): boolean {
    const requiredKeyId = getString(door.properties?.requiredKeyId, "").trim();

    if (!requiredKeyId || this.collectedKeyIds.has(requiredKeyId)) {
      return true;
    }

    if (showMessage && this.messageCooldown <= 0) {
      const keyLabel = this.getKeyLabel(requiredKeyId);
      this.hud.showMessage(keyLabel ? `Voce precisa da chave: ${keyLabel}` : "Voce precisa de uma chave.");
      this.messageCooldown = 1.1;
    }

    return false;
  }

  private getKeyLabel(keyId: string): string | null {
    const collectedLabel = this.keyLabels.get(keyId);

    if (collectedLabel) {
      return collectedLabel;
    }

    const keyObject = this.map.objects.find((candidate) => (
      candidate.type === "key" &&
      getString(candidate.properties?.keyId, candidate.id) === keyId
    ));

    if (!keyObject) {
      return null;
    }

    return getString(keyObject.properties?.label, keyId);
  }

  private openDoor(door: MapObject, showMessage = true, ignoreKeyRequirement = false): boolean {
    const doorId = getString(door.properties?.doorId, door.id);

    if (this.openedDoorIds.has(doorId)) {
      return false;
    }

    if (!ignoreKeyRequirement && !this.canOpenDoorWithKey(door, showMessage)) {
      return false;
    }

    const view = this.objectViews.get(door.id);

    if (!view) {
      return false;
    }

    const offset = getVector(door.properties?.openOffset, { x: 0, y: 4, z: 0 });
    view.position.add(new THREE.Vector3(offset.x, offset.y, offset.z));
    this.physicsSystem.removeCollider(door.id);
    this.openedDoorIds.add(doorId);
    this.objectiveRuntime.onDoorOpened(doorId);
    if (showMessage) {
      this.hud.showMessage("Porta aberta");
      this.audio.play("door");
      this.feedback.spawn("door", door.position);
    }

    return true;
  }

  private captureDoorPositions(): void {
    for (const mapObject of this.map.objects) {
      if (mapObject.type !== "door") {
        continue;
      }

      const view = this.objectViews.get(mapObject.id);

      if (view) {
        this.initialDoorPositions.set(mapObject.id, view.position.clone());
      }
    }
  }

  private applyInitialDoorState(): void {
    for (const door of this.map.objects.filter((mapObject) => mapObject.type === "door")) {
      if (door.properties?.startsOpen || door.properties?.doorState === "open") {
        this.openDoor(door, false, true);
      }
    }
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

  private getTotalCoinObjects(): number {
    return this.map.objects.filter((mapObject) => mapObject.type === "coin").length;
  }

  private getTotalEnemyObjects(): number {
    return this.map.objects.filter((mapObject) => mapObject.type === "enemy").length;
  }

  private getDoorById(doorId: string): MapObject | null {
    return this.map.objects.find((candidate) => (
      candidate.type === "door" &&
      (candidate.id === doorId || candidate.properties?.doorId === doorId)
    )) ?? null;
  }

  private getObjectById(objectId: string): MapObject | ItemPickupObject | null {
    return this.runtimePickups.get(objectId) ??
      this.map.objects.find((mapObject) => mapObject.id === objectId) ??
      null;
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
  const lines = dialogue.length > 0
    ? dialogue
    : legacyDialog.trim().length > 0
      ? [legacyDialog]
      : ["Ola!"];

  if (!objectiveHint) {
    return lines;
  }

  return [...lines, `Objetivo atual: ${objectiveHint}`];
}

function getSpawnMode(value: unknown): ItemSpawnMode {
  return value === "random" ? "random" : "fixed";
}

function getRespawnTime(spawner: MapObject): number {
  return Math.max(0, getNumber(spawner.properties?.respawnTime, 0));
}

function getMaxSpawnedItems(spawner: MapObject): number {
  return Math.max(1, Math.floor(getNumber(spawner.properties?.maxSpawnedItems, 1)));
}

function chooseItemId(spawner: MapObject): string | null {
  const spawnItemType = spawner.properties?.spawnItemType;

  if (spawnItemType === "health") {
    return "health_pack";
  }

  if (spawnItemType === "coin") {
    return "coin";
  }

  if (spawnItemType === "weapon_basic") {
    return "weapon_basic";
  }

  const itemPool = getStringArray(spawner.properties?.itemPool);

  if (itemPool.length === 0) {
    return null;
  }

  if (getSpawnMode(spawner.properties?.spawnMode) === "random") {
    return itemPool[Math.floor(Math.random() * itemPool.length)];
  }

  return itemPool[0];
}

function normalizeWeaponId(weaponId: string): string {
  return weaponId === "weapon_basic" || weaponId === "sword" ? "basic_sword" : weaponId;
}

function getSpawnerAmount(spawner: MapObject, itemId: string): number {
  const fallback = itemId === "coin" ? 1 : 25;
  return Math.max(1, getNumber(spawner.properties?.amount, fallback));
}

function getPickupPosition(spawner: MapObject, index: number): Vector3 {
  const scale = spawner.scale ?? { x: 1, y: 1, z: 1 };
  const angle = index * 2.3999632297;
  const radius = index === 0 ? 0 : 0.55;

  return {
    x: spawner.position.x + Math.cos(angle) * radius,
    y: spawner.position.y + Math.max(0.75, scale.y * 0.75),
    z: spawner.position.z + Math.sin(angle) * radius
  };
}

function createId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    z: vector.z
  };
}

function distance2DVector(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function getEnemyBehavior(mapObject: MapObject): "idle" | "patrol" | "chase" {
  const behavior = mapObject.properties?.behavior;

  if (behavior === "idle" || behavior === "patrol" || behavior === "chase") {
    return behavior;
  }

  return "chase";
}
