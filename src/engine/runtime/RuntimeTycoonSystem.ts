import type * as THREE from "three";
import type { WorldEvent } from "../../shared/types/MultiplayerSchema";
import type { Vector3 } from "../../shared/types/ObjectSchema";
import type { TycoonSystem } from "../mechanics/TycoonSystem";
import type { RuntimeSystem } from "./core/RuntimeSystem";

export class RuntimeTycoonSystem implements RuntimeSystem {
  readonly id = "tycoon";

  constructor(
    private readonly tycoonSystem: TycoonSystem,
    private readonly getPlayerBounds: () => THREE.Box3,
    private readonly getPlayerPosition: () => Vector3
  ) {}

  update(deltaSeconds: number): void {
    this.tycoonSystem.update(deltaSeconds, this.getPlayerBounds(), this.getPlayerPosition());
  }

  reset(): void {
    this.tycoonSystem.reset();
  }

  dispose(): void {
    this.tycoonSystem.dispose();
  }

  getInteractionHint(objectId: string): string | null {
    return this.tycoonSystem.getInteractionHint(objectId);
  }

  interactWithObject(objectId: string): boolean {
    return this.tycoonSystem.interactWithObject(objectId);
  }

  applyWorldEvent(event: WorldEvent): boolean {
    return this.tycoonSystem.applyWorldEvent(event);
  }
}
