# @dhaakon/motion 0.4 — Transport, Timecode, Cue Sheets

Implementation plan for the next major capability set. Written for an implementing agent (Sonnet 5). Read the whole document before touching code. Phases are ordered by dependency; do not start a phase before the previous phase's acceptance criteria pass.

Repo: `/home/claude/Development/ai/dhaakon-motion` (git remote: Gitea `dhaakon-ubuntu/dhaakon-motion`). Current version `0.3.2`. Target version `0.4.0`.

---

## 0. Ground truth: what exists today

Read these files first; every phase builds on them.

| File | Lines | What it is |
|---|---|---|
| `src/scheduler.ts` | 32 | `FrameScheduler` (one rAF for all tasks) with injectable `FrameDriver { request, cancel, now }`. Global `scheduler` singleton. |
| `src/core.ts` | 183 | `Tween` (owns its own clock: `startedAt = frameLoop.now() - elapsed`; `sampleAt(ms)` is the pure sampler), `Timeline` (flat list of `Tween`s driven by an internal `Tween<number>`; `render(time)` calls `child.sampleAt(time - start)`), `MotionValue`, `animate`, `stagger`, `Line`. |
| `src/easing.ts` | 55 | `Easing` table, `cubicBezier`, `spring`, `resolveEasing(name|fn)`. |
| `src/interpolate.ts` | 43 | `interpolate(from, to, t)` for numbers, unit strings, colors, arrays, nested objects. |
| `src/react.tsx` | 158 | `MotionConfig`, `useReducedMotion`, `useInView`, `useMotionValue`, `useMotionValueState`, `useTween`, `useTimeline` (returns a **ref**, timeline built inside `useEffect`), `Motion`, `motion.*`, `Reveal`, `writeStyle`/`readStyle` (module-private). |
| `tests/core.test.mjs` | 66 | `node --test` against `dist/`. Contains a `ManualDriver` class (time, request, cancel, step) that already gives deterministic tests. |
| `docs/src/App.tsx`, `docs/src/ThreeShowcase.tsx` | 345 / 367 | Vite docs site (port 21764 in the network, 5175 locally). Imports `src/` directly via alias. Three.js showcase drives four `MotionValue`s from one `Timeline` and calls `renderer.render` in `onUpdate`. |
| `tsup.config.ts` | | Two entries (`index`, `react`), ESM + CJS, dts. New entry points must be added here **and** in `package.json#exports`. |

Invariants that must survive:

- The core (`.` entry) has **zero runtime dependencies**. Three, Web Audio, Web MIDI, React are all optional peers behind separate entry points.
- `sideEffects: false`. No module-level side effects except the `scheduler` singleton.
- All existing public APIs keep working unchanged (`Tween`, `Timeline.add/label/play/pause/stop/reverse/seek/loop`, position strings, `MotionValue`, React exports). Additive only, except where this document explicitly says otherwise.
- Every active tween/timeline still shares one `requestAnimationFrame`.
- Time inside the engine stays **milliseconds as a JS number**. Frames and timecodes are views over ms computed through a rational frame rate; never accumulate frame time by repeated addition.

Known defects to fold in while you are there (each gets a test):

1. Position `'<+=100'` / `'>-=50'` throws `Unknown timeline label` (parses as a label named `<`). Support `<`/`>` with `+=`/`-=` offsets.
2. `Tween.getCurrentFrame` uses `Math.ceil`; frame index must be `floor` with an epsilon. Keep the old method, have it delegate to the new one.
3. `Timeline.play()` re-configures its driver tween's `from/to/duration` on every play; this goes away with the transport refactor.
4. `Timeline` has no `totalDuration` (repeat-aware); nesting needs it.

---

## 1. Target architecture

```
                         ┌──────────────────────────┐
   FrameScheduler ─tick─▶│        Transport         │◀── Clock (performance.now | AudioContext | external chase)
   (one rAF)             │  time · rate · state     │
                         │  loop · frameRate        │
                         └─────┬──────────────┬─────┘
                               │ render(t)    │ onTick(t, frame)
                     ┌─────────▼────────┐  ┌──▼──────────────────────────────┐
                     │ Timeline (root)  │  │ Outputs                          │
                     │ ├ Tween          │  │  three   → renderer.render once  │
                     │ ├ Track (keys)   │  │  canvas  → draw once             │
                     │ ├ Timeline (nest)│  │  audio   → clip sync + params    │
                     │ ├ AudioClip      │  │  midi/signal → cue → bytes       │
                     │ ├ Marker / Cue   │  │  dom     → (values already wrote)│
                     │ └ ...            │  │  trace   → inspection ring buffer│
                     └──────────────────┘  └──────────────────────────────────┘
```

Tick order inside `Transport.tick(now)`:

1. Compute the new `time` from the clock, rate, loop region, and frame snapping.
2. `root.render(time)` — every item samples and **writes values** (MotionValue.set, DOM style, Three object fields). Cues crossed since the last render fire here, in time order.
3. `for (output of outputs) output.onTick(frameInfo)` — draw calls, audio param pushes, hardware sends. Each renderer draws **once** per tick after all writes.
4. `subscribers` (React state, playhead UI) are notified last.

Standalone `Tween.play()` (used by `animate()`, `motion.*`, `useTween`) keeps its current self-clocked `advance` path. It is unchanged.

New module layout (core entry):

```
src/
  scheduler.ts     (unchanged)
  cycle.ts         NEW  shared repeat / yoyo / delay math (extracted from Tween.sampleAt)
  time.ts          NEW  FrameRate, rational frame<->ms, duration parsing ('12f', '1.5s', '500ms')
  timecode.ts      NEW  SMPTE parse/format incl. drop-frame
  transport.ts     NEW  Transport, Clock, TransportOutput, chase
  items.ts         NEW  TimelineItem interface, Track (keyframes), Marker, Cue, AudioClip descriptor
  timeline.ts      NEW  Timeline moved out of core.ts, nested, markers, cues, inspect/toAscii
  core.ts          Tween, MotionValue, animate, stagger, Line (Timeline re-exported from timeline.ts for compat)
  offline.ts       NEW  renderFrames / OfflineTransport
  sheet.ts         NEW  cue sheet + scene state (de)serialization, validation, easing registry
  dom.ts           NEW  writeStyle/readStyle moved from react.tsx so non-React code can use them
  trace.ts         NEW  ring-buffer trace output
  index.ts         re-exports all of the above
  react.tsx        + Transport provider, Sequence, Track, Cue, Marker, hooks
  three.ts         NEW entry  ./three
  audio.ts         NEW entry  ./audio
  midi.ts          NEW entry  ./midi
  testing.ts       NEW entry  ./testing
  devtools.ts      NEW entry  ./devtools (plain DOM inspector)
```

Every NEW entry: add to `tsup.config.ts#entry`, `package.json#exports` (types/import/require), `tsup#external` for its peer (`three`), and `peerDependenciesMeta` optional.

Code style: the existing code is dense (several statements per line). For the new complex modules (`transport`, `timecode`, `timeline`, `sheet`) prefer one statement per line and short functions; correctness and readability over matching density. Strict TS, no `any` in public signatures.

---

## 2. Phase 0 — Test infrastructure and preparatory refactor

Goal: make later phases testable without a build step and without the DOM, and prepare `Tween`/`Timeline` for nesting.

### 0.1 Vitest

- Add devDeps: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/dom`.
- `vitest.config.ts` with two projects: `core` (environment `node`, `tests/core/**/*.test.ts`), `react` (environment `jsdom`, `tests/react/**/*.test.tsx`). Both resolve `@dhaakon/motion` and `@dhaakon/motion/*` to `src/` via `resolve.alias` (same aliases as `docs/vite.config.ts`, plus the new entries).
- Scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:dist": "npm run build && node --test tests/dist/*.test.mjs"`, `"typecheck": "tsc --noEmit"`, `"check": "npm run typecheck && npm test && npm run test:dist"`.
- Move `tests/core.test.mjs` to `tests/dist/core.test.mjs` unchanged (it is the packaged-output smoke test). Port its cases to `tests/core/tween.test.ts` and `tests/core/timeline.test.ts` on `src/`.

### 0.2 `src/testing.ts` (entry `./testing`)

Promote the test `ManualDriver` to a public, typed API:

```ts
export class ManualDriver implements FrameDriver {
  time = 0; requests = 0;
  now(): number;
  request(cb): number; cancel(id): void;
  step(time: number): void;              // absolute; runs the pending callback once
  advance(delta: number): void;          // relative
  stepFrames(n: number, frameRate: FrameRateInput): void;  // added in phase 1
}
export function createTestScheduler(): { driver: ManualDriver; scheduler: FrameScheduler };
export function installFrameDriver(driver?: ManualDriver): () => void;
   // swaps the global `scheduler`'s driver (add a `setDriver` to FrameScheduler); returns restore fn. Needed for React tests that use motion.*.
export function recordValues<T>(tween: Tween<T>): T[];        // wraps onUpdate, returns the live array
export function sample(timeline: Timeline, times: TimeInput[]): Array<{ time: number; values: Record<string, unknown> }>;
   // seeks each time, collects every bound target's current value (phase 5 bindings) — until then, collects the `value` of each Tween in the tree
```

`FrameScheduler` gains `setDriver(driver: FrameDriver)` (cancels the pending frame, swaps, re-wakes if tasks exist).

### 0.3 Extract cycle math: `src/cycle.ts`

```ts
export interface CycleSpec { duration: number; delay: number; repeat: number; repeatDelay: number; direction: Direction; reversed: boolean; }
export interface CycleSample { iteration: number; cycleTime: number; progress: number; active: number; }
export function activeDuration(spec): number;          // repeat===Infinity → Infinity
export function totalDuration(spec): number;
export function sampleCycle(spec, milliseconds): CycleSample;   // exactly the math currently in Tween.sampleAt lines 99-107
```

`Tween.sampleAt` calls `sampleCycle`; existing tests must still pass bit-for-bit (values in `tests/dist/core.test.mjs` are exact equality).

### 0.4 `TimelineItem` interface: `src/items.ts`

```ts
export interface TimelineItem {
  readonly kind: 'tween' | 'track' | 'timeline' | 'cue' | 'marker' | 'audio' | string;
  name?: string;
  readonly totalDuration: number;        // ms incl. delay + repeats; Infinity allowed
  sampleAt(localMs: number, ctx: RenderContext): void;   // write values, fire cues
  reset?(): void;                        // clear crossing state (used by stop / offline start)
}
export interface RenderContext { direction: 1 | -1; fireCues: boolean; frame?: FrameInfo; transport?: Transport; }
```

`Tween` implements it (`kind: 'tween'`, existing `sampleAt` gets an optional `ctx` param, ignored). `Timeline.add()` accepts any `TimelineItem`; internal entries become `{ item, start, end }`.

Acceptance for phase 0: `npm run check` green; `tests/dist/core.test.mjs` unchanged and passing; docs site still builds (`npm run docs:build`).

---

## 3. Phase 1 — Time foundations: frame rates, durations, SMPTE timecode

### 1.1 `src/time.ts`

```ts
export interface FrameRate { readonly num: number; readonly den: number; readonly dropFrame: boolean; readonly fps: number /* num/den */; readonly label: string; }
export type FrameRateInput = number | string | FrameRate | { num: number; den: number; dropFrame?: boolean };
export const FrameRates: { '23.976': FrameRate; '24': …; '25': …; '29.97': …; '29.97df': …; '30': …; '50': …; '59.94': …; '59.94df': …; '60': …; };
export function frameRate(input: FrameRateInput): FrameRate;
   // 29.97 → {30000,1001,false}; '29.97df' → dropFrame true; 23.976 → {24000,1001}; plain ints → {n,1}
   // dropFrame is only legal for 30000/1001 and 60000/1001 → throw otherwise
export function frameToMs(frame: number, rate: FrameRate): number;   // frame * 1000 * den / num
export function msToFrame(ms: number, rate: FrameRate): number;      // Math.floor(ms * num / (1000 * den) + FRAME_EPSILON), FRAME_EPSILON = 1e-6
export function snapToFrame(ms: number, rate: FrameRate): number;    // frameToMs(msToFrame(ms))
export type TimeInput = number | string;   // ms | '12f' | '1.5s' | '500ms' | 'HH:MM:SS:FF' | 'HH:MM:SS;FF'
export function parseTime(input: TimeInput, rate?: FrameRate): number;  // → ms. Frames/timecode need `rate`, throw a clear error if missing.
export function formatTime(ms: number, rate?: FrameRate, style?: 'ms' | 'seconds' | 'frames' | 'timecode'): string;
```

### 1.2 `src/timecode.ts`

```ts
export interface Timecode { hours: number; minutes: number; seconds: number; frames: number; dropFrame: boolean; }
export function parseTimecode(text: string, rate: FrameRate): Timecode;   // accepts ':' and ';' separators; ';' forces dropFrame; validates ranges; drop-frame validity (frames 0/1 at minute boundaries not divisible by 10 are invalid at 29.97df)
export function timecodeToFrames(tc: Timecode, rate: FrameRate): number;  // drop-frame aware
export function framesToTimecode(frame: number, rate: FrameRate): Timecode;
export function formatTimecode(tc: Timecode): string;                     // 'HH:MM:SS:FF' or 'HH:MM:SS;FF'
export function msToTimecode(ms: number, rate: FrameRate): Timecode;
export function timecodeToMs(text: string | Timecode, rate: FrameRate): number;
export function addFrames(tc: Timecode, frames: number, rate: FrameRate): Timecode;
```

Drop-frame algorithm (29.97df, standard SMPTE): nominal 30 fps; drop frame numbers 0 and 1 at the start of every minute except minutes divisible by 10. For 59.94df drop 4 (0–3). Implement `timecodeToFrames` as `totalMinutes * (nominalFps*60) + ... - dropped * (totalMinutes - totalMinutes/10)` and `framesToTimecode` with the standard inverse (compute `D = frames / framesPer10Min`, `M = frames % framesPer10Min`, add back drops). Test against known vectors:

| Timecode | Rate | Frames |
|---|---|---|
| `00:01:00;02` | 29.97df | 1800 |
| `00:10:00;00` | 29.97df | 17982 |
| `01:00:00;00` | 29.97df | 107892 |
| `00:01:00:00` | 30 | 1800 |
| `00:00:01:00` | 24 | 24 |
| `00:00:01:23` | 24 | 47 |
| `01:00:00;00` | 59.94df | 215784 |

Round-trip property: for every frame in `[0, 3 hours)` at 29.97df, `timecodeToFrames(framesToTimecode(f)) === f` (run in a test over a strided sample plus exhaustive over the first 20 minutes).

### 1.3 Wire into `Tween` and `Timeline`

- `Tween` gets `frameAt(rate: FrameRateInput): number` (= `msToFrame(elapsed - delay)`) and `timecodeAt(rate)`. `getCurrentFrame(fps)` delegates to `frameAt` (fix defect 2).
- `Timeline` options gain `frameRate?: FrameRateInput` and `snap?: boolean` (default `false`; `true` quantizes every render time to a frame boundary). Position parsing (`resolvePosition`) is rewritten on top of `parseTime`:
  - number → ms; `'12f'`, `'1.5s'`, `'500ms'`, timecode → via `parseTime(at, this.frameRate)`;
  - `'label'`, `'label+=N'`, `'label-=N'` where `N` is any `TimeInput` (`'intro+=12f'`, `'verse-=00:00:00:06'`);
  - `'<'`, `'>'`, `'<+=N'`, `'<-=N'`, `'>+=N'`, `'>-=N'` (fix defect 1);
  - nested timelines without their own `frameRate` inherit the parent's at attach time.
- `timeline.duration` remains ms; add `timeline.frames` (`msToFrame(duration)`), `timeline.timecode(ms?)`.

Acceptance: `tests/core/time.test.ts`, `tests/core/timecode.test.ts` with the vectors above; position parsing tests for every form listed; `'<+=100'` works.

---

## 4. Phase 2 — Transport, nested timelines, markers and cues

### 2.1 `src/transport.ts`

```ts
export interface Clock { now(): number; }        // ms
export type TransportState = 'idle' | 'playing' | 'paused' | 'finished';
export interface TransportOptions {
  scheduler?: FrameScheduler;      // tick source (default: global)
  clock?: Clock;                   // time source (default: scheduler.now)
  frameRate?: FrameRateInput;      // default 60 (used for FrameInfo, snapping, step())
  snap?: boolean;                  // quantize time to frames on every tick
  rate?: number;                   // playback rate, default 1; negative plays backwards
  loop?: boolean | [TimeInput, TimeInput];   // whole duration or a region
  duration?: TimeInput;            // explicit; otherwise root.totalDuration
}
export interface FrameInfo { time: number; frame: number; timecode: string; delta: number; rate: number; direction: 1 | -1; frameRate: FrameRate; }
export interface TransportOutput {
  name?: string;
  onAttach?(transport: Transport): void;
  onTick?(info: FrameInfo): void;
  onStateChange?(state: TransportState, transport: Transport): void;
  onSeek?(info: FrameInfo): void;
  onRateChange?(rate: number): void;
  onDetach?(): void;
  supportsOffline?: boolean;      // default true; false → skipped by the offline renderer (e.g. live audio)
}

export class Transport {
  constructor(options?: TransportOptions);
  readonly frameRate: FrameRate;
  time: number;                            // ms, read-only outside (use seek)
  rate: number; state: TransportState; duration: number;
  root: Timeline;                          // created lazily; `transport.add(item, at)` forwards to root.add
  add(item: TimelineItem, at?: TimelinePosition): this;
  attach(output: TransportOutput): () => void;
  subscribe(listener: (info: FrameInfo, transport: Transport) => void): () => void;   // for UI; called after outputs
  play(): this; pause(): this; stop(): this; toggle(): this;
  seek(to: TimeInput, options?: { cues?: 'fire' | 'skip' }): this;
  seekFrame(frame: number): this; seekTimecode(tc: string): this;
  step(frames?: number): this;             // ±n frames, pauses first
  setRate(rate: number): this;             // negative = reverse
  reverse(): this;                         // rate = -rate
  setLoop(loop: TransportOptions['loop']): this;
  chase(externalMs: number, options?: { smoothing?: number; threshold?: number }): this;   // external sync; see 4.5
  tick(now: number): void;                 // manual drive (used by offline + tests)
  get frame(): number; get timecode(): string; get progress(): number;
  readonly finished: Promise<this>;        // resolves when reaching the end without loop
  dispose(): void;
}
```

Semantics:

- `play()` records `anchorClock = clock.now()` and `anchorTime = time`; each tick sets `time = anchorTime + (clock.now() - anchorClock) * rate`. Changing `rate` or seeking re-anchors. This is how the audio clock or an external clock can become the time source with no other changes.
- Loop region `[a, b]`: when time passes `b` (or `a` if rate < 0) wrap with the overshoot carried over (`time = a + (time - b)`), fire `onLoop` subscribers, and render the wrap as **two crossings** (last → b, then a → new) so cues at the loop boundary fire exactly once per lap.
- End without loop: clamp to `duration`, render, set `finished`, resolve promise, remove the scheduler task.
- `snap: true`: `time` is quantized after the rate/loop math and before render.
- `stop()`: pause, `root.reset()`, `time = 0`, render with `cues: 'skip'`.
- `Transport` holds exactly one scheduler task while playing; `pause()` removes it. Two transports on the same scheduler still share one rAF (existing scheduler behaviour).

### 2.2 `Timeline` on top of the transport (`src/timeline.ts`)

- Move `Timeline` to its own file; `core.ts` re-exports it so `import { Timeline } from './core'` inside the repo and `from '@dhaakon/motion'` both keep working.
- Remove the internal driver `Tween`. A root timeline that is played directly (`timeline.play()`) lazily creates a **private `Transport`** (`timeline.transport`) with `scheduler: options.scheduler`. `play/pause/stop/reverse/seek/loop/state/finished` forward to it. Existing behaviour (including `repeat`, `yoyo` from options) is preserved by giving the root's cycle spec to `Timeline.sampleAt` (see below) and using `transport.duration = timeline.totalDuration`.
- `Timeline implements TimelineItem`:
  - `duration` = content length (max child end, or explicit `options.duration`); `totalDuration` = `cycle.totalDuration({ duration, delay: 0, repeat, repeatDelay, direction })`.
  - `sampleAt(localMs, ctx)`: `sampleCycle` → `cycleTime`; then for each entry `item.sampleAt(cycleTime - entry.start, childCtx)`; then fire cues (2.3); then `options.onUpdate?.(cycleTime, progress)`.
  - `render(time)` stays as the public alias for `sampleAt(time, { direction: sign(time - last), fireCues: true })`.
- `add(item, at)` accepts `Tween | Timeline | Track | Cue | Marker | AudioClip | TimelineItem`. Adding a timeline that already has a parent or its own transport throws `Timeline "<name>" is already attached`. Adding sets `child.parent`, and `child.play()` while parented throws `Timeline "<name>" is nested; control its root transport` (documented limitation).
- `remove(item)`, `clear()`, `items` (readonly array of `{ item, start, end }`), `parent`, `rootTransport` getter.
- Position resolution uses `parseTime` with the timeline's `frameRate` (phase 1.3).
- `loop(value)` keeps working: sets `repeat = value ? Infinity : 0` and updates the transport duration.

### 2.3 Markers and cues (`src/items.ts` + `Timeline`)

```ts
export interface Marker { kind: 'marker'; name: string; time: number; color?: string; payload?: unknown; }
export interface CueEvent { name: string; time: number; direction: 1 | -1; payload: unknown; timeline: Timeline; frame: FrameInfo | undefined; }
export interface CueOptions { payload?: unknown; once?: boolean; onEnter?(e: CueEvent): void; onExit?(e: CueEvent): void; }

class Timeline {
  label(name, at?): this;                       // unchanged; now also creates a Marker (labels and markers are one table)
  marker(name: string, at?: TimelinePosition, options?: { color?: string; payload?: unknown }): this;
  cue(name: string, at: TimelinePosition, handler: (e: CueEvent) => void, options?: CueOptions): this;
  region(name: string, from: TimelinePosition, to: TimelinePosition, options?: CueOptions): this;   // onEnter/onExit around a span
  markers: readonly Marker[];                   // sorted by time
  cues: readonly Cue[];
  seekToMarker(name: string): this;             // via root transport
  nextMarker(fromMs?: number): Marker | undefined; previousMarker(fromMs?: number): Marker | undefined;
}
```

Crossing semantics (implement once in `Timeline.fireCrossed(prev, next, ctx)`):

- Timeline keeps `lastCycleTime: number | null` and `lastIteration`.
- Forward (`next >= prev`): fire cues with `prev < at <= next`. Backward: `next <= at < prev`, with `direction: -1`.
- First render after construction or `reset()` (`last === null`): treat `prev = -Infinity` for forward, so a cue at `0` fires when playback starts at `0`. `stop()` renders with `fireCues: false` so it does not fire.
- Iteration change (repeat wrap or yoyo turn): fire `prev → cycleEnd` then `cycleStart → next` (or the reverse for alternate direction). Cues at exactly `duration` fire once per lap.
- `once: true` cues are marked fired and skipped afterwards until `reset()`.
- `region`: `onEnter` when crossing `from` forward or `to` backward; `onExit` on the opposite.
- `seek(t, { cues: 'skip' })` updates `last` without firing. Default for `Transport.seek` is `'fire'` (a scrub fires what it passes; this is what audio and hardware consumers expect). Document both.
- Handler exceptions are caught, reported through `transport.onError` (default `console.error`), and never break the tick.

### 2.4 Tests (`tests/core/transport.test.ts`, `timeline.test.ts`, `cues.test.ts`)

- Transport with `ManualDriver`: play/pause/resume keeps anchor; `rate: 2` doubles progress; `rate: -1` plays backward and stops at 0; loop region wraps with overshoot carried; `finished` resolves; `snap` produces only frame-aligned times at 24 fps.
- Custom clock: a `Clock` whose `now()` is independent of the scheduler's `now` drives the time (audio-clock model).
- Nested: parent with child timeline at `'intro'`, child with `repeat: 1, yoyo: true`; sampling the parent at a set of times yields the same values as sampling the child directly at `t - start` (property-style test over 50 times). Nested three levels deep. `frameRate` inheritance.
- Cues: forward, backward, scrub over multiple cues fires in time order, cue at 0 on first play, cue at end once per loop across three laps, `once`, `region` enter/exit both directions, `seek({cues:'skip'})`, handler throw does not stop the tick.
- Back-compat: every case in `tests/dist/core.test.mjs` unchanged and green against the new build.

---

## 5. Phase 3 — Deterministic offline rendering and inspection

### 3.1 `src/offline.ts`

```ts
export interface RenderFramesOptions {
  frameRate?: FrameRateInput;           // default transport.frameRate
  from?: TimeInput; to?: TimeInput;     // default 0 .. duration (inclusive of the last frame)
  outputs?: TransportOutput[];          // extra outputs for this render only
  signal?: AbortSignal;
  yieldEvery?: number;                  // frames between `await` yields (default 0 = fully synchronous when onFrame is sync)
}
export function renderFrames(source: Transport | Timeline, onFrame: (info: FrameInfo) => void | Promise<void>, options?): Promise<{ frames: number; from: number; to: number }>;
export function* frames(source, options?): Generator<FrameInfo, void, unknown>;   // synchronous iterator; each `next()` renders the next frame
export class OfflineTransport extends Transport { /* clock = frame counter; tick(frame) */ }
```

Rules that make it deterministic:

- Iterate an integer frame index; `time = frameToMs(frame, rate)` each step (no accumulation).
- Before the first frame: `root.reset()` and render `from` with `cues: 'skip'`, then render each frame with `cues: 'fire'` so every cue in `(from, to]` fires exactly once, in order, regardless of frame rate (a cue between two frames fires on the later frame).
- The offline transport never touches the scheduler or `performance.now`. Outputs with `supportsOffline === false` are skipped and a `console.warn` is emitted once.
- `onFrame` may be async (canvas `toBlob`, Three `readRenderTargetPixels`, ffmpeg pipe); the renderer awaits it before advancing. With a sync callback and `yieldEvery: 0`, the whole render is synchronous.
- Result is identical whether run in one call or resumed: render `[0, 10f]` then `[10f, 20f]` on the same transport equals rendering `[0, 20f]` (test this).

### 3.2 Inspection (`Timeline`, `src/trace.ts`)

```ts
interface InspectNode { kind: string; name?: string; start: number; end: number; duration: number; totalDuration: number; repeat: number; direction: Direction; startTimecode?: string; children: InspectNode[]; markers: Marker[]; cues: { name: string; time: number }[]; }
timeline.inspect(): InspectNode;
timeline.toAscii(options?: { width?: number; frameRate?: FrameRateInput; labels?: boolean }): string;
timeline.explain(position: TimelinePosition): { ms: number; frame?: number; timecode?: string; base?: string; offset?: number };  // how a position resolved
transport.trace(options?: { capacity?: number }): Trace;     // attaches a trace output
interface Trace extends TransportOutput { entries: TraceEntry[]; clear(): void; toText(): string; }
interface TraceEntry { tick: number; time: number; frame: number; rate: number; state: TransportState; cues: string[]; durationMs: number /* wall time of the tick */; }
```

`toAscii` output shape (must be stable; snapshot-test it):

```
show                 0        2000      4000      6000      8000  9200
├ camera      tween  ████████████████████████████████████████████│
├ rig         tween  ████████████████████████████████████████████│
├ intro       tl ×2      ▓▓▓▓▓▓▓▓▓▓▓▓
│ ├ title     tween      ██████
│ └ body      tween         ██████
◆ verse @ 2000   ◆ chorus @ 6000   ● blackout @ 9000
```

### 3.3 Tests

- `renderFrames` at 24 fps over a 1 s timeline yields 25 frames with `time` exactly `frameToMs(i)`; a cue at 500 ms fires once, on frame 12; running twice gives identical `sample()` tables (deep-equal).
- Resume equality test (3.1 last bullet).
- 29.97df render: frame 1800's timecode is `00:01:00;02`.
- `toAscii` snapshot; `inspect()` tree for a 3-level composition; `explain('intro+=12f')`.
- Trace records cue names and frame numbers.

---

## 6. Phase 4 — Outputs: DOM, Three.js, Canvas, audio, hardware on one transport

All outputs implement `TransportOutput`. Core ships the generic ones; entries with peers ship separately.

### 4.1 Core generic outputs (`src/transport.ts` or `src/outputs.ts`)

```ts
export function drawOutput(draw: (info: FrameInfo) => void, options?: { name?: string }): TransportOutput;   // canvas / any "draw once after writes"
export function signalOutput(send: (signal: unknown, info: FrameInfo) => void, options?: { filter?: (cue: CueEvent) => boolean }): TransportOutput;
   // subscribes to every cue fired in the tree; forwards `payload.signal` (or the whole payload) with the frame info
```

`Timeline.cue` payloads therefore become the routing key: `{ signal: { type: 'dmx', channel: 12, value: 255 } }`.

DOM: nothing new is needed for `motion.*` (values are written during render). Move `writeStyle`/`readStyle` to `src/dom.ts` and export `styleTrack(node, keyframes, options)` (a `Track` whose `apply` writes styles) so plain-DOM users get the same thing React users have.

### 4.2 `./three` (`src/three.ts`, peer `three` optional)

```ts
export function threeOutput(options: { renderer: WebGLRenderer; scene: Scene; camera: Camera; composer?: { render(): void }; onBeforeRender?(info): void }): TransportOutput;   // one render per tick
export function objectTrack(object: Object3D, keyframes: Keyframe<{ position?: [n,n,n]; rotation?: [n,n,n]; scale?: number | [n,n,n] }>[], options?): Track;
export function uniformTrack(material: ShaderMaterial | { uniforms }, keyframes: Keyframe<Record<string, number | string | number[]>>[], options?): Track;   // colors via setStyle
export function cameraTrack(camera: PerspectiveCamera, keyframes: Keyframe<{ position?; target?; fov?; roll? }>[], options?): Track;
export function frameCapture(renderer: WebGLRenderer): (info: FrameInfo) => Promise<Blob>;   // helper for renderFrames
```

Migrate `docs/src/ThreeShowcase.tsx` to `Transport` + `threeOutput` + the tracks above, keeping the visible behaviour identical. Its transport bar becomes timecode-aware (phase 6 hooks).

### 4.3 `./audio` (`src/audio.ts`, Web Audio, no deps)

```ts
export function audioClock(context: AudioContext): Clock;                   // now() = context.currentTime * 1000 → pass as Transport `clock` to make audio the master
export class AudioClip implements TimelineItem {                            // kind: 'audio'
  constructor(options: { context: AudioContext; buffer: AudioBuffer; destination?: AudioNode; offset?: number; duration?: number; gain?: number; loop?: boolean; name?: string });
  // sampleAt: no-op for values; the output below owns scheduling
}
export function audioOutput(context: AudioContext, options?: { driftThreshold?: number /* ms, default 25 */; lookahead?: number /* ms, default 100 */ }): TransportOutput;
   // on play: for each AudioClip active at `time`, start a BufferSource at context.currentTime with offset (time - clip.start)/1000
   // on tick: start clips whose start falls within [time, time + lookahead] at the exact context time; stop clips that ended; compare transport time vs (context.currentTime - startedAt) and restart the source if |drift| > threshold
   // on pause/stop/seek: stop all sources; seek while playing restarts them at the new offset
   // on rate change: source.playbackRate = |rate|; rate <= 0 → sources stopped (no reverse audio)
   // supportsOffline: false
export function paramTrack(param: AudioParam, keyframes: Keyframe<number>[], options?: { context: AudioContext }): Track;
   // applies with setTargetAtTime/linearRampToValueAtTime one tick ahead so envelopes are sample-accurate rather than tick-quantized
export function renderAudio(source: Transport | Timeline, context: OfflineAudioContext, options?: { from?; to? }): Promise<AudioBuffer>;
   // schedules every AudioClip at its absolute start time and paramTracks as automation curves, then context.startRendering(). Deterministic; pairs with renderFrames for offline export.
```

Autoplay policy: `audioOutput` exposes `unlock(): Promise<void>` (resumes the context on a user gesture); the React `<Transport>` provider (phase 6) calls it from `play()` when the context is suspended.

### 4.4 `./midi` (`src/midi.ts`, Web MIDI, no deps)

```ts
export function midiOutput(port: MIDIOutput, options?: { channel?: number }): TransportOutput;     // routes cue payloads { midi: number[] } or built by the helpers below; uses `port.send(data, timestamp)` with the tick's DOMHighResTimeStamp
export const midi: { noteOn(note, velocity?, channel?): number[]; noteOff(note, channel?): number[]; cc(controller, value, channel?): number[]; programChange(program, channel?): number[]; };
export function noteCue(timeline: Timeline, at: TimelinePosition, note: number, options?: { velocity?; duration?: TimeInput; channel? }): Timeline;   // emits noteOn at `at` and noteOff at `at + duration`
export function mtcOutput(port: MIDIOutput): TransportOutput;   // MIDI Timecode quarter-frame messages (8 per 2 frames) while playing; full-frame message on seek — stretch goal, implement last
```

### 4.5 Hardware sync input: `Transport.chase`

`transport.chase(externalMs, { smoothing = 0.1, threshold = 40 })`: the transport follows an external clock (LTC/MTC decoder, OSC `/time`, a WebSocket from a lighting desk, another transport in another tab). If `|external - time| > threshold` hard-seek; otherwise adjust `rate` toward `1 + (external - time) / smoothingWindow` so the local clock converges without stepping. `chase()` while `state !== 'playing'` starts playing. `transport.setClock(clock)` also exists for the simpler "make the external device the clock" model.

### 4.6 Tests

- `drawOutput` and `signalOutput` ordering: values written before draw within the same tick (assert with a recording array).
- Three: tests run in node with a fake renderer object (`{ render: vi.fn() }`) — assert exactly one render per tick and none while paused; `objectTrack` writes position/rotation/scale on a stub `Object3D` shape.
- Audio: jsdom has no Web Audio; write a small `FakeAudioContext` in `tests/react/fakes/audio.ts` (currentTime, createBufferSource with start/stop spies, createGain). Assert: play starts sources with correct offset; seek restarts; pause stops; drift beyond threshold restarts; `renderAudio` schedules clip starts at `start/1000` seconds on a fake OfflineAudioContext.
- MIDI: fake port with `send` spy; `noteCue` emits on/off at the right ticks; timestamps monotonic; cue payload routing.
- Chase: feeding an external clock that runs 2 % fast converges (rate drifts to ≈1.02 within N ticks, no hard seeks); a 500 ms jump hard-seeks once.

---

## 7. Phase 5 — Serializable cue sheets and scene states

### 5.1 Keyframe `Track` (`src/items.ts`)

`Tween` is a two-key special case; sheets need N keys.

```ts
export interface Keyframe<T> { at: TimeInput; value: T; easing?: EasingInput; }   // easing applies to the segment ending at this key
export type EasingInput = EasingName | ['cubicBezier', number, number, number, number] | ['spring', { stiffness?; damping?; mass? }] | ['steps', number] | EasingFunction | string /* registered name */;
export class Track<T extends MotionValueShape> implements TimelineItem {
  constructor(options: { keyframes: Keyframe<T>[]; apply: (value: T, info) => void; target?: MotionValue<T>; name?: string; frameRate?; repeat?; repeatDelay?; direction?; easing?: EasingInput /* default for all segments */ });
  keyframes: ResolvedKeyframe<T>[];   // ms-resolved, sorted
  valueAt(ms: number): T;             // pure
  sampleAt(ms, ctx): void;            // valueAt → apply / target.set
}
export function track<T>(target: MotionValue<T> | ((v: T) => void), keyframes: Keyframe<T>[], options?): Track<T>;
```

`Tween` gets `toTrack(): Track` (from/to → two keys). `interpolate` handles all value shapes already.

### 5.2 Easing registry (`src/easing.ts`)

`registerEasing(name, fn)`, `resolveEasing(EasingInput)` extended to handle the tuple forms and registered names, and `serializeEasing(fn | input): EasingInput | undefined` (returns the input form if it was created through `resolveEasing`; functions created by `cubicBezier`/`spring` carry a hidden `[Symbol('easing')]` descriptor so they serialize; anonymous functions serialize as `undefined` with a validation warning).

### 5.3 Cue sheet format (`src/sheet.ts`)

```jsonc
{
  "$schema": "dhaakon-motion/cue-sheet/1",
  "name": "show",
  "frameRate": "29.97df",                 // FrameRateInput
  "duration": "00:00:09:05",              // optional explicit
  "repeat": 0, "direction": "normal",
  "markers": [{ "name": "verse", "at": "00:00:02:00", "color": "#ff5a1f" }],
  "cues":    [{ "name": "blackout", "at": "verse+=12f", "payload": { "signal": { "type": "dmx", "channel": 1, "value": 0 } } }],
  "regions": [{ "name": "chorus", "from": "00:00:06:00", "to": "00:00:08:00" }],
  "items": [
    { "type": "track", "name": "camera", "target": "camera", "at": 0, "easing": "dhaakon",
      "keyframes": [{ "at": 0, "value": { "position": [0.4, 1.2, 8.8], "fov": 44 } },
                    { "at": "00:00:09:05", "value": { "position": [-4.2, 2.55, 5.8], "fov": 31 }, "easing": ["cubicBezier", 0.16, 1, 0.3, 1] }] },
    { "type": "timeline", "name": "intro", "at": "verse", "repeat": 1, "direction": "alternate", "items": [ /* … */ ] },
    { "type": "audio", "name": "vo", "asset": "vo-01", "at": "00:00:01:00", "gain": 0.8 }
  ]
}
```

```ts
export interface SheetBindings {
  targets?: Record<string, MotionValue<any> | ((value: any) => void)>;
  cues?: Record<string, (e: CueEvent) => void>;         // by cue name; unbound cues still fire through signalOutput
  assets?: Record<string, AudioBuffer>;                 // for audio items
  audio?: { context: AudioContext };
  easings?: Record<string, EasingFunction>;
}
export function loadSheet(sheet: CueSheet | string, bindings?: SheetBindings, options?: { strict?: boolean }): Timeline;   // strict (default true): unknown target/asset throws; false: warns and skips
export function saveSheet(timeline: Timeline): CueSheet;      // authored position strings are preserved when the item was created from a string; otherwise ms
export function validateSheet(input: unknown): { ok: true; sheet: CueSheet } | { ok: false; errors: { path: string; message: string }[] };   // hand-rolled, no schema lib
export function diffSheets(a: CueSheet, b: CueSheet): SheetDiff;     // for tests and tooling: added/removed/changed items by path
```

`Timeline.toJSON()` returns `saveSheet(this)`; `Timeline.fromJSON(sheet, bindings)` is an alias of `loadSheet`. Round-trip property: `saveSheet(loadSheet(saveSheet(loadSheet(s))))` deep-equals `saveSheet(loadSheet(s))` for every fixture in `tests/fixtures/sheets/*.json`.

### 5.4 Scene states

```ts
export type SceneState = Record<string, MotionValueShape>;          // targetId → value
export interface SceneFile { $schema: 'dhaakon-motion/scene/1'; states: Record<string, SceneState>; }
export function captureScene(targets: SheetBindings['targets']): SceneState;
export function applyScene(state: SceneState, targets, options?: { transition?: TweenOptions & { stagger?: number | ((id: string, index: number) => number) } }): Timeline | void;   // no transition → immediate set; with transition → returns a playing Timeline of one Track per target
export function sceneTransition(from: SceneState, to: SceneState, targets, options?): Timeline;   // not auto-played; attach to a transport or play()
export function sceneSheet(states: Record<string, SceneState>, order: string[], options?: { hold?: TimeInput; transition?: TimeInput; easing? }): CueSheet;   // turns a state list into a cue sheet with markers per state
```

Replace the ad-hoc state tweening in the docs' `SceneStateExample` with `applyScene` to prove the API.

### 5.5 Tests

- `Track.valueAt` at, between, before first, after last key; per-segment easing; `steps`.
- Easing serialization round trip for every form; anonymous fn warns.
- Fixtures: `minimal.json`, `nested-timecode.json` (29.97df positions everywhere), `audio.json`, `scene-transition.json`. Each: `validateSheet` ok, `loadSheet` → `inspect()` snapshot, `sample()` table snapshot at 10 times, round-trip property.
- Validation errors: bad frame rate, `dropFrame` with 24 fps, unknown easing, keyframes out of order, unknown label in a position, missing target in strict mode (message includes the JSON path).
- Scene: capture → mutate → applyScene immediate; transition produces expected intermediate values at 50 %.

---

## 8. Phase 6 — React composition lifecycle (`src/react.tsx`)

Goal: a React tree can declare a composition; the engine owns time; React owns mount/unmount and props; nothing rerenders at frame rate unless it subscribes.

### 6.1 Provider and hooks

```tsx
export function Transport(props: {
  children; frameRate?: FrameRateInput; snap?: boolean; rate?: number; loop?: TransportOptions['loop'];
  autoplay?: boolean; paused?: boolean /* controlled */; clock?: Clock; scheduler?: FrameScheduler;
  outputs?: TransportOutput[]; transport?: TransportInstance /* bring your own */;
  onStateChange?(state): void; onFinish?(): void;
}): JSX.Element;
export function useTransport(): TransportInstance;                         // throws outside a provider (message names the component)
export function useTransportState(): { state; rate; duration; loop; frameRate };   // useSyncExternalStore on a cheap snapshot; does NOT change per tick
export function usePlayhead(options?: { fps?: number /* UI update rate, default 30 */ }): { time: number; frame: number; timecode: string; progress: number };   // throttled state updates; for scrubbers/clocks
export function usePlayheadValue(): MotionValue<number>;                   // frame-rate updates with no React render; bind to DOM via motion.* or subscribe
export function useCue(at: TimelinePosition, handler: (e: CueEvent) => void, deps?: DependencyList): void;   // registers on the nearest Sequence
export function useSceneState(targets): [SceneState, (next: SceneState, transition?) => void];
```

### 6.2 Declarative composition

```tsx
<Transport frameRate={24} loop autoplay>
  <Sequence name="show">
    <Track target={cameraSignal} keyframes={[…]} easing="dhaakon" />
    <Sequence name="intro" at="show+=200" repeat={1} direction="alternate">
      <Tween target={titleOpacity} from={0} to={1} duration="12f" />
    </Sequence>
    <Marker name="verse" at="00:00:02:00" />
    <Cue name="blackout" at="verse+=12f" onFire={e => …} payload={{ signal: … }} />
    <Region name="chorus" from="6s" to="8s" onEnter={…} onExit={…} />
    <AudioClip asset={buffer} at="1s" />
  </Sequence>
  <Scrubber />   // a docs component built on usePlayhead + useTransport
</Transport>
```

Registration protocol (this is the part that must be exactly right):

- `Sequence` creates its `Timeline` **once** in a ref during the first render (cheap, no DOM needed) and provides `{ timeline, register(entry: { key, item, at, order }), unregister(key), invalidate() }` through context. The root `Sequence` attaches to the provider's transport in `useLayoutEffect`.
- Each child component creates its item once (ref), then in `useLayoutEffect` calls `register` and returns `unregister`. Children's layout effects run **before** the parent's and **in sibling order**, so the parent's `useLayoutEffect` sees the full ordered list and calls `rebuild()` once for the initial mount. `order` is a monotonically increasing counter assigned at first render so `<`/`>` positions resolve against the previous sibling.
- On later prop changes a child unregisters/registers, which calls `invalidate()`; the sequence coalesces invalidations with `queueMicrotask` and rebuilds once: `timeline.clear()`, re-add all entries in `order`, propagate to the parent (`parent.invalidate()`), and finally the root transport `seek(transport.time, { cues: 'skip' })` so the playhead is preserved and the new state is rendered immediately.
- Unmount of a `Sequence` removes it from its parent and disposes its items; unmount of the root detaches from the transport. The transport itself lives as long as the provider (or the user's instance).
- StrictMode double-invocation: effects mount → cleanup → mount; register/unregister/register is idempotent by `key`. Test this with `<React.StrictMode>`.
- Reduced motion (existing `MotionConfig` policy): the provider renders the transport at `duration` and never plays when `useReducedMotion()` is true and `respectReducedMotion !== false`.
- Audio unlock: if any output has `unlock`, the provider's `play` calls it first.

### 6.3 Existing hooks

- `useTimeline(factory, deps)` keeps its signature and return type (a ref, per current docs) to avoid breaking the docs and consumers; it now attaches the built timeline to the nearest `<Transport>` if one exists, else behaves as today. Mark as "prefer `<Sequence>`" in docs.
- `useTween`, `motion.*`, `Reveal`, `useInView`, `Motion` unchanged. `useMotionValue(0)` literal-type issue: add an overload `useMotionValue<T>(initial: T): MotionValue<T>` with `T` widened via `NoInfer`/explicit generic docs.

### 6.4 Tests (`tests/react/*.test.tsx`, jsdom + testing-library + `installFrameDriver`)

- Provider mounts, `useTransport` throws outside provider with a helpful message.
- `<Sequence>` with three children registers in order; `inspect()` matches an imperative build of the same composition.
- Rebuild on prop change preserves playhead (seek to 1200 ms, change a child's `at`, assert `transport.time === 1200` and values re-rendered).
- Unmounting a child removes it; unmounting the root detaches (`transport.root.items.length === 0`).
- StrictMode: same `inspect()` result as non-strict; no duplicate cues fired.
- `usePlayhead` updates at ≤ `fps` per second while ticking at 60 (count renders).
- `useCue` fires once when stepped across.
- Controlled `paused` prop toggles state.

---

## 9. Phase 7 — Test tooling, devtools inspector, docs, release

### 7.1 `./testing` additions

- `stepFrames(driver, n, frameRate)`, `runUntil(transport, predicate, { maxFrames })`.
- `expectSample(timeline, at, expected, { tolerance })` helper that formats failures with the ASCII timeline and the resolved position (`explain`).
- `snapshotTimeline(timeline)` → `{ ascii, inspect, samples }` for `toMatchSnapshot`.
- `fakeAudioContext()`, `fakeMidiPort()` exported from `./testing` (move the phase 4 test fakes here so consumers can test their own compositions).
- README section "Testing compositions" with a full example.

### 7.2 `./devtools` — plain-DOM inspector

`mountInspector(transport: Transport, options?: { container?: HTMLElement; collapsed?: boolean; theme?: 'ink' | 'paper' }): { unmount(): void }`

- No React, no deps; a `<div>` overlay with: transport bar (play/pause/stop, rate ±, step ±1 frame, loop toggle, timecode readout at the transport's frame rate, scrubber), lanes per item from `inspect()` (nested collapsible, tween/track/timeline/audio colour-coded), marker ticks, cue lanes that flash when fired (subscribe via `signalOutput`-style hook), trace tail (last 20 entries), and a "copy sheet JSON" button (`saveSheet`).
- Styling from the design system tokens inline (`#101010` ink, `#f0eee8` paper, `#ff5a1f` accent, `#2d62ff` focus, sharp corners, `IBM Plex Mono, ui-monospace, monospace`); read `--dhk-*` custom properties when present.
- Keyboard: space play/pause, `←`/`→` step frames, shift for 10, `home`/`end`, `l` loop.
- Live-updated via `transport.subscribe` throttled to 30 Hz; never allocates per frame in the hot path.

### 7.3 Docs site (`docs/src/App.tsx` and new files under `docs/src/`)

Add sections, following the existing `SectionTitle` / `Reveal` / `CodePanel` patterns and numbering:

- **07 Timecode & transport** — a scrubber with SMPTE readout at 24 / 29.97df / 60, frame stepping, rate control, loop region; `<Transport>` + `<Sequence>` source shown.
- **08 Cue sheet** — a JSON sheet in a textarea → `loadSheet` → live `toAscii` and inspector; edit the JSON and watch the lanes update; scene-state switcher built on `applyScene` (replaces the ad-hoc code in `SceneStateExample`).
- **09 Offline render** — render 24 frames of the canvas signal demo into a filmstrip with `renderFrames`, showing that output equals the live one; a "download PNG sequence" button using `frameCapture`.
- **05 Three.js** — migrate to `Transport` + `threeOutput`, add an optional muted audio bed through `audioOutput` with the audio clock as master (toggle), and MIDI out when `navigator.requestMIDIAccess` exists (sends note cues per phase; silently absent otherwise).
- **10 Testing & inspection** — the ASCII timeline, `snapshotTimeline`, and the devtools overlay toggled by a button.
- Update the API grid (section 06) with `Transport`, `Track`, `Cue/Marker`, `renderFrames`, `loadSheet`, `mountInspector`.
- Add a docs `check:routes`-style smoke script (`docs/scripts/check.mjs`) that builds and loads the page in headless Chrome (`puppeteer-core` against the system Chrome if present; skip with a warning if not) and fails on any `data-demo-error` or console error, mirroring `dhaakon-ui`.

### 7.4 README and changelog

- README: new "Transport", "Timecode", "Nested timelines, markers, cues", "Outputs (Three.js, audio, MIDI, hardware)", "Cue sheets and scene states", "Offline rendering", "Testing", "Devtools" sections with the short forms of the snippets in this plan. Keep the existing sections.
- `CHANGELOG.md` starting at 0.4.0 with the additive list and the two documented behaviour notes (nested `play()` throws; `Transport.seek` fires cues by default).

### 7.5 Release

1. `npm run check` green; `npm run docs:build` green; docs smoke script green.
2. `npm version minor --no-git-tag-version` → `0.4.0`.
3. `npm publish` (registry is already `http://dhaakon-ubuntu:21760/` in `publishConfig`).
4. Rebuild the docs image in the network stack: `cd /home/claude/Development/dhaakon-network && docker compose build dhaakon-motion-docs && docker compose up -d dhaakon-motion-docs`; verify `http://dhaakon-ubuntu:21764` serves the new sections.
5. Commit per phase (see below) and push to Gitea.

---

## 10. Working agreements for the implementing agent

- **One commit per phase**, message `motion: <phase title>` with a body listing new public APIs. Run `npm run check` before each commit. Do not squash phases together.
- **Tests first for the tricky parts**: drop-frame vectors, cue crossing table, nested sampling equivalence, offline resume equality, React registration order. Write the failing test, then the code.
- **Do not** add runtime dependencies to the core. Do not add a schema library; validation is hand-written. Do not implement reverse audio, LTC decoding, OSC/DMX transports, or video encoding — these are consumer concerns and `signalOutput` / `renderFrames` are the extension points.
- **Do not** change existing public behaviour except the two documented notes (nested `play()` throws; `Transport.seek` fires cues by default). If a change looks necessary, stop and write it down in `CHANGELOG.md` under "Breaking" with the reason, then continue.
- Keep `tests/dist/core.test.mjs` byte-identical; it is the compatibility oracle.
- Every new public function gets a one-line TSDoc comment; every new entry gets a README section and a docs demo.
- When the frame-rate math is involved, test with 29.97 and 23.976 as well as integers; integer-only tests hide rounding bugs.
- Web Audio types are already in `tsconfig#lib` (`DOM`). Web MIDI types come from `@types/webmidi` (add as a devDep); do not vendor them.

## 11. Acceptance summary

| # | Feature | Proven by |
|---|---|---|
| 1 | SMPTE/timecode and frame-based timelines | `timecode.test.ts` vectors + round-trip; positions in frames/timecode; `snap`; 29.97df readout in docs 07 |
| 2 | Deterministic offline rendering | `renderFrames` equality and resume tests; filmstrip demo equals live demo |
| 3 | Nested cue timelines and markers | nested equivalence property test; cue crossing table incl. loops and reverse; `toAscii` snapshot |
| 4 | One transport for DOM/Three/Canvas/audio/hardware | Three showcase on `Transport`; audio clock as master; MIDI note cues; `chase` convergence test |
| 5 | React composition lifecycle | `<Transport>/<Sequence>` registration tests incl. StrictMode and playhead-preserving rebuild |
| 6 | Serializable cue sheets and scene states | fixtures round-trip; validation errors with paths; scene transition demo |
| 7 | Strong test tooling and timeline inspection | `./testing` entry, `inspect/toAscii/explain/trace`, `./devtools` overlay, docs smoke script |
