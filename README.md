# MiniBlox Alpha 0.2.0-alpha.1

MiniBlox is a TypeScript sandbox map editor and lightweight 3D game runtime for the browser.

The current alpha focuses on a playable creator loop: build maps, test them in the editor, publish them to the online catalog, and play them solo or in multiplayer rooms.

> MiniBlox is still early alpha. The editor, runtime, online catalog and multiplayer MVP are usable, but several systems are intentionally conservative and still being stabilized.

## Current Features

- Browser-based 3D map editor
- Local save, import and export
- Online map catalog with publish/update/download
- Runtime playable in solo mode
- Multiplayer rooms over WebSocket
- Remote avatars, shared world events, synchronized enemies and basic PvP
- Chat/lobby social flow with room list and host migration
- HUD with multiplayer state, chat, objectives, session timer, score, health and weapons
- Character and weapon visuals with stable attachment, attack and respawn poses
- Tycoon creation/gameplay with generators, collectors, buy buttons, upgrades and unlockables
- SQLite-backed online catalog with simple username/password auth
- Server rate limits, structured JSON logs and WebSocket heartbeat cleanup
- 29 official premium templates covering sandbox, obby, collect, puzzle, combat, Tycoon, PvP, coop, city, island and stress examples
- Basic logic/objective/game-mode panels

## Alpha 0.2.0-alpha.1 Runtime Extraction

- Added the `RuntimeSystemManager` lifecycle for small runtime systems with ordered update, interaction and world-event delegation
- Extracted Tycoon, pickup/inventory/spawner, door/button, movement-object, hazard/checkpoint, enemy, projectile and combat-bridge responsibilities out of `RuntimeMechanics`
- Added guardrails for runtime-system registration and lookup so duplicate system IDs fail early
- Kept `RuntimeMechanics` as the runtime orchestrator for global player lifecycle, finish/void flows, cross-system callbacks and multiplayer shared-state application
- Reworked the official template catalog into a 29-map premium pack while keeping lightweight menu metadata separate from heavy generators

## Alpha 0.1.9 Performance, CI Smokes & Runtime Systems

- Added Vite chunk splitting and lazy loading for editor, play screen and online map list flows
- Split template catalog metadata from heavy template generation so the main menu can render without loading full map generators
- Added GitHub Actions CI plus smoke workflow coverage for backend, multiplayer and render checks
- Added runtime-system architecture docs and performance notes for future feature work

## Alpha 0.1.8 Quality Gate

- Added Vitest coverage for frontend runtime systems, Tycoon behavior, validation and backend auth/repository flows
- Added runtime test harness mocks for HUD, audio, feedback, physics and runtime test maps
- Documented architecture, testing, object-type extension and game-mode extension rules
- Added `check:all` commands to run typecheck, tests, validation, build and render smoke from one command

## Alpha 0.1.7 Tycoon Mode

- Added a Tycoon game mode with local cash, collectors, generators, buy buttons, unlockables, upgrades, barriers and completion progress
- Added Tycoon objects to the editor object palette and property panel, plus Tycoon-specific game-mode settings and objectives
- Added Tycoon runtime integration for HUD status, interaction hints, feedback, objective progress, visual logic events and restart/reset behavior
- Added the official `Tycoon Basico` template with a small factory progression loop
- Online map validation and template validation now understand Tycoon fields and references
- Multiplayer support syncs Tycoon purchase/upgrade world events, while cash and ownership remain intentionally basic

## Alpha 0.1.6 Backend Hardening

- Online catalog now uses SQLite through Node's built-in `node:sqlite` adapter; legacy `server/data/maps.json` maps are imported on startup when present
- Added migrations and repository boundaries for users, auth sessions, maps and likes
- Added username/password auth with bcryptjs password hashes and hashed bearer tokens
- Publish, update, delete and like now require auth; legacy client ownership can be claimed only after login with the matching old `clientId`
- HTTP rate limits and structured logs were added to the backend
- Multiplayer rooms remain in memory, but now have configurable TTL, structured lifecycle logs and WebSocket heartbeat/payload checks
- Weapon combat rules were moved to `shared/weapon-rules.json` and are reused by frontend catalog/runtime and server PvP/enemy validation

## Alpha 0.1.6 Character & Weapon Animation Fix

- Added a small `PlayerAnimator` for idle, movement, airborne, attack and defeated poses without changing movement or combat rules
- Added shared weapon attachment configs so sword, hammer, dagger and blaster stay anchored to the hand socket locally and remotely
- Weapon attack visuals now use per-attack poses for slash, overhead, stab and shoot, then return cleanly to the base pose
- Restart, respawn, defeat and weapon swapping reset pose/weapon state instead of leaving stale attack rotations or duplicated weapon meshes
- Remote player views reuse the same animator and existing `playerAttackVisual`/`equippedWeaponId` data; no backend, protocol or schema changes

## Alpha 0.1.6 Playable Loop e Test Mode

- Runtime HUD now shows session mode, session timer, useful coin/score/team stats, health, weapon state and current objectives with less empty noise
- Maps without explicit objectives get a non-persistent fallback objective based on finish objects, coins, enemies, description or exploration
- Victory and defeat feedback now include clearer summaries with score, coins, kills, deaths, objectives and elapsed time when available
- Restart from HUD/pause/R resets player, health, pickups, enemies, doors/buttons, projectiles, objective state and session timer through the existing runtime restart path
- Editor test mode is labeled as `Testando mapa` and surfaces basic controls without changing editor history, save/publish or template schemas
- No intentional gameplay balance, backend, multiplayer protocol or schema changes

## Alpha 0.1.5 Template Quality Pass

- All 28 built-in templates were audited as official playable examples
- Template tags now use a consistent lowercase taxonomy for basic, platform, puzzle, collect, combat, multiplayer, local, exploration, stress and showcase categories
- Five curated showcase templates are marked for quick starts: sandbox, obby, coin collect, multiplayer PvP and multiplayer coop enemies
- Template metadata exposes tags so UI/catalog surfaces can reason about the same metadata as generated maps without loading full generators
- `node scripts/validate-templates.mjs` now checks catalog metadata, required tags, generated map tag parity, transform bounds, enemy/damage limits and multiplayer template requirements
- No intentional gameplay, backend, multiplayer protocol or schema changes

## Alpha 0.1.4 History UI e Commit Coverage

- Discreet Undo/Redo buttons in the editor top bar using the same history controller as shortcuts
- History state now updates button disabled states through controller change notifications
- Metadata, visual environment, audio, logic, objectives and game-mode edits enter history
- Continuous fields use a single commit at the end of the interaction instead of per-key/per-tick snapshots
- No intentional gameplay, backend, multiplayer protocol, schema or template changes

## Alpha 0.1.3 Undo/Redo e Transform Commit

- Basic editor history for object add, duplicate, delete, transform and property edits
- Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z support for undo/redo outside text fields
- Transform commit event prevents one drag/move/rotate/scale gesture from creating many history entries
- Properties commit on blur/Enter instead of creating history on every keystroke
- No intentional gameplay, backend, multiplayer protocol, schema or template changes

## Alpha 0.1.2 Editor Stability

- Editor persistence moved into a small controller for local save, load, import and export
- Test mode now starts from a normalized snapshot with local validation before runtime boot
- Online publish/update validates the editor snapshot locally before calling the backend
- Shared map normalization is used by editor snapshots and runtime loading
- Object editing is safer against invalid numbers, non-positive scale and stale selection
- Editor keyboard shortcuts are isolated in a disposable controller
- No intentional gameplay, multiplayer protocol, backend or schema changes

## Alpha 0.1.1 Runtime Cleanup

- Initial extraction of runtime mechanics helpers for pickups, doors/buttons, damage zones, projectiles and enemies
- Small network send wrapper for runtime multiplayer integration
- Runtime map normalization before play/test mode
- Safer cleanup for runtime projectiles and spawned pickups
- No intentional gameplay, protocol or UI feature changes

## Alpha 0.1.0 Stabilization Focus

- Server-side validation for PvP, enemy hits, enemy position updates and world events
- Server-side healing requests for health pickups
- Online map validation for unsafe fields, extreme transforms and abusive gameplay values
- Smoke tests for backend, multiplayer, rendering and templates
- Small code organization steps in runtime mechanics and editor online publishing

## Installation

```bash
npm install
cd server
npm install
```

Run frontend and backend together:

```bash
npm run dev:all
```

Run frontend only:

```bash
npm run dev
```

Run backend only:

```bash
cd server
npm run db:migrate
npm run dev
```

Create a local backend `.env` from `server/.env.example`. The default database is:

```env
DATABASE_URL=file:./data/miniblox.sqlite
```

## Validation Commands

Frontend:

```bash
npm run typecheck
npm run test
npm run build
npm run check
npm run check:all
node scripts/verify-render.mjs
node scripts/validate-templates.mjs
```

Backend:

```bash
cd server
npm run typecheck
npm run test
npm run check
npm run build
npm run check:all
node scripts/smoke-server.mjs
```

Multiplayer smoke:

```bash
node server/scripts/smoke-multiplayer.mjs
node smoke-multiplayer.mjs
```

## Known Limits

- Multiplayer is an MVP, not a full anticheat system.
- Enemy AI is still host-authoritative, with server validation around movement and damage.
- Player physics remain mostly client-side with server sanity checks.
- Rooms are in memory and are removed by cleanup.
- Postgres is planned behind the repository interface, but SQLite is the implemented adapter in this alpha.
- Chat has length/rate limits, but no advanced moderation.
- Editor collaboration, ranking and matchmaking are not part of Alpha 0.2.0-alpha.1.

## More Docs

See [README_ONLINE.md](README_ONLINE.md) for online catalog, room flow, protocol notes and multiplayer test steps.

See [docs/TYCOON.md](docs/TYCOON.md) for Tycoon object setup, runtime behavior, validation rules and current multiplayer limits.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/TESTING.md](docs/TESTING.md), [docs/PERFORMANCE.md](docs/PERFORMANCE.md), [docs/RUNTIME_SYSTEMS.md](docs/RUNTIME_SYSTEMS.md), [docs/ADDING_OBJECT_TYPES.md](docs/ADDING_OBJECT_TYPES.md) and [docs/ADDING_GAME_MODES.md](docs/ADDING_GAME_MODES.md) for development rules, performance notes, runtime-system architecture, test harness usage and extension checklists.
