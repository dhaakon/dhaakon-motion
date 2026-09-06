# Rust / WebAssembly engine and rendering migration

Audit and implementation proposal · 2026-09-05 · no rewrite implemented

Implementation began on 2026-09-06. This document retains the original audit baseline; see [current implementation status and accepted corrections](ENGINE-MIGRATION.md) for the branch, delivered first batch, checks and remaining phase gates.

## 1. Recommendation

Build a shared Rust evaluation/geometry core that runs as WebAssembly in the browser and natively in the export tool. Keep the existing TypeScript classes, React composition, gesture integration and browser/device adapters as the public interface. Add a separately loaded `wgpu`/WGSL rendering backend for portable scenes, while retaining browser SVG/DOM/Three.js rendering for full compatibility.

The valuable change is **compile once, evaluate in batches, retain renderer resources, and stream exports**. A line-for-line TypeScript-to-Rust translation with one boundary crossing per tween/property would preserve much of the current overhead and could make ordinary UI animations slower.

The long-term portable engine can own timing, keyframe lookup, interpolation, analytic physics, cue traversal, procedural geometry and render-plan execution. JavaScript remains responsible for actual JavaScript closures, React ownership, native input, DOM integration and browser permissions. That host layer preserves current capabilities while the portable core is shared.

Use two explicit execution contracts:

- **Compatibility execution:** all current APIs and custom items/callbacks continue working. A JavaScript fallback remains available; proven-pure regions can use the Rust evaluator without changing observable ordering.
- **Portable compiled execution:** a validated, immutable timeline/scene plan supports efficient batching, worker execution and native export. Unsupported host features produce a capability report and select an explicit browser fallback, or a clear error when portability is required.

Do not automatically move existing synchronous APIs into workers, replace SVG with canvas, require WebGPU/shared memory for basic playback, or silently change callback ordering. Do not call a new native renderer feature-complete until its declared rendering subset passes fidelity tests.

## 2. Audit baseline and verification

The audited source is the **current working tree**, package `@dhaakon/motion@0.6.0`, based on `main` at `fd3f0f5`. It includes substantial uncommitted engine, test, documentation and tracked distribution changes. It is not equivalent to that commit alone. Those changes were preserved; no branch, version, release, deployment or package installation was performed for this audit.

Read alongside [the architecture map](ARCHITECTURE.md), [the existing correctness audit](AUDIT.md), and [the SVG production specification](CUE-SHEET.md). Source line references below refer to this working-tree snapshot.

### Checks performed now

| Check                                     | Observed result                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `npm run typecheck`                       | Passed                                                                    |
| `npm test`                                | 229 passing tests; four explicitly expected failures; 33 files            |
| `node --test tests/dist/*.test.mjs`       | 15 passed against the existing distribution artifacts                     |
| In-memory build of current `src/index.ts` | Passed; used for independent probes and timing measurements               |
| Live Chrome capability check              | Current HTTP docs origin is not a secure context or cross-origin isolated |
| Engine probes                             | Reproduced the additional behaviors in section 3                          |

The package tests above were deliberately not preceded by `npm run build`: `dist/` is tracked and already modified. They do not prove a fresh release build matches source. No new MP4 was rendered, no full browser route sweep was rerun, and no Rust/Wasm implementation, GPU speed comparison, native rendering comparison or audio acceptance test was performed.

The audit's ignored diagnostic artifacts are `test-results/rust-wasm-audit/benchmark.mjs` and `benchmark.json`. Run from the repository root:

```sh
node --expose-gc test-results/rust-wasm-audit/benchmark.mjs
```

This diagnostic bundles source in memory and does not regenerate `dist/`. Promote a reviewed benchmark harness into maintained tooling during phase 0; ignored diagnostics are not a release gate.

### Measured source baseline

Linux x64, Intel i7-8809G @ 3.10 GHz, eight logical CPUs, Node 24.20.0. Each case has three rounds, 60 warm-up samples per round and 180 measured samples per round, with time `(sample * 37) % 1999`. Percentiles pool 540 observations. Sampling includes an observable JavaScript callback; construction, browser/DOM/GPU/React and encoding are excluded. The sparse case additionally includes Transport seek/traversal.

| Workload                                | p50/sample | p95/sample |
| --------------------------------------- | ---------: | ---------: |
| 100 scalar tweens                       |   0.032 ms |   0.069 ms |
| 1,000 scalar tweens                     |   0.305 ms |   0.563 ms |
| 10,000 scalar tweens                    |   3.340 ms |   5.269 ms |
| 1,000 compound tweens                   |   2.841 ms |   3.585 ms |
| 10,000 compound tweens                  |  30.806 ms |  35.364 ms |
| 1,000 scalar tracks, eight keys each    |   0.379 ms |   0.508 ms |
| 1,000 scalar tracks, 256 keys each      |   1.216 ms |   1.963 ms |
| Sparse timeline, 10,000 scalar children |   0.728 ms |   1.106 ms |

Compound values contain nested position, opacity, a color and a CSS-unit string. They perform more work than scalar values; this is not a controlled isolation of allocation alone. The results support investigating value-shape compilation and keyframe indexing, not a claimed Rust speedup. The sparse result also shows why the whole engine should not be labeled uniformly slow.

These are exploratory measurements from one shared workstation, not stable CI limits or browser FPS. The in-memory source bundle SHA-256 was `18c620812616f13e4cfa36c88029bb82694ea0d4a515821e2e5b078cc3db95f3`.

### Deployment and toolchain constraints

At `http://dhaakon-ubuntu:21764/svg-cue-sheet`, Chrome reported:

```text
isSecureContext       false
crossOriginIsolated   false
WebAssembly           available
navigator.gpu         undefined
SharedArrayBuffer     undefined
VideoEncoder          undefined
OffscreenCanvas       available
```

WebGPU requires a secure context; cross-origin isolation has additional policy requirements. The current deployment therefore cannot be the only target of a WebGPU/threads-first rewrite. Plan an HTTPS staging origin, but keep non-threaded Wasm and existing browser rendering functional without those upgrades. Do not recommend browser security-bypass flags. [WebGPU requirements](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API), [cross-origin isolation](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated).

`gst-launch-1.0` is available. `rustc`, `cargo`, `wasm-pack`, `wasm-bindgen`, `wasm-opt` and `ffmpeg` were not found on the audit shell's PATH. Provision a pinned project toolchain in the implementation phase; this audit did not install one.

## 3. Findings that must shape the rewrite

### Correctness and compatibility

| ID / priority            | Evidence                                                                                                                                                                                                                                                         | Required treatment                                                                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RW-01 / P1               | Existing AUD-01–04 still fail as expected: late frame-rate placement binding, lossy `saveSheet`, repeated offline ownership, incomplete validation. `tests/core/known-issues.test.ts:8`, `src/sheet.ts:199`, `src/offline.ts:27`.                                | Fix/specify before making a Rust oracle or compiler format. Authored JSON, not `saveSheet(loadSheet(...))`, remains the source of truth meanwhile.                                                              |
| RW-02 / P1               | A manual-driver probe with two tasks and a throwing first callback leaves two registered tasks and zero pending frames. `src/scheduler.ts:23,38`.                                                                                                                | Define error containment, callback isolation and rearming; a single user callback must not strand unrelated clocks. Rust traps need an equally explicit policy.                                                 |
| RW-03 / P1               | `Timeline.add(child, 'missing')` throws but leaves the child considered nested; `child.play()` then throws. `src/timeline.ts:138–154`.                                                                                                                           | Transactional validation/attachment. The compiled graph must never retain half-applied edits or invalid ownership handles.                                                                                      |
| RW-04 / P2               | Reverse linear tween `0→100`, 1000 ms: at 250 ms, value 75, reported velocity +0.1, finite-difference velocity approximately −0.1. A leading-delay hold reports +0.1 while its value is stationary. `src/core.ts:134`.                                           | Resolve signed cycle velocity and hold phases before physics handoff parity tests.                                                                                                                              |
| RW-05 / P2               | Scalar inertia with velocity 1, power 1, time constant 100 and `modifyTarget: () => 10` samples about 98.99 one millisecond before completion, then 10 at completion. `src/physics.ts:171,196`.                                                                  | Specify continuous retargeting versus intentional endpoint snapping. Test bounds, bounce-disabled behavior and generic nonnumeric inputs before porting.                                                        |
| RW-06 / P2               | `resolveEasing('toString')` returns an inherited function with a nonnumeric result; `'__proto__'` returns a nonfunction. `src/easing.ts:95`.                                                                                                                     | Own-key lookup, contextual easing validation and finite parameter checks. This is not a claim of arbitrary code execution.                                                                                      |
| RW-07 / P2               | A fresh offline render of frames 0–1 with a cue at zero fires that cue zero times. `src/offline.ts:74–82`.                                                                                                                                                       | Decide and test start-boundary inclusion, partial ranges, resume behavior and once/reset. Also reconcile a requested export rate with an existing Transport's snap/metadata rate.                               |
| RW-08 / P1 compatibility | Timelines fire their own crossings before iterating children; child setters/callbacks run inline; outputs follow root sampling, subscribers follow outputs, and `onSeek` follows the seek render. `src/timeline.ts:348,352`, `src/transport.ts:313–319`, `:191`. | A batch of all values followed by all callbacks is incompatible. Preserve host barriers or require an explicit portable execution contract.                                                                     |
| RW-09 / P1 compatibility | Synchronous `MotionValue`, mutable Tween fields, arbitrary `TimelineItem`, custom easings/setters/clocks and live graph mutation are supported. `src/core.ts:35,188`, `src/items.ts:10`, `src/sheet.ts:58`.                                                      | Keep canonical JS identities and opaque-host fallback. Do not pretend closures, DOM references or mutable objects are automatically serializable.                                                               |
| RW-10 / P1 lifecycle     | React constructs objects during render; `Transport.dispose()` is reusable teardown, not terminal destruction. JSX keys can omit target/function identity. `src/react.tsx:331,473,499`, `src/transport.ts:239`, `tests/core/audit-regressions.test.ts:69`.        | Keep render-phase wrappers side-effect-free, allocate external resources at commit/explicit attachment, and support teardown/reattachment without replacing public objects. Repair stale identities separately. |

RW-02 through RW-07 contain fresh runtime probes of current source. The mutation/order/lifetime findings also come from source and existing tests; they are not newly fixed. Do not turn these bugs into permanent compatibility goldens. Keep an explicit accepted-corrections ledger with desired tests.

Additional code-review backlog to confirm with focused tests:

- Binding-only custom easing names are validated before `bindings.easings` is consulted; per-keyframe easing and `steps(..., 'start')` serialization need complete descriptors (`src/sheet.ts:73,119,190,280`, `src/easing.ts:52`).
- Large crossing traversal has silent iteration guards: 2,000 timeline iterations and 10,000 transport laps. Time folding and bounded event delivery need separate, observable overflow policies (`src/timeline.ts:385`, `src/transport.ts:269`).
- Sub-millisecond cycle folding, rounded-to-zero rational rate components, drop-frame 24-hour rollover and zero-duration completion require boundary fixtures (`src/cycle.ts:43`, `src/time.ts:20`, `src/timecode.ts:70`, `src/transport.ts:296`).
- `FrameInfo.cues` promises earlier cues inside handlers, but is populated only after root sampling. Resolve the discrepancy before designing event records (`src/transport.ts:40,313`).
- Existing AUD-05–08 and AUD-10–12 cover stale React callbacks/outputs, sequence rebuild ordering, reduced-motion repeats, audio export trimming, momentum teardown, recording coordinate spaces and inspector rebuilding. Wasm does not fix these host-layer defects.

### Performance and rendering architecture

| Finding                                    | Evidence                                                                                                                                          | Implication                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Value shape is rediscovered every sample   | Regex color/unit parsing, recursive key unions, object/array allocation and string formatting in `src/interpolate.ts:25`.                         | Compile shape/token layouts once; compare optimized TS against Rust using the same layout. Preserve returned-value identity/formatting where observable. |
| Track lookup scans segments                | `findIndex` in `src/track.ts:93`; the benchmark grows with key count.                                                                             | Monotonic segment cursor plus binary-search fallback for reverse/random seek.                                                                            |
| Spring setup does repeated work            | Duration search samples up to 20 seconds in 4 ms steps and refines; physical coefficients are recomputed in sampling. `src/physics.ts:36,49,205`. | Precompute coefficients and benchmark construction separately from playback. Preserve analytic seeking, not timestep simulation.                         |
| Timeline pruning is not automatically safe | Every child is sampled, including clamped before/after its span. `src/timeline.ts:352`.                                                           | Preserve callback counts and overlapping-writer order; cull only explicitly pure outputs after accounting for endpoint writes.                           |
| Existing SVG optimizations are real        | Cached selectors, unchanged-state signatures and hidden-layer geometry suppression. `docs/src/cue-sheet/renderer.ts:19,44,52`.                    | Retain these; do not attribute them to the rewrite later. Replace signatures with revision/dirty buffers only after equivalence tests.                   |
| Cue-sheet JSON is not a scene description  | Timing/control targets in `src/sheet.ts`; artwork/filter definitions in `docs/src/cue-sheet/CueScene.tsx:19`; target meaning in `renderer.ts:35`. | A second scene/asset/render-pass representation is required for native rendering.                                                                        |
| Encoding already runs natively             | Browser SVG → PNG sequence → GStreamer/x264. `docs/src/AdvancedCueSheetLab.tsx:259`, `docs/scripts/render-cue.mjs:34,52`.                         | Profile capture, transfers and rasterization; “moving encoding to Rust” alone misses the existing native encoder.                                        |
| Available telemetry is not a profiler      | `Trace.durationMs` is inter-tick cadence, not evaluator or GPU execution time. `src/trace.ts:10,33`.                                              | Add separate evaluation, host-write, render-submit, GPU-completion, readback and encode spans.                                                           |
| Current GPU correctness check is limited   | Stage 12 hashes 145 state snapshots and initializes 900 stars nondeterministically with `Math.random()`. `docs/src/ShowstopperLab.tsx:79,142`.    | State hashes do not prove rendered pixels or audio. Seed and capture the actual composite before using it as a golden.                                   |

The 23-target SVG study includes clipping, masks/reveals, gradients, turbulence/displacement, blur, ribbons/contours, particles, depth duplicates, chromatic echoes and typography. Its depth is vector duplication, not a physically lit mesh. The ambient study is raw WebGL/GLSL; Three scenes include their own material, lighting, tone-mapping and compositing semantics. These are different rendering contracts.

Existing records describe a 576-frame, 24 fps, 24-second, 1080p silent master and twelve decoded-frame comparisons with RGB MAE approximately 1.11–4.27. Those are prior browser-to-H.264 checks, not fresh all-frame, cross-backend or throughput measurements. The current manifest identifies JSON/video hashes but not all renderer, geometry, font, browser and GPU inputs.

## 4. Capability preservation matrix

| Current surface                             | Public behavior to retain                                                                                    | Rust / host split                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `Tween`, `animate`, `Line`, easing registry | Legacy constructors, chaining, seek/reverse/repeat/delay, actual wrapper passed to callbacks and `.finished` | Rust built-in interpolation/cycle kernels; JS wrappers, custom functions and observable lifecycle    |
| `MotionValue`                               | Synchronous `get/set/subscribe`, velocity, animation replacement and stop                                    | JS canonical object; optional numeric storage behind it; no asynchronous `get()`                     |
| Value shapes                                | Numbers, booleans, CSS-unit/color strings, arrays, nested optional properties, discrete fallbacks            | Numeric channels plus typed shape metadata; compatible reconstruction/formatting or host fallback    |
| `Track` / custom items                      | Pure `valueAt`, writing `sampleAt`, segment easings, arbitrary structural TimelineItem                       | Rust compiled tracks; custom `sampleAt` stays a host participant                                     |
| `Timeline`                                  | Nested ownership, symbolic positions, markers/cues/regions, local timebases, insertion order, once/reset     | Rust compiled schedule/traversal when supported; JS authoring and ordered callback barriers          |
| `Transport` / scheduler                     | One clock, injected drivers/clocks, rate/chase/loops, synchronous seek/step, attach order                    | Host provides timestamps and schedules frames; portable engine evaluates them                        |
| Cue sheets                                  | Existing schema/bindings/extensions, inspectable authoring and edits                                         | Versioned authored AST and compiler; no forced binary authoring or lossless-save assumption          |
| React                                       | Existing root/react imports, hooks, JSX composition, controlled playback, StrictMode and reduced motion      | React stays TypeScript; per-runtime backend service is additive                                      |
| Gestures                                    | Immediate/coalesced input modes, capture/preventDefault, arbitration, keyboard/ARIA, recording/replay        | Native input remains host-side; batchable numerical estimation/physics may move                      |
| DOM/SVG/Canvas/Three                        | Existing refs, styles, custom draw outputs/materials and Three object identity                               | Keep adapters; optionally supply values/geometry from Rust; new renderer is not a silent replacement |
| Audio/MIDI/signals                          | Browser/device ownership, permissions, offline opt-out, lifecycle                                            | Host integrations; portable audio scheduling data only after correctness work                        |
| Offline/testing/devtools                    | `frames()` synchronous iteration, awaited capture in `renderFrames`, manual driver, trace/inspection         | Native/Wasm evaluator can be shared; async GPU/export operations get a separate completion contract  |
| Package                                     | Eight existing entry points, ESM/CJS, optional React/Three peers, no browser globals required at import      | Keep canonical exports/self-imports; lazily load backend assets through a new optional entry         |

Existing packaged tests establish adapter identity within ESM and within CJS, not shared constructors across mixed ESM/CJS instances. Do not expand that guarantee accidentally; test/document mixed-format usage explicitly.

## 5. Target architecture

```text
Existing TS API / React / JSON authoring / browser input
                    |
       Host facade + capability classifier
          |                       |
    compatibility path       validated authoring + bindings
    opaque JS execution             |
                              compiler / versioned IR
                                    |
                       shared Rust evaluator + geometry
                         /                        \
              browser Wasm                  native Rust
                 |                              |
        ordered values/events             exact-frame job
          /             \                    /        \
  DOM/SVG/Three     portable scene     native scene   browser-host
  compatibility    renderer           renderer       fallback
                      |                   |
                wgpu / WGSL         bounded frame queue
                      |                   |
                  browser canvas     GStreamer + mux
```

A CPU evaluator and a GPU renderer are independent selections. `wasm + svg-dom`, `wasm + three`, `wasm + webgpu`, and `native + headless-renderer` must not be conflated into one “accelerated” boolean. Diagnostics should show the selected engine, renderer, execution location, capabilities and fallback reasons.

### Proposed ownership layout

Names below are proposals, not newly added packages or exports.

| Area                                  | Responsibility                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------- |
| `crates/motion-ir`                    | Versioned descriptors, limits, source IDs, validated frame-rate/time/value/easing types       |
| `crates/motion-core`                  | Pure sampling, analytic physics, schedule/event cursor, no browser/GPU/encoder dependencies   |
| `crates/motion-geometry`              | Seeded analytic paths, transforms, tessellation/instances; independent of authoring framework |
| `crates/motion-wasm`                  | Narrow `wasm-bindgen` ABI, generational handles, buffers, structured errors                   |
| `crates/motion-render`                | Portable scene representation, render-pass/resource management and wgpu backend               |
| `crates/motion-export`                | Native job orchestration, frame fences/readback, bounded encoder pipeline, manifests          |
| `src/backends/`                       | JS reference, Wasm loader, capability classifier and compatibility bridge                     |
| Existing `src/react.tsx` and adapters | Public interface/host ownership; split internally only where it improves review and tests     |
| Shared conformance fixtures           | Authored source, sample/event oracle, assets, render outputs and accepted corrections         |

Do not introduce a game engine or a large ECS merely to animate a collection of tracks. Use compact arrays/arenas and explicit resource ownership first. Keep Rust renderer dependencies out of the lightweight tween Wasm artifact.

## 6. Engine design decisions

### Authoring, compilation and exact time

Maintain three separate representations:

1. **Authored AST:** original time/frame/SMPTE expressions, target names, easing parameters, cue payload references, regions and local timebases. Preserve it for editing and round trips.
2. **Compiled timeline IR:** stable IDs, resolved placements, indexed segments/events, precomputed curve/physics coefficients, value-channel layouts, host-call barriers and source mappings.
3. **Scene IR:** paths, instances, text/font assets, gradients, clips/masks, filters, composition, render passes and target-to-property bindings.

Current cue sheets supply only part of the first representation. Do not derive either IR by serializing a live Timeline through the current lossy `saveSheet`.

Keep f64 milliseconds for public numeric compatibility. Preserve frame indices as integers and frame rates as validated rational numerator/denominator pairs; calculate each frame/sample timestamp from its index rather than accumulating rounded durations. An integer-only or f32 time API would discard existing sub-frame behavior. Infinite repeats are explicit validated variants, not arbitrary nonfinite data in every numeric field.

Preserve half-open loop ranges and inclusive offline frame ranges. A 576-frame movie samples 0–575. Specify floor/epsilon conversion, local timebase rebinding, drop-frame display/24-hour wrapping, negative rate, chase and large-gap event policy in independent tests.

Build interpolation plans once: number channels, color channels, unit tags, discrete endpoints and structural reconstruction metadata. Precompute spring coefficients; keep analytic value/velocity sampling for random seeks. Start with f64 scalar Rust; add explicitly detected SIMD builds where benchmarks justify them. Do not enable relaxed SIMD or fast-math behavior in the reference path. Transcendental functions may require tolerances across JS, native and Wasm; do not promise universal bit identity.

### ABI and batching

Use a versioned binary layout with stable target/channel IDs. Serialize validated descriptors at creation/edit time, not full objects/JSON per frame. Return a bounded value buffer, dirty-channel information, ordered event records and diagnostics. A pure compiled group should normally need one sample call per requested frame, not thousands of calls across the boundary.

The protocol needs:

- Runtime ID plus index/generation handles; validate type, bounds, ownership and disposal before dereferencing.
- Explicit ABI version, capacity, byte length, alignment, output generation and memory epoch.
- A defined borrowed-view lifetime. Refresh JS typed-array views when Wasm memory changes; never expose them as permanent user objects or React snapshots.
- Capacity reservation and reusable scratch buffers; growth and edits happen outside a protected frame transaction where possible.
- JS-side registries for callbacks, unknown payloads, target setters and objects; callback payloads do not need to be copied into Wasm merely to be delivered later.
- Structured validation/runtime errors. No Rust borrow or outstanding buffer assumption may span a reentrant host callback.
- Explicit behavior for callback exceptions, recursive seek, mutation, cancellation and stale worker completion. Never silently replay side-effectful callbacks after retry/fallback.

The memory-view hazard is documented by wasm-bindgen itself; using a Rust library does not remove it. [wasm-bindgen memory-view example](https://wasm-bindgen.github.io/wasm-bindgen/examples/webgl.html).

### Callback barriers and mutability

The existing execution order is a compatibility requirement except for explicitly accepted bug fixes. Model it as an ordered execution program: timeline cue barrier → eligible child evaluation groups and host calls → timeline callbacks → transport outputs → subscribers → seek notification.

For unrestricted callbacks/custom items, retain the JS path initially. Later, accelerate only proven-pure contiguous groups, with publication at the correct barriers. If a callback reads or mutates later children, the bridge must observe it before their evaluation. A “defer every mutation until next frame” rule is a new contract and may only apply to an explicit portable mode.

Public Tween fields, referenced value objects and custom item state can change outside library methods. Do not compile those once and ignore later mutation, freeze caller objects, or assume subscribers only inspect final frames. Add validated invalidation/accessor behavior where compatible; otherwise classify the object as host-only. Explicit compiled plans can own immutable copies without changing the original APIs.

Object identity also matters: `MotionValue` currently uses `Object.is`, and interpolation can create new objects even when leaves repeat. Skipping all unchanged notifications globally is a behavioral change. Optimize typed renderer bindings without silently changing public subscriptions.

### Scheduling and workers

Keep one host scheduling authority. Browser rAF, audio/external clocks and manual test drivers provide timestamps; Rust does not start a second animation clock. Snapping can reuse a previously computed frame only if state publication, callbacks and output semantics remain correct.

Keep synchronous `seek`, `MotionValue.get/set`, immediate gesture arbitration and `frames().next()` on a synchronous path. A worker is suitable for explicit portable scenes, heavy geometry, compilation and asynchronous export, not a transparent replacement for those operations.

Use a dedicated worker with private Wasm memory/transferable buffers before requiring shared memory. Define request generations, cancellation, queue depth and ownership of transferred buffers. Real-time rendering may present only the newest visual request, but must not silently drop cue events. Offline export must retain every requested frame and backpressure the producer.

Threaded Wasm is a later optional artifact. The documented wasm-bindgen-rayon path uses workers/shared memory and a pinned nightly/build-std setup; it adds operational complexity and isolation requirements. Do not make that the baseline toolchain or consume every available CPU by default. [wasm-bindgen-rayon requirements](https://github.com/RReverser/wasm-bindgen-rayon).

## 7. Rendering and export strategy

### A. Preserve the compatibility renderer

Retain DOM styles, SVG nodes, existing Canvas draw callbacks, Three.js objects/materials, CSS composition and browser audio/MIDI. React continues creating the semantic/accessible host tree; animation writes remain imperative. Moving DOM setters through `web-sys` would still call browser APIs and would not move layout/paint into Rust.

For the SVG study, first compare Rust state/geometry against the same SVG renderer at the same dimensions. This isolates evaluator correctness from rasterizer differences. Retain seeded geometry, unchanged-frame skipping, solo/mute/exploded inspection and responsive behavior.

Do not equate serialized SVG equality with pixel equality: hidden geometry can retain different historical attributes while the visible frame is equivalent. Conversely, matching numeric control state does not establish matching typography or filters.

### B. Add a portable GPU renderer

Recommended GPU foundation: `wgpu` with WGSL shaders, using its browser WebGPU and native graphics backends. Keep shader validation/translation aligned with its Naga dependency. WebGL availability in wgpu does not mean a compute-heavy WebGPU pipeline automatically works on WebGL; support must be declared per renderer. [wgpu backend and shader documentation](https://docs.rs/wgpu/latest/wgpu/).

Start with the bounded fullscreen ambient shader in `docs/src/AmbientShader.tsx:178`, not the whole Three scene. Then add retained paths/instances, gradients, clipping/masking, blur/displacement and explicit compositing through a render graph. Reuse pipelines, bind groups, textures, geometry buffers and scratch targets; batch/instance repeated particles and shards. Avoid CPU↔GPU readback during normal playback.

The scene schema must declare coordinate systems, clipping rules, `pathLength`/dash behavior, filter regions, color interpolation, premultiplied alpha, blend modes, text shaping, font identity, pixel ratio, output color space and asset dependencies. Preserve CSS brightness and cross-surface blends explicitly. Canvas output also needs accessible labels, a meaningful static fallback and preserved external controls.

Use a capability probe for device features/limits, then select the supported renderer. Handle device loss and resize/resource replacement. Fail visibly if `requirePortable` or an equivalent strict mode was requested; otherwise report and use the compatibility renderer. No missing effects disguised as a successful render.

### C. Evaluate vector implementations behind an interface

| Candidate                         | Role in the plan                                                                      | Acceptance condition                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct wgpu/WGSL effects          | Preferred controlled shader/effect path shared with native export                     | Shader, color/compositing and device-loss fixtures; real-device performance                                                                        |
| Vello / Vello Hybrid / CPU family | Time-boxed retained-vector renderer evaluation                                        | Verify the selected implementation's current browser/native support, filters, text, bundle and compatible wgpu versions on the actual scene corpus |
| `resvg` / `usvg`                  | Candidate native static-SVG snapshot/reference renderer                               | Explicit static-SVG subset, pinned fonts/assets and cross-rasterizer image tests; no DOM/script/animation parity claim                             |
| Skia / CanvasKit                  | Comparison option if fidelity/text/filter requirements beat the Rust-first candidates | Accept its different implementation/build/bundle tradeoffs only with measured benefit; not a mandatory second browser Wasm runtime                 |

The current Vello project distinguishes an experimental compute renderer, a CPU implementation and a hybrid renderer aimed at production use. This is a reason to benchmark a specific implementation, not to assume a single universal Vello backend. [Vello project](https://github.com/linebender/vello).

resvg targets static SVG rather than scripting/animation/DOM behavior; motion can supply snapshots, but a browser-equivalent export still needs validation. [resvg scope](https://github.com/linebender/resvg). CanvasKit exposes Skia drawing/text APIs through Wasm and is a legitimate fidelity comparison, not a Rust rewrite by itself. [CanvasKit](https://skia.org/docs/user/modules/canvaskit/).

### D. Give rendering a completion contract

Keep `TransportOutput.onTick` synchronous and compatible. Add a separate optional rendering interface for apply/submit, completion, pixel acquisition and disposal. The export driver awaits a frame-specific completion/readback fence before encoding; submission alone is not completion. The existing awaited `renderFrames` capture callback is an integration point, not evidence that arbitrary output promises are already awaited.

### E. Native/offline pipeline

Use the same Rust timeline/geometry crate natively; do not run the CLI through browser Wasm unnecessarily. Keep a browser-host export fallback for trusted applications that depend on DOM, arbitrary JavaScript, custom Three materials or unsupported effects. A native orchestrator can use that fallback before the native rasterizer is complete.

The target pipeline is exact frame index → evaluate → render → completion fence → bounded raw-frame queue → native encoder/mux. Preserve optional PNG checkpoints for regression, resume and archival rather than requiring PNG encode/decode on every delivery path.

Use the already present GStreamer ecosystem first, through its Rust bindings and an `appsrc`-style producer with explicit timestamps, caps and backpressure. FFmpeg can be a separately evaluated adapter if a required codec/workflow warrants it; do not bundle a large browser FFmpeg Wasm runtime into the core. [GStreamer Rust bindings](https://gstreamer.freedesktop.org/documentation/rust/stable/latest/docs/), [appsrc queue and buffer handling](https://gstreamer.freedesktop.org/documentation/app/appsrc.html).

At 1920×1080 RGBA8, one frame is 8,294,400 bytes; 24 fps is about 199 MB/s and 576 uncompressed frames are about 4.78 GB. A raw pipe removes PNG work but is not free. Bound queues, reuse buffers, overlap render/readback/encoding where safe, and measure copies. Do not promise zero-copy GPU-to-encoder integration on every platform.

For browser export, evaluate WebCodecs with configuration detection, a separate container muxer, bounded encoder queues, flush and `VideoFrame.close()` cleanup. Generate timestamps from integer frame indices/rational rates. Codec availability is implementation-specific; native/browser fallback remains necessary. [WebCodecs interfaces](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API), [codec support and processing model](https://w3c.github.io/webcodecs/).

Treat audio as a separate acceptance track: exact clip start offset, trim at both export bounds, gain/pan/rate, nested repeats/yoyo policy, 48 kHz sample positions, resampling and A/V mux synchronization. The current flagship is silent and `renderAudio` has AUD-08 gaps. Do not claim audio parity just because a video encoder works.

Export manifests should identify authored AST + scene IR versions, engine/renderer revision, shader/geometry hashes, complete assets/fonts, seed, frame range/rate, output dimensions/color/alpha, browser/native/GPU backend, encoder settings/version and output hashes. Keep device/network side effects disabled in portable export. Host callbacks with effects require explicit authorization/configuration; a generic `signalOutput` is not automatically harmless offline.

Temporal motion blur, HDR/wide-gamut and new cinematic effects are optional later capabilities, not requirements for initial parity. They need their own quality profiles and deterministic sample policies rather than changing existing looks by default.

## 8. React and end-user integration

Keep these current forms valid without new initialization requirements:

```ts
new Tween({ from: 0, to: 1, duration: 600, onUpdate }).play();
transport.seek('00:00:02:00');
const current = motionValue.get();
```

Existing React hooks/components continue using the same imports and ownership rules. An optional backend loader/runtime prop can be introduced, but its name and API must be designed and tested rather than presented as shipped functionality.

Proposed loading policy:

1. Root and React imports perform no fetch, worker creation or top-level await.
2. Applications can preload a Wasm runtime once outside constructors. Without it, existing code runs on JS immediately.
3. An optional React provider can initiate loading after commit and expose readiness/fallback diagnostics. Server rendering and hydration never depend on fetch completion.
4. Each composition selects a backend at a defined preparation boundary. Do not silently migrate playing graphs when a module arrives. Any later migration must transfer time, cursor/once state, velocity, promises, subscriptions and object identities without duplicate callbacks.
5. `auto` can select a ready, compatible backend; explicit `wasm`/portable-required behavior reports errors instead of silently pretending acceleration succeeded.

Keep arbitrary user callbacks in JS, passed the actual wrapper instance. Never leak unstable memory views into `useSyncExternalStore`. Owned resources use commit-phase acquisition and generation-guarded cleanup; borrowed transports stay caller-owned. `dispose()` must remain reattachable or reconstruct internal resources on reuse, as the existing StrictMode tests require. Any new terminal `destroy()` operation would be additive and separately documented.

Repair callback/output/target identity on rerender, pending sequence rebuilds, unmount during loading, reduced-motion infinite repeats, gesture momentum cleanup and HMR lifecycle before enabling Wasm by default. Do not make pointer capture/preventDefault wait for a worker response.

### Packaging and deployment

Keep all eight exports and optional peers. Add separate backend/render/export entries or packages only where needed; coordinate `package.json`, `files`, `tsup.config.ts`, `tsconfig.json`, `docs/source-aliases.ts` and Vitest aliases. Keep adapters importing the canonical core, not bundling another scheduler/class/backend registry.

Generate browser loader and Node/CJS-compatible paths deliberately. Use package-relative asset resolution plus a documented URL/module/bytes override for unusual hosts. Ship hashed Wasm/worker assets, correct MIME, a non-streaming loading fallback, compatible cache headers and version/ABI checks. Do not hardcode the homelab hostname into a reusable package. [wasm-bindgen deployment targets](https://wasm-bindgen.github.io/wasm-bindgen/reference/deployment.html).

The repository currently uses Vite 7.3.x; current Vite documentation describes newer Wasm support too. Test the installed version and intended consumer bundlers independently instead of assuming the newest guide applies. Include production base paths, Node SSR, CJS, React streaming/hydration and workers in a packed-consumer matrix. [Vite Wasm initialization and asset handling](https://vite.dev/guide/features.html).

CSP may block Wasm compilation; document the narrow `wasm-unsafe-eval` policy where appropriate, not a blanket `unsafe-eval` requirement. If policy forbids Wasm/workers, the ordinary JS/DOM path remains usable. Cross-origin isolation is optional and must be tested with fonts, media, embeds and popup integrations before any host configuration change. [CSP WebAssembly policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).

## 9. Performance, fidelity and operational gates

Compare **current JS → optimized compiled JS → Rust/Wasm scalar → optional SIMD/worker/GPU**. Use identical authored work, output semantics, dimensions, quality and host callbacks. Keep cold-start and steady-state results separate. A faster Rust microkernel is not a win if marshaling, object reconstruction, startup or rendering makes the actual workflow slower.

### Required benchmark matrix

| Workload                                                     | Measurements                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 1, 100, 1k, 10k, 100k channels; scalar/vector/compound/color | Evaluation, boundary calls/bytes, host materialization, GC/allocation and retained memory                |
| 8/256/1024-key tracks; forward, reverse, random seeks        | Lookup and compilation time, update latency, cursor correctness                                          |
| Deep/sparse/overlapping timelines and dense cues             | Evaluation vs traversal/event cost, mutation barriers, catch-up overflow                                 |
| Springs and inertia                                          | Construction, analytic sample cost, velocity continuity, interruption                                    |
| Real input and React                                         | Pointer-to-value and pointer-to-paint latency, coalescing, cancellation, commit/subscription cost        |
| SVG study at 540p/1080p/4K                                   | Per-layer geometry, DOM/string writes, paint/raster, filters and presented frames                        |
| 24 fps authored under 60/120 Hz scheduling                   | Duplicate evaluation/publication and actual changed-frame work                                           |
| Ambient shader and Three composite                           | CPU submission vs GPU completion, actual render-target resolution and device limits                      |
| Full 576-frame export, then longer/4K jobs                   | Stage timings, throughput, copies, backpressure, peak RSS/VRAM, cancellation/resume and encoded duration |
| Cold start                                                   | Asset compressed size, fetch, decode/compile/instantiate, first usable frame, failed/blocked load        |
| Lifecycle soak                                               | Repeated mount/unmount, edits, context/device loss, handle/worker/buffer counts and memory plateau       |

The existing Chrome harness forces SwiftShader. Retain it for repeatable CI correctness, but use physical integrated/discrete GPUs and an ARM/mobile browser for performance claims. Do not infer GPU execution time from CPU submit duration. Capture presentation misses and input latency, not just average FPS.

### Proposed promotion criteria, to ratify after phase-0 baselines

- All compatibility/state/event tests pass for supported features; every unsupported feature has a tested fallback or clear diagnostic.
- A material steady-state win on the agreed dense portable workload, measured end to end against **optimized JS**, not only today's recursive interpreter. A starting decision rule is at least 1.5× throughput with repeatable confidence; keep JS selected where this is not achieved.
- No material common-UI regression: use repeated measurements and a provisional tolerance of the larger of 5% or 0.1 ms in p95 processing latency. First-frame readiness must not block ordinary JS fallback.
- Respect application budgets: 16.67 ms at 60 Hz and 8.33 ms at 120 Hz include browser rendering, not just engine work. Agree evaluator/render budgets per fixture/device; do not promise every complex SVG at 120 fps.
- Warm pure-Rust sampling performs no heap allocation inside its reserved-capacity region. Host object materialization may still allocate and must be measured honestly.
- No mandatory Wasm, worker or GPU asset download on an untouched basic JS path. Set kernel/facade size budgets from the spike; renderer/encoder dependencies stay lazy and separate.
- Bounded memory and cancellation for long exports; no full-video raw-frame accumulation. A native-export throughput target is conditional on matching fidelity and hardware, not a universal “Rust is faster” percentage.

### Conformance and quality

1. Preserve authored fixtures and an independent JS oracle after accepted bug corrections. Every discovered counterexample becomes a minimized fixture.
2. Compare exact frame indices, discrete/string values, callback order, once/reset, loop/range counts and lifecycle events. Start f64 comparison with documented absolute/relative tolerances, then tighten or split by algorithm; no tolerance for wrong events or frame boundaries.
3. Sample the flagship's complete 576-frame state in sequential, reverse and randomized order. Capture all lossless reference frames for the canonical renderer; compare new renderers before encoding, then validate decoded media separately.
4. Pin assets/fonts/seeds, dimensions, color pipeline and renderer versions. The current generic monospace text needs a font policy before portable image equality is meaningful.
5. Use per-feature pixel/foreground metrics and visual review; existing H.264 thresholds are a codec baseline, not permission for an additional rasterizer regression. Test thin paths, masks, gradient transforms, blur/displacement bounds, compositing and text independently.
6. Add React SSR/hydration/StrictMode/Suspense-abandonment, target/callback replacement, loader failure, memory-growth and multiple-runtime tests. Add actual keyboard/touch/reduced-motion coverage.
7. Add audio sample-level fixtures, hardware/browser tests and A/V duration checks; ensure export cannot emit MIDI or unspecified network/device side effects.
8. Fuzz authored JSON, compiled IR and handle/command protocols with resource limits: recursion, items/keys/events, memory, textures, assets and processing time. Rust memory safety alone does not prevent expensive input or unsafe host callbacks.

Use Criterion for native microbenchmarks, property/state-machine tests with Proptest, and bounded cargo-fuzz jobs; keep browser and application performance outside those microbenchmarks. [Criterion](https://bheisler.github.io/criterion.rs/book/), [Proptest](https://proptest-rs.github.io/proptest/intro.html), [cargo-fuzz](https://rust-fuzz.github.io/book/cargo-fuzz.html).

## 10. Implementation phases and review gates

Each phase is a reviewable deliverable, not permission to implement or deploy it now. Begin by reviewing/checkpointing the existing dirty work with its owner; do not sweep it into a new commit or reset it.

| Phase                            | Deliverable                                                                                                                                        | Exit gate / dependency                                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Contract and baseline        | Current-source checkpoint, accepted-corrections ledger, full API/state/event fixtures, phase-level profiler and reproducible benchmark harness     | Resolve/specify AUD-01–04 and critical new findings; measure real SVG/export bottlenecks; establish reference devices and budgets                    |
| 1 — Compiler and optimized JS    | Lossless authored AST, versioned numeric IR, TS compiled evaluator, indexed tracks, precomputed interpolation/physics                              | Differential parity against corrected JS; complete source mappings and explicit host-only classification                                             |
| 2 — Rust/Wasm numeric spike      | Pinned Rust workspace, native+Wasm scalar core, thin ABI, batched sampling, comparison report                                                      | Same-IR TS/native/Wasm parity including host publication; measured wins justify continuation/selection                                               |
| 3 — Production host integration  | Canonical JS wrappers, optional loader/runtime selection, lifecycle-safe handles, React/gesture/device adapters, optional SIMD artifact            | Packed ESM/CJS and consumer/SSR matrix; failure fallback, mutation/order/StrictMode and memory tests                                                 |
| 4 — Portable scene and GPU pilot | Scene/asset/render-pass IR, seeded ambient WGSL pilot, wgpu resources/fences, vector-renderer evaluation                                           | HTTPS staging available; real-device profiling; no missing-effect fallback ambiguity; existing renderer remains usable                               |
| 5 — Flagship renderer and export | SVG study port for the declared subset, native renderer plus browser-host fallback, bounded GStreamer pipeline, provenance and cancellation/resume | All-frame state/lossless-render corpus, decoded media, duration/frame counts, memory bounds; audio acceptance separately tracked                     |
| 6 — Hardening and rollout        | Fuzz/soak/accessibility/browser matrix, documentation, migration diagnostics, prerelease packages and consumer canaries                            | Explicit release approval; staged opt-in → supported auto selection, with rollback; no removal of compatibility features without versioned agreement |

Phases 0–3 are the first engine milestone. Phases 4–5 are a distinct graphics/export milestone and should not block useful evaluator improvements. Scene-schema design and HTTPS planning can proceed alongside phases 1–3, but renderer implementation should use the settled IR/time contract.

Use a short spike to obtain real costs, then estimate engine and renderer milestones separately. Full SVG/filter/text/Three/audio parity has a much larger uncertainty than the numeric kernel. Do not commit to a release date before the phase-2 and phase-4 reports.

### First implementation batch, once authorized

1. Review/checkpoint the current motion changes without incorporating unrelated work.
2. Promote the read-only benchmark into maintained tooling, adding browser stage profiling and saved results.
3. Add desired regression tests for scheduler callback isolation, transactional `Timeline.add`, signed/hold velocity and offline start-cue behavior; record any intended API corrections before fixing them.
4. Resolve authored placement/serialization/validation/offline ownership contracts and establish immutable source fixtures.
5. Write an ADR for compiled IR, callback barriers and ownership; implement the TS compiled scalar/compound Track path.
6. Build the same evaluator in Rust and compare it against that optimized TS path through the actual JS boundary.

This first batch must not rewrite React, change renderer output, publish a package or replace the docs container.

## 11. Agentic development and version control

Proposed branches after baseline review: `audit/rust-wasm-baseline`, `feat/compiled-motion-ir`, `spike/rust-wasm-kernel`, `feat/wasm-runtime-integration`, `feat/portable-scene-renderer`, and `feat/native-motion-export`. None were created by this audit.

Keep correctness fixes, layout/compiler changes, Rust implementation, host integration and renderer changes in separate commits. Do not combine a visual redesign or a dhaakon-ui consumer upgrade with the engine rewrite; use those applications as compatibility fixtures instead.

For future agents, document per-crate/adapter ownership, public entry points, ABI/IR versions, memory and callback contracts, exact test commands, reference fixtures and known unsupported features. Require every task to identify its files, acceptance tests and whether it changes semantics or only implementation. Keep historical proposals separate from current instructions.

Pin `rust-toolchain.toml`, Cargo.lock, npm lockfile and matching wasm-bindgen crate/CLI versions; select renderer/wgpu versions together. Use a reproducible build container and reviewed feature sets. Keep a portable Wasm artifact distinct from SIMD/thread variants; dependencies can introduce instructions that invalidate an intended baseline, so validate the final binary. [Rust Wasm target/features](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html).

Evaluate release optimization levels/LTO and Binaryen `wasm-opt` against both throughput and compressed size. Keep source maps/debug symbols as diagnostic artifacts. Build tooling and fuzz/nightly dependencies should not leak into the normal stable kernel build. [Binaryen](https://github.com/WebAssembly/binaryen).

CI should separate source conformance, native Rust, browser Wasm, actual packed consumers, renderer/pixel tests, media tests and controlled performance jobs. Export machine-readable failures with fixture/source IDs and minimal reproduction commands; do not make every edit rebuild every renderer and codec.

Use a next-minor prerelease only after the baseline version is agreed; a name such as `0.7.0-alpha.N` is illustrative, not a version assignment. Public API/schema changes need migration notes and explicit version decisions. New private IR versions must reject incompatible artifacts rather than reading them optimistically.

Keep backend selection and package rollback independent. A faulty Wasm/rendering prerelease must be reversible to the compatible JS/browser path without changing user code or data. Release tags, npm publication, branch pushes, HTTPS/header changes and docs/container rollout all require separate authorization.

## 12. Decisions to ratify before implementation

Recommended defaults are provided so these do not block reviewing the plan:

- Target both ordinary React UI motion and cinematic cue sheets; report their performance separately.
- Preserve browser DOM/SVG and Three support indefinitely as host integrations; native portability is capability-declared, not universal.
- Keep f64 timing and existing synchronous APIs. Start with single-threaded Wasm, then justify SIMD/workers from measurements.
- Adopt wgpu/WGSL for the controlled GPU path, with a bounded vector-library evaluation before committing the entire scene renderer.
- Keep GStreamer as the first native encoder integration; browser WebCodecs is optional and feature-detected.
- Introduce HTTPS staging for GPU evaluation; do not require shared-memory isolation for default users.
- Fix/specify the existing correctness debt before treating it as a cross-language reference.

Success means users keep the same compositional vocabulary and integrations, while measured workloads gain a compiled, portable evaluation core and a rendering/export pipeline that spends less time parsing, allocating, crossing boundaries and moving pixels unnecessarily. It does not mean replacing every JavaScript line with Rust or making unsupported fidelity/performance claims.
