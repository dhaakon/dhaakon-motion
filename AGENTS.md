# Working on Dhaakon Motion

This is a TypeScript animation library plus a separately deployed Vite docs app.
Read `docs/ARCHITECTURE.md` for ownership and the feature map. Read
`docs/AUDIT.md` for known limitations before treating an existing behavior as a contract.
For engine migration work, also read `docs/ENGINE-MIGRATION.md` and
`docs/adr/0001-compiled-execution.md`; these record current corrections and the
experimental compiled contract, distinct from the historical audit baseline.
`IMPLEMENTATION_PLAN.md` and `GESTURE_PLAN.md` are historical plans, not current instructions.

## Start here

1. Check `git status --short`; preserve unrelated work. Generated `dist/` is tracked.
2. Locate the feature with `rg` and `docs/src/routes.ts` (each route names source and tests).
3. Reproduce bugs with a focused regression before changing engine semantics.
4. Use a manual driver for timing tests, not real delays or arbitrary sleeps.

## Commands

```sh
npm ci                              # Node 24; .npmrc uses the private UI registry
npm run typecheck
npx vitest run tests/core/transport.test.ts
npx vitest run tests/react/gesture-react.test.tsx
npm run check                       # types, all source tests, built ESM/CJS smoke tests
npm run docs:dev                     # localhost:5175
npm run docs:check                   # production docs + lazy-route/asset budget checks
npm run docs:smoke                   # real Chrome, built docs, deep links + cleanup
npm run docs:verify-css-ui           # real native CSS playback, interruption, accessibility
npm run docs:render-cue              # build + exact-frame 1080p PNG → MP4 (GStreamer)
npm run docs:verify-cue              # build + decoded-frame image comparisons
npm run check:all                    # full pre-handoff gate; Chrome required
npm run bench:gestures               # actual built estimator, deterministic synthetic input
npm run format:docs                  # format modular docs code; does not rewrite legacy demos
npm run format:check                 # verify formatting for the same maintained surface
```

`CHROME_PATH` overrides `/usr/bin/google-chrome`. The browser harness has no
Playwright dependency or sibling-repository fallback. `DOCS_URL` makes smoke
checks target a deployed docs URL. Reports/screenshots belong in ignored
`test-results/`; exports belong in ignored `exports/`. Missing Chrome is a
reported prerequisite, never a silently skipped successful browser check.

For the advanced SVG study, read `docs/CUE-SHEET.md`. Keep scene/geometry writers
independent of wall-clock time. Regenerate the MP4 after visual or score changes,
then run decoded-frame image comparisons; JSON hashes alone do not prove parity.

## Boundaries

- `src/` is authoritative; never hand-edit `dist/`. Run `npm run build` to regenerate it.
- Core must remain free of runtime package dependencies and browser globals at import time.
- React, gesture, Three.js, audio, MIDI, testing, and devtools stay in their public entry points.
- Built-package tests matter: source aliases can hide duplicate runtime identities or stale exports.
- Runtime imports from adapters into the engine must use `@dhaakon/motion`,
  not relative imports that bundle a second Timeline/Track/MotionValue/scheduler.
  This package self-reference is externalized by tsup and aliased to source in development.
- `docs/source-aliases.ts` is shared by Vite and Vitest. Update it, `tsconfig.json`,
  `tsup.config.ts`, and package exports together when adding an entry point.
- Do not pull live demos or Three.js into `App.tsx`, the route registry, or the overview.
- Do not reintroduce feature-number-dependent rendering or a monolithic demo barrel in pages.
- Do not delegate to sub-agents unless the user explicitly requests it.

## Lifecycle and time contracts

- One owner creates a transport; cleanup disposes it and its subscriptions.
- Stop animations, cancel queued frames/timers, disconnect observers and listeners,
  dispose geometry/materials/renderers, and close opt-in audio contexts on unmount.
- React effects must survive StrictMode setup → cleanup → setup.
- `DemoViewport` is for continuous visuals. It unmounts/reset visuals offscreen,
  while hidden, or when suspended. Do not wrap editors whose unsaved state must survive scrolling.
- All times inside the engine are milliseconds. Public inputs may be frames or SMPTE.
- Set `frameRate` explicitly on timelines before authoring frame-based positions.
  Authored placements now re-resolve in declaration order on late binding.
- Loops are half-open `[in, out)`. Offline frame ranges are inclusive `[from, to]`.
  A 240-frame video exports frames 0–239, not 0–240.
- Offline sampling should use a fresh, nonplaying timeline/transport and capture after output writes.
- Cue-sheet validation has data/resource limits, but is not a sandbox for host code.
- `saveSheet(loaded)` preserves authored input; runtime edits require explicit
  `{ source: 'runtime' }`, whose opaque extensions/functions remain best-effort.

## CSS-native interfaces

For CSS-native UI work, read `docs/CSS-UI-MOTION.md`. `/css` is browser-owned
presentation, not a replacement for the Transport or compiled engine. The React
adapter must import `@dhaakon/motion/css` canonically to share element ownership.
Preserve the existing `motion` API and shared reduced-motion policy.
For consumer work spanning both kits, the reusable source skill is
`skills/dhaakon-ui-motion/SKILL.md`; keep its references aligned with public APIs.

## Experimental compiled engine

- `src/backends/` owns compiler, shape materialization, JS reference, binary encoder and Wasm host.
- `crates/motion-ir`, `motion-core`, `motion-wasm` own validation, pure evaluation and ABI handles.
- Original eight entries stay compatible; `/compiled` is optional, `/wasm/*` contains generated assets.
- Do not hand-edit `wasm/` or `dist/`. Use `npm run build:wasm` and `npm run build` respectively.
- Do not silently compile mutable live graphs, defer their callbacks, auto-load Wasm at import,
  or enable a default backend based on microbenchmarks alone.
- Compiled players/runtimes are explicitly owned terminal resources; Transport teardown is reusable.
- Keep binary/IR/ABI versions, TS/Rust validators, source mappings and conformance tests aligned.
- Run `npm run test:wasm` and `npm run test:packed-engine` after backend/packaging changes.
- GPU/scene/export work is a separate milestone; state hashes are not pixel or audio parity.
- The opt-in docs route is `/rust/experimental`; read `docs/RUST-EXPERIMENTAL.md`.
  Its actual browser/failure/lifecycle verifier is `docs/scripts/verify-rust.mjs`.
  Keep generated Wasm out of eager imports, copy it in `Dockerfile.docs`, and
  preserve explicit asset MIME/404 handling. Experimental publishes must not move `latest`.

## Add a feature page

1. Add a default-exported `docs/src/pages/FeaturePage.tsx` and a focused lab under `labs/` if needed.
2. Add its path, metadata, source/test pointers, and literal dynamic import to `routes.ts`.
3. Use `components/Demo.tsx` for presentation and source patterns. Keep presentation free of hidden demo mounts.
4. Add interaction/lifecycle tests. The route-registry test and Chrome smoke script discover new pages automatically.
5. Run `npm run check:all`; inspect desktop/mobile visuals. Do not raise budgets merely to make a check pass.

## Deployment and release

Local builds are not deployed docs. When deployment is requested, build only
`Dockerfile.docs` and recreate only the `dhaakon-motion-docs` Compose service.
Verify its deep routes and media byte ranges. Do not restart the whole network stack.
An npm publish, version bump, git push, or release requires explicit authorization;
a docs build or audit does not imply permission for those actions.

Handoff: state what changed, actual verification results, any skipped checks,
known remaining limitations, and the deployed URL only if deployment succeeded.
