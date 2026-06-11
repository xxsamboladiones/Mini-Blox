# Adding Object Types

Use this checklist whenever a new `MapObject.type` is added.

## Required Steps

1. Add the type to `src/shared/types/ObjectSchema.ts`.
2. Add typed/default properties to `MapObjectProperties` when needed.
3. Add catalog metadata and defaults in `src/shared/ObjectCatalog.ts`.
4. Add normalization in `src/shared/normalizeGameMap.ts`.
5. Add a visual in `src/engine/ObjectFactory.ts`.
6. Expose it in `src/editor/ObjectPanel.ts`.
7. Add editable fields in `src/editor/PropertiesPanel.ts`.
8. Add local validation in `src/editor/EditorMapValidator.ts`.
9. Add backend validation in `server/src/validation/validateOnlineMap.ts`.
10. Add tests for defaults, references and invalid values.
11. Update docs or templates only when the object is intended for creators immediately.

## Runtime Rules

- Put behavior in a focused runtime system, not directly in `RuntimeMechanics`.
- Keep reset behavior explicit: visibility, collision, timers, counters and HUD state must return to initial state.
- Avoid creating materials, geometries or expensive lookup structures every frame.
- If the object interacts with multiplayer, update shared message types and server validation together.

## Validation Rules

- IDs must be non-empty and length-limited.
- Arrays must have a maximum length and must reference existing objects or purchase IDs when applicable.
- Numeric values need safe min/max limits.
- Strings shown to users should be length-limited and must not allow script/HTML injection.
