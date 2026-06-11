import * as THREE from "three";
import type { GameMap } from "../../../shared/types/MapSchema";
import type { WorldEvent } from "../../../shared/types/MultiplayerSchema";
import type { MapObject } from "../../../shared/types/ObjectSchema";
import type { AudioSystem } from "../../AudioSystem";
import type { FeedbackSystem } from "../../FeedbackSystem";
import {
  applyObjectAppearanceToThree,
  applyObjectTransformToThree,
} from "../../ObjectFactory";
import type { RuntimeHud } from "../../RuntimeHud";
import {
  applyButtonActivatedVisual,
  applyDoorClosedVisual,
  applyDoorOpenVisual,
  findLinkedDoor,
  getDoorId,
  getLinkedDoorIds,
  isButtonObject,
  isDoorObject,
} from "../../mechanics/DoorButtonMechanics";
import type { PhysicsSystem } from "../../PhysicsSystem";
import type { RuntimeSystem } from "../core/RuntimeSystem";

export type DoorOpenOptions = {
  showMessage?: boolean;
  ignoreKeyRequirement?: boolean;
  emitWorldEvent?: boolean;
  dispatchRuntimeEvents?: boolean;
};

export type DoorCloseOptions = {
  showFeedback?: boolean;
  emitWorldEvent?: boolean;
};

export type ButtonActivationOptions = {
  playFeedback?: boolean;
  emitWorldEvent?: boolean;
  triggerLinkedDoor?: boolean;
  dispatchRuntimeEvents?: boolean;
};

export type RuntimeDoorButtonLogicEvent =
  | { type: "onButtonActivated"; objectId: string };

export type RuntimeDoorButtonSystemOptions = {
  map: GameMap;
  objectViews: Map<string, THREE.Object3D>;
  physicsSystem: PhysicsSystem;
  hud: RuntimeHud;
  audio: AudioSystem;
  feedback: FeedbackSystem;
  hasKey: (keyId: string) => boolean;
  getKeyLabel: (keyId: string) => string | null;
  showMissingKeyMessage: (keyLabel: string | null) => void;
  emitWorldEvent: (event: WorldEvent) => void;
  onDoorOpened: (doorId: string) => void;
  onButtonActivated: (objectId: string) => void;
  onLogicEvent: (event: RuntimeDoorButtonLogicEvent) => void;
};

export class RuntimeDoorButtonSystem implements RuntimeSystem {
  readonly id = "door-buttons";

  private readonly openedDoorIds = new Set<string>();
  private readonly activatedButtonIds = new Set<string>();
  private readonly initialDoorPositions = new Map<string, THREE.Vector3>();
  private warnedMissingDoorIds = new Set<string>();

  constructor(private readonly options: RuntimeDoorButtonSystemOptions) {
    this.captureDoorPositions();
    this.reset();
  }

  reset(): void {
    this.openedDoorIds.clear();
    this.activatedButtonIds.clear();
    this.warnedMissingDoorIds = new Set();
    this.restoreDoorAndButtonViews();
    this.applyInitialDoorState();
  }

  updateObject(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    if (isButtonObject(mapObject)) {
      return this.updateButton(mapObject, playerBounds);
    }

    if (isDoorObject(mapObject)) {
      return this.updateDoorTouch(mapObject, playerBounds);
    }

    return false;
  }

  getInteractionHint(objectId: string): string | null {
    const target = this.getObjectById(objectId);

    if (!target) {
      return null;
    }

    if (isButtonObject(target)) {
      const oneTime = target.properties?.oneTime !== false;
      return oneTime && this.activatedButtonIds.has(target.id) ? null : "Botao";
    }

    if (isDoorObject(target)) {
      const doorId = getDoorId(target);
      return this.openedDoorIds.has(doorId) ? null : "Porta";
    }

    return null;
  }

  interactWithObject(objectId: string): boolean {
    const target = this.getObjectById(objectId);

    if (!target) {
      return false;
    }

    if (isButtonObject(target)) {
      return this.activateButton(target);
    }

    if (isDoorObject(target)) {
      return this.openDoor(target);
    }

    return false;
  }

  applyWorldEvent(event: WorldEvent): boolean {
    if (event.type === "doorOpened") {
      return this.openDoorById(event.doorId, {
        showMessage: false,
        ignoreKeyRequirement: true,
        emitWorldEvent: false,
        dispatchRuntimeEvents: false,
      });
    }

    if (event.type === "doorClosed") {
      return this.closeDoorById(event.doorId, {
        showFeedback: false,
        emitWorldEvent: false,
      });
    }

    if (event.type === "buttonActivated") {
      const button = this.getObjectById(event.objectId);
      if (!button || !isButtonObject(button)) {
        return false;
      }

      return this.activateButton(button, {
        playFeedback: false,
        emitWorldEvent: false,
        triggerLinkedDoor: false,
        dispatchRuntimeEvents: false,
      });
    }

    return false;
  }

  openDoorById(doorId: string, options: DoorOpenOptions = {}): boolean {
    const door = this.getDoorById(doorId);
    return door ? this.openDoor(door, options) : false;
  }

  closeDoorById(doorId: string, options: DoorCloseOptions = {}): boolean {
    const door = this.getDoorById(doorId);

    if (!door) {
      return false;
    }

    const view = this.options.objectViews.get(door.id);

    if (!view) {
      return false;
    }

    const resolvedDoorId = getDoorId(door);

    if (!this.openedDoorIds.has(resolvedDoorId)) {
      return false;
    }

    const initialPosition = this.initialDoorPositions.get(door.id);

    if (initialPosition) {
      applyDoorClosedVisual(view, initialPosition);
    } else {
      applyObjectTransformToThree(view, door);
    }

    this.openedDoorIds.delete(resolvedDoorId);
    this.options.physicsSystem.updateColliderForObject(door, view, true);

    if (options.showFeedback !== false) {
      this.options.hud.showMessage("Porta fechada");
      this.options.audio.play("door");
      this.options.feedback.spawn("door", door.position);
    }

    if (options.emitWorldEvent !== false) {
      this.options.emitWorldEvent({ type: "doorClosed", doorId: resolvedDoorId, objectId: door.id });
    }

    return true;
  }

  isDoorOpenById(doorId: string): boolean {
    const door = this.getDoorById(doorId);
    const resolvedDoorId = door ? getDoorId(door) : doorId;
    return this.openedDoorIds.has(resolvedDoorId);
  }

  activateButton(mapObject: MapObject, options: ButtonActivationOptions = {}): boolean {
    const oneTime = mapObject.properties?.oneTime !== false;

    if (oneTime && this.activatedButtonIds.has(mapObject.id)) {
      return false;
    }

    const targetDoorId = getLinkedDoorIds(mapObject)[0] ?? "";

    if (targetDoorId && options.triggerLinkedDoor !== false) {
      const door = findLinkedDoor(this.options.map.objects, targetDoorId);

      if (!door) {
        if (!this.warnedMissingDoorIds.has(targetDoorId)) {
          console.warn(`Mini Blox: door "${targetDoorId}" was not found.`);
          this.warnedMissingDoorIds.add(targetDoorId);
        }

        return false;
      }

      if (!this.openDoor(door, { emitWorldEvent: options.emitWorldEvent })) {
        return false;
      }
    }

    return this.markButtonActivated(mapObject, targetDoorId || undefined, options);
  }

  private openDoor(door: MapObject, options: DoorOpenOptions = {}): boolean {
    const doorId = getDoorId(door);
    const showMessage = options.showMessage !== false;
    const ignoreKeyRequirement = options.ignoreKeyRequirement === true;

    if (this.openedDoorIds.has(doorId)) {
      return false;
    }

    if (!ignoreKeyRequirement && !this.canOpenDoorWithKey(door, showMessage)) {
      return false;
    }

    const view = this.options.objectViews.get(door.id);

    if (!view) {
      return false;
    }

    applyDoorOpenVisual(view, door);
    this.options.physicsSystem.removeCollider(door.id);
    this.openedDoorIds.add(doorId);

    if (options.dispatchRuntimeEvents !== false) {
      this.options.onDoorOpened(doorId);
    }

    if (showMessage) {
      this.options.hud.showMessage("Porta aberta");
      this.options.audio.play("door");
      this.options.feedback.spawn("door", door.position);
    }

    if (options.emitWorldEvent !== false) {
      this.options.emitWorldEvent({ type: "doorOpened", doorId, objectId: door.id });
    }

    return true;
  }

  private markButtonActivated(
    mapObject: MapObject,
    doorId?: string,
    options: ButtonActivationOptions = {}
  ): boolean {
    const alreadyActivated = this.activatedButtonIds.has(mapObject.id);
    const canRepeat = mapObject.properties?.oneTime === false && options.emitWorldEvent !== false;

    if (alreadyActivated && !canRepeat) {
      return false;
    }

    this.activatedButtonIds.add(mapObject.id);
    const view = this.options.objectViews.get(mapObject.id);

    if (view) {
      applyButtonActivatedVisual(view, mapObject);
    }

    if (options.playFeedback !== false) {
      this.options.audio.play("button");
      this.options.feedback.spawn("button", mapObject.position);
      this.options.hud.showMessage(doorId ? "Botao acionado: porta liberada" : "Botao acionado", 1400);
    }

    if (options.dispatchRuntimeEvents !== false) {
      this.options.onButtonActivated(mapObject.id);
      this.options.onLogicEvent({ type: "onButtonActivated", objectId: mapObject.id });
    }

    if (options.emitWorldEvent !== false) {
      this.options.emitWorldEvent({ type: "buttonActivated", objectId: mapObject.id, doorId });
    }

    return true;
  }

  private updateButton(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    if (!this.intersects(mapObject, playerBounds)) {
      return false;
    }

    return this.activateButton(mapObject);
  }

  private updateDoorTouch(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    if (!this.hasRequiredKey(mapObject) || !this.intersects(mapObject, playerBounds)) {
      return false;
    }

    return this.openDoor(mapObject);
  }

  private hasRequiredKey(door: MapObject): boolean {
    return getString(door.properties?.requiredKeyId, "").trim().length > 0;
  }

  private canOpenDoorWithKey(door: MapObject, showMessage: boolean): boolean {
    const requiredKeyId = getString(door.properties?.requiredKeyId, "").trim();

    if (!requiredKeyId || this.options.hasKey(requiredKeyId)) {
      return true;
    }

    if (showMessage) {
      this.options.showMissingKeyMessage(this.options.getKeyLabel(requiredKeyId));
    }

    return false;
  }

  private captureDoorPositions(): void {
    for (const mapObject of this.options.map.objects) {
      if (!isDoorObject(mapObject)) {
        continue;
      }

      const view = this.options.objectViews.get(mapObject.id);

      if (view) {
        this.initialDoorPositions.set(mapObject.id, view.position.clone());
      }
    }
  }

  private restoreDoorAndButtonViews(): void {
    for (const mapObject of this.options.map.objects) {
      if (!isDoorObject(mapObject) && !isButtonObject(mapObject)) {
        continue;
      }

      const view = this.options.objectViews.get(mapObject.id);
      if (!view) {
        continue;
      }

      view.visible = true;
      applyObjectTransformToThree(view, mapObject);
      applyObjectAppearanceToThree(view, mapObject);

      if (isDoorObject(mapObject)) {
        this.options.physicsSystem.updateColliderForObject(mapObject, view, true);
      }
    }
  }

  private applyInitialDoorState(): void {
    for (const door of this.options.map.objects.filter(isDoorObject)) {
      if (door.properties?.startsOpen || door.properties?.doorState === "open") {
        this.openDoor(door, {
          showMessage: false,
          ignoreKeyRequirement: true,
          emitWorldEvent: false,
          dispatchRuntimeEvents: false,
        });
      }
    }
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

  private getDoorById(doorId: string): MapObject | null {
    return (
      this.options.map.objects.find(
        (candidate) =>
          isDoorObject(candidate) && (candidate.id === doorId || getDoorId(candidate) === doorId)
      ) ?? null
    );
  }

  private getObjectById(objectId: string): MapObject | null {
    return this.options.map.objects.find((mapObject) => mapObject.id === objectId) ?? null;
  }
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
