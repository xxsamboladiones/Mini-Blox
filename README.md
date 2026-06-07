# MiniBlox Alpha 0.1.6

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
- Official templates for basic, platform, puzzle, collect, combat, PvP and coop examples
- Basic logic/objective/game-mode panels

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
- `MAP_TEMPLATES` now exposes template tags so UI/catalog surfaces can reason about the same metadata as generated maps
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
npm run dev
```

## Validation Commands

Frontend:

```bash
npm run typecheck
npm run build
npm run check
node scripts/verify-render.mjs
node scripts/validate-templates.mjs
```

Backend:

```bash
cd server
npm run typecheck
npm run check
npm run build
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
- Chat has length/rate limits, but no advanced moderation.
- Online catalog storage is local JSON on the backend.
- Editor collaboration, login, ranking and matchmaking are not part of Alpha 0.1.6.

## More Docs

See [README_ONLINE.md](README_ONLINE.md) for online catalog, room flow, protocol notes and multiplayer test steps.
