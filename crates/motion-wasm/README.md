# Numeric Wasm spike (opt-in)

`motion-ir` validates immutable version-1 numeric plans; `motion-core` compiles and
samples them natively and in Wasm. This crate only adds instance-local handles
and JavaScript bindings. It has no renderer, clock, callback, worker, audio or GPU
dependency. Existing TypeScript APIs are not automatically redirected here.

## Build and native verification

```sh
node scripts/setup-rust.mjs
node scripts/build-wasm.mjs
node --input-type=module -e 'import {cargo,run} from "./scripts/setup-rust.mjs"; run(cargo,["test","--workspace","--locked"]);'
```

The setup command provisions Rust 1.94.1 and matching wasm-bindgen crate/CLI
0.2.114 locally in ignored `.tools/`. It does not modify shell profiles. A native
C linker and development headers are needed even when building Wasm proc macros.
For the audited Ubuntu x64 host with missing `cc`, `setup-rust.mjs --local-cc`
extracts checksum-pinned GCC 15 packages into `.tools/host-cc`; it never installs
system packages. That optional bootstrap requires the host's glibc development
files and binutils. The automatic scripts are Linux x64 tooling; other operating
systems need manual Cargo/wasm-bindgen invocations and separate verification.

`wasm/web/` is ESM and supports asynchronous or synchronous initialization;
`wasm/node/` is CJS. Generated code and binaries are never hand edited. The build
emits `wasm/manifest.json` with source and artifact SHA-256 hashes, tool versions,
target and exact hashed input paths. This is kernel provenance, not visual/export
provenance. Cargo.lock pins transitive Rust dependencies; no wasm-opt step runs.

For native conformance, `cargo run --locked --release -p motion-core --example
sample` reads `{ "plan": <numeric IR>, "times": [<milliseconds>] }` from stdin and
writes `{ "version": 1, "frames": [[<concatenated values>]] }`. Use the setup
module's `cargo` and `rustEnv` exports to select project-local tools. The runner
limits input to 64 MiB, samples to 100,000 and output scalars to 4,000,000. It is not
a media export CLI.

## ABI version 1

- `version(): number` returns 1.
- `wasm_memory(): WebAssembly.Memory` exposes this module instance's memory.
- `create(planJson: string): number` validates, copies and compiles a plan, samples
  its initial time zero, and returns a u32 handle.
- `create_binary(bytes: Uint8Array): number` adds binary-v1 creation into the same
  arena. JSON creation remains supported; callers can feature-detect this export.
- `sample(handle, milliseconds): void` synchronously samples the whole batch.
- `values_ptr(handle): number` returns the output's byte offset, aligned for f64.
- `values_len(handle): number` returns the number of f64 values, not bytes.
- `free(handle): void` releases the plan and invalidates its handle.

Errors are thrown strings with a stable leading code and descriptive context.
Handles are opaque instance-local u32 values: 16-bit generation and 16-bit slot.
Freeing a stale handle throws. Exhausted generations retire rather than wrap.
Never pass a handle to another instance: numeric handles do not encode instance
identity; the JavaScript owner must enforce that boundary.

The buffer is retained during sampling. Its contents are borrowed, not a user
snapshot: copy before callbacks/React publication, do not write into it, and do
not retain/use it after free. Any creation or explicit memory growth can replace
`wasm_memory().buffer`; refresh typed-array views whenever that buffer changes. There
are no user callbacks while the arena is borrowed.

Per-instance budgets are 256 live plans, 8,000,000 retained key scalars and
2,000,000 retained output scalars. A failed insertion leaves existing plans valid.
These bound retained resources, not exact peak bytes during descriptor parsing.
JSON or binary descriptors are accepted only at creation, never on the sampling
hot path. Binary creation avoids decimal/string expansion for dense numeric plans.

## Binary descriptor version 1

The byte budget is 64 MiB, independent of the JSON budget; all numeric IR limits
still apply. Fields are packed with no alignment/padding. Integers and IEEE-754
f64 numbers are little-endian. The format is exactly:

```text
magic: ASCII DHM1
version: u32 = 1
trackCount: u32
for each track:
  idByteLength: u32
  id: UTF-8 bytes[idByteLength]
  width: u32
  keyCount: u32
  repeat: i32
  repeatDelay: f64
  direction: u8 (normal=0, reverse=1, alternate=2, alternate-reverse=3)
  times: f64[keyCount]
  values: f64[keyCount * width] (key-major)
  for each of keyCount - 1 segments:
    kind: u8
    argCount: u8
    args: f64[argCount]
```

Kind codes are array indices in this fixed order:

```text
linear, easeInQuad, easeOutQuad, easeInOutQuad, easeInCubic,
easeOutCubic, easeInOutCubic, easeInQuart, easeOutQuart,
easeInOutQuart, easeOutBack, dhaakon, cubicBezier, spring, steps
```

Codes 0..11 require zero arguments; codes 12/13/14 require 4/3/2 respectively.
The decoder checks counts, remaining bytes, aggregate budgets and multiplication
overflow before allocating their sections. It rejects invalid UTF-8, duplicate
IDs, unknown codes, invalid numeric/easing parameters, truncation and trailing
bytes. It reads unaligned fields safely without pointer casts. The additive
export does not change ABI version 1 or the retained sample buffer contract.

## Numeric contract

Plan fields are `version: 1` and `tracks`. Tracks contain unique UTF-8 `id`,
nondecreasing `times`, equal-width numeric `values` vectors, one `easings`
descriptor per segment, `repeat`, `repeatDelay`, and `direction`. Unknown fields
are rejected. Duplicate times preserve the existing first-ending-segment rule.

Limits: 64 MiB JSON; 100,000 tracks; 4,096 keys/track; widths 1..64; 4,000,000 key
scalars; 1,000,000 output scalars; IDs 1..256 UTF-8 bytes. Key times/repeat delay
are finite 0..1e12 ms; values have magnitude <=1e100. Repeat is -1 for infinity or
an integer 0..1,000,000. Samples accept finite milliseconds of magnitude <=1e15;
negative times clamp to zero. Invalid samples leave the previous output intact.

Built-in easing names use empty args. `cubicBezier` uses `[x1,y1,x2,y2]` with x in
0..1 and y in -100..100. `spring` uses `[stiffness,damping,mass]`: stiffness/mass
1e-6..1e6, damping 0..1e6. `steps` uses `[count,position]`, integer count 1..1e6 and
position 0=end / 1=start. `dhaakon` is the built-in Bezier alias. Parameters are
precomputed where useful; the existing normalized spring formula is preserved.

Positive cycle durations are never rounded up to 1 ms. Infinite cycles use
remainders to avoid quotient overflow for subnormal durations. Zero-duration
tracks return their first key, consistent with `Track.valueAt(0)`. Finite repeat
ends clamp, intermediate cycle boundaries are half-open. Sampling is analytic
and order-independent. f64 transcendental results require documented numeric
tolerances across engines; this does not promise bitwise or rendered-pixel parity.
