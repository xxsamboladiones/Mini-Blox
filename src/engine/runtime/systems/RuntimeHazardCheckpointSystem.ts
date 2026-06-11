import * as THREE from "three";
import type { GameMap } from "../../../shared/types/MapSchema";
import type { MapObject, Vector3 } from "../../../shared/types/ObjectSchema";
import type { AudioSystem } from "../../AudioSystem";
import type { FeedbackSystem } from "../../FeedbackSystem";
import {
  applyObjectAppearanceToThree,
} from "../../ObjectFactory";
import type { RuntimeHud } from "../../RuntimeHud";
import {
  getDamageZoneAmount,
  getDamageZoneCooldownSeconds,
  getDamageZoneMode,
  isDamageZoneObject,
  shouldApplyDamageZone,
} from "../../mechanics/DamageZoneMechanics";
import type { RuntimeSystem } from "../core/RuntimeSystem";

export type RuntimeHazardCheckpointSystemOptions = {
  map: GameMap;
  objectViews: Map<string, THREE.Object3D>;
  hud: RuntimeHud;
  audio: AudioSystem;
  feedback: FeedbackSystem;
  getPlayerBounds: () => THREE.Box3;
  getDeathCooldown: () => number;
  setDamageCooldown: (cooldownSeconds: number) => void;
  isPlayerDead: () => boolean;
  setRespawnPoint: (position: Vector3) => void;
  damagePlayer: (amount: number, message: string, position: Vector3) => void;
  killPlayer: (message: string, position: Vector3) => void;
};

export class RuntimeHazardCheckpointSystem implements RuntimeSystem {
  readonly id = "hazard-checkpoints";

  private readonly activatedCheckpointIds = new Set<string>();
  private readonly messageZoneTriggeredIds = new Set<string>();
  private readonly messageZoneInsideIds = new Set<string>();

  constructor(private readonly options: RuntimeHazardCheckpointSystemOptions) {}

  reset(): void {
    this.activatedCheckpointIds.clear();
    this.messageZoneTriggeredIds.clear();
    this.messageZoneInsideIds.clear();
    this.restoreCheckpointViews();
  }

  updateObject(mapObject: MapObject, playerBounds = this.options.getPlayerBounds()): boolean {
    if (mapObject.type === "checkpoint") {
      return this.updateCheckpoint(mapObject, playerBounds);
    }

    if (isDamageZoneObject(mapObject)) {
      return this.updateDamageZone(mapObject, playerBounds);
    }

    if (mapObject.type === "messageZone") {
      return this.updateMessageZone(mapObject, playerBounds);
    }

    return false;
  }

  setCheckpointFromObject(objectId: string): boolean {
    const target = this.options.map.objects.find((mapObject) => mapObject.id === objectId);

    if (!target) {
      return false;
    }

    this.activateCheckpoint(target);
    return true;
  }

  private updateCheckpoint(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    if (this.activatedCheckpointIds.has(mapObject.id) || !this.intersects(mapObject, playerBounds)) {
      return false;
    }

    this.activateCheckpoint(mapObject);
    return true;
  }

  private activateCheckpoint(mapObject: MapObject): void {
    this.activatedCheckpointIds.add(mapObject.id);
    this.options.setRespawnPoint(mapObject.position);

    if (mapObject.type === "checkpoint") {
      const activatedColor = getString(mapObject.properties?.activatedColor, "#22c55e");
      const view = this.options.objectViews.get(mapObject.id);

      if (view) {
        applyObjectAppearanceToThree(view, {
          ...mapObject,
          properties: {
            ...mapObject.properties,
            color: activatedColor,
          },
        });
      }
    }

    this.options.hud.showMessage("Checkpoint ativado");
    this.options.audio.play("checkpoint");
    this.options.feedback.spawn("checkpoint", mapObject.position);
  }

  private updateDamageZone(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    if (
      !shouldApplyDamageZone(this.options.getDeathCooldown(), this.intersects(mapObject, playerBounds))
    ) {
      return false;
    }

    const mode = getDamageZoneMode(mapObject);

    if (mode === "damage") {
      const amount = getDamageZoneAmount(mapObject);
      this.options.damagePlayer(amount, "Cuidado! Voce sofreu dano", mapObject.position);

      if (!this.options.isPlayerDead()) {
        this.options.setDamageCooldown(getDamageZoneCooldownSeconds());
      }

      return true;
    }

    this.options.killPlayer("Voce morreu", mapObject.position);
    return true;
  }

  private updateMessageZone(mapObject: MapObject, playerBounds: THREE.Box3): boolean {
    const inside = this.intersects(mapObject, playerBounds);

    if (!inside) {
      this.messageZoneInsideIds.delete(mapObject.id);
      return false;
    }

    if (this.messageZoneInsideIds.has(mapObject.id)) {
      return false;
    }

    this.messageZoneInsideIds.add(mapObject.id);

    if (mapObject.properties?.oneTime !== false && this.messageZoneTriggeredIds.has(mapObject.id)) {
      return false;
    }

    this.messageZoneTriggeredIds.add(mapObject.id);
    this.options.audio.play("message");
    this.options.hud.showMessage(getString(mapObject.properties?.message, "Bem-vindo ao mapa!"), 2600);
    return true;
  }

  private restoreCheckpointViews(): void {
    for (const mapObject of this.options.map.objects) {
      if (mapObject.type !== "checkpoint") {
        continue;
      }

      const view = this.options.objectViews.get(mapObject.id);

      if (view) {
        applyObjectAppearanceToThree(view, mapObject);
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
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
