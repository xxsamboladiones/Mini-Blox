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

`RuntimeSystemManager` calls `start`, `update` and `reset` in registration order. `dispose` runs in reverse order. Interaction and world-event hooks are resolved by priority, then registration order. System IDs must be unique; duplicate registration throws immediately, and `getSystem(id)` exists for targeted tests/debugging.

## Current Systems

- `RuntimePickupSystem` owns coins, keys, item pickups, item spawners, pickup inventory HUD state and pickup world events.
- `RuntimeDoorButtonSystem` owns opened doors, activated buttons, required-key checks, door/button visuals and door/button world events.
- `RuntimeMovementObjectSystem` owns moving platforms, disappearing blocks, jump pads, teleporters, their cooldown/state maps and collider updates.
- `RuntimeHazardCheckpointSystem` owns checkpoints, damage zones, message zones, checkpoint/message state and hazard cooldown bridging.
- `RuntimeTycoonSystem` adapts the existing `TycoonSystem` to the common lifecycle.
- `RuntimeCombatSystem` remains a focused helper system owned by `RuntimeMechanics`.

Tycoon now uses the manager for update, reset, dispose, interaction hints, object interaction and `tycoonPurchase`/`tycoonUpgrade` world events. Direct Tycoon queries still remain where `LogicRuntime`, `ObjectiveRuntime`, `GameModeRuntime` and shared world-state snapshots need specialized APIs.

Hazards/checkpoints, movement objects, pickups and door/buttons are registered before Tycoon:

1. `RuntimeHazardCheckpointSystem`, with default lifecycle priority and no interaction/world-event hooks.
2. `RuntimeMovementObjectSystem`, with default lifecycle priority and no interaction/world-event hooks.
3. `RuntimePickupSystem`, with pickup interaction/world-event priority.
4. `RuntimeDoorButtonSystem`, with door/button interaction/world-event priority.
5. `RuntimeTycoonSystem`, with Tycoon interaction/world-event priority.

Static map-object touch checks for checkpoints, damage zones, message zones, coins, keys, buttons, doors, disappearing blocks, jump pads and teleporters are still delegated from the existing `RuntimeMechanics` object loop through `updateObject(...)`. This preserves the older map iteration order while moving ownership of the state and behavior into focused systems.

## System Dependencies

`RuntimePickupSystem` depends on:

- `GameMap`, `world`, `objectViews`, HUD, audio and feedback services;
- player bounds for spawned pickup overlap checks;
- callbacks for healing, weapon equip, objective/game-mode coin progress, key objectives, logic events and multiplayer heal requests.

`RuntimeDoorButtonSystem` depends on:

- `GameMap`, `objectViews`, `PhysicsSystem`, HUD, audio and feedback services;
- `RuntimePickupSystem` for `hasKey` and key labels;
- callbacks for objective progress, logic events and world-event emission.

`RuntimeMovementObjectSystem` depends on:

- `GameMap`, `objectViews`, `PhysicsSystem`, HUD, audio and feedback services;
- player bounds for touch-triggered objects;
- callbacks to set player position, reset velocity, apply jump-pad impulse and play jump-pad feedback.

`RuntimeHazardCheckpointSystem` depends on:

- `GameMap`, `objectViews`, HUD, audio and feedback services;
- player bounds for touch-triggered checkpoints, damage zones and message zones;
- callbacks to set respawn point, damage/kill the player, read player death state and bridge the shared death cooldown still owned by `RuntimeMechanics`.

`RuntimeMechanics` still acts as the bridge for cross-system callbacks so systems do not import each other directly.

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
- combat/projectile flow and equipped weapon state;
- void death, finish/goal and enemy flows that have not yet been extracted;
- map-object iteration that delegates touch checks into the extracted systems.

Future refactors should move those domains one at a time, protected by tests and smokes.
