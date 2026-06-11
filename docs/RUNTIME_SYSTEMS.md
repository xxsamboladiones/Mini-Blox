# Runtime Systems

`RuntimeMechanics` is the high-level runtime orchestrator. Gameplay domains should live behind small runtime systems instead of adding new mechanics directly to the orchestrator.

## Core Contracts

The shared runtime contracts live in `src/engine/runtime/core`:

- `RuntimeSystem.ts` defines optional lifecycle, interaction and world-event hooks.
- `RuntimeSystemManager.ts` registers systems and calls them in a deterministic order.
- `RuntimeInteraction.ts` defines interaction priority constants.
- `RuntimeContext.ts` documents the common dependencies a future system may need.
- `RuntimeEvents.ts` contains shared event handler types.

## Lifecycle

Systems may implement any of these hooks:

```ts
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
```

`RuntimeSystemManager` calls `start`, `update` and `reset` in registration order. `dispose` runs in reverse order. Interaction and world-event hooks are resolved by priority, then registration order.

## Current Systems

- `RuntimeTycoonSystem` adapts the existing `TycoonSystem` to the common lifecycle.
- `RuntimeCombatSystem` and `RuntimeInventorySystem` remain focused helper systems owned by `RuntimeMechanics`.

Tycoon now uses the manager for update, reset, dispose, interaction hints, object interaction and `tycoonPurchase`/`tycoonUpgrade` world events. Direct Tycoon queries still remain where `LogicRuntime`, `ObjectiveRuntime`, `GameModeRuntime` and shared world-state snapshots need specialized APIs.

## Adding A Runtime System

1. Add stateful behavior to a focused class under `src/engine/runtime` or `src/engine/mechanics`.
2. Implement `RuntimeSystem` directly or create a thin adapter.
3. Register it from `RuntimeMechanics` with an explicit interaction/world-event priority.
4. Add tests for lifecycle, reset, interaction and event handling.
5. Document any remaining bridge API needed by logic, objectives, game modes or multiplayer.

Example:

```ts
this.runtimeSystems.register(new RuntimeTycoonSystem(tycoon, getBounds, getPosition), {
  interactionPriority: RUNTIME_INTERACTION_PRIORITIES.tycoon,
  worldEventPriority: RUNTIME_INTERACTION_PRIORITIES.tycoon,
});
```

## What Should Stay In RuntimeMechanics

For now, `RuntimeMechanics` still owns cross-cutting runtime wiring:

- player lifecycle, respawn and void death;
- high-level restart/finish/menu/edit actions;
- wiring for `LogicRuntime`, `ObjectiveRuntime` and `GameModeRuntime`;
- multiplayer bridge methods and shared state application;
- older pickup, door/button, hazard, checkpoint, moving object and enemy flows that have not yet been extracted.

Future refactors should move those domains one at a time, protected by tests and smokes.
