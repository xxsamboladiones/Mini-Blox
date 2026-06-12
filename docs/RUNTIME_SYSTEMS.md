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
- `RuntimeEnemySystem` owns enemy state, initialization, reset, spawn, network state application, patrol/chase movement, enemy attack cooldowns, enemy player damage callbacks and host position sync.
- `RuntimeProjectileSystem` owns projectile spawning, movement, expiry, cleanup, enemy projectile hit lookup and remote-player projectile hit lookup.
- `RuntimeCombatBridgeSystem` owns equipped-weapon state, attack cooldown HUD, high-level player attack flow, melee target selection and ranged projectile spawning.
- `RuntimeTycoonSystem` adapts the existing `TycoonSystem` to the common lifecycle.
- `RuntimeCombatSystem` remains a focused helper used internally by `RuntimeCombatBridgeSystem`.
- `RuntimeMechanics` still owns player lifecycle, finish/void flows and damage callbacks used by the combat systems.

Tycoon now uses the manager for update, reset, dispose, interaction hints, object interaction and `tycoonPurchase`/`tycoonUpgrade` world events. Direct Tycoon queries still remain where `LogicRuntime`, `ObjectiveRuntime`, `GameModeRuntime` and shared world-state snapshots need specialized APIs.

Hazards/checkpoints, movement objects, pickups and door/buttons are registered before Tycoon:

1. `RuntimeHazardCheckpointSystem`, with default lifecycle priority and no interaction/world-event hooks.
2. `RuntimeMovementObjectSystem`, with default lifecycle priority and no interaction/world-event hooks.
3. `RuntimePickupSystem`, with pickup interaction/world-event priority.
4. `RuntimeDoorButtonSystem`, with door/button interaction/world-event priority.
5. `RuntimeEnemySystem`, with default lifecycle priority and no interaction/world-event hooks.
6. `RuntimeProjectileSystem`, with default reset/dispose hooks. `RuntimeMechanics` calls projectile updates explicitly in the legacy frame position to preserve behavior.
7. `RuntimeCombatBridgeSystem`, with default reset hooks. `RuntimeMechanics` calls combat updates explicitly in the legacy frame position to preserve behavior.
8. `RuntimeTycoonSystem`, with Tycoon interaction/world-event priority.

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

`RuntimeEnemySystem` depends on:

- `GameMap`, `objectViews`, `PhysicsSystem`, HUD, audio and feedback services;
- callbacks for objective progress, game-mode progress and logic events;
- a small `RuntimeMechanics` bridge to clear runtime-disabled state when logic respawns an enemy;
- optional host-state detection so multiplayer host updates can apply received enemy transforms immediately.
- player position/bounds/death state and multiplayer remote-player callbacks for chase, attack and position-sync behavior.

`RuntimeProjectileSystem` depends on:

- `world` and `objectViews` for projectile visual lifecycle and hit lookup;
- `RuntimeEnemySystem` state through a callback, without importing `RuntimeMechanics`;
- callbacks for solo enemy damage, multiplayer enemy-hit requests and multiplayer player-attack requests.

`RuntimeCombatBridgeSystem` depends on:

- HUD, audio and feedback services for attack/weapon feedback;
- player position, facing, equipped-weapon socket and attack-animation callbacks;
- `RuntimeEnemySystem` state and `RuntimeProjectileSystem` spawning through narrow callbacks;
- multiplayer callbacks for enemy hits, player attacks and remote attack visuals.

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
- player health/damage/death callbacks used by enemy and combat systems;
- void death and finish/goal flows;
- map-object iteration that delegates touch checks into the extracted systems.

Future refactors should move those domains one at a time, protected by tests and smokes.

## Enemy Extraction Readiness

`RuntimeEnemySystem` owns enemy state, initialization, reset, spawn, `applyEnemyUpdated`/
`applyEnemyDefeated`, movement, patrol, chase, enemy player damage and host position-sync behavior.
`RuntimeProjectileSystem` owns projectile lifecycle and projectile hit lookup/application callbacks.
`RuntimeCombatBridgeSystem` owns equipped weapon, cooldown HUD, high-level player attack flow,
melee target selection and ranged projectile spawning. `RuntimeMechanics` remains the coordinator for
player lifecycle, global damage/death callbacks, logic/objective/game-mode wiring and shared
multiplayer state application.
