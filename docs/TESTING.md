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

Root Vitest is configured to test `src/**` and exclude `server/**`. Current tests cover `TycoonSystem` behavior and editor map validation.

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
- `createMockPhysicsSystem.ts` records collider updates/removals.
- `createRuntimeTestMap.ts` creates normalized maps and objects for runtime systems.
- `simulateRuntimeTicks.ts` advances systems with a fake player bounds/position.

Use the harness for runtime systems that do not need a real browser canvas. Browser-specific rendering, pointer lock, layout and multiplayer tab flows still need smoke/manual playtests.

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`/`master`:

- Root: `npm ci`, typecheck, tests, check, build, template validation and render verification.
- Backend: `npm ci`, typecheck, tests, check and build.

Smoke scripts that open ports or coordinate multiple processes remain local/manual unless moved into a dedicated CI job.

## Test Expectations

- New runtime systems should have unit tests around state transitions, reset behavior and callbacks.
- New object types should have validation tests for valid templates and broken references.
- Backend route tests should use temporary SQLite and should not depend on existing local data.
- Regressions found by browser playtesting should get a small automated test when the behavior can be isolated.
