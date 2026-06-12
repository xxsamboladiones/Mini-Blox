# Enemy And Combat Audit

This document captures the current enemy, combat and projectile behavior during the incremental
`RuntimeEnemySystem`, `RuntimeProjectileSystem` and `RuntimeCombatBridgeSystem` extraction. Phase 2
moved enemy state, initialization, reset, spawn, network state application, movement,
patrol/chase behavior, enemy attacks and host position sync into `RuntimeEnemySystem`. Phase 3 moved
projectile lifecycle, movement, expiry, cleanup and projectile hit lookup/application callbacks into
`RuntimeProjectileSystem`. Phase 4 moved equipped weapon state, weapon cooldown HUD, high-level
player attack flow, melee target selection and ranged projectile spawning into
`RuntimeCombatBridgeSystem`.

## Scope

Audited files:

- `src/engine/RuntimeMechanics.ts`
- `src/engine/mechanics/EnemyMechanics.ts`
- `src/engine/mechanics/ProjectileMechanics.ts`
- `src/engine/runtime/RuntimeCombatSystem.ts`
- `src/engine/ObjectiveRuntime.ts`
- `src/engine/GameModeRuntime.ts`
- `src/engine/RuntimeNetworkController.ts`
- `src/shared/types/MultiplayerSchema.ts`
- `server/src/multiplayer/Room.ts`
- `server/src/multiplayer/MultiplayerServer.ts`

## Enemy State

Enemy runtime state is now owned by `RuntimeEnemySystem`:

- `enemyStates`: runtime state per map object id.
- `defeatedEnemyIds`: idempotency and objective/game-mode progress guard.
- `allEnemiesDefeatedDispatched`: ensures the global logic event fires once.

`RuntimeEnemySystem` also owns `enemySyncAccumulator`, which throttles host enemy position updates.

Each enemy state stores:

- original `MapObject`;
- spawn position;
- `health` and `maxHealth`;
- attack cooldown;
- patrol target side;
- network target position and rotation;
- network state: `idle`, `patrol`, `chase` or `dead`.

`EnemyMechanics.ts` resolves enemy defaults:

- health: `properties.health` or `50`, minimum `1`;
- damage: `properties.damage` or `10`, minimum `1`;
- speed: `properties.speed` or `2`, minimum `0`;
- detection range: `properties.detectionRange` or `8`;
- attack range: `properties.attackRange` or `1.5`, minimum `0.2`;
- attack cooldown: `properties.attackCooldown` or `1`, minimum `0.2`;
- behavior: `idle`, `patrol` or `chase`, default `chase`.

## Initialization And Reset

`RuntimeEnemySystem.reset()` scans map objects and creates enemy states for objects with
`type === "enemy"`. It also resets the visual transform/appearance, visibility and collider state.

`RuntimeMechanics.restart()`:

- clears projectiles;
- resets combat cooldown and equipped weapon;
- restores every object transform and appearance;
- rebuilds physics colliders;
- resets extracted runtime systems, including `RuntimeEnemySystem`, plus game mode, objectives and
  logic.

`spawnEnemy(objectId)` is exposed by `RuntimeEnemySystem` and bridged through `LogicRuntime`. It
resets health, cooldown, target state, visual visibility and collider state for a defeated or
disabled enemy.

## Movement And Targeting

Enemy update happens through `RuntimeEnemySystem.updateEnemyBehavior(delta, playerBounds)`, called
from `RuntimeMechanics` in the same frame position the old enemy update used. Lifecycle `update()`
exists for isolated tests and future manager-driven ordering, but `RuntimeMechanics` currently calls
the explicit method to preserve existing update order.

Current rules:

- dead or invisible enemies are skipped;
- attack cooldown is reduced every update;
- multiplayer clients interpolate from received net state;
- solo and multiplayer host run behavior locally;
- `chase` targets the closest alive player in detection range;
- `patrol` moves between spawn position and `patrolOffset`;
- `idle` does not chase;
- host sends enemy position updates to the server every `0.14s`;
- enemy view rotation faces the movement direction.

## Enemy Attacks

Enemy attack uses `shouldEnemyAttackPlayer()`:

- attack if horizontal distance is within attack range or enemy bounds intersect player bounds;
- only when enemy attack cooldown is zero;
- only when player death cooldown is zero.

When an attack lands, `RuntimeMechanics.damagePlayer(...)` applies damage, plays HUD/audio/feedback
and dispatches `onPlayerDamaged` to logic. In multiplayer it also reports damage to the server via
`onPlayerDamageReport(damage, "enemy")`.

Fatal enemy damage:

- in solo, calls `killPlayer()`, which immediately respawns the player while showing defeat UI;
- in multiplayer, leaves respawn handling to the multiplayer flow and sets death cooldown.

## Player Melee Combat

`RuntimeMechanics.attack()` owns the high-level attack flow:

1. reject attacks while game is finished or death cooldown is active;
2. require an equipped weapon;
3. check `RuntimeCombatSystem.canAttack()`;
4. begin cooldown using the equipped weapon;
5. play attack HUD/audio/player/feedback;
6. broadcast attack visual in multiplayer;
7. if weapon is melee, find the best enemy inside range/cone;
8. in solo, call `damageEnemy(...)`;
9. in multiplayer, send `onEnemyHit(enemyObjectId, damage, weaponId)` to the server.

If no enemy is hit in multiplayer, the same attack can target a remote player and sends a
`playerAttack` payload.

## Enemy Damage And Death

`damageEnemy(state, amount)`:

- clamps health;
- plays hit feedback;
- shows `Inimigo: current/max` while alive;
- when health reaches zero, hides the view, removes its collider and records the enemy as defeated;
- shows "Inimigo derrotado";
- dispatches objective, game mode and logic events.

`dispatchEnemyDefeated(objectId)`:

- calls `ObjectiveRuntime.onEnemyDefeated(defeatedCount, totalEnemies)`;
- calls `GameModeRuntime.onEnemyDefeated(defeatedCount, totalEnemies)`;
- dispatches `onEnemyDefeated` and `onAnyEnemyDefeated`;
- dispatches `onAllEnemiesDefeated` exactly once after all enemy objects are defeated.

`applyEnemyDefeated(enemyObjectId)` is idempotent and is used by multiplayer server updates.

## Projectiles

Ranged weapons create projectiles through `ProjectileMechanics.ts`.

Current rules:

- projectile direction is flattened to horizontal movement;
- invalid zero-length directions are rejected;
- projectile range is stored as `remainingRange`;
- `advanceProjectile` moves by `projectileSpeed * delta` clamped by remaining range;
- projectile expires when remaining range is near zero;
- local projectiles can damage enemies or remote players;
- remote visual projectiles are not local and therefore never apply damage.

Projectile ownership and cleanup remain in `RuntimeMechanics`:

- `activeProjectiles`;
- `projectileSequence`;
- `spawnProjectile(...)`;
- `updateProjectiles(...)`;
- `removeProjectile(...)`;
- `clearProjectiles()`.

`restart()` and `dispose()` clear all active projectiles.

## Objectives And Game Modes

Enemy defeat updates:

- objective type `defeatEnemies`;
- fallback combat objectives in `ObjectiveRuntime`;
- combat/team score in `GameModeRuntime`;
- logic triggers: `onEnemyDefeated`, `onAnyEnemyDefeated`, `onAllEnemiesDefeated`;
- score victory checks when configured.

`GameModeRuntime` currently grants enemy defeat score and can also grant objective score when the
enemy defeat completes a required objective. Tests should not assume a single score source unless
they intentionally isolate objectives.

## Multiplayer Protocol

Shared payloads live in `src/shared/types/MultiplayerSchema.ts`:

- `EnemyNetState`
- `EnemyPositionUpdate`
- `enemyState`
- `enemyUpdated`
- `enemyDefeated`
- `enemyHit`
- `enemyPositionUpdate`
- `playerAttack`
- `playerAttackVisual`
- `playerDamageReport`

Client bridge:

- `RuntimeNetworkController` sends enemy hits, enemy positions, player attacks, attack visuals,
  damage reports and heal requests through the multiplayer adapter.
- `RuntimeMechanics.applyEnemyState(...)` hydrates received enemy state snapshots.
- `RuntimeMechanics.applyEnemyUpdated(...)` applies health, state, target position and rotation.
- `RuntimeMechanics.applyEnemyDefeated(...)` applies final death idempotently.
- `RuntimeMechanics.applyRemoteAttackVisual(...)` creates ranged projectile visuals without damage.

Server authority:

- `Room.applyEnemyHit(...)` validates player alive state, enemy existence, enemy alive state, weapon
  id/rules, attack distance and cooldown.
- server weapon rules are loaded from the shared weapon rules mirror.
- server applies damage and returns `enemyUpdated` or `enemyDefeated`.
- `Room.updateEnemyPositions(...)` accepts position updates from the current host only and applies
  plausibility validation.
- `MultiplayerServer` broadcasts enemy updates/defeats and player attack visuals.

Current multiplayer model is host/server guarded, not pure client authority: clients may request
enemy damage, but final enemy health/death comes from the server update path.

## Responsibilities Still In RuntimeMechanics

After RuntimeEnemySystem, RuntimeProjectileSystem and RuntimeCombatBridgeSystem extraction,
`RuntimeMechanics` still owns:

- enemy damage application until fatal damage delegates to `RuntimeEnemySystem`;
- global multiplayer state application and server update entry points;
- player damage/death callbacks used by enemy and combat systems;
- global player death/respawn integration.

`RuntimeCombatSystem` only owns attack cooldown timing and is used inside
`RuntimeCombatBridgeSystem`.

## Protection Tests Added

`src/engine/RuntimeMechanicsEnemyCombat.test.ts` protects:

- enemy initial health and melee damage;
- enemy death visibility, collider removal and objective completion;
- single dispatch of `onAllEnemiesDefeated`;
- logic-driven `spawnEnemy`;
- restart restoration and projectile cleanup;
- enemy attack range/cooldown and fatal damage flow;
- ranged projectile creation, movement, expiry and enemy hit behavior;
- projectiles ignoring dead enemies;
- multiplayer enemy hit request behavior for host/client;
- network enemy update application;
- idempotent enemy defeat application;
- remote ranged attack visuals without duplicate damage.

`src/engine/runtime/systems/RuntimeEnemySystem.test.ts` protects:

- enemy initial state;
- reset/spawn restoration;
- `applyEnemyUpdated` and `applyEnemyDefeated`;
- idempotent defeated-enemy dispatch;
- objective, game-mode and logic callbacks;
- chase, idle and patrol movement;
- enemy attack cooldown and dead-enemy attack prevention;
- multiplayer client interpolation and host position-update throttling;
- `RuntimeSystemManager` registration/reset behavior.

`src/engine/runtime/systems/RuntimeProjectileSystem.test.ts` protects:

- projectile spawn, movement and range expiry;
- solo enemy projectile hits;
- dead enemy projectile immunity;
- multiplayer enemy-hit request delegation;
- multiplayer remote-player projectile hit delegation;
- reset cleanup.

`src/engine/runtime/systems/RuntimeCombatBridgeSystem.test.ts` protects:

- attacking without a weapon;
- weapon equip/HUD/player socket state;
- attack cooldown;
- solo and multiplayer melee enemy hit delegation;
- ranged projectile spawning and multiplayer attack visuals;
- melee remote-player hit delegation;
- reset cleanup.

## Future RuntimeEnemySystem Extraction Plan

Recommended extraction order:

1. Done: move enemy state creation, reset, spawn and network apply updates into
   `RuntimeEnemySystem`.
2. Done: move enemy update, movement, attack cooldown and host position sync into the new system.
3. Done: move high-level player attack flow, melee target lookup and ranged projectile spawning into
   `RuntimeCombatBridgeSystem`.
4. Done: move projectile lifecycle into `RuntimeProjectileSystem`.
5. Done: move equipped weapon state and high-level attack flow into `RuntimeCombatBridgeSystem`.
6. Expose narrow bridge methods:
   - `damageEnemy(enemyObjectId, amount, source)`;
   - `applyEnemyUpdated(enemy)`;
   - `applyEnemyDefeated(enemyObjectId)`;
   - `spawnEnemy(objectId)`;
   - `getDefeatedEnemyCount()`;
   - `isEnemyDefeated(objectId)`.
7. Keep server protocol unchanged during the extraction.
8. Run the enemy/combat protection tests after each migration step.

Do not move void death, global respawn or PvP damage in the first enemy extraction unless a test
proves the boundary is already safe.
