import type { WorldEvent } from "../../../shared/types/MultiplayerSchema";

export interface RuntimeSystem {
  readonly id: string;
  start?(): void;
  update?(deltaSeconds: number): void;
  reset?(): void;
  dispose?(): void;
  getInteractionHint?(objectId: string): string | null;
  interactWithObject?(objectId: string): boolean;
  applyWorldEvent?(event: WorldEvent): boolean;
}
