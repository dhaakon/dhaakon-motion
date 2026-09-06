# Codebase audit — 2026-09-04

## Scope and conclusion

Reviewed the timing/interpolation/physics engine, timeline ownership and cue
crossings, JSON/scene serialization, offline sampling, React registration and
gesture lifecycles, rendering/device adapters, diagnostics, docs demos, package
entry points, tests, build configuration, and docs deployment path.

The main docs problem was architectural: a single root mounted many unrelated
live systems, including a WebGL flagship implicitly inserted by the timecode
example's number. Source navigation was difficult and development tooling could
resolve some adapters from stale distribution output.

This change provides 16 lazy feature routes, focused lab modules, a static
overview, viewport suspension for continuous visuals, reproducible verification,
and agent-oriented documentation. It also fixes confirmed runtime defects.
It is not a claim that the entire engine is defect-free or production-certified.

## Fixed in this pass

| Finding | Impact | Change / evidence |
| --- | --- | --- |
| Transport loop anchor retained historical laps | Old cue crossings fired repeatedly; work grew with elapsed laps; video loop resync could recur | Rebase the unquantized anchor; forward/reverse and sub-frame regression tests |
| Track ignored cycle direction | Reverse and alternating tracks sampled forward | Sample direction-adjusted progress; three direction/repeat-delay tests |
| Scheduler snapshot invoked canceled tasks | A disposed renderer could still receive a callback later in the same flush | Check membership before invocation; cleanup regression |
| Disposed Transport remained `playing` | StrictMode reattachment could fail to schedule a clock | Normalize disposed state; reattachment regression |
| Timeline accepted ownership cycles | Self/ancestor insertion could cause unbounded traversal | Reject cycles before mutation; ownership regression |
| Audio ticks ignored paused state | Paused scrubbing could start sound | Gate source playback on the owning transport state; regression |
| Audio drift used rate instead of its inverse | Non-unit rates unnecessarily restarted voices | Correct clock conversion and restart on rate change; regression |
| Audio voice teardown retained connections | Audio graph resources outlived stopped voices | Disconnect source and gain nodes on teardown |
| Camera roll accumulated on repeat sampling | Identical frame seeks could produce different orientations | Apply roll deltas when no look-at reset occurs; regression |
| MIDI lacked offline capability guard | An offline output list could send live MIDI | Declare `supportsOffline: false` |
| Docs mounted unrelated animations together | Unnecessary clocks, subscriptions, canvases, and GPU scenes | Route-specific mounting; real Chrome returns to zero pending animation callbacks after every route |
| Flagship geometry/material teardown incomplete | Repeated route visits could retain GPU resources | Traverse/dispose renderables, release WebGL contexts, dispose temporary cage geometry |
| Recorder and canvas lifecycle/resize work | Armed recording listeners survived unmount; canvas resized every draw | Stop recorder on cleanup; resize canvas through ResizeObserver only |
| JSON editor destroyed the good take before validation | Invalid edits stopped playback | Construct the replacement first, then dispose the old transport |
| Misleading docs metrics and demonstrations | CSS 3D labeled Three.js; state hashes described as RGBA/clean processes; stale size/comparison claims | Accurate simulation/state labels; measured build budgets; removed static competitor matrix |
| Partial docs source aliases | Audio/MIDI/devtools could use stale `dist/` | One complete alias registry shared by Vite/Vitest; package-export mapping test |
| Built adapters duplicated engine classes and scheduler | Nested audio was skipped, offline audio rejected public transports, Three.js tracks lost serialization, testing could not drive the root scheduler | Adapter runtime imports use the externalized package self-reference; six new ESM/CJS integration tests reproduced and now guard these boundaries |
| Benchmark duplicated code and required a sibling repo | Benchmark could disagree with shipped estimator or fail on a clean checkout | Use the actual built estimator with deterministic synthetic input; no browser dependency |
| Development-tool dependency advisory | Low-severity esbuild Windows dev-server advisory | Compatible lockfile update via npm audit fix; subsequent npm audit reports zero known vulnerabilities |

Dependency result is time-specific, not a guarantee. The resolved advisory was
[GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr).
No npm version bump, publish, or git push was performed.

## Remaining findings / executable backlog

### SVG director’s cut follow-up — 2026-09-05

The SVG study now has five acts, 23 inspectable targets, independent vector
geometry/renderer modules, solo/mute/exploded inspection, and a 24-second 1080p
offline master. It retains authored JSON, rejects incompatible/oversized edits
before replacing the good take, and skips unchanged snapped-frame DOM writes.

**AUD-09 is addressed for decoded-frame telemetry:** only presented video-frame
callbacks update the decoded counter; a requested seek does not manufacture zero
drift. Twelve paused decoded-frame comparisons passed against fresh SVG pixels
at matching 1080p resolution. Mean absolute RGB error ranged from approximately
1.11 to 4.27 on the 0–255 scale; this is a bounded lossy-image comparison, not
pixel identity or hardware clock synchronization. Responsive SVG filter rasterization
can differ from a downscaled 1080p video. See `CUE-SHEET.md` for the exact semantics.

The full local gate passed with **229 source tests, four expected failures,
15 packaged tests**, 16 routes, and the decoded-frame/layer/mobile checks.
GStreamer independently confirmed 24 fps, 24 seconds, 1920 × 1080, and 576
decoded frames. The new SVG chunk is about 46 kB; initial JS remains about
311 kB. Render frames and browser reports are excluded from Docker context,
reducing this export's build context from 1.292 GB to about 12 MB.

Deployed follow-up checks passed at `http://dhaakon-ubuntu:21764` on 2026-09-05:
all 16 routes, cleanup, history, mobile navigation, media byte ranges, 12 decoded
image comparisons, paused seeks, and layer controls. Only the motion docs service
was recreated. Its healthy image is `dc74a30e6eb7`, entry `index-K5SFcZmT.js`;
the served MP4 checksum matches the generated media manifest.

### Remaining engine and adapter findings

The first four desired contracts are reproduced with `test.fails` in
`tests/core/known-issues.test.ts`. They are reported as **expected failures**, not
fixed regressions. A future fix should remove `.fails` and update this table.

| ID | Priority | Evidence and safe next change |
| --- | --- | --- |
| AUD-01 | High | `Timeline.bindFrameRate` remeasures child durations but not authored starts/markers/cues. Authoring `'24f'` before binding 24 fps leaves a 400 ms placement from the provisional 60 fps context. Retain authored placement expressions and re-resolve them in dependency order. Demos now author relevant nested timelines with an explicit rate. |
| AUD-02 | High | `saveSheet` drops cue payload/once semantics, region structure, Track segment easing/repeat/direction, and some nested metadata. Keep authored JSON as the authoritative show file. Add full nested load → save → load semantic comparisons before calling serialization lossless. |
| AUD-03 | High | Reusing the same Timeline in `renderFrames` creates a second owning Transport and throws. Passing an already-playing Transport also risks wall-clock writes during async capture. Define ownership/restoration semantics; reject or isolate live sources; use fresh nonplaying sources today. |
| AUD-04 | High for untrusted input | `validateSheet` is incomplete for timing values, region shapes, value types, nonfinite values, nesting/resource limits, and extension types. Passing validation does not guarantee successful loading or bounded resource use. Add context-aware validation and explicit limits before accepting arbitrary external show files. |
| AUD-05 | Medium | React hooks use serialized keys that omit function/identity changes (`useGesture`, `useDrag`, `usePinch`); output attachment depends on output names. Replacing a callback or same-named output may retain the old binding. Add rerender identity tests and latest-callback refs. |
| AUD-06 | Medium | `createSequenceValue` registers items before markers, so JSX items referencing marker names can fail on rebuild. Queued rebuilds are not explicitly invalidated on owner teardown. Define marker/item dependency order and a generation/disposal guard. |
| AUD-07 | Medium | `useTween` handles reduced motion by setting duration to zero while retaining infinite repeats. Test and implement an explicit final-state policy for reduced-motion repeats and transition config changes. `DemoViewport` already requires opt-in playback for continuous visual studies under reduced motion. |
| AUD-08 | High for audio export | `renderAudio` does not offset buffer reads when exporting from the middle of a clip, or explicitly bound each source at `to`. Nested repeat/yoyo audio folding is documented as unsupported; `lookahead` is not implemented. Add exact scheduling tests, then real OfflineAudioContext sample tests. |
| AUD-10 | Medium | Gesture `scrub()` starts an InertiaItem without retaining it for disposal. Some low-level bindings start target animations whose ownership is not explicit. Add cancel/finish guards so unmount cannot resume a disposed transport. |
| AUD-11 | Medium | Gesture recording infers normalization from coordinate ranges instead of storing a normalization flag; tiny absolute coordinates can replay as normalized. Version/document the recording format and add replay tests for both coordinate spaces. |
| AUD-12 | Low / perf | Devtools rebuilds the full lane DOM after every tick; queued rebuild/trail timeout cleanup is incomplete. Track tree revisions, update only playhead/cue presentation per tick, and cancel deferred work on unmount. |
| AUD-13 | Low / perf | Styles remain global and gesture galleries share a module. The shell still shares some motion runtime code through MotionConfig. Further splitting should follow measured import/CPU profiles, not arbitrary file-size targets. |

Additional hardening areas: invalid numeric options in the direct APIs,
drop-frame conversion across the 24-hour rollover, exceptions in scheduler tasks
and cue/listener callbacks, JSON prototype/reserved-key handling, and deterministic
particle seeds in visual-only studies. These need dedicated boundary/fuzz tests;
they are not covered by the route smoke check.

## Performance evidence

- Previous deployed entry: about **434.4 kB** minified / **137.9 kB** gzip.
- First routed build: about **310.9 kB** / **98.5 kB** gzip, approximately **28% less entry JS**.
- Overview page: approximately **1.7 kB**, loaded separately; no canvas/video or pending animation callbacks.
- The ~523 kB Three.js vendor chunk is still large, but is loaded only by WebGL pages.
- `npm run docs:check` measures current output. Budgets cover the initial static
  import closure and each page's own chunk, **not** the sum of its lazy dependencies.
- CSS/fonts remain shared. No CPU, GPU, memory, FPS, or network-speed improvement
  percentage is claimed from bundle sizes alone.

## Verification and limits

Final local gate: **224 passing source tests, 4 explicitly expected failures,
15 passing built-package tests**, formatting and build budgets passed, and all
16 route views checked in Chrome (15 feature pages plus the idle overview).
The known failures are AUD-01–04 above; they are not included in the passing count.

Deployed docs verification also passed at `http://dhaakon-ubuntu:21764` on
2026-09-04 (America/New_York): all feature routes, client-side cleanup, legacy
bookmarks, back/forward, mobile navigation, 404 view, and MP4 byte ranges.
Only `dhaakon-motion-docs` was recreated; the container is healthy. Deployment
image: `4b9ec51a48ce`; entry asset: `index-U6aTrBqB.js`.

The modular docs surface has a pinned formatter and `format:check` gate so new
agent edits remain readable and consistent without rewriting unrelated legacy demos.

Run `npm run check:all` for types, source regressions, explicitly tracked expected
failures, ESM/CJS package checks, manifest budgets, and headless Chrome smoke checks.
`test-results/docs-smoke.json` records the current browser run; screenshots include
desktop overview, SVG comparison, and mobile transport. Deployed checks use
`DOCS_URL` and verify byte-range serving for the actual MP4.

Chrome checks prove mounting, navigation, basic runtime health, and animation
callback cleanup—not exhaustive interactions, all GPU allocations, audio quality,
decoded-frame parity, or every gesture on real touch hardware. Cross-browser,
long-duration memory profiling, real MIDI/audio devices, container-image scanning,
and adversarial cue-sheet fuzzing remain separate validation work.

## Recommended follow-up order

1. Resolve authored timing and lossless serialization (AUD-01/02).
2. Specify safe offline ownership and validate untrusted data (AUD-03/04/08).
3. Repair React/gesture callback identity and cancellation contracts (AUD-05/06/07/10).
4. Extend image verification across browsers; verify recording fidelity and long-duration behavior.
