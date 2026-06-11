# MiniBlox Architecture

MiniBlox is split into four main layers: shared schema/catalog code, the editor, the browser runtime and the backend.

## Shared Layer

`src/shared` owns portable data contracts and content definitions:

- `types/*` defines `GameMap`, `MapObject`, objectives, logic rules, multiplayer messages and item schemas.
- `ObjectCatalog.ts`, `ItemCatalog.ts`, `MapTemplateMetadata.ts` and `MapTemplates.ts` define objects, items, lightweight template catalog data and official starter-map generators.
- `normalizeGameMap.ts` is the compatibility boundary for older maps. Any new `GameMap` field needs an explicit default or migration path here.
- `WeaponRules.ts` and `shared/weapon-rules.json` are the single source for combat weapon constants used by client and server.

## Editor

`src/editor` turns shared schemas into creator UI:

- Object creation goes through the catalog and editor scene.
- Property editing must write schema-compatible values.
- Local validation lives in `EditorMapValidator.ts`.
- Test mode should run a normalized snapshot and must not mutate editor history.

Every new object type should be visible in the object panel, editable in the properties panel, normalized defensively and validated locally before publish/test.

## Runtime

`src/engine` owns playable behavior:

- `GameRuntime.ts` wires scene, camera, input, HUD, physics, network and mechanics.
- `RuntimeMechanics.ts` is an orchestrator. Do not add large new gameplay systems directly into it.
- `runtime/core/*` defines the `RuntimeSystem` lifecycle and `RuntimeSystemManager` used for incremental system extraction.
- New feature domains should live in focused systems such as `src/engine/runtime/*` or `src/engine/mechanics/*`.
- `ObjectFactory.ts` builds the visual representation for map objects.
- `GameModeRuntime.ts`, `ObjectiveRuntime.ts`, `LogicRuntime.ts`, `RuntimeHud.ts`, `AudioSystem.ts` and `FeedbackSystem.ts` consume system state and events.

The runtime-system extraction is incremental. `RuntimePickupSystem` owns coins, keys, item pickups and spawners. `RuntimeDoorButtonSystem` owns opened doors, activated buttons and required-key checks. `RuntimeMovementObjectSystem` owns moving platforms, disappearing blocks, jump pads and teleporters, including their cooldowns and collider updates. `RuntimeHazardCheckpointSystem` owns checkpoints, damage zones and message zones while bridging the global death cooldown that still belongs to player lifecycle. The Tycoon mode follows the same direction: `TycoonSystem` owns money, generators, collectors, purchases, upgrades and completion, while `RuntimeTycoonSystem` adapts it to the runtime manager for update, reset, interaction and world-event flow.

## Backend

`server/src` is a separate Node/Express/WebSocket application:

- `db/*` owns SQLite connection and migrations.
- `repositories/*` are the persistence boundary for users, auth sessions, maps and likes.
- `routes/*` validates HTTP intent and calls repositories.
- `middleware/*` handles auth, rate limits and request logging.
- `multiplayer/*` owns in-memory rooms, host migration, heartbeat and server-side validation.
- `validation/validateOnlineMap.ts` protects the online catalog from malformed or abusive maps.

SQLite is the implemented adapter. Postgres is reserved for future repository adapters and must not be documented as functional unless implemented and tested.

## Change Rules

- Do not add new gameplay logic directly inside `RuntimeMechanics`.
- New runtime mechanics should be registered through `RuntimeSystemManager` or documented as a temporary bridge.
- Every new object type needs schema, catalog, ObjectFactory visual, editor properties, normalization, local validation, online validation and tests.
- Every new game mode needs schema, editor settings, runtime system, HUD/objective integration, validation and tests.
- Every `GameMap` schema change needs explicit normalization or migration documentation.
- Multiplayer protocol changes must update shared schemas, server handling, client adapters, smoke tests and docs together.
- Backend ownership must use authenticated `userId`, not `clientId`, for new writes.
