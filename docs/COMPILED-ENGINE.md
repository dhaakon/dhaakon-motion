# Compiled engine (experimental)

`@dhaakon/motion/compiled` is an opt-in way to evaluate many numeric tracks at once. You describe
tracks as plain data, compile them into an immutable plan, and play that plan through the same
`Timeline` and `Transport` as everything else. A plan can run on the built-in JavaScript evaluator or
on a Rust evaluator compiled to WebAssembly.

It does not replace the ordinary `Tween`/`Track`/`Timeline` API, it does not render anything, and
nothing loads WebAssembly unless your code asks for it. See [ADR 0001](adr/0001-compiled-execution.md)
for the design and [the Rust ABI notes](../crates/motion-wasm/README.md) for the Wasm bindings. The
docs site has live studies at `/rust/experimental`, described in [RUST-EXPERIMENTAL.md](RUST-EXPERIMENTAL.md).

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

## Performance

Measure your own workload before choosing a backend. As a reference point, the benchmark below pooled 540 measurements (3 rounds × 60 warm-up + 180 measured samples) on Node 24.20.0, Linux x64, i7-8809G. These are shared-workstation p50 sampling times including materialization and host callbacks, excluding construction and browser rendering:

| Workload               | Existing Track interpreter | Compiled JS | Rust/Wasm |
| ---------------------- | -------------------------: | ----------: | --------: |
| 1,000 scalar tracks    |                   0.359 ms |    0.492 ms |  0.186 ms |
| 1,000 compound tracks  |                   2.984 ms |    1.304 ms |  0.940 ms |
| 10,000 scalar tracks   |                   3.674 ms |    6.422 ms |  2.820 ms |
| 10,000 compound tracks |                  31.011 ms |   20.491 ms | 18.205 ms |

The compiler/reference still needs optimization: compiled JS regresses scalar sampling versus the existing Track implementation, and dense compound materialization limits the additional Rust benefit to about 1.13× versus compiled JS. For 10,000 compound tracks, measured creation was approximately 9 ms for ordinary Tracks, 554 ms for compiled JS and 626 ms for the full compiled/Wasm path. Do not trade that startup cost into ordinary UI by default. **Production promotion is not justified by this run.** Keep the spike explicit while improving the compiler/reference, minimizing host materialization and measuring actual browser/consumer workloads.

## Building and testing the engine

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
