import type { WorldEvent } from "../../../shared/types/MultiplayerSchema";
import type { RuntimeSystemRegistrationOptions } from "./RuntimeInteraction";
import type { RuntimeSystem } from "./RuntimeSystem";

type RuntimeSystemRegistration = {
  system: RuntimeSystem;
  order: number;
  interactionPriority: number;
  worldEventPriority: number;
};

export class RuntimeSystemManager {
  private readonly registrations: RuntimeSystemRegistration[] = [];
  private nextOrder = 0;

  register(
    system: RuntimeSystem,
    options: RuntimeSystemRegistrationOptions = {}
  ): RuntimeSystem {
    this.registrations.push({
      system,
      order: this.nextOrder,
      interactionPriority: options.interactionPriority ?? 0,
      worldEventPriority: options.worldEventPriority ?? 0,
    });
    this.nextOrder += 1;
    return system;
  }

  start(): void {
    for (const { system } of this.registrations) {
      system.start?.();
    }
  }

  update(deltaSeconds: number): void {
    for (const { system } of this.registrations) {
      system.update?.(deltaSeconds);
    }
  }

  reset(): void {
    for (const { system } of this.registrations) {
      system.reset?.();
    }
  }

  dispose(): void {
    for (const { system } of [...this.registrations].reverse()) {
      system.dispose?.();
    }
  }

  getInteractionHint(objectId: string): string | null {
    for (const { system } of this.getInteractionRegistrations()) {
      const hint = system.getInteractionHint?.(objectId) ?? null;
      if (hint) {
        return hint;
      }
    }

    return null;
  }

  interactWithObject(objectId: string): boolean {
    for (const { system } of this.getInteractionRegistrations()) {
      if (system.interactWithObject?.(objectId)) {
        return true;
      }
    }

    return false;
  }

  applyWorldEvent(event: WorldEvent): boolean {
    for (const { system } of this.getWorldEventRegistrations()) {
      if (system.applyWorldEvent?.(event)) {
        return true;
      }
    }

    return false;
  }

  private getInteractionRegistrations(): RuntimeSystemRegistration[] {
    return [...this.registrations].sort(
      (a, b) => b.interactionPriority - a.interactionPriority || a.order - b.order
    );
  }

  private getWorldEventRegistrations(): RuntimeSystemRegistration[] {
    return [...this.registrations].sort(
      (a, b) => b.worldEventPriority - a.worldEventPriority || a.order - b.order
    );
  }
}
