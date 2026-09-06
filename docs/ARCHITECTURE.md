# Architecture and development map

## Data flow

```text
Authored JSON / React composition / imperative objects
                       ↓
             Timeline → nested items
                       ↑
             Transport (clock authority)
                       ↑
       shared scheduler OR exact offline frame index
                       ↓
             values written → outputs drawn
```

`Tween` interpolates two values, `Track` samples multiple keys, and physics items
sample analytic spring/inertia curves. `Timeline` owns item placement and cue
crossing state. `Transport` owns playback state, timebase, rate, looping, and
ordered outputs. A root timeline lazily creates its own transport when played.
Nested timelines must not independently own transports or form cycles.

## Change map

| Concern | Source | Focused tests |
| --- | --- | --- |
| Tween and observable values | `src/core.ts` | `tests/core/tween.test.ts`, `motion-value.test.ts` |
| Easing/interpolation | `src/easing.ts`, `interpolate.ts` | `interpolate.test.ts`, `track.test.ts` |
| Repeat/direction folding | `src/cycle.ts`, `track.ts` | `cycle.test.ts`, `audit-regressions.test.ts` |
| Scheduling and playback | `src/scheduler.ts`, `transport.ts` | `scheduler.test.ts`, `transport.test.ts` |
| Placement/cues/inspection | `src/timeline.ts`, `items.ts` | `timeline.test.ts`, `cues.test.ts`, `inspect.test.ts` |
| Rational frames/SMPTE | `src/time.ts`, `timecode.ts` | `time.test.ts`, `timecode.test.ts` |
| Spring/inertia | `src/physics.ts` | `physics.test.ts` |
| JSON and scene state | `src/sheet.ts` | `sheet.test.ts`, `advanced-cue-sheet.test.ts` |
| Deterministic export | `src/offline.ts` | `offline.test.ts` |
| React ownership and hooks | `src/react.tsx` | `tests/react/transport.test.tsx`, `bindings.test.tsx` |
| Gesture lifecycle and controls | `src/gesture/` | `tests/react/gesture.test.tsx`, `gesture-react.test.tsx` |
| Velocity | `src/gesture/velocity.ts` | `tests/core/velocity-estimator.test.ts` |
| Renderer/device adapters | `src/three.ts`, `audio.ts`, `midi.ts`, `outputs.ts` | `three.test.ts`, `audio.test.ts`, `midi.test.ts`, `transport.test.ts` |
| Diagnostics | `src/testing.ts`, `devtools.ts`, `trace.ts` | `testing-helpers.test.ts`, `tests/react/devtools.test.tsx` |
| Public packaging | `package.json`, `tsup.config.ts` | `tests/dist/*.test.mjs` |
| Experimental compiled groups | `src/compiled.ts`, `src/backends/` | `compiled.test.ts`, `compiled-review.test.ts`, `tests/react/compiled.test.tsx` |
| Rust/Wasm IR and kernels | `crates/motion-ir`, `motion-core`, `motion-wasm` | `npm run test:rust`, `npm run test:wasm` |
| Packed compiled consumers | `scripts/test-packed-engine.mjs` | `npm run test:packed-engine` |
| Docs route registry | `docs/src/routes.ts`, `router.ts` | `docs-routes.test.ts`, `docs/scripts/smoke.mjs` |

Test basenames without a directory above are under `tests/core/`.

The compiled entry is opt-in and does not replace compatibility rendering or the
existing clock. Read [engine migration status](ENGINE-MIGRATION.md) and
[ADR 0001](adr/0001-compiled-execution.md) for current semantics and promotion gates.

## Docs structure

```text
docs/src/
  App.tsx                  navigation, page heading, suspense/error boundary
  router.ts                History API, legacy bookmarks, location subscription
  routes.ts                lazy page registry + implementation/test pointers
  pages/                   one route per feature, default exports
  labs/                    isolated production demo implementations
  examples/                focused fundamental demos + code patterns
  components/
    Demo.tsx               presentation, copyable code, source disclosure
    DemoViewport.tsx       opt-in mount/suspend/reset for continuous visuals
  AdvancedCueSheetLab.tsx   standalone live SVG / offline MP4 comparison
  advancedCueSheet.ts       authored JSON and layer metadata
  cue-sheet/               pure geometry, shared SVG adapter, decoded-frame telemetry
  GestureLabs.tsx           event-driven gesture gallery and production labs
  ThreeShowcase.tsx         Three.js property showcase
  ShowstopperLab.tsx        flagship WebGL cue-sheet production
  docs.css                 existing feature styles
  routes.css               static shell, responsive navigation, route layouts
```

`ProductionLabs.tsx` is a compatibility re-export for existing tests/consumers;
route pages import leaf modules. The two gesture pages currently share one
small chunk but only mount the selected gallery. The large Three.js dependency
is shared between WebGL pages and never part of the overview's initial load.
The global style sheet remains shared; CSS loading is not equivalent to running a demo.

Navigation uses real anchors plus same-origin History API interception. Modified
clicks, downloads, external links, and in-page anchors keep browser behavior.
Each route has a document title, h1, active navigation state, and source/test hints.
The nginx SPA fallback supports direct links. Unknown paths render a 404 view
(the SPA host still responds HTTP 200).

## Verification layers

1. TypeScript verifies source, docs, and tests together.
2. Vitest runs deterministic engine tests and jsdom component tests.
3. Built ESM/CJS tests catch package-boundary and runtime identity mistakes.
4. The Vite manifest check verifies lazy page entries and initial/page JS budgets.
5. A disposable Chrome process checks every deep route, exceptions, animation
   callback cleanup on client navigation, history, mobile navigation, 404, and MP4 decoding/ranges.

Browser checks use local static output by default, not the development server.
`DOCS_URL=http://dhaakon-ubuntu:21764 npm run docs:smoke` verifies a deployment.
GPU/software-renderer timing is not a performance benchmark. Physical touch,
Safari/Firefox, live MIDI hardware, and audio perceptual quality need separate testing.

## Generated assets and deployment

`dist/` is generated and tracked for distribution. `docs/dist/` is disposable.
The offline MP4 lives in `docs/public/media/`; its public URL is root-relative so
deep routes do not break playback. Keep its source cue sheet and frame metadata
together when regenerating it. Never substitute state hashes for pixel validation.

The SVG director’s cut has 23 targets over five acts, with a 576-frame 1080p
master. See `CUE-SHEET.md` for render ownership, commands, limits, and comparison
semantics. `docs:verify-cue` checks decoded frames against fresh SVG pixels;
source hashes alone do not establish image equivalence.

The Docker build consumes source aliases and docs directly; it does not depend
on host `dist/`. Deployment changes only the motion docs container. See `AGENTS.md`
for authorization boundaries and `AUDIT.md` for known correctness limitations.
