import { describe, expect, it, vi } from "vitest";
import { RuntimeSystemManager } from "./RuntimeSystemManager";
import type { RuntimeSystem } from "./RuntimeSystem";
import type { WorldEvent } from "../../../shared/types/MultiplayerSchema";

describe("RuntimeSystemManager", () => {
  it("chama start/update/reset em ordem de registro", () => {
    const calls: string[] = [];
    const first = createSystem("first", calls);
    const second = createSystem("second", calls);
    const manager = new RuntimeSystemManager();

    manager.register(first);
    manager.register(second);

    manager.start();
    manager.update(0.16);
    manager.reset();

    expect(calls).toEqual([
      "first:start",
      "second:start",
      "first:update:0.16",
      "second:update:0.16",
      "first:reset",
      "second:reset",
    ]);
  });

  it("chama dispose em ordem inversa", () => {
    const calls: string[] = [];
    const manager = new RuntimeSystemManager();

    manager.register(createSystem("first", calls));
    manager.register(createSystem("second", calls));
    manager.dispose();

    expect(calls).toEqual(["second:dispose", "first:dispose"]);
  });

  it("retorna o primeiro hint valido por prioridade de interacao", () => {
    const lowPriority = createSystem("low", [], {
      hint: "low hint",
    });
    const highPriority = createSystem("high", [], {
      hint: "high hint",
    });
    const manager = new RuntimeSystemManager();

    manager.register(lowPriority, { interactionPriority: 1 });
    manager.register(highPriority, { interactionPriority: 10 });

    expect(manager.getInteractionHint("object")).toBe("high hint");
  });

  it("para interact no primeiro sistema que retorna true", () => {
    const firstInteract = vi.fn(() => false);
    const secondInteract = vi.fn(() => true);
    const thirdInteract = vi.fn(() => true);
    const manager = new RuntimeSystemManager();

    manager.register(createSystem("first", [], { interact: firstInteract }));
    manager.register(createSystem("second", [], { interact: secondInteract }));
    manager.register(createSystem("third", [], { interact: thirdInteract }));

    expect(manager.interactWithObject("button")).toBe(true);
    expect(firstInteract).toHaveBeenCalledWith("button");
    expect(secondInteract).toHaveBeenCalledWith("button");
    expect(thirdInteract).not.toHaveBeenCalled();
  });

  it("para applyWorldEvent no primeiro sistema que aplica", () => {
    const firstApply = vi.fn(() => false);
    const secondApply = vi.fn(() => true);
    const thirdApply = vi.fn(() => true);
    const event: WorldEvent = { type: "coinCollected", objectId: "coin" };
    const manager = new RuntimeSystemManager();

    manager.register(createSystem("first", [], { applyWorldEvent: firstApply }));
    manager.register(createSystem("second", [], { applyWorldEvent: secondApply }));
    manager.register(createSystem("third", [], { applyWorldEvent: thirdApply }));

    expect(manager.applyWorldEvent(event)).toBe(true);
    expect(firstApply).toHaveBeenCalledWith(event);
    expect(secondApply).toHaveBeenCalledWith(event);
    expect(thirdApply).not.toHaveBeenCalled();
  });
});

function createSystem(
  id: string,
  calls: string[],
  overrides: Partial<RuntimeSystem> & {
    hint?: string | null;
    interact?: (objectId: string) => boolean;
    applyWorldEvent?: (event: WorldEvent) => boolean;
  } = {}
): RuntimeSystem {
  return {
    id,
    start: () => calls.push(`${id}:start`),
    update: (deltaSeconds) => calls.push(`${id}:update:${deltaSeconds}`),
    reset: () => calls.push(`${id}:reset`),
    dispose: () => calls.push(`${id}:dispose`),
    getInteractionHint:
      overrides.hint === undefined ? undefined : () => overrides.hint ?? null,
    interactWithObject: overrides.interact,
    applyWorldEvent: overrides.applyWorldEvent,
    ...overrides,
  };
}
