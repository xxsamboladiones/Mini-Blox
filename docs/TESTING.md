# Testing

MiniBlox uses Vitest for automated tests plus existing smoke scripts for render, templates, backend and multiplayer flows.

## Frontend / Root

```bash
npm run test
npm run test:watch
npm run typecheck
npm run check
npm run build
npm run check:all
node scripts/validate-templates.mjs
node scripts/verify-render.mjs
```

Root Vitest is configured to test `src/**` and exclude `server/**`. Current tests cover `TycoonSystem`, `RuntimeSystemManager`, `RuntimePickupSystem`, `RuntimeDoorButtonSystem`, `RuntimeMovementObjectSystem`, `RuntimeHazardCheckpointSystem`, `RuntimeEnemySystem`, `RuntimeProjectileSystem`, `RuntimeCombatBridgeSystem`, enemy/combat/projectile integration protection and editor map validation.

## Backend

```bash
cd server
npm run test
npm run test:watch
npm run typecheck
npm run check
npm run build
npm run check:all
node scripts/smoke-server.mjs
node scripts/smoke-multiplayer.mjs
```

Backend tests create a temporary SQLite database per test server and set `RATE_LIMIT_ENABLED=false`, so they do not touch the development database under `server/data`.

## Runtime Test Harness

The runtime harness lives in `src/engine/testing`:

- `createMockHud.ts` records HUD messages and Tycoon status updates.
- `createMockAudioSystem.ts` records audio cues.
- `createMockFeedbackSystem.ts` records feedback spawns and floating labels.
- `createMockPhysicsSystem.ts` records collider updates/removals and lets tests query active colliders.
- `createRuntimeTestMap.ts` creates normalized maps and objects for runtime systems.
- `simulateRuntimeTicks.ts` advances systems with a fake player bounds/position.

Use the harness for runtime systems that do not need a real browser canvas. Browser-specific rendering, pointer lock, layout and multiplayer tab flows still need smoke/manual playtests.

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`/`master`:

- Root: `npm ci`, typecheck, tests, check, build and template validation.
- Backend: `npm ci`, typecheck, tests, check and build.

`.github/workflows/smoke.yml` runs the slower port-based smoke checks in a separate job:

- builds and starts the backend with a CI SQLite database;
- waits for `/health` with `scripts/wait-for-url.mjs`;
- runs backend and multiplayer smoke scripts;
- starts the Vite dev server;
- waits for the frontend and runs render verification plus the root multiplayer smoke.

Keep the basic CI workflow fast and deterministic. Put checks that need live ports, background processes or browser probing in the smoke workflow.

## Local Smokes

```bash
cd server
npm run build
npm run start
```

In another shell:

```bash
node server/scripts/smoke-server.mjs
node server/scripts/smoke-multiplayer.mjs
npm run dev
node scripts/verify-render.mjs
node smoke-multiplayer.mjs
```

Use temporary `DATABASE_URL=file:...` values when running repeated smoke tests to avoid database lock noise. Use `MINIBLOX_BROWSER_PATH` or `BROWSER_PATH` if render verification cannot find Chrome/Edge/Chromium.

## Test Expectations

- New runtime systems should have unit tests around state transitions, reset behavior and callbacks.
- New runtime systems should also have `RuntimeSystemManager` or adapter coverage for lifecycle, interaction priority and world-event handling.
- Pickup-like systems should test static object collection, spawned runtime objects, shared world events and restart cleanup.
- Door/button-like systems should test linked object changes, required-key bridges, repeated interaction rules, world events and reset restoration.
- Movement-object systems should test position interpolation, collider updates/removal, cooldowns, player motion callbacks and reset restoration.
- Hazard/checkpoint systems should test checkpoint activation/reset, damage cooldowns, fatal damage callbacks and message-zone entry/exit rules.
- Enemy state/reset/spawn/network-apply, movement, attack cooldown and host-sync changes should update `RuntimeEnemySystem.test.ts`.
- Projectile lifecycle/hit changes should update `RuntimeProjectileSystem.test.ts` and keep `RuntimeMechanicsEnemyCombat.test.ts` passing.
- Weapon equip, cooldown, melee target selection, ranged projectile spawning and combat bridge changes should update `RuntimeCombatBridgeSystem.test.ts` and keep `RuntimeMechanicsEnemyCombat.test.ts` passing.
- New object types should have validation tests for valid templates and broken references.
- Backend route tests should use temporary SQLite and should not depend on existing local data.
- Regressions found by browser playtesting should get a small automated test when the behavior can be isolated.
