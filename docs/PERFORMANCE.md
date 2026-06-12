# Performance And Build Splitting

MiniBlox uses Vite with explicit chunks for the largest browser subsystems. The goal is to keep the initial menu light while loading editor, runtime and online catalog code only when those screens are opened.

## Current Strategy

- `src/app/App.ts` dynamically imports `EditorScreen`, `PlayScreen` and `MapListScreen`.
- The main menu imports `src/shared/MapTemplateMetadata.ts` only; full template generators in `MapTemplates.ts` are loaded on demand when a map is created.
- Multiplayer service code is loaded on demand by multiplayer actions instead of being imported into the app shell.
- `vite.config.ts` creates stable chunks for `vendor-three`, `vendor-ui`, `shared`, `editor`, `runtime-engine`, `runtime`, `online` and generic `vendor`.
- Screens that import `src/editor` or `src/engine` should be loaded through dynamic imports from `App`.
- Shared schemas and catalog code are grouped into `shared` so editor/runtime can reuse them without forcing the initial screen to load Three.js.

## Build Snapshot

Before this pass, the root build emitted one initial app chunk around `1,889 kB` and Vite warnings for mixed static/dynamic imports around online storage/services.

After lazy screens and manual chunks, the initial `index` chunk is around `23.79 kB` before gzip. The largest generated chunks are expected vendor/specialized chunks:

- `vendor-three`: about `620 kB`
- `vendor-ui`: about `596 kB`
- `runtime-engine`: about `235 kB`
- `editor`: about `193 kB`
- `template-generators`: about `141 kB`, loaded when a template map is created or templates are validated
- `online`: about `58 kB`
- `shared`: about `44 kB`

The chunk warning limit is set to `700 kB` because these larger chunks are intentional and lazy-loaded or vendor-owned.

## Rules For New Screens

- Do not statically import editor or runtime screens into the menu shell.
- If a screen imports Three.js, `src/editor` or `src/engine`, load it with `await import(...)` from `App`.
- Avoid mixing static and dynamic imports for the same heavy module. Pick one loading path.
- Menu and lightweight shell code should use `MapTemplateMetadata.ts`; only map creation/validation code should import `MapTemplates.ts`.
- Use `import type` for shared types whenever possible.
- Run `npm run build` after adding a screen and check for Vite warnings.

## CI And Local Checks

```bash
npm run build
node scripts/verify-render.mjs
```

Use `MINIBLOX_BROWSER_PATH` or `BROWSER_PATH` if `verify-render` cannot find a Chromium-based browser automatically.
