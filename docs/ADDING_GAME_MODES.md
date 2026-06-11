# Adding Game Modes

Use this checklist whenever a new `GameMode` is added.

## Required Steps

1. Add the mode to `src/shared/types/MapSchema.ts`.
2. Add game-mode settings and defaults in `createEmptyGameMap` and `normalizeGameMap.ts`.
3. Add editor controls in `src/editor/GameModePanel.ts`.
4. Add runtime behavior in a focused system under `src/engine/runtime` or `src/engine/mechanics`.
5. Integrate with `GameModeRuntime.ts`, `ObjectiveRuntime.ts`, `LogicRuntime.ts` and `RuntimeHud.ts`.
6. Add object/catalog support only for objects the mode actually needs.
7. Add local validation and backend validation.
8. Add a template or generator only when it can pass validation and be played end to end.
9. Add unit tests for the runtime system and validation tests for broken maps.
10. Document multiplayer support honestly: full, partial, experimental or unsupported.

## Runtime Rules

- `RuntimeMechanics` should orchestrate systems and expose compatibility APIs; it should not become the primary implementation of a new mode.
- Restart and map switching must clear all mode-specific state.
- HUD panels must be mode-scoped and hidden in other modes.
- Objectives and win conditions must be deterministic after reset.
- Multiplayer should apply local solo behavior immediately and use world events only for synchronization when server authority is partial.

## Compatibility Rules

- Existing maps must load after normalization.
- Existing modes must not show new HUD or validation errors unless they use the new fields.
- Backend publish/list/get/update/delete contracts must remain compatible with old maps.
- Smoke scripts and template validation should keep passing before the mode is considered complete.
