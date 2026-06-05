# MiniBlox Alpha 0.1.1

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
- HUD with multiplayer state, chat, objectives, score, health and weapons
- Templates for obby, combat, PvP and coop enemy arenas
- Basic logic/objective/game-mode panels

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
node scripts/verify-render.mjs
node scripts/validate-templates.mjs
```

Backend:

```bash
cd server
npm run check
npm run build
node scripts/smoke-server.mjs
```

Multiplayer smoke:

```bash
node server/scripts/smoke-multiplayer.mjs
```

## Known Limits

- Multiplayer is an MVP, not a full anticheat system.
- Enemy AI is still host-authoritative, with server validation around movement and damage.
- Player physics remain mostly client-side with server sanity checks.
- Rooms are in memory and are removed by cleanup.
- Chat has length/rate limits, but no advanced moderation.
- Online catalog storage is local JSON on the backend.
- Editor collaboration, login, ranking and matchmaking are not part of Alpha 0.1.0.

## More Docs

See [README_ONLINE.md](README_ONLINE.md) for online catalog, room flow, protocol notes and multiplayer test steps.
