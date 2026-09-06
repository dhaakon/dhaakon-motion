# Engine migration — implementation status

2026-09-06 · branch `feat/rust-wasm-engine` · package version remains 0.6.0

Baseline checkpoint: `76b1221`. The preexisting docs, media, engine fixes and audit were committed separately on `main` with the owner's authorization before creating the feature branch. No push, publication, version bump, HTTPS configuration or container deployment is implied.

## Implemented first batch

- Correctness regressions and accepted behavior corrections listed below; the four former expected-failure cases now pass normally.
- Detached authored-sheet snapshots, bounded contextual validation, declaration-order placement rebinding, indexed Track lookup, and exclusive offline capture ownership.
- Optional compiled Track API with source IDs, immutable plans, precompiled value shapes and explicit host-only diagnostics.
- Independent JavaScript and Rust evaluators, shared versioned numeric IR, batched f64 sampling, binary creation, and native conformance runner.
- Lazy application-controlled Wasm initialization, generation-checked handles, refreshed memory views, and cleanup/reentry tests.
- Maintained engine benchmarks, actual packaged ESM/CJS and browser checks, and read-only SVG capture-stage profiling.

This is the plan's **first implementation batch**, not completion of all phases. Phase 0 has its targeted corrections and measurement tooling, but not the full device/performance corpus. Phases 1–2 have a tested portable numeric subset. Phase 3 has optional package/host integration foundations, not automatic acceleration of every React hook or mutable graph. Phases 4–6—portable scene/wgpu renderer, native video export, broader hardening and rollout—remain open.

## Usage

Existing imports and animation code remain valid. Opt into compiled groups separately:

Compiled plans resolve their timebase once; a containing Timeline does not rebind their authored frames. Set `frameRate` on each compiled input before preparation when using frame/SMPTE literals.

```ts
import { Timeline, Transport } from '@dhaakon/motion';
import { compileTracks, createCompiledPlayer } from '@dhaakon/motion/compiled';

const plan = compileTracks([
  {
    id: 'logo',
    frameRate: 24,
    easing: 'dhaakon',
    keyframes: [
      { at: '0f', value: { x: 0, opacity: 0 } },
      { at: '24f', value: { x: 300, opacity: 1 } },
    ],
  },
]);
const player = createCompiledPlayer(plan, {
  bindings: { logo: (value) => console.log(value) },
});
const transport = new Transport({ root: new Timeline({ frameRate: 24 }).add(player) });
transport.seek(500); // Synchronous; same clock/Timeline integration.
transport.dispose();
player.dispose(); // Explicit compiled ownership; not done by Transport teardown.
```

Load browser Wasm explicitly, outside render or in an owned effect:

```ts
import { loadWasmRuntime, createCompiledPlayer } from '@dhaakon/motion/compiled';

const runtime = await loadWasmRuntime(async () => {
  const bindings = await import('@dhaakon/motion/wasm/web/motion_wasm.js');
  // Default generated loader resolves its binary beside itself when served directly.
  // Bundlers should pass an emitted asset URL, bytes, or WebAssembly.Module explicitly.
  const initialized = await bindings.default({ module_or_path: '/assets/motion_wasm_bg.wasm' });
  return { bindings, memory: initialized.memory };
});
const player = createCompiledPlayer(plan, { backend: 'wasm', runtime });
// ... use the player, then clean up its owner ...
player.dispose();
runtime.dispose();
```

That URL is an application-provided example, not an asset automatically copied by the package. The real packed browser test serves an exported binary under `/motion-test/assets/`; unusual hosts can supply bytes or an already compiled module. Wasm loading failures reject the loader promise; applications may keep their existing JS composition. `auto` selects a ready supplied runtime only at player creation and reports why a host-only plan falls back. No global default changes.

Node/CommonJS uses the actual exported Node bindings:

```js
const { createWasmRuntime } = require('@dhaakon/motion/compiled');
const bindings = require('@dhaakon/motion/wasm/node/motion_wasm.js');
const runtime = createWasmRuntime(bindings, bindings.wasm_memory());
```

React needs no rewritten hook. Memoize pure authoring plans if useful; create the owned player/transport in `useEffect`, and dispose both in that effect's cleanup. Keep a shared preloaded runtime caller-owned. Do not create Wasm evaluators in render or use borrowed numeric buffers as `useSyncExternalStore` snapshots.

## Accepted corrections

| Finding        | Implemented contract / regression                                                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RW-02          | Scheduler isolates callback failures, calls `onError(error, task)`, and rearms. Failed tasks retry unless explicitly removed; reporting failures do not stop unrelated tasks.                                                                                       |
| RW-03          | Resolve placement before child ownership/timebase mutation. Missing labels leave the child unattached and playable.                                                                                                                                                 |
| RW-04          | Tween velocity is signed with respect to increasing sampled local time; leading/final/repeat-delay holds report zero. Direct sampling does not change public elapsed time.                                                                                          |
| RW-05          | Modified scalar inertia uses target-relative amplitude, with a continuous settling tail. Effective initial velocity changes when the target changes. Unmodified decay remains unchanged; `bounce:false` stops at its bound.                                         |
| RW-06          | Easing names use own keys; parameters/tuple shapes are checked; step-start and spring factory metadata survive serialization. Shadowed registry names cannot misidentify a function.                                                                                |
| AUD-01         | Authored placement expressions replay in declaration order when timebases change, including markers/cues/regions. Explicit nested timebases win.                                                                                                                    |
| AUD-02         | `saveSheet(loaded)` returns a detached copy of the original authored source. To reflect runtime edits, call `saveSheet(timeline, { source: 'runtime' })`. Runtime mode preserves Track/cue/region metadata but remains best-effort for opaque extensions/functions. |
| AUD-03 / RW-07 | Repeated offline calls reuse one owner. Capture rejects playing/concurrent/rate-conflicting/live-output sources, includes the fresh start boundary, prevents playback during await, and releases ownership in cleanup.                                              |
| Cycle boundary | Sub-millisecond positive cycles are not rounded to 1ms. Zero-duration infinite sampling is finite.                                                                                                                                                                  |

An authored snapshot is not a recording of later runtime edits. JSON source and opaque host functions also have different portability guarantees. Validation bounds ordinary data; it is not a sandbox for host factories, closures, proxies or device effects.

Fresh partial capture primes crossing history without extra setters or update callbacks. A subsequent `from > 0` call resumes existing cue/once state. Capture leaves the owner at the last sampled frame, suspends loop wrapping without changing its configuration, and reports first-frame delta zero. Explicit concurrent graph edits/seeks remain unsupported. General before-start nested cue behavior, large-gap cue overflow, other React/gesture/audio audit findings and extreme direct-API numeric inputs remain follow-up work.

## Reproducible checks

```sh
npm run rust:setup -- --local-cc # Linux x64 helper; optional locally extracted GCC if cc is absent
npm run build:wasm             # pinned Cargo.lock + bindgen; regenerates wasm/ and hashes
npm run test:rust              # native tests, formatting and native/Wasm Clippy
npm run check                 # types, source tests, fresh ESM/CJS distribution tests
npm run test:wasm              # actual native/JS/web-module/Node-Wasm conformance
npm run test:packed-engine     # installed tarball, SSR, declarations and actual Chrome loader
npm run bench:engine           # interpreter vs compiled JS vs Wasm; JSON report
npm run profile:cue            # built SVG snapshot stage spans; no MP4 replacement
npm run check:all              # docs routes, cleanup and decoded existing media too
```

Rust tools and optional compiler packages are installed only in ignored `.tools/`; Rust output is in ignored `target/`. Other platforms must provide the pinned toolchain locally. No normal import/build provisions tools or accesses the network. Generated Wasm is checked in for ordinary npm consumers; Rust is needed only when rebuilding it.

Reports live under ignored `test-results/`. The conformance corpus covers all 576 flagship control frames in sequential, reverse and permuted order. This is **state conformance**, not a ported rasterizer or pixel/audio claim. Browser package checks complement Node execution of the web glue. The existing decoded-media check remains a browser SVG versus lossy H.264 comparison.

The SVG profiler separates combined evaluation/host writes, serialization, image decode, canvas submission, canvas export and CDP transfer. `pngMs` includes any deferred rasterization/flush/readback performed by `toDataURL`, not isolated PNG encoder or GPU time. Its software-renderer timings must not be presented as real-GPU performance.

## Verification and measured decision

The implemented source passed `npm run check:all`: **331 source tests across 38 files**, no expected failures, 15 freshly built distribution tests, docs formatting/budgets, all 16 routes, navigation/cleanup, and 12 decoded-media comparisons. Rust passed **23 native tests**, rustfmt, and both native/Wasm Clippy with warnings denied. Cross-runtime conformance passed **846,488 numeric comparisons**, including binary/JSON creation, materialized strings, stale handles/memory growth and the complete flagship control-frame corpus.

The packed package passed independent ESM/CJS identity checks, strict NodeNext declarations, React 19.2.8 SSR without implicit fetch/Wasm initialization, and actual Chrome 152 loading under `/motion-test/`. Separate React tests cover StrictMode cleanup/replay and abandoned Suspense acquisition. These are not a complete browser/React-version or hydration matrix. The generated scalar Wasm artifact is **183,156 bytes**; it is not part of the ordinary docs or root-import download.

The final source benchmark uses 3 rounds × 60 warm-up + 180 measured samples, pooling 540 measurements. Node 24.20.0, Linux x64, i7-8809G. These are shared-workstation p50 sampling times including materialization and host callbacks, excluding construction and browser rendering:

| Workload               | Existing Track interpreter | Compiled JS | Rust/Wasm |
| ---------------------- | -------------------------: | ----------: | --------: |
| 1,000 scalar tracks    |                   0.359 ms |    0.492 ms |  0.186 ms |
| 1,000 compound tracks  |                   2.984 ms |    1.304 ms |  0.940 ms |
| 10,000 scalar tracks   |                   3.674 ms |    6.422 ms |  2.820 ms |
| 10,000 compound tracks |                  31.011 ms |   20.491 ms | 18.205 ms |

The compiler/reference still needs optimization: compiled JS regresses scalar sampling versus the existing Track implementation, and dense compound materialization limits the additional Rust benefit to about 1.13× versus compiled JS. For 10,000 compound tracks, measured creation was approximately 9 ms for ordinary Tracks, 554 ms for compiled JS and 626 ms for the full compiled/Wasm path. Do not trade that startup cost into ordinary UI by default. **Production promotion is not justified by this run.** Keep the spike explicit while improving the compiler/reference, minimizing host materialization and measuring actual browser/consumer workloads.

The initial 1,000-track × 1,024-key JSON creation exceeded the diagnostic 64 MiB wire limit. DHM1 binary creation was added in response; it is now the generated runtime's preferred creation path. The final run passed that workload: Wasm p50 sampling was 0.530 ms, but full authoring/compilation/creation took about 13.8 seconds. That setup cost remains explicit optimization debt. Byte/channel limits remain enforced. Sampling behavior did not change.

### Next gates

Measure stable native/browser/device baselines and cold start before default selection. Compiling, copying and validating immutable data has real setup cost. Full host materialization can dominate a fast Rust kernel. Large plan creation must satisfy both numeric capacity and encoded-byte limits; a resource rejection is reported, not labeled an accelerated success.

Next engine work: reduce compilation/shape-publication overhead, extend the immutable timeline/physics/cue program with explicit callback barriers, test more consumer bundlers and hydration/worker/failure cases, then consider narrowly supported auto selection. Renderer work requires a separate Scene IR and fidelity corpus. WebGPU staging needs an approved HTTPS origin and real-device profiling. Native GStreamer export needs completion fences, bounded frame queues, cancellation/resume and all-frame visual acceptance. Release/push/deployment remain separate approvals.

See [ADR 0001](adr/0001-compiled-execution.md), [the original audit and phased plan](RUST-WASM-AUDIT-PLAN.md), and [the Rust ABI notes](../crates/motion-wasm/README.md).
