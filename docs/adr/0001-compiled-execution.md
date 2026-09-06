# ADR 0001 — Explicit compiled groups, shared numeric IR

Accepted for the experimental engine spike · 2026-09-06

## Decision

Keep existing mutable `Tween`, `Track`, `Timeline`, `Transport`, MotionValue and React APIs as the compatibility engine. Add a separately imported `@dhaakon/motion/compiled` entry with immutable authoring snapshots, a compiled JavaScript reference, and an optional Rust/Wasm evaluator. No root import initializes Wasm, fetches an asset, creates a worker, or installs a second clock.

`compileTracks()` accepts authored Track descriptions, not live object graphs. Its source IDs map directly to output bindings and capability diagnostics. A compiled player is one explicitly owned TimelineItem; existing Timeline/Transport scheduling can drive it synchronously. This is not yet a compiler for arbitrary nested cue sheets, physics items, mutable Tweens, closures, render trees, or audio/MIDI.

## Representations and ownership

- Authoring retains detached values, key/time expressions, frame-rate inputs and easing descriptors. Caller objects are never frozen. Opaque host easing functions retain their JavaScript identity.
- Numeric IR version 1 contains bounded sorted keys, fixed numeric vectors, complete per-segment curve descriptors, repeat/direction and source IDs. It contains no setters, payloads or browser references.
- DHM1 binary version 1 is the creation-time little-endian wire encoding. JSON creation remains a diagnostic/native-conformance path. Neither is serialized per sample.
- Rust `motion-ir` validates; `motion-core` compiles curves and samples into reserved output; `motion-wasm` manages generation-checked handles. GPU/encoder dependencies are excluded.
- `src/backends/numeric.ts` independently evaluates the same IR in JavaScript. `shape.ts` precompiles numeric/vector/color/CSS-unit reconstruction. Irregular, discrete and custom-easing tracks select the host path with a diagnostic.
- `wasm/manifest.json` identifies generated assets, checked-in Rust/build inputs, ABI/IR/binary versions and the toolchain. Generated assets are separate from `dist/`, because ordinary tsup builds clean `dist/`.

The binary record layout and limits are documented in `crates/motion-wasm/README.md` and executable in the independent Rust decoder and TS encoder. Unknown versions, malformed data, resource-limit violations and stale handles fail explicitly.

## Time and numerical contract

Use f64 milliseconds. Authoring frame rates resolve through the existing rational-time helpers; offline timestamps derive from integer frame indices. Repeats use exact positive cycle duration, including sub-millisecond durations. A zero-duration compiled Track returns its first key, matching Track's endpoint rule. Infinite repeat is encoded as `-1` only in private IR, never accepted as a negative authored repeat.

Built-in IR operations have fixed mathematical definitions, independent of the mutable host easing registry. Custom/replaced functions are classified using the actual resolved function. Preserve color/unit formatting and duplicate-key segment selection. Cross-language numeric tests use absolute/relative tolerances; state/event boundaries and discrete strings are not accepted with a numerical tolerance.

## Observable ordering

The compatibility engine keeps timeline-cue → child evaluation/publication → timeline callback → output → subscriber ordering. No live graph is automatically converted into a batch.

Explicit portable groups evaluate and materialize every result before publishing bindings in authored track order. Binding callbacks can read the complete sampled group through `get()`. They cannot mutate its compiled plan. Reentrant sampling of that same player throws; use the compatibility engine for callback-driven graph mutation. Disposing from a callback stops subsequent publication. Exceptions propagate and are never automatically replayed on another backend.

If any track requires host execution, the entire group uses inline host Track sampling/publication. This conservatively preserves host easing and setter ordering. Explicit `backend: 'wasm'` rejects a host-only plan; `auto` reports fallback. No player hot-switches when a runtime becomes available.

## Memory and lifecycle

Each runtime owns its evaluators. Rust's module-local arena enforces slot/generation and aggregate capacity limits. The JS wrapper never exposes raw handles to ordinary consumers. `createJsEvaluator` and Wasm's low-level evaluator return borrowed numeric views for tooling; those views are not stable React snapshots.

Wasm views refresh after memory growth and validate pointer/count bounds. A player materializes output into JavaScript values before any callback can grow memory or release a handle. `player.dispose()` and `runtime.dispose()` are explicit terminal operations and idempotent; cleanup attempts all owned handles even if one fails. Existing `Transport.dispose()` remains reusable and does not destroy a caller-owned compiled player.

React consumers acquire players/evaluators in effects, not during render. A pure plan can be memoized during render. StrictMode effect replay creates fresh owned players; Suspense abandonment cannot leak a Wasm allocation because acquisition has not happened yet. A runtime loaded by the application is borrowed unless that component explicitly owns it.

## Promotion and follow-up

Default selection remains JavaScript. An explicitly supplied runtime plus `backend: 'wasm'` or `'auto'` opts into the spike. Benchmarks include host materialization/publication and report construction separately. A numeric speedup does not authorize global default selection: creation cost, common-UI latency, browser startup, payload limits and full application workloads still gate promotion.

Rendering remains a separate backend decision. This ADR does not replace SVG/DOM/Three, implement wgpu, export native video, require HTTPS/shared memory, or claim pixel/audio equivalence. Those are later gated deliverables in the migration plan.
