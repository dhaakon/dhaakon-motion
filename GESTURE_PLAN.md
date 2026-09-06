# @dhaakon/motion 0.6 — Touch and gesture control

Implementation plan for a gesture layer that is more complete and more responsive than Framer Motion's. Written for an implementing agent. Read the whole document before touching code; phases are dependency-ordered and each ends at its own acceptance criteria and a commit.

Repo: `/home/claude/Development/ai/dhaakon-motion` (Gitea `dhaakon-ubuntu/dhaakon-motion`). Current version `0.5.2`, 144 tests across 19 files. Target `0.6.0`.

---

## 0. Ground truth

What exists today and matters here:

| Thing | State | Consequence for gestures |
|---|---|---|
| `MotionValue<T>` (`src/core.ts:177`) | `get`/`set`/`subscribe`/`animate`/`stop`. No velocity, no timestamps. | Velocity tracking must be added to it — it is the boundary every gesture writes through. |
| `spring()` (`src/easing.ts`) | A **duration-normalized easing curve**, not a simulation. No initial velocity, no rest detection. | Keep it (it is used as an easing name). Gestures need a real integrator/closed-form spring with `velocity` in. |
| `Tween` | Accepts `TimeInput` durations, inherits frame rate from its Transport/Timeline (0.5.0). Finite `totalDuration`. | A fling has no fixed duration; physics needs an item type whose duration is *solved* from a rest threshold. |
| `Transport` (`src/transport.ts`) | Clock authority: rate, loop, `seek`, `step`, `chase()`, outputs, `FrameInfo.cues`. Loop regions are half-open (0.5.2). | A drag can *be* the clock — scrubbing a transport with a finger is a first-class goal. |
| `Timeline` cues | Direction-aware crossing, fire on scrub/seek. | Gesture thresholds (snap points, detents, "dismiss line") should fire cues, not ad-hoc callbacks. |
| `FrameScheduler` / `ManualDriver` | One rAF; fully deterministic under test. | Gestures coalesce to the frame loop and are testable without a browser. |
| `motion.*` (`src/react.tsx`) | `initial`/`animate`/`whileInView`/`viewport`/`transition`. Writes styles via `writeStyle` off the frame loop. | No `whileHover`/`whileTap`/`drag`. Adding them must keep "no React render per frame". |
| Docs comparison table (`docs/src/App.tsx`, commit `bf6e097`) | Lists gestures as Motion's (Framer's) strength. | This plan's success criterion is being able to flip that cell honestly. |
| Dependencies | Core: zero. `./react`, `./three`, `./audio`, `./midi` are optional entries. | The gesture layer gets its own entry `./gesture` (DOM, no React) and adds no dependency. |

Invariants that must survive: zero core dependencies; `sideEffects: false`; every existing public API unchanged; one rAF for everything; no React render per frame; `npm run check` green at every phase; `tests/dist/core.test.mjs` byte-identical.

---

## 1. The decision: a custom input layer, on Pointer Events

**Yes, build our own.** Not a wrapper around `@use-gesture`, Hammer, or Framer's internals. Reasons, in order of weight:

1. **Nothing else knows about the clock.** The point of this library is one inspectable clock. A drag that scrubs a `Transport`, a fling that lands on a `Timeline` as a scrubbable/offline-renderable item, a snap detent that fires a `cue` — none of that is expressible through a third-party gesture library that terminates in a callback.
2. **Velocity is the whole game.** Every "feels right" gesture interaction is a velocity handoff: finger → inertia, tween → grab, spring → re-grab. Framer's estimator is `Δposition / Δtime` of the last event with a 30ms cutoff; it is jittery on high-rate touch screens and wrong when a finger pauses before lifting. Owning the estimator (§3.2) is the single biggest feel improvement available.
3. **Arbitration is the single biggest completeness gap.** Framer has no gesture arena: a draggable inside a scroller, a sheet over scrollable content, a pinch over a pannable map, a tap inside a swipe row — these are all left to the developer. Flutter solved this with a gesture arena a decade ago; we do the same (§3.4).
4. **Determinism.** Gestures recorded as data, replayed under `ManualDriver`, asserted with `expectSample`. No other web gesture layer offers this, and it is only possible if the input layer is ours.
5. **Zero dependencies** is a stated rule of the package.

**Why Pointer Events, not raw Touch Events:** one code path for mouse, touch, and pen; `pointerId` for multi-touch; `setPointerCapture` for drags that leave the element; `getCoalescedEvents()`/`getPredictedEvents()` for sub-frame sampling and latency reduction; `pointerType` to make hover touch-aware. Raw `touchstart/touchmove` are used in exactly one place: a non-passive `touchmove` listener attached **only during an active gesture** to `preventDefault()` browser scroll/zoom where `touch-action` alone is insufficient (iOS Safari pinch). Everything else is Pointer Events.

**Design principles**
- Input is sampled at event rate; **values are written at frame rate** (coalesced through the scheduler) except where `immediate: true` is requested.
- Every gesture ends in a **velocity**, and every animation can start from one.
- A gesture is a **state machine with a data trail**, not a callback bag: recognizers produce `GestureEvent`s with `phase`, `velocity`, `delta`, `pointerType`, and a `session` you can inspect.
- Physics are **closed-form where possible** (spring, exponential decay) so they are time-parametric: scrubbable, offline-renderable, nestable in a `Timeline`.
- **Accessibility is not a wrapper**: every draggable gets keyboard equivalents, ARIA state, and a reduced-motion path from the same code, not a separate component.

---

## 2. Architecture

```
src/
  core.ts            + MotionValue velocity tracking (get velocity, setWithVelocity, timestamps)
  physics.ts         NEW  closed-form spring/inertia + rubberband/snap/bounds math; SpringItem/InertiaItem (TimelineItems)
  index.ts           + physics exports

  gesture/           NEW entry  ./gesture  (DOM, no React, no deps)
    pointer.ts       PointerSession: normalized pointer stream, capture, coalesced/predicted events, touch-action
    velocity.ts      VelocityEstimator (windowed weighted least squares)
    recognizers.ts   Recognizer interface + tap/doubleTap/longPress/press/pan/swipe/pinch/rotate/wheel/hover
    arena.ts         GestureArena: claim/yield/sweep, nested arenas, scroll cooperation
    bind.ts          drag() → MotionValue; scrub() → Transport; bounds/elastic/momentum/snap composition
    keyboard.ts      keyboard equivalents + ARIA for anything draggable
    record.ts        GestureRecording, record()/replay(), gestureToTrack()
    index.ts
  react.tsx          + motion.* gesture props, useGesture/useDrag/usePinch/useScrub/useDragControls/useVelocity
  testing.ts         + pointer(), stroke(), fling(), replayGesture(), measureLatency(); PointerEvent polyfill for jsdom
  devtools.ts        + gesture overlay (pointer trails, velocity vector, arena state)  [phase G6]
```

Entry points: add `gesture: 'src/gesture/index.ts'` to `tsup.config.ts`, `./gesture` to `package.json#exports`, `@dhaakon/motion/gesture` to `tsconfig#paths` and `vitest.config.ts` aliases. `./react` imports from `./gesture` (it already depends on the DOM).

Data flow for a drag, one tick:

```
pointermove (×N, coalesced) ─▶ PointerSession.samples ─▶ VelocityEstimator
                                       │
                               Recognizer(pan).update ─▶ GestureArena.claim ─▶ GestureEvent{delta, velocity}
                                       │
                               bind.drag: apply bounds/rubberband ─▶ MotionValue.setWithVelocity   (marks dirty)
                                       │
                            FrameScheduler tick ─▶ subscribers write DOM/Three/Canvas once
pointerup ─▶ estimator.velocity ─▶ InertiaItem or SpringItem started from that velocity ─▶ same MotionValue
```

---

## 3. Core modules and APIs

### 3.1 `MotionValue` velocity (core, `src/core.ts`)

```ts
class MotionValue<T> {
  get velocity(): T | number;              // units per second; numbers/arrays/objects: component-wise; strings: 0
  setWithVelocity(value: T, velocity: T | number, time?: number): void;
  set(value: T, time?: number): void;     // now records (value, time) into a 2-slot history → velocity derived on demand
  readonly updatedAt: number;             // ms, scheduler clock
  animate(to, options): Tween<T>;         // unchanged, but stopping it mid-flight leaves `velocity` accurate
  spring(to, options: SpringOptions): SpringItem<T>;     // new: physics, starts from current velocity by default
  decay(options: InertiaOptions): InertiaItem<T>;        // new: fling from current velocity
}
```

Velocity is derived as `(current − previous) / (now − prevTime)` from the last two writes, with the 50ms rule: if the previous write is older than 50ms, velocity is 0 (a value that stopped moving has no velocity). Physics items and gestures call `setWithVelocity` so the reported velocity is the simulator's/estimator's analytic value, not a finite difference. `Tween.sampleAt` calls `set(value, time)` so **interrupting a tween hands its instantaneous velocity to whatever grabs the value next** — Framer only does this for springs.

### 3.2 `VelocityEstimator` (`src/gesture/velocity.ts`)

```ts
class VelocityEstimator {
  constructor(options?: { window?: number /* ms, default 100 */; maxSamples?: number /* 20 */; axes?: 1 | 2 });
  push(x: number, y: number, t: number): void;   // t = event.timeStamp (high-res, monotonic)
  velocity(now?: number): { x: number; y: number };  // px/ms
  reset(): void;
}
```

Method: weighted least-squares linear fit over samples within the trailing `window`, weights `e^(−(now − t)/τ)` with τ = 40ms, so the most recent motion dominates but single-event jitter does not. Two guards Framer lacks: (a) the **lift rule** — samples older than 60ms before `pointerup` are discarded, so a finger that pauses then lifts yields 0, not the pre-pause speed; (b) **coalesced events** (`getCoalescedEvents()`) are pushed individually, so a 120Hz touch screen contributes all its samples even when rAF runs at 60. Tests use synthetic strokes with known ground truth velocity (§7.1).

### 3.3 `PointerSession` (`src/gesture/pointer.ts`)

```ts
interface PointerSample { id: number; type: 'mouse' | 'touch' | 'pen'; x: number; y: number; t: number; pressure: number; buttons: number; isPrimary: boolean; predicted?: boolean; }
interface SessionOptions {
  element: Element;
  capture?: boolean;                    // setPointerCapture on down (default true)
  touchAction?: 'auto' | 'none' | 'pan-x' | 'pan-y' | 'manipulation' | 'inherit';  // set on element while the session is armed
  passive?: boolean;                    // default true; false only while a recognizer that needs preventDefault is active
  predict?: boolean;                    // use getPredictedEvents() for the render position (default true; falls back silently)
  coalesce?: boolean;                   // default true
  onSample(sample: PointerSample, pointers: ReadonlyMap<number, PointerSample[]>): void;
  onEnd(sample: PointerSample, cancelled: boolean): void;
}
function createPointerSession(options: SessionOptions): { dispose(): void; pointers: ReadonlyMap<number, PointerSample[]> };
```

Responsibilities: one `pointerdown` listener per element; on down, attach `pointermove`/`pointerup`/`pointercancel`/`lostpointercapture` to the element (with capture) *or* the document (without); normalize into `PointerSample`s; keep per-pointer history for multi-touch; manage `touch-action` (set on arm, restore on dispose); attach the non-passive `touchmove` `preventDefault` only while a recognizer that declared `preventsScroll` is claimed; handle `pointercancel` (OS took over — treat as a cancelled gesture, never as a fling); ignore secondary mouse buttons unless asked; expose `pointers` for pinch/rotate math.

### 3.4 Recognizers and the arena (`src/gesture/recognizers.ts`, `arena.ts`)

```ts
type Phase = 'possible' | 'began' | 'changed' | 'ended' | 'cancelled';
interface GestureEvent<K extends string = string> {
  kind: K; phase: Phase; time: number; pointerType: 'mouse' | 'touch' | 'pen';
  origin: { x: number; y: number }; point: { x: number; y: number };
  delta: { x: number; y: number }; offset: { x: number; y: number };     // since last event / since began
  velocity: { x: number; y: number };                                     // px/ms, from the estimator
  pointers: number;
  // pinch / rotate only:
  scale?: number; rotation?: number; center?: { x: number; y: number };
  // wheel only:
  inertial?: boolean;                                                     // trackpad momentum detected
  native: Event;
  preventDefault(): void;
}
interface Recognizer<K extends string = string> {
  readonly kind: K;
  readonly priority: number;                  // higher wins ties in the arena
  readonly preventsScroll: boolean;
  onDown(sample, session): void;
  onMove(sample, session): 'claim' | 'yield' | 'wait';   // arena verdict
  onUp(sample, session): void;
  cancel(): void;
  subscribe(listener: (e: GestureEvent<K>) => void): () => void;
}
```

Built-ins and their claim rules:

| Recognizer | Claims when | Notes |
|---|---|---|
| `tap` | up within 250ms and < 10px movement | `count` for double/triple; `pointerType`-aware (no 300ms wait, ever) |
| `longPress` | held ≥ 400ms with < 10px movement | fires `began` at the threshold, `ended` on up; cancels on movement |
| `press` | immediately on down | for `whileTap`; `ended` on up/cancel; never blocks others |
| `pan` | movement ≥ `threshold` (10px touch / 3px mouse) | `axis: 'x' | 'y' | 'any' | 'lock'` — lock decides on the first 10px and yields if the other axis wins; `preventsScroll` when claimed on the scroll axis |
| `swipe` | pan ends with speed ≥ 0.5px/ms and ≥ 30px | direction quantized; emits once |
| `pinch` | two pointers, span changes ≥ 5px | `scale`, `center`; coexists with `rotate` and two-finger `pan` (combined into one `transform` event by `bind.transformGesture`) |
| `rotate` | two pointers, angle changes ≥ 5° | |
| `wheel` | any `wheel` | normalizes deltaMode; detects trackpad momentum (`inertial`) by delta-decay pattern; emits `began` on first event, `ended` after 150ms silence |
| `hover` | `pointerenter/leave` for `pointerType !== 'touch'` | never sticks on touch — fixes the classic touch hover bug |

**Arena.** One per element with gestures; arenas nest by DOM ancestry. On `pointerdown` every recognizer on the path from target to root enters. On each move, the *innermost* arena polls its recognizers; a `claim` closes that arena and cancels its losers, and **also cancels every ancestor arena's recognizers** unless the claiming recognizer has `propagate: true` (Framer's `dragPropagation`, generalized). A `yield` removes the recognizer. When an arena empties, the next outer arena takes over with the same pointer history. On `pointerup` with no claim, the arena is *swept*: the highest-priority recognizer that is still `possible` wins (this is how `tap` beats `pan` on a click that moved 4px). Explicit cooperation hooks for the two famous cases:

- `cooperateWithScroll(scroller: Element, { edge: 'top' | 'bottom' | 'both' })` — a `pan` inside a scroller yields to native scrolling unless the scroller is at the given edge *and* the pan direction moves away from it (the bottom-sheet rule).
- `arena.settle(recognizer)` — force-claim from outside (the bottom sheet's handle claims regardless of content scroll).

### 3.5 Physics (`src/physics.ts`, core)

All closed-form and time-parametric, so each is a `TimelineItem` with a solved `totalDuration`:

```ts
interface SpringOptions { stiffness?: number /* 170 */; damping?: number /* 26 */; mass?: number /* 1 */; velocity?: number | T /* default: from the MotionValue */; restDelta?: number /* 0.01 */; restSpeed?: number /* 0.01/ms */; bounce?: number /* alternative parametrization: 0–1 */; duration?: TimeInput /* alternative: solve stiffness for a target settle time */ }
interface InertiaOptions { velocity?: number | T; power?: number /* 0.8 */; timeConstant?: number /* 325ms — iOS decay */; min?: number; max?: number; bounce?: SpringOptions | false; restDelta?: number; modifyTarget?(projected: number): number /* snap hook */ }

class SpringItem<T> implements TimelineItem { /* kind 'spring'; valueAt(ms) closed-form under/critical/over-damped; totalDuration solved by bisection on the envelope */ }
class InertiaItem<T> implements TimelineItem { /* kind 'inertia'; x(t) = x0 + v0·τ·(1 − e^(−t/τ)); if the projected endpoint exits [min,max] the item chains a SpringItem back to the boundary at the crossing velocity */ }

function rubberband(value: number, min: number, max: number, coefficient = 0.55, dimension = 300): number;   // iOS formula: (1 − 1/((d·c/dim) + 1))·dim
function clampWithRubberband(...): number;
function projectFling(value: number, velocity: number, timeConstant = 325): number;                          // where a fling would stop — used for snap decisions
function snapTo(points: number[] | { step: number; offset?: number } | ((projected: number) => number), value: number, velocity: number): number;
```

`MotionValue.spring(to, opts)` / `.decay(opts)` create these items and play them on the scheduler like `animate` does. Because they are `TimelineItem`s they can also be `.add()`ed to a `Timeline` at a position, scrubbed, and offline-rendered — **a fling in a cue sheet** (`sheet.ts` gets `'spring'`/`'inertia'` item types). The existing `spring()` easing stays untouched.

### 3.6 Bindings (`src/gesture/bind.ts`)

```ts
interface DragOptions {
  axis?: 'x' | 'y' | 'any' | 'lock';
  bounds?: { min?: number; max?: number } | { x?: [number, number]; y?: [number, number] } | Element | (() => Bounds);
  elastic?: number | false;                 // rubberband coefficient outside bounds (0.55)
  momentum?: boolean | InertiaOptions;      // inertia on release (true)
  snap?: number[] | { step: number } | ((projected: number) => number);   // resolves against the *projected* fling endpoint
  snapTransition?: SpringOptions;
  threshold?: number; propagate?: boolean; capture?: boolean; touchAction?: SessionOptions['touchAction'];
  immediate?: boolean;                      // write on every event instead of per frame (lowest latency, may thrash)
  predict?: boolean;
  cursor?: boolean;                         // grab/grabbing cursors on mouse
  cues?: { at: number | number[]; name: string }[];   // fire a cue when the value crosses a threshold during the drag (haptic-style ticks, dismiss lines)
  onStart?(e): void; onMove?(e): void; onEnd?(e, outcome: { settled: Promise<void>; target: number }): void;
}
function drag(target: MotionValue<number> | { x: MotionValue<number>; y: MotionValue<number> }, element: Element, options?: DragOptions): { dispose(): void; start(nativeEvent: PointerEvent): void; cancel(): void; isDragging: MotionValue<boolean> };

interface TransformGestureOptions { scale?: MotionValue<number>; rotation?: MotionValue<number>; x?: MotionValue<number>; y?: MotionValue<number>; scaleBounds?: [number, number]; elastic?: number; momentum?: boolean; doubleTapZoom?: number | false; }
function transformGesture(element: Element, options: TransformGestureOptions): { dispose(): void };   // pinch + rotate + two-finger pan + wheel-zoom, composed into one coherent transform with a shared anchor point

interface ScrubOptions { axis?: 'x' | 'y'; pixelsPerFrame?: number; pixelsPerMs?: number; momentum?: boolean | InertiaOptions; snapToMarkers?: boolean | { within: TimeInput }; snapToFrames?: boolean; cues?: 'fire' | 'skip'; resumeAfter?: boolean /* resume playing after release if it was playing */ }
function scrub(transport: Transport, element: Element, options?: ScrubOptions): { dispose(): void };   // drag scrubs time; release flings through time with inertia; settles on the nearest marker/frame

function press(element, options): { dispose(); isPressed: MotionValue<boolean> };
function hover(element, options): { dispose(); isHovered: MotionValue<boolean> };
```

`scrub` is the flagship binding: it maps pointer distance to transport time (`transport.seek`, cues firing by default so audio/MIDI follow a scrub), uses the estimator's release velocity to start an `InertiaItem` **over time itself** (an inertia item whose target is the transport's playhead), and snaps to the nearest marker with a spring. Reverse scrubbing is just negative velocity — cues already fire backward.

### 3.7 Keyboard and accessibility (`src/gesture/keyboard.ts`)

Applied automatically by `drag`/`scrub`/`transformGesture` unless `keyboard: false`:
- `tabindex="0"` if not focusable; `role="slider"` with `aria-valuenow/min/max/orientation` for 1-D drags, `aria-roledescription="draggable"` otherwise; an optional `aria-label` from options.
- Arrow keys move by `step` (default 1% of range or 10px), Shift ×10, Home/End to bounds, Escape cancels an in-progress keyboard or pointer drag and springs back to the origin, Space/Enter toggles "grabbed" for screen readers.
- `prefers-reduced-motion` (through `useReducedMotion` in React, `matchMedia` in `./gesture`): momentum off, snap transitions instant, rubberband off, hover states still work.
- Focus-visible styling is left to the consumer; the library only sets attributes.

### 3.8 Recording and replay (`src/gesture/record.ts`)

```ts
interface GestureRecording { $schema: 'dhaakon-motion/gesture/1'; frameRate?: FrameRateInput; element?: { width: number; height: number }; samples: Array<{ id: number; type: string; kind: 'down' | 'move' | 'up' | 'cancel'; x: number; y: number; t: number; pressure?: number }>; }
function record(element: Element, options?: { normalize?: boolean /* to 0..1 of the element box */ }): { stop(): GestureRecording };
function replay(recording: GestureRecording, element: Element, options?: { driver?: ManualDriver; speed?: number; from?: number; to?: number }): Promise<void>;   // dispatches synthetic PointerEvents timed by the scheduler (or stepped by a ManualDriver in tests)
function gestureToTrack(recording: GestureRecording, options: { pointerId?: number; frameRate: FrameRateInput; axis?: 'x' | 'y' | 'both'; simplify?: number /* px tolerance, Ramer–Douglas–Peucker */ }): Track<number | { x: number; y: number }>;
```

A recorded drag becomes keyframes, quantized to frames, that go into a cue sheet and an offline render. This is "performer-recorded automation", and no other web motion library has it.

### 3.9 Testing additions (`src/testing.ts`)

```ts
function installPointerEvents(): () => void;                    // minimal PointerEvent/pointer-capture polyfill for jsdom (feature-detected; no-op in browsers)
function pointer(element: Element, options?: { id?: number; type?: 'mouse' | 'touch' | 'pen' }): { down(x, y, t?): void; move(x, y, t?): void; up(x?, y?, t?): void; cancel(): void };
function stroke(element, points: Array<[x, y, t]>, options?): Promise<void>;      // a full down→moves→up sequence
function fling(element, options: { from: [number, number]; velocity: [number, number] /* px/ms */; duration?: number }): Promise<void>;   // synthesizes a stroke with an exact ground-truth velocity
function measureLatency(element, motionValue): Promise<{ eventToWrite: number; eventToPaint?: number }>;   // uses ManualDriver timestamps; the paint half only in a real browser
```

---

## 4. Where this beats Framer Motion (the honest list)

| Capability | Framer Motion | This plan |
|---|---|---|
| Multi-touch pinch / rotate | Not built in | `pinch`, `rotate`, composed `transformGesture` with a shared anchor |
| Gesture arbitration | None (`dragPropagation` only) | Full arena: claim/yield/sweep, nested arenas, scroll cooperation, priorities |
| Velocity estimation | Last-event delta, 30ms cutoff | Windowed weighted least squares over coalesced samples, lift rule, ground-truth tested |
| Velocity handoff | Spring ← drag only | Any animation ↔ any animation: tween→grab, spring→re-grab, inertia→spring — `MotionValue.velocity` is universal |
| Physics model | Numeric spring/inertia, not scrubbable | Closed-form `SpringItem`/`InertiaItem`: `TimelineItem`s you can place, scrub, offline-render, put in a cue sheet |
| Gesture → timeline | Not a concept | `scrub()`: drag scrubs a `Transport`, fling through time, snap to markers, cues fire |
| Snapping | `dragSnapToOrigin`, `modifyTarget` | Points/grid/function resolved against the *projected* endpoint, with a spring settle, plus cue ticks on crossing |
| Trackpad/wheel | `onWheel` is yours | `wheel` recognizer with inertia detection, unified with pan/zoom |
| Latency | Event → next frame | Predicted events (`getPredictedEvents`) for the render position; `immediate` mode; measured by a harness |
| Hover on touch | Sticks | `hover` ignores `pointerType === 'touch'` |
| Keyboard / ARIA | Nothing for drag | Automatic slider/draggable semantics, arrows, Home/End, Escape |
| Reduced motion | `useReducedMotion` for you to wire | Momentum/snap/elastic degrade automatically |
| Determinism / tests | None | `ManualDriver` replay, `stroke()`/`fling()` with ground truth, `expectSample` |
| Recording | None | `record()`/`replay()`/`gestureToTrack()` |
| Framework | React-only | `./gesture` is plain DOM; `./react` binds it |

Not claimed: layout animations (`layout`, `layoutId`) — out of scope for this plan; noted as the remaining Framer strength in the comparison table.

---

## 5. Phases

### G0 — Velocity and physics (core, no DOM)

- `MotionValue`: `velocity`, `updatedAt`, `set(value, time?)`, `setWithVelocity`, `spring()`, `decay()`. `Tween.sampleAt` passes its time to `set`.
- `src/physics.ts`: `SpringItem`, `InertiaItem`, `rubberband`, `projectFling`, `snapTo`, `springDuration(options)` solver, `stiffnessFor(duration, bounce)` inverse.
- `sheet.ts`: `'spring'` and `'inertia'` sheet item types; `saveSheet` round-trips them.
- Tests (`tests/core/physics.test.ts`, `motion-value.test.ts`): closed-form spring matches a reference RK4 integration within 1e-3 for under/critical/over-damped cases; `totalDuration` is the first time both |x−target| < restDelta and |v| < restSpeed; inertia endpoint equals `projectFling`; inertia crossing a bound chains a spring with the crossing velocity (C¹ continuity: velocity at the join is equal from both sides); rubberband is monotonic and bounded by `dimension`; velocity handoff: a tween stopped at t=150ms of 300ms linear 0→300 reports 1 px/ms, and a `spring` started then has identical position and velocity at t=0⁺; a physics item inside a `Timeline` scrubs and offline-renders identically to playing it live (`sample()` table equality).

### G1 — Pointer layer

- `PointerSession`, `VelocityEstimator`, `touch-action` management, coalesced/predicted events, `pointercancel` handling, `installPointerEvents()` polyfill for jsdom, `pointer()`/`stroke()`/`fling()` helpers.
- Tests (`tests/react/pointer.test.tsx`, jsdom): a `fling()` with ground-truth velocity is estimated within 5% at 60Hz sampling and within 2% with coalesced 120Hz samples; the lift rule zeros velocity after a 100ms pause; `pointercancel` ends a session as cancelled and never reports a fling; capture attaches move/up to the element, no-capture to the document; `touch-action` is set on arm and restored on dispose; a second pointer creates a second history without disturbing the first.

### G2 — Recognizers and arena

- All recognizers in §3.4; `GestureArena` with nesting, propagation, sweep, `cooperateWithScroll`, `settle`.
- Tests (`tests/react/gesture.test.tsx`): the **conflict matrix** — for each pair in {tap, longPress, pan-x, pan-y, pan-lock, swipe, pinch, press} a synthetic stroke that should resolve to exactly one winner, asserted by which listener fired and in which phases; nested arenas: an inner pan claims and the outer is cancelled, unless `propagate`; a 4px "click" sweeps to `tap`, not `pan`; `pan lock` yields on the wrong axis and the scroller's `wheel`/native scroll is not prevented; `cooperateWithScroll` yields at the top edge dragging up and claims dragging down; `hover` does not fire for `pointerType: 'touch'`; `wheel` marks trackpad momentum `inertial` from a decaying delta series and not from constant mouse-wheel notches.

### G3 — Bindings

- `drag`, `transformGesture`, `scrub`, `press`, `hover`, keyboard/ARIA layer, reduced-motion degradation, drag `cues`.
- Tests: drag writes at frame rate (N moves in one frame → one `set`), `immediate` writes per event; bounds + elastic produce rubberbanded values outside and exact values inside; release starts inertia from the estimator velocity and `snap` picks the point nearest the *projected* endpoint (a slow drag past the midpoint snaps forward, a fast flick from before the midpoint also snaps forward); `cues` fire once per crossing in either direction; keyboard: ArrowRight moves `step`, Shift ×10, Home/End, Escape springs back; reduced motion: no inertia, instant snap; `scrub`: dragging 240px at `pixelsPerFrame: 10` seeks 24 frames, a release fling continues time then settles on the nearest marker, cues fire forward and backward, `resumeAfter` resumes playback; `transformGesture`: pinch about a point keeps that point fixed (anchor invariant, asserted numerically), wheel-zoom composes with it, double-tap toggles between 1× and `doubleTapZoom`.

### G4 — React

- `motion.*` props: `drag`, `dragBounds`, `dragElastic`, `dragMomentum`, `dragSnap`, `dragAxis`, `dragPropagation`, `whileHover`, `whileTap`, `whileDrag`, `whileFocus`, `onTap`, `onLongPress`, `onPanStart/onPan/onPanEnd`, `onPinch`, `onDragStart/onDrag/onDragEnd`; hooks `useGesture(ref, recognizers)`, `useDrag`, `usePinch`, `useScrub(transport?)`, `useDragControls()` (start a drag from a handle element), `useVelocity(motionValue)`, `useIsPressed/useIsHovered`.
- `while*` states resolve like `animate` does today (a tween between style objects), but **interruptibly**: releasing mid-`whileTap` starts the return tween from the current value and velocity, never from the target.
- Tests (`tests/react/gesture-react.test.tsx`): no React render during a drag (render counter); `whileTap` applies on down and reverts from the interrupted value; `drag` on `motion.div` moves `transform` and cleans up on unmount; `useDragControls().start(event)` begins a drag from another element; StrictMode mounts once.

### G5 — Recording, replay, latency

- `record`, `replay`, `gestureToTrack`; `measureLatency`; sheet item type `'gesture-track'`? No — `gestureToTrack` produces a plain `Track`, which already serializes.
- Tests: a recorded stroke replayed under `ManualDriver` reproduces the same `MotionValue` sample table; `gestureToTrack` at 24fps produces frame-aligned keyframes and RDP simplification reduces a 200-sample stroke to ≤ 12 keyframes within 2px; the resulting `Track` in a sheet round-trips and offline-renders.

### G6 — Docs, devtools, benchmarks, release

- Docs: a new section **08 · Touch and gesture** with the general examples (§6.1) as `Demo` cells and the complex examples (§6.2) as labs in `ProductionLabs.tsx`; the comparison table's "Gestures" row flips to native with a link; README sections; `CHANGELOG.md` 0.6.0.
- Devtools: pointer trail + velocity vector + arena state overlay (`mountInspector` gains `gestures: true`).
- Benchmarks (`docs/scripts/gesture-bench.mjs`, headless Chrome): velocity error vs ground truth for our estimator and a Framer-equivalent last-delta estimator on the same synthetic strokes; event→write latency with and without prediction; results embedded in the docs section as a table (numbers measured, not claimed).
- Release: `npm version minor` → 0.6.0, `npm run check`, docs `check`, publish to Verdaccio, rebuild `dhaakon-motion-docs`.

---

## 6. Examples

Each example names what it proves and the API it exercises. General examples are `Demo` cells; complex examples are labs with a live panel and a code panel, like the current section 06.

### 6.1 General examples (9)

1. **Draggable card** — `drag` on a `motion.div` with `dragBounds` from its parent, `dragElastic`, `dragMomentum`. Proves: rubberband at the edges, inertia on release, spring settle back inside bounds, velocity handoff when grabbed mid-settle.
2. **Swipe-to-dismiss row** — `drag` on `x`, `dragAxis: 'lock'` inside a vertical list, a `cues` threshold at ±40% width that flips a "delete" state, release decision by `projectFling`. Proves: axis lock coexisting with native vertical scroll, a projected-endpoint decision (a slow drag past the line or a fast flick before it both dismiss), cue ticks.
3. **Bottom sheet with detents** — `drag` on `y` with `dragSnap: [peek, half, full]`, `cooperateWithScroll` on its content. Proves: snap resolves against the projected endpoint with a spring, and the sheet only moves when the content is at its top edge.
4. **Carousel with momentum** — `drag` on `x` with `dragSnap: { step: slideWidth }`, elastic ends, `wheel` recognizer for trackpads. Proves: grid snapping, rubberband at the first/last slide, trackpad momentum detected and not double-applied.
5. **Pinch-to-zoom image** — `transformGesture` with `scaleBounds: [1, 4]`, `doubleTapZoom: 2.5`, wheel-zoom. Proves: the pinch anchor stays under the fingers, pan is bounded by the scaled image, zoom out past 1× rubberbands and springs back.
6. **Knob and slider** — `drag` with `axis: 'y'` mapped to a value, keyboard arrows/Home/End, `role="slider"`, a `cues` tick every 10 units. Proves: the accessibility layer is automatic, ticks fire in both directions, reduced motion removes momentum.
7. **Pull-to-refresh** — `drag` on `y` with `elastic` resistance only, a `cue` at the trigger distance, `snapTransition` back to 0 on release. Proves: resistance without bounds, threshold cue, a promise-returning `onEnd` (`settled`).
8. **Hover / tap / press matrix** — `motion.button` with `whileHover`, `whileTap`, `whileFocus`, `onLongPress`. Proves: hover never sticks on touch, tap has no delay, `whileTap` releases from the interrupted value, long-press cancels on movement.
9. **Drag-to-reorder list** — `useDragControls` from a handle, `drag: 'y'` with auto-scroll near the container edges, siblings tweening into place. Proves: drag started from a handle, arena propagation off (the list does not scroll while an item drags), continuous auto-scroll from the frame loop.

### 6.2 Complex examples (6)

**C1 — Scrub the show.** The Three.js showstopper's viewport becomes a scrubber: horizontal drag scrubs the `Transport` at `pixelsPerFrame: 4`, release flings through time with inertia, and the playhead settles on the nearest marker with a spring. Audio and MIDI outputs follow because `scrub` seeks with cues firing; reverse flings fire cues backward. Playback resumes after release if it was playing. Proves: gesture as a clock, physics over time itself, the whole output stack following a finger. Acceptance: a recorded stroke replayed under `ManualDriver` produces the same `transport.trace()` (same frames, same cues in the same order) as the live run.

**C2 — Sheet over a map.** A `transformGesture` map (pinch/rotate/pan/wheel, bounded, inertial) with a `drag` bottom sheet over it whose content scrolls. Three arenas cooperate: the sheet's handle always claims; the sheet body claims only when its content is at the top and the drag moves down; the map gets everything else. Proves: nested arenas, `cooperateWithScroll`, `settle`, two independent physics systems on one frame loop. Acceptance: the conflict matrix for these three (pinch on map, drag on sheet body at scrollTop 0 vs > 0, drag on handle) resolves as specified; `mountInspector({ gestures: true })` shows which arena won.

**C3 — Card stack throw.** Five stacked cards; the top card drags on x/y with rotation coupled to x; release uses `projectFling` against a dismiss line to decide throw vs spring-back; on throw the card leaves with inertia and the stack re-layouts with staggered springs; **undo** reverses by playing the recorded throw backward. Proves: projected decisions, coupled values (rotation from x through `MotionValue.subscribe`), inertia-to-spring chaining, velocity handoff when a card is caught mid-throw, reversal of a physics item. Acceptance: catching a card at any time during the throw starts the new drag with the card's current velocity (asserted: no positional discontinuity, velocity within 1% at the handoff frame).

**C4 — Performer-recorded automation.** Record a hand-drawn drag on a light-intensity fader (`record`), convert it to a `Track` at 24fps with RDP simplification (`gestureToTrack`), drop it into a cue sheet next to existing tracks, `saveSheet`/`loadSheet` it, scrub it with the existing transport lab, and offline-render 24 frames. Proves: gesture → data → deterministic reproduction; the same JSON drives a live show and a render. Acceptance: the offline `sample()` table equals the live-replay table; the sheet fixture round-trips.

**C5 — Multi-touch mixer.** Four vertical faders each bound to its own pointer (four fingers, four independent drags in one arena root), a waveform strip where pinch sets `transport.setRate()` and a two-finger pan seeks, long-press on a fader solos it (a `cue`), and `paramTrack` writes the fader values to `AudioParam`s through `audioOutput`. Proves: per-pointer sessions, pinch and pan coexisting on the same element, gestures driving transport rate and audio, 10-pointer capacity. Acceptance: a replay with four simultaneous recorded strokes yields four independent `MotionValue` sample tables; rate changes are reflected in `trace()` entries.

**C6 — Gesture-driven timeline editor (devtools dogfood).** The inspector's lanes become editable: drag the playhead (snap to frames), drag markers (snap to frames, cue names update), pinch/wheel to zoom the time axis about the cursor, pan to scroll it with inertia, long-press a lane to inspect its item. Proves: the layer is good enough to build a tool with, not just demos; frame snapping through `msToFrame`; transform gestures on a virtual (non-DOM-transform) coordinate system. Acceptance: dragging a marker and saving the sheet produces the new time, frame-aligned; zooming keeps the time under the cursor fixed (numeric invariant).

**C7 — Interruptible physics playground (bonus).** One `MotionValue`, four buttons (tween to A, spring to B, fling right, grab), and a ball; every transition starts from the current value *and velocity*. A velocity trace is drawn underneath. Proves: the universality of the handoff. Acceptance: the drawn velocity trace has no discontinuities greater than the estimator tolerance at any transition; the same sequence under `ManualDriver` produces the same trace.

---

## 7. Quality bars

### 7.1 Velocity accuracy
Synthetic strokes with analytic ground truth (constant velocity, linear deceleration, sine wobble + constant drift, pause-then-lift) at 60Hz and 120Hz sampling with ±1ms timestamp jitter. Requirements: constant-velocity error < 2%; deceleration: velocity at lift within 5% of the analytic instantaneous value; wobble: drift recovered within 10%; pause-then-lift: 0. The same strokes are run through a last-delta estimator in the benchmark to show the difference; the numbers go in the docs.

### 7.2 Latency
- Event → `MotionValue` write: ≤ one scheduler tick in frame mode, 0 ticks in `immediate` mode (measured with `measureLatency` under `ManualDriver`).
- Predicted events reduce apparent lag by the browser's prediction horizon (typically 1 frame); asserted only in the headless benchmark, not in unit tests.
- No layout reads during a drag: `bounds: Element` is measured on `began` and on `ResizeObserver`, never per move.

### 7.3 Robustness
- `pointercancel`, `lostpointercapture`, window `blur`, and `visibilitychange` all end a gesture as cancelled with a spring back (or a stop if `momentum: false`) — never a stuck drag.
- Touch + mouse simultaneously (pen + finger, or a touch screen with a mouse) — separate pointer ids, separate sessions.
- iOS Safari: `touch-action` set before the first touch (on arm, not on down), non-passive `touchmove` only while claimed, `-webkit-user-select: none` during drags.
- A drag started on a `motion.*` element that unmounts mid-gesture disposes cleanly.

### 7.4 Performance
- Zero allocations per `pointermove` on the hot path after warm-up (samples reuse ring-buffer slots; `GestureEvent` objects are reused per recognizer).
- One `pointerdown` listener per element; move/up attached only while armed.
- Per-frame work is one `set` per value; the DOM write happens in the existing subscriber, once.

---

## 8. Working agreements, non-goals, risks

- **One commit per phase**, `motion: G<n> — <title>`; `npm run check` before each; the dist compatibility oracle stays byte-identical. Tests first for: the velocity estimator, the spring closed form, the conflict matrix, the snap-decision cases, the sheet/scroll cooperation.
- **Do not** add dependencies; do not fork Framer's or `@use-gesture`'s code; do not put DOM code in the core entry (physics is core, everything touching `Element` is `./gesture`).
- **Do not** change existing behavior. The one addition to a core class is `MotionValue` velocity, which is purely additive.
- **Non-goals for 0.6:** layout animations (`layout`/`layoutId`), shared-element transitions, scroll-linked animation (`useScroll`) beyond the `wheel` recognizer, 3D manipulation gestures (arcball) — a Three.js orbit gesture can be built on `transformGesture` later.
- **Risks and mitigations:** jsdom's Pointer Events are partial → `installPointerEvents()` polyfill and feature-detected capture, with the conflict matrix also run in the headless-Chrome benchmark to catch divergence; iOS Safari gesture quirks → the touch-action-on-arm rule and a manual checklist in the docs lab; closed-form spring duration solving → bisection on the amplitude envelope with a hard cap, tested against RK4; scope creep in React props → the prop set above is the whole set for 0.6.

## 9. Acceptance summary

| Goal | Proven by |
|---|---|
| More responsive than Framer | Velocity benchmark (§7.1) and latency harness (§7.2) with published numbers; predicted-event path |
| More complete than Framer | Pinch/rotate/wheel/longPress recognizers, the arena and conflict matrix, `scrub`, physics-as-timeline-items, record/replay, keyboard/ARIA — each with tests |
| Fits the library | Every gesture ends in a `MotionValue` or a `Transport`; physics items live on `Timeline`s and in cue sheets; everything runs on the one scheduler and under `ManualDriver` |
| Demonstrated | 9 general demos and 7 labs in the docs, each with a stated acceptance test |
