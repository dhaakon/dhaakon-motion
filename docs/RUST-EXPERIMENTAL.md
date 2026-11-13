# Rust / Wasm experimental studies

The docs route `/rust/experimental` shows the optional compiled engine at work. It does not
make Wasm the default backend or replace browser rendering. For how to use the engine in your
own code, see [the compiled engine guide](COMPILED-ENGINE.md).

## Three studies

1. **Chromatic Assembly**: 20 fixed-shape compiled layer tracks, five acts,
   12 seconds at 60 fps. A dimensional SVG study with the Dhaakon logo, aperture
   masks, chromatic slice separation, orbital traces, grids and phase ribbons.
   Pause/play, reverse, single-frame seek, act selection and JS/Wasm switching
   use the existing Timeline/Transport. Sampling time excludes React and rasterization.
2. **Batched field**: 256, 1,024 or 2,048 points with seven channels each, morphing
   through orbit, point typography, interference and toroidal formations. Independent
   compiled JS and actual Wasm players sample the same timestamp at a selected
   24 or 60 fps. Both panes use the same Canvas 2D renderer. Sample/materialization
   rolling p50, last-frame draw submission and creation are measured separately.
   Target fps is not measured display fps. These exploratory timings are not a
   benchmark for production backend promotion.
3. **Random-access conformance**: all 720 vector-score frames, sequential, reverse
   and permuted. Compares every numeric IR channel with a scaled tolerance of
   `1e-9`, using the actual Rust/Wasm evaluator and independent JS reference.
   This is state verification, not pixel, audio or MP4 equivalence.

## Ownership and loading

The route is lazy; its styles and code do not enter the overview's initial import
closure. `Load Rust / Wasm` explicitly loads the generated bindings and the
hashed 183,156-byte binary. The overview and an untouched experimental route
fetch no Wasm. A failed load leaves the JS study available and permits retry.

Only the generated module initialization promise is cached. Every mounted page
owns a fresh disposable runtime wrapper; every live lab owns its players and
clock. Late initialization after navigation disposes the unclaimed runtime.
Verification is chunked, cancellable and releases its evaluator in `finally`.
DemoViewport unmounts continuous studies offscreen, while hidden or on suspension.
All studies start paused. Reduced-motion users explicitly start the viewport.

The vector score and point-field geometry are authored data, not `Math.random()`
or wall-clock effects. SVG/Canvas rendering remains host-side; no GPU, worker,
shared-memory, native scene renderer or native video export is implied.

## Source map and checks

| Concern                            | Source                                                          |
| ---------------------------------- | --------------------------------------------------------------- |
| Lazy route and page ownership      | `docs/src/pages/RustExperimentalPage.tsx`, `docs/src/routes.ts` |
| Explicit module initialization     | `docs/src/labs/rust/runtime.ts`                                 |
| Vector authoring and host renderer | `docs/src/labs/rust/score.ts`, `ScoreScene.tsx`, `ScoreLab.tsx` |
| Point authoring and comparison     | `docs/src/labs/rust/batch.ts`, `BatchLab.tsx`                   |
| Cancellable numeric conformance    | `docs/src/labs/rust/verification.ts`                            |
| Browser integration and failures   | `docs/scripts/verify-rust.mjs`                                  |

```sh
npm run check:all
npm run test:wasm
npm run test:packed-engine
# Check a deployed copy of the docs without rebuilding it:
DOCS_URL=https://motion.dhaakon.com node docs/scripts/verify-rust.mjs
DOCS_URL=https://motion.dhaakon.com npm run docs:smoke
```

The browser verifier checks actual Wasm bytes/MIME/hash, opt-in loading,
frame controls, all-frame numerical comparisons, every point-count tier,
both timebases, reduced motion, failed loading/retry, late loading after
navigation, and callback cleanup. Screenshots and JSON reports belong in
ignored `test-results/`. Existing SVG/MP4 decoded-image verification remains
a separate check and the offline master is unchanged by this page.

## Installing

Since 0.8.0 the `/compiled` entry and its Wasm artifacts ship in the regular
`@dhaakon/motion` package on npm. They remain opt-in: you import
`@dhaakon/motion/compiled` yourself and provide an initialized runtime for
`backend: 'wasm'`. Ordinary root/React imports neither fetch nor initialize
WebAssembly.
