import * as THREE from "three";
import type { GameMap } from "../../../shared/types/MapSchema";
import type { MapObject, Vector3 } from "../../../shared/types/ObjectSchema";
import type { AudioSystem } from "../../AudioSystem";
import type { FeedbackSystem } from "../../FeedbackSystem";
import { applyObjectAppearanceToThree, applyObjectTransformToThree } from "../../ObjectFactory";
import type { PhysicsSystem } from "../../PhysicsSystem";
import type { RuntimeHud } from "../../RuntimeHud";
import type { RuntimeSystem } from "../core/RuntimeSystem";

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

export type RuntimeMovementObjectSystemOptions = {
  map: GameMap;
  objectViews: Map<string, THREE.Object3D>;
  physicsSystem: PhysicsSystem;
  hud: RuntimeHud;
  audio: AudioSystem;
  feedback: FeedbackSystem;
  getPlayerBounds: () => THREE.Box3;
  getPlayerPosition: () => Vector3;
  setPlayerPosition: (position: Vector3) => void;
  resetPlayerVelocity: () => void;
  applyPlayerImpulseY: (force: number) => void;
  playJumpPadFeedback: () => void;
};

export class RuntimeMovementObjectSystem implements RuntimeSystem {
  readonly id = "movement-objects";

  private readonly movingPlatformStates = new Map<string, MovingPlatformRuntimeState>();
  private readonly disappearingBlockStates = new Map<string, DisappearingBlockRuntimeState>();
  private readonly jumpPadCooldowns = new Map<string, number>();
  private readonly teleporterCooldowns = new Map<string, number>();

  constructor(private readonly options: RuntimeMovementObjectSystemOptions) {
    this.reset();
  }

  update(deltaSeconds: number): void {
    this.updateCooldownMap(this.jumpPadCooldowns, deltaSeconds);
    this.updateCooldownMap(this.teleporterCooldowns, deltaSeconds);
    this.updateMovingPlatforms(deltaSeconds);
  }

  reset(): void {
    this.movingPlatformStates.clear();
    this.disappearingBlockStates.clear();
    this.jumpPadCooldowns.clear();
    this.teleporterCooldowns.clear();

    for (const mapObject of this.options.map.objects) {
      if (mapObject.type === "movingPlatform") {
        const state: MovingPlatformRuntimeState = {
          mapObject,
          basePosition: toThreeVector(mapObject.position),
          startOffset: getThreeVector(mapObject.properties?.startOffset, { x: 0, y: 0, z: 0 }),
          endOffset: getThreeVector(mapObject.properties?.endOffset, { x: 5, y: 0, z: 0 }),
          progress: 0,
          direction: 1,
        };
        this.movingPlatformStates.set(mapObject.id, state);
        this.applyMovingPlatformPosition(state);
      } else if (mapObject.type === "disappearingBlock") {
        const state: DisappearingBlockRuntimeState = {
          mapObject,
          phase: "idle",
          timer: 0,
        };
        this.disappearingBlockStates.set(mapObject.id, state);
        this.showDisappearingBlock(state);
      }
    }
  }

  updateObject(
    mapObject: MapObject,
    playerBounds = this.options.getPlayerBounds(),
    deltaSeconds = 0
  ): boolean {
    if (mapObject.type === "disappearingBlock") {
      return this.updateDisappearingBlock(mapObject, playerBounds, deltaSeconds);
    }

    if (mapObject.type === "jumpPad") {
      return this.updateJumpPad(mapObject, playerBounds);
    }

    if (mapObject.type === "teleporter") {
      return this.updateTeleporter(mapObject, playerBounds);
    }

    return false;
  }

  private updateMovingPlatforms(deltaSeconds: number): void {
    for (const state of this.movingPlatformStates.values()) {
      const distance = state.startOffset.distanceTo(state.endOffset);
      const speed = Math.max(0, getNumber(state.mapObject.properties?.speed, 1));

      if (distance <= 0.001 || speed <= 0) {
        this.applyMovingPlatformPosition(state);
        continue;
      }

      state.progress += ((deltaSeconds * speed) / distance) * state.direction;

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
    const view = this.options.objectViews.get(state.mapObject.id);

    if (!view) {
      return;
    }

    const offset = state.startOffset
      .clone()
      .lerp(state.endOffset, THREE.MathUtils.clamp(state.progress, 0, 1));
    view.position.copy(state.basePosition).add(offset);
    this.options.physicsSystem.updateColliderForObject(state.mapObject, view, true);
  }

  private updateDisappearingBlock(
    mapObject: MapObject,
    playerBounds: THREE.Box3,
    deltaSeconds: number
  ): boolean {
    const state = this.disappearingBlockStates.get(mapObject.id);

    if (!state) {
      return false;
    }

    let changed = false;

    if (state.phase === "idle" && this.intersects(mapObject, playerBounds)) {
      state.phase = "waiting";
      state.timer = Math.max(0, getNumber(mapObject.properties?.delayBeforeDisappear, 0.5));
      changed = true;
    }

    if (state.phase === "waiting") {
      state.timer -= deltaSeconds;

      if (state.timer <= 0) {
        this.hideDisappearingBlock(state);
        changed = true;
      }
    } else if (state.phase === "hidden") {
      state.timer -= deltaSeconds;

      if (state.timer <= 0) {
        this.showDisappearingBlock(state);
        changed = true;
      }
    }

    return changed;
  }

  private hideDisappearingBlock(state: DisappearingBlockRuntimeState): void {
    const view = this.options.objectViews.get(state.mapObject.id);

    if (view) {
      view.visible = false;
    }

    this.options.physicsSystem.removeCollider(state.mapObject.id);
    this.options.audio.play("disappearingBlock");
    this.options.feedback.spawn("disappearingBlock", state.mapObject.position);
    state.phase = "hidden";
    state.timer = Math.max(0, getNumber(state.mapObject.properties?.respawnDelay, 3));
  }

  private showDisappearingBlock(state: DisappearingBlockRuntimeState): void {
    const view = this.options.objectViews.get(state.mapObject.id);

    if (view) {
      view.visible = true;
      applyObjectTransformToThree(view, state.mapObject);
      applyObjectAppearanceToThree(view, state.mapObject);
      this.options.physicsSystem.updateColliderForObject(state.mapObject, view, true);
    }

    state.phase = "idle";
    state.timer = 0;
  }

  private updateJumpPad(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    if (
      (this.jumpPadCooldowns.get(mapObject.id) ?? 0) > 0 ||
      !this.intersects(mapObject, playerBounds)
    ) {
      return false;
    }

    this.options.applyPlayerImpulseY(Math.max(0, getNumber(mapObject.properties?.force, 12)));
    this.jumpPadCooldowns.set(
      mapObject.id,
      Math.max(0.05, getNumber(mapObject.properties?.cooldown, 0.4))
    );
    this.options.hud.showMessage("Impulso!");
    this.options.audio.play("jumpPad");
    this.options.feedback.spawn("jumpPad", mapObject.position);
    this.options.playJumpPadFeedback();
    return true;
  }

  private updateTeleporter(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    if (
      (this.teleporterCooldowns.get(mapObject.id) ?? 0) > 0 ||
      !this.intersects(mapObject, playerBounds)
    ) {
      return false;
    }

    const targetTeleporterId = getString(mapObject.properties?.targetTeleporterId, "").trim();

    if (!targetTeleporterId) {
      return false;
    }

    const target = this.options.map.objects.find(
      (candidate) =>
        candidate.type === "teleporter" &&
        (candidate.id === targetTeleporterId ||
          candidate.properties?.teleporterId === targetTeleporterId)
    );

    if (!target) {
      return false;
    }

    this.options.setPlayerPosition(target.position);
    this.options.resetPlayerVelocity();
    const cooldown = Math.max(
      0.2,
      getNumber(mapObject.properties?.cooldown, 1),
      getNumber(target.properties?.cooldown, 1)
    );
    this.teleporterCooldowns.set(mapObject.id, cooldown);
    this.teleporterCooldowns.set(target.id, cooldown);
    this.options.hud.showMessage("Teleporte");
    this.options.audio.play("teleporter");
    this.options.feedback.spawn("teleport", mapObject.position);
    this.options.feedback.spawn("teleport", target.position);
    return true;
  }

  private intersects(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    const view = this.options.objectViews.get(mapObject.id);

    if (!view || !view.visible) {
      return false;
    }

    const objectBounds = new THREE.Box3().setFromObject(view);
    objectBounds.expandByScalar(0.18);
    return objectBounds.intersectsBox(playerBounds);
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
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
