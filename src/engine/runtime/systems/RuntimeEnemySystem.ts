import * as THREE from "three";
import type { GameMap } from "../../../shared/types/MapSchema";
import type {
  EnemyNetState,
  EnemyPositionUpdate,
  PlayerNetState,
} from "../../../shared/types/MultiplayerSchema";
import type { MapObject, Vector3 } from "../../../shared/types/ObjectSchema";
import type { AudioSystem } from "../../AudioSystem";
import type { FeedbackSystem } from "../../FeedbackSystem";
import {
  applyObjectAppearanceToThree,
  applyObjectTransformToThree,
} from "../../ObjectFactory";
import type { PhysicsSystem } from "../../PhysicsSystem";
import type { RuntimeHud } from "../../RuntimeHud";
import {
  clampEnemyHealth,
  getEnemyRuntimeConfig,
  shouldEnemyAttackPlayer,
} from "../../mechanics/EnemyMechanics";
import type { RuntimeSystem } from "../core/RuntimeSystem";

export type EnemyRuntimeState = {
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

export type RuntimeEnemyLogicEvent =
  | { type: "onEnemyDefeated"; objectId: string }
  | { type: "onAnyEnemyDefeated"; objectId: string }
  | { type: "onAllEnemiesDefeated" };

export type RuntimeEnemySystemOptions = {
  map: GameMap;
  objectViews: Map<string, THREE.Object3D>;
  physicsSystem: PhysicsSystem;
  hud: RuntimeHud;
  audio: AudioSystem;
  feedback: FeedbackSystem;
  enableLifecycleUpdate?: boolean;
  isHost?: () => boolean;
  isMultiplayerEnabled?: () => boolean;
  getLocalPlayerId?: () => string | null;
  getRemotePlayers?: () => PlayerNetState[];
  getPlayerPosition?: () => Vector3;
  isLocalPlayerAlive?: () => boolean;
  getPlayerBounds?: () => THREE.Box3;
  getDeathCooldown?: () => number;
  damagePlayer?: (amount: number, message: string, position: Vector3) => void;
  onEnemyPositionUpdate?: (enemies: EnemyPositionUpdate[]) => void;
  setObjectRuntimeEnabled?: (objectId: string, enabled: boolean) => void;
  onEnemyDefeated: (defeatedCount: number, totalEnemies: number) => void;
  onGameModeEnemyDefeated: (defeatedCount: number, totalEnemies: number) => void;
  onLogicEvent: (event: RuntimeEnemyLogicEvent) => void;
};

export class RuntimeEnemySystem implements RuntimeSystem {
  readonly id = "enemies";

  private readonly enemyStates = new Map<string, EnemyRuntimeState>();
  private readonly defeatedEnemyIds = new Set<string>();
  private enemySyncAccumulator = 0;
  private allEnemiesDefeatedDispatched = false;

  constructor(private readonly options: RuntimeEnemySystemOptions) {
    this.reset();
  }

  reset(): void {
    this.enemyStates.clear();
    this.defeatedEnemyIds.clear();
    this.enemySyncAccumulator = 0;
    this.allEnemiesDefeatedDispatched = false;

    for (const mapObject of this.options.map.objects) {
      if (mapObject.type !== "enemy") {
        continue;
      }

      const config = getEnemyRuntimeConfig(mapObject);
      const maxHealth = config.maxHealth;
      const view = this.options.objectViews.get(mapObject.id);

      if (view) {
        view.visible = true;
        applyObjectTransformToThree(view, mapObject);
        applyObjectAppearanceToThree(view, mapObject);
        this.options.physicsSystem.updateColliderForObject(mapObject, view);
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

  dispose(): void {
    this.enemyStates.clear();
    this.defeatedEnemyIds.clear();
    this.enemySyncAccumulator = 0;
    this.allEnemiesDefeatedDispatched = false;
  }

  update(deltaSeconds: number): void {
    if (this.options.enableLifecycleUpdate === false) {
      return;
    }

    this.updateEnemyBehavior(deltaSeconds);
  }

  getEnemyState(objectId: string): EnemyRuntimeState | null {
    return this.enemyStates.get(objectId) ?? null;
  }

  getEnemyStates(): EnemyRuntimeState[] {
    return [...this.enemyStates.values()];
  }

  getAliveEnemyStates(): EnemyRuntimeState[] {
    return this.getEnemyStates().filter((state) => {
      const view = this.options.objectViews.get(state.mapObject.id);
      return Boolean(view?.visible) && state.health > 0;
    });
  }

  isEnemyDefeated(objectId: string): boolean {
    return this.defeatedEnemyIds.has(objectId);
  }

  getDefeatedEnemyCount(): number {
    return this.defeatedEnemyIds.size;
  }

  getTotalEnemyCount(): number {
    return this.enemyStates.size;
  }

  spawnEnemy(objectId: string): boolean {
    const state = this.enemyStates.get(objectId);
    if (!state) {
      return false;
    }

    const config = getEnemyRuntimeConfig(state.mapObject);
    const view = this.options.objectViews.get(objectId);

    state.health = config.maxHealth;
    state.maxHealth = config.maxHealth;
    state.attackCooldown = 0;
    state.patrolTarget = 1;
    state.spawnPosition.copy(toThreeVector(state.mapObject.position));
    state.targetPosition.copy(state.spawnPosition);
    state.targetRotationY = getNumber(state.mapObject.rotation?.y, 0);
    state.netState = config.behavior;

    if (view) {
      view.visible = true;
      applyObjectTransformToThree(view, state.mapObject);
      applyObjectAppearanceToThree(view, state.mapObject);
      this.options.physicsSystem.updateColliderForObject(state.mapObject, view);
    }

    this.defeatedEnemyIds.delete(objectId);
    this.allEnemiesDefeatedDispatched = false;
    this.options.setObjectRuntimeEnabled?.(objectId, true);
    this.options.feedback.spawn("item", state.mapObject.position, "Inimigo");
    this.options.hud.showMessage("Inimigo reativado");
    return true;
  }

  applyEnemyUpdated(enemy: EnemyNetState, showFeedback = true): void {
    const state = this.enemyStates.get(enemy.objectId);

    if (!state) {
      return;
    }

    const previousHealth = state.health;
    const wasAlive = previousHealth > 0;
    state.maxHealth = Math.max(state.maxHealth, enemy.maxHealth ?? state.maxHealth);
    state.health = clampEnemyHealth(enemy.health, state.maxHealth);
    state.targetPosition.copy(toThreeVector(enemy.position));
    state.targetRotationY = enemy.rotationY;
    state.netState = enemy.state;

    const view = this.options.objectViews.get(enemy.objectId);
    if (view && this.options.isHost?.() === true) {
      view.position.copy(state.targetPosition);
      view.rotation.y = enemy.rotationY;
    }

    if (!enemy.alive || state.health <= 0) {
      this.applyEnemyDefeated(enemy.objectId, showFeedback && wasAlive);
      return;
    }

    if (view) {
      view.visible = true;
    }

    if (showFeedback && wasAlive && state.health < previousHealth) {
      const hitPosition = view ? fromThreeVector(view.position) : enemy.position;
      this.options.audio.play("hit");
      this.options.feedback.spawn("damage", hitPosition, `-${Math.round(previousHealth - state.health)}`);
      this.options.hud.showMessage(`Inimigo: ${Math.ceil(state.health)}/${state.maxHealth}`);
    }
  }

  applyEnemyDefeated(enemyObjectId: string, showFeedback = true): void {
    const state = this.enemyStates.get(enemyObjectId);

    if (!state || this.defeatedEnemyIds.has(enemyObjectId)) {
      return;
    }

    state.health = 0;
    state.netState = "dead";
    const view = this.options.objectViews.get(enemyObjectId);
    const hitPosition = view ? fromThreeVector(view.position) : state.mapObject.position;

    if (view) {
      view.visible = false;
    }

    this.options.physicsSystem.removeCollider(enemyObjectId);
    this.defeatedEnemyIds.add(enemyObjectId);

    if (showFeedback) {
      this.options.hud.showMessage("Inimigo derrotado");
      this.options.audio.play("item");
      this.options.feedback.spawn("item", hitPosition, "Inimigo -");
    }

    this.dispatchEnemyDefeated(enemyObjectId);
  }

  updateEnemyBehavior(
    deltaSeconds: number,
    playerBounds = this.options.getPlayerBounds?.()
  ): void {
    const playerPositionValue = this.options.getPlayerPosition?.();

    if (!playerPositionValue || !playerBounds) {
      return;
    }

    const playerPosition = toThreeVector(playerPositionValue);
    const isMultiplayer = this.options.isMultiplayerEnabled?.() === true;
    const isHost = isMultiplayer && this.options.isHost?.() === true;
    const shouldSyncEnemyPositions =
      isHost && (this.enemySyncAccumulator += deltaSeconds) >= 0.14;
    const enemyPositionUpdates: EnemyPositionUpdate[] = [];

    for (const state of this.enemyStates.values()) {
      const view = this.options.objectViews.get(state.mapObject.id);

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
          deathCooldown: this.options.getDeathCooldown?.() ?? 0,
        })
      ) {
        state.attackCooldown = config.attackCooldown;
        this.options.damagePlayer?.(config.damage, "Inimigo causou dano", state.mapObject.position);
      }
    }

    if (shouldSyncEnemyPositions) {
      this.enemySyncAccumulator = 0;
      if (enemyPositionUpdates.length > 0) {
        this.options.onEnemyPositionUpdate?.(enemyPositionUpdates);
      }
    }
  }

  private dispatchEnemyDefeated(objectId: string): void {
    const totalEnemies = this.getTotalEnemyCount();
    this.options.onEnemyDefeated(this.defeatedEnemyIds.size, totalEnemies);
    this.options.onGameModeEnemyDefeated(this.defeatedEnemyIds.size, totalEnemies);
    this.options.onLogicEvent({ type: "onEnemyDefeated", objectId });
    this.options.onLogicEvent({ type: "onAnyEnemyDefeated", objectId });

    if (
      totalEnemies > 0 &&
      !this.allEnemiesDefeatedDispatched &&
      this.defeatedEnemyIds.size >= totalEnemies
    ) {
      this.allEnemiesDefeatedDispatched = true;
      this.options.onLogicEvent({ type: "onAllEnemiesDefeated" });
    }
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
    const localPlayerId = this.options.getLocalPlayerId?.() ?? undefined;
    const localPlayerPosition = this.options.getPlayerPosition?.();

    if (!localPlayerPosition) {
      return null;
    }

    const candidates: Array<{ playerId?: string; position: Vector3; alive: boolean }> = [
      {
        playerId: localPlayerId,
        position: localPlayerPosition,
        alive: this.options.isLocalPlayerAlive?.() ?? true,
      },
      ...(this.options.getRemotePlayers?.() ?? []).map((player) => ({
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
}

function toThreeVector(vector: Vector3): THREE.Vector3 {
  return new THREE.Vector3(vector.x, vector.y, vector.z);
}

function fromThreeVector(vector: THREE.Vector3): Vector3 {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getThreeVector(value: unknown, fallback: Vector3): THREE.Vector3 {
  if (
    typeof value === "object" &&
    value !== null &&
    "x" in value &&
    "y" in value &&
    "z" in value
  ) {
    const candidate = value as Partial<Vector3>;
    return new THREE.Vector3(
      getNumber(candidate.x, fallback.x),
      getNumber(candidate.y, fallback.y),
      getNumber(candidate.z, fallback.z)
    );
  }

  return toThreeVector(fallback);
}

function distance2DVector(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
