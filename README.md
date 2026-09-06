# @dhaakon/motion

The original `dhaak-anim` tween vocabulary, rebuilt as the motion layer for the Dhaakon network. The core is dependency-free and framework-agnostic; React, Three.js, Web Audio, and Web MIDI support are separate, optional entry points.

Documentation and live playground: **http://dhaakon-ubuntu:21764**

## Install

Configure the network registry once:

```ini
@dhaakon:registry=http://dhaakon-ubuntu:21760/
```

```sh
npm install @dhaakon/motion
```

The opt-in Rust/Wasm prerelease uses `npm install @dhaakon/motion@experimental`.
Explore its [advanced experimental demos](http://dhaakon-ubuntu:21764/rust/experimental)
and [scope, lifecycle and verification notes](docs/RUST-EXPERIMENTAL.md).
It does not change the stable `latest` tag or automatically accelerate existing imports.

## CSS-first interfaces (development branch)

The new `/css-ui` docs page demonstrates browser-owned CSS motion with Dhaakon UI:
shared timing tokens, named CSS variants, interrupted transitions, reduced motion
and an accessible disclosure. Use `cssMotion` from `/react` and the optional `/css`
entry; existing `motion`/Transport APIs and opt-in Rust/Wasm graphics remain separate.
See [the API, ownership rules and scope](docs/CSS-UI-MOTION.md). This branch's feature
has not been published or deployed merely by building it locally.

## Core

```ts
import { Tween, Easing } from '@dhaakon/motion';

const tween = new Tween({
  from: { x: 0, opacity: 0, color: '#2d62ff' },
  to: { x: 240, opacity: 1, color: '#ff5a1f' },
  duration: 600,
  easing: Easing.dhaakon,
  onUpdate: (value) => render(value),
}).play();

tween.pause().play();
tween.reverse();
tween.seek(0.5);
await tween.finished;
```

`Tween` interpolates numbers, CSS unit strings, colors, arrays, and nested objects. It supports delay, repeat, repeat-delay, alternate/yoyo direction, seeking, reversing, and lifecycle callbacks. Every active tween uses the same `FrameScheduler`, so a composition requests one animation frame instead of one per element.

The legacy forms remain available:

```ts
new Tween({ curve: [0, 100], onUpdate(value) {} }).play();
new Tween({ curve: new Tween.Line([0, 0], [100, 30]) }).play();
```

## Timelines

```ts
const sequence = new Timeline()
  .label('entrance')
  .add(titleTween, 'entrance')
  .add(bodyTween, 'entrance+=80')
  .add(actionTween, 'entrance+=160');

sequence.play();
```

Positions can be absolute milliseconds, labels, relative label offsets, `<` (align with the previous start), `>` (follow the previous end) — each also accepts a `+=`/`-=` offset (`'<+=100'`, `'>-=00:00:00:06'`) — or a frame/timecode literal directly (`'12f'`, `'00:00:01:00'`). A timeline samples children from its own clock, making overlaps, pause, seek, and reverse deterministic.

## Transport

A `Transport` is the clock authority a composition plays through — timelines render into it, and any number of outputs (DOM, Three.js, Canvas, audio, hardware) attach to it and draw once per tick, after every value for that instant has been written.

```ts
import { Transport, Timeline, Tween } from '@dhaakon/motion';

const show = new Timeline().add(titleTween, 0).add(bodyTween, '>');

const transport = new Transport({ root: show, frameRate: 24, loop: [0, '00:00:04:00'] });
transport.play();
transport.pause();
transport.seek('00:00:02:00');   // absolute time — a timecode, '12f', '1.5s', or plain ms
transport.step(1);               // ±1 frame, pauses first
transport.setRate(-1);           // plays backward
transport.chase(externalMs);     // follow an external clock (hard-seeks past a threshold, else nudges rate to converge)
await transport.finished;        // resolves once, at the end, when not looping
```

`new Timeline().play()` still works exactly as before — a root timeline lazily owns a private `Transport`, and `play`/`pause`/`stop`/`reverse`/`seek` (still 0–1 progress, unchanged) forward to it.

`transport.frame`, `.timecode`, `.progress`, and `.duration` read the current position; `snap: true` quantizes every rendered time to a frame boundary. `transport.attach(output)` connects a `TransportOutput` (`onTick`, `onStateChange`, `onSeek`, `onRateChange`, `onAttach`/`onDetach`); `transport.subscribe(listener)` is a lighter per-tick hook without the output lifecycle.

## SMPTE timecode and frame rates

```ts
import { frameRate, parseTime, formatTime, msToTimecode, timecodeToMs } from '@dhaakon/motion';

const rate = frameRate('29.97df');       // drop-frame, only legal at 29.97/59.94
parseTime('00:01:00;02', rate);          // 1800 frames worth of ms
formatTime(60000, rate, 'timecode');     // '00:01:00;02'
```

`FrameRates` has presets from `23.976` through `60`, including `29.97df`/`59.94df`. `msToFrame`/`frameToMs` are the plain rational conversion (frame ↔ ms, no drop-frame correction — a frame's actual moment in time never changes); the drop-frame correction lives in `timecodeToFrames`/`framesToTimecode`, which only affects how a frame count is *displayed*. `Tween.frameAt(rate)`/`.timecodeAt(rate)` and `Timeline.frames`/`.timecode()` read the same way.

Tween clock fields use that same vocabulary directly:

```ts
const graphic = new Tween({
  from: 0,
  to: 1,
  delay: '6f',
  duration: '00:00:00:18',
  repeat: 1,
  repeatDelay: '4f',
});

const show = new Timeline().add(graphic);
new Transport({ root: show, frameRate: 24 });
```

`duration`, `delay`, and `repeatDelay` retain their authored `TimeInput` internally and resolve against the nearest timebase. A tween without `frameRate` inherits its containing timeline/transport rate when attached—even if it was constructed earlier. Set `frameRate` on the tween or a nested timeline to create an intentional local timebase. Public runtime values such as `tween.duration` remain normalized milliseconds.

## Nested timelines, markers, and cues

Timelines nest — `.add()` accepts another `Timeline` (or a `Track`, see below) exactly like a `Tween`:

```ts
const intro = new Timeline({ name: 'intro', repeat: 1, yoyo: true }).add(titleTween, 0);

const show = new Timeline({ name: 'show', frameRate: 24 })
  .label('verse', '00:00:02:00')
  .add(intro, 'verse')
  .marker('chorus', 'verse+=4s', { color: '#d9ff43' })
  .cue('blackout', 'chorus+=12f', (e) => dmx.send(e.payload), { payload: { channel: 1, value: 0 } })
  .region('spotlight', 'verse', 'chorus', { onEnter: () => light.on(), onExit: () => light.off() });
```

A cue fires forward and backward — `e.direction` says which — whenever the playhead crosses `at`, including on a scrub, a seek, or a repeat/yoyo lap turning over (a cue at the end of a repeating timeline fires exactly once per lap, not once per sample). A `region`'s `onEnter`/`onExit` are direction-paired at its two boundaries. `once: true` disarms a cue until `timeline.reset()`. A nested timeline without its own `frameRate` inherits its parent's at attach time; playing a nested timeline directly throws (`"is nested; control its root transport instead"`) — control the whole composition through its root `Transport`.

## Deterministic offline rendering

```ts
import { renderFrames, frames } from '@dhaakon/motion';

const { frames: count } = await renderFrames(show, (info) => {
  encoder.addFrame(canvas.toDataURL(), info.frame);
}, { frameRate: 24, to: '00:00:04:00' });

for (const info of frames(show, { frameRate: 24 })) drawOneFrame(info);
```

`renderFrames` walks an integer frame index and seeks to `frameToMs(frame, rate)` each step — no time accumulation, so running it twice (or resuming it on the same `Transport` where a prior call left off) produces identical output. Every cue in the rendered range fires exactly once, in order, regardless of frame rate. `OfflineTransport` never touches the scheduler or `performance.now`, and skips (with one warning) any attached output whose `supportsOffline` is `false`.

## Outputs: DOM, Three.js, Canvas, audio, MIDI

Every output implements `TransportOutput`; `transport.attach(output)` connects it.

```ts
import { drawOutput, signalOutput } from '@dhaakon/motion';

transport.attach(drawOutput((info) => renderer.drawFrame(info)));               // Canvas or any custom renderer
transport.attach(signalOutput((signal, cue) => lightingDesk.send(signal)));     // routes every fired cue's payload
```

```ts
import { threeOutput, objectTrack, cameraTrack, uniformTrack } from '@dhaakon/motion/three';

const camera = new Track(cameraTrack(threeCamera, [
  { at: 0, value: { position: [0, 1, 9], fov: 44 } },
  { at: 4000, value: { position: [-3, 2, 5], fov: 30 }, easing: 'dhaakon' },
]));
transport.add(objectTrack(rig, keyframes), 0);
transport.attach(threeOutput({ renderer, scene, camera: threeCamera }));        // one render() per tick
```

```ts
import { audioClock, AudioClip, audioOutput, paramTrack } from '@dhaakon/motion/audio';

const transport = new Transport({ clock: audioClock(context) });                // audio becomes the master clock
transport.add(new AudioClip({ context, buffer, gain: 0.8 }), '1s');
transport.attach(audioOutput(context));                                         // schedules BufferSources; no reverse audio
```

```ts
import { midiOutput, noteCue } from '@dhaakon/motion/midi';

noteCue(show, '00:00:01:00', 60, { velocity: 100, duration: '200ms' });
transport.attach(midiOutput(midiAccess.outputs.values().next().value));
```

Three.js and Web Audio/MIDI types are peer/ambient dependencies only — the core (`.`) entry has zero runtime dependencies regardless of which output entries a project also imports.

## Cue sheets and scene states

A composition can be loaded from and serialized to plain JSON. Serialization
currently preserves structure and named targets but is not lossless for all metadata:

```ts
import { loadSheet, saveSheet, validateSheet } from '@dhaakon/motion';

const { ok, sheet, errors } = validateSheet(json);
const timeline = loadSheet(sheet, { targets: { camera: cameraSignal }, cues: { blackout: (e) => dmx.send(e.payload) } });
const backToJson = saveSheet(timeline);   // structure and named target bindings
```

```ts
import { captureScene, applyScene, sceneTransition } from '@dhaakon/motion';

const rehearsal = captureScene({ camera: cameraSignal, energy: energyValue });
applyScene(liveState, { camera: cameraSignal, energy: energyValue }, { transition: { duration: 600, easing: 'dhaakon' } });
```

`loadSheet`'s `strict` option (default `true`) throws on a missing target/asset or an unhandled item type, naming it with a JSON path; pass `strict: false` to warn and skip instead. `bindings.createItem` is the escape hatch for item types the core doesn't know (`'audio'`, built from `AudioClip`).

## Testing compositions

```ts
import { createTestScheduler, expectSample, snapshotTimeline } from '@dhaakon/motion/testing';

const { driver, scheduler } = createTestScheduler();
const timeline = new Timeline({ scheduler }).add(new Tween({ from: 0, to: 100, duration: 1000 }), 0);
driver.step(500);
expectSample(timeline, 500, { 0: 50 });        // throws with the ASCII timeline on mismatch
console.log(snapshotTimeline(timeline).ascii); // for a snapshot test
```

`ManualDriver` makes any `FrameScheduler` (and, via `installFrameDriver()`, the shared global one `motion.*`/`useTween` use) fully deterministic — nothing runs until `.step()`/`.advance()`. `fakeAudioContext()`/`fakeOfflineAudioContext()`/`fakeMidiPort()` stand in for Web Audio/MIDI in a test.

## Inspecting a timeline

```ts
timeline.inspect();     // { kind, name, start, end, duration, totalDuration, repeat, direction, children, markers, cues }
timeline.toAscii();     // a stable, human-readable rendering of the tree, its markers, and its cues
timeline.explain('verse+=12f'); // { ms, frame, timecode, base: 'verse', offset: 200 }
transport.trace();      // a ring-buffer TransportOutput recording every tick and the cues that fired
```

```ts
import { mountInspector } from '@dhaakon/motion/devtools';

const inspector = mountInspector(transport);   // a plain-DOM transport bar + timeline lanes overlay
inspector.unmount();
```

`./devtools` is dependency-free and only loaded where you import it — it never ships as part of a production bundle unless a project reaches for it directly.

Pass `{ gestures: true }` to add active pointer trails, velocity vectors, and the winning gesture-arena state to the inspector.

## Touch, gestures, and physics

The dependency-free `./gesture` entry owns Pointer Events, coalesced sampling, weighted velocity estimation, nested gesture arbitration, bounds, rubberbanding, momentum, snapping, keyboard/ARIA behavior, and recording. Values still flow through the same `MotionValue` and scheduler as every other renderer.

```ts
import { MotionValue } from '@dhaakon/motion';
import { drag, scrub, transformGesture } from '@dhaakon/motion/gesture';

const x = new MotionValue(0);
const card = drag(x, element, {
  axis: 'x', bounds: { min: -240, max: 240 }, elastic: .55,
  momentum: true, snap: [-240, 0, 240],
  cues: [{ at: [-120, 120], name: 'dismiss-line' }],
});

scrub(transport, programMonitor, {
  pixelsPerFrame: 4, snapToMarkers: true, resumeAfter: true,
});

transformGesture(viewport, {
  x: cameraX, y: cameraY, scale: zoom, rotation,
  scaleBounds: [1, 4], doubleTapZoom: 2.5,
});

card.dispose();
```

`MotionValue.velocity` is expressed in units per millisecond. `setWithVelocity()`, `.spring()`, and `.decay()` preserve velocity across tween → grab → inertia → spring handoffs. `SpringItem` and `InertiaItem` are closed-form timeline items, so physics can be sought, nested, serialized in cue sheets, and rendered offline.

React adds the same system without rerendering on each pointer move:

```tsx
<motion.article
  drag="x"
  dragBounds={{ min: -240, max: 240 }}
  dragElastic={.55}
  dragMomentum
  dragSnap={[-240, 0, 240]}
  whileHover={{ y: -4 }}
  whileTap={{ scale: .96 }}
  whileDrag={{ rotate: 3 }}
  onDragEnd={({ velocity }) => log(velocity.x)}
/>
```

The React entry also exports `useGesture`, `useDrag`, `usePinch`, `useScrub`, `useDragControls`, `useVelocity`, `useIsPressed`, and `useIsHovered`. Draggables install focusable slider/draggable semantics and arrow, Shift+arrow, Home/End, Escape, Space, and Enter equivalents; reduced-motion preferences disable fling and resolve snaps immediately.

Record a performance and turn it into portable animation data:

```ts
import { record, replay, gestureToTrack } from '@dhaakon/motion/gesture';

const take = record(fader, { normalize: true, frameRate: 24 });
const recording = take.stop();
await replay(recording, fader);
const automation = gestureToTrack(recording, { frameRate: 24, axis: 'y', simplify: 2 });
show.add(automation, 'PERFORMER-IN');
```

## React

```tsx
import { MotionConfig, motion } from '@dhaakon/motion/react';

<MotionConfig transition={{ duration: 360, easing: 'dhaakon' }}>
  <motion.article
    initial={{ y: 24, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
  >
    <CourseCard />
  </motion.article>
</MotionConfig>
```

The React entry point exports:

- `motion.*` — DOM animation without rerendering the React tree every frame
- `Reveal` / `whileInView` — animate when an element crosses a configurable viewport threshold
- `useInView` — IntersectionObserver state for custom reveal compositions
- `Motion` — render-prop animation for SVG, canvas, and component props
- `useTween` — animated state plus controls
- `useMotionValue` / `useMotionValueState` — external observable values
- `useTimeline` — lifecycle-safe timeline composition (imperative; prefer `<Sequence>` below for declarative composition)
- `MotionConfig` / `useReducedMotion` — shared transitions and accessible motion policy

React 18 and 19 are optional peer dependencies. Importing the core never loads React.

```tsx
<Reveal as="section" from={{ y: 36, opacity: 0 }} amount={0.2} once>
  <CourseModule />
</Reveal>
```

Reveal observers disconnect after the first entrance by default, and resolve immediately when reduced motion is requested. Use `once={false}` when a composition should respond each time it crosses the viewport.

### Declarative transport composition

```tsx
import { Transport, Sequence, Track, Tween, Marker, Cue, Region, useTransport, usePlayhead, useCue } from '@dhaakon/motion/react';

<Transport frameRate={24} loop autoplay respectReducedMotion>
  <Sequence name="show">
    <Track target={cameraSignal} keyframes={[...]} easing="dhaakon" />
    <Sequence name="intro" at="show+=200" repeat={1} yoyo>
      <Tween target={titleOpacity} from={0} to={1} duration="12f" />
    </Sequence>
    <Marker name="verse" at="00:00:02:00" />
    <Cue name="blackout" at="verse+=12f" onFire={(e) => dmx.send(e.payload)} payload={{ channel: 1 }} />
    <Region name="chorus" from="6s" to="8s" onEnter={() => {}} onExit={() => {}} />
  </Sequence>
</Transport>
```

`<Transport>` owns (or, given a `transport` prop, adopts) a `Transport` and provides it via context; `autoplay`/`paused` (controlled) drive play/pause reactively, and `respectReducedMotion` (default `true`) parks it at the end instead of playing when the user prefers reduced motion. `<Track>`/`<Tween>`/`<Marker>`/`<Cue>`/`<Region>` register into the nearest `<Sequence>` (or the root); a prop change coalesces through a microtask into one rebuild that reseeks the transport back to where the playhead already was, so it never jumps or refires what it already crossed. `useTransport()`/`useTransportState()`/`usePlayhead({fps})`/`usePlayheadValue()` (a `MotionValue`, no React render per tick) and `useCue(at, handler)` read and hook into it from anywhere beneath the provider. There is no `<AudioClip>` React wrapper — `useTransport()` to add one imperatively keeps the React entry free of a Web Audio dependency.

## Custom renderers and Three.js

For one isolated hover, CSS is usually enough. Use a motion engine when several systems must share timing and controls: a scene graph, camera, shader, DOM overlay, audio envelope, or any other render target that must pause, seek, reverse, repeat, and test as one composition.

`MotionValue` is the renderer boundary. Subscribe once and write the current value into any external API; React only owns setup and teardown.

```tsx
useEffect(() => {
  const frame = new MotionValue({
    camera: [0, 1, 9],
    rotation: [0, 0, 0],
    energy: 0.2,
    light: '#ff5a1f',
  });

  const unsubscribe = frame.subscribe(() => {
    const value = frame.get();
    camera.position.fromArray(value.camera);
    rig.rotation.fromArray(value.rotation);
    shader.uniforms.uEnergy.value = value.energy;
    keyLight.color.setStyle(value.light);
  });

  const show = new Timeline({
    onUpdate: () => renderer.render(scene, camera),
  }).add(new Tween({
    from: frame.get(),
    to: finaleState,
    duration: 9200,
    onUpdate: (value) => frame.set(value),
  })).play();

  return () => { show.stop(); unsubscribe(); renderer.dispose(); };
}, []);
```

The live documentation contains the complete Three.js example, including procedural shaders, lighting, particles, camera animation, telemetry, and transport controls. Three.js remains a documentation-only development dependency; the published motion core has zero runtime dependencies.

## Development

Start with [AGENTS.md](AGENTS.md), the [architecture map](docs/ARCHITECTURE.md),
and the [audit / known limitations](docs/AUDIT.md). `saveSheet` currently loses
some cue/region and track metadata; preserve authored JSON when fidelity matters.

```sh
npm run check           # typecheck + vitest + the packaged-output compatibility test
npm test                # vitest only
npm run docs:dev        # http://localhost:5175
npm run docs:build
npm run docs:check      # build + lazy-route and JS budget validation
npm run docs:smoke      # real Chrome deep-link, navigation, media, cleanup checks
npm run docs:render-cue # 576 exact SVG frames → 1080p H.264 (Chrome + GStreamer)
npm run docs:verify-cue # decoded-frame image comparisons + live controls
npm run check:all       # complete local verification (Chrome required)
```

The documentation site imports the package source directly and uses `@dhaakon/ui`. Its network container is `dhaakon-motion-docs` in the `dhaakon-network` Compose stack.

The [docs overview](http://dhaakon-ubuntu:21764/) runs no demos. Features have
independent lazy-loaded routes, including [gestures](http://dhaakon-ubuntu:21764/gestures),
[transport](http://dhaakon-ubuntu:21764/transport), [Three.js](http://dhaakon-ubuntu:21764/three),
and the [24fps SVG / offline MP4 comparison](http://dhaakon-ubuntu:21764/svg-cue-sheet).
The complete registry is `docs/src/routes.ts`; legacy section bookmarks redirect.

The SVG director’s cut is a 24-second, five-act composition with 23 inspectable
targets, solo/mute controls, and a side-by-side 1080p offline master. The
[render guide](docs/CUE-SHEET.md) documents its shared SVG adapter, deterministic
geometry, reproducible export, and decoded-frame verification limits.

## Entry points

| Import | Contents |
| --- | --- |
| `@dhaakon/motion` | `Tween`, `Timeline`, `Transport`, `Track`, `MotionValue`, easing, timecode/frame-rate utilities, cue sheets, scene states, offline rendering, `drawOutput`/`signalOutput` |
| `@dhaakon/motion/react` | `motion.*`, `Reveal`, hooks, `<Transport>`/`<Sequence>`/`<Track>`/`<Tween>`/`<Marker>`/`<Cue>`/`<Region>` |
| `@dhaakon/motion/three` | `threeOutput`, `objectTrack`, `uniformTrack`, `cameraTrack`, `frameCapture` (peer: `three`, type-only import) |
| `@dhaakon/motion/audio` | `audioClock`, `AudioClip`, `audioOutput`, `paramTrack`, `renderAudio` (Web Audio, no npm dependency) |
| `@dhaakon/motion/midi` | `midi.*` byte builders, `midiOutput`, `noteCue` (Web MIDI, no npm dependency) |
| `@dhaakon/motion/testing` | `ManualDriver`, `createTestScheduler`, `installFrameDriver`, `expectSample`, `snapshotTimeline`, `sample`, `stepFrames`, `runUntil`, audio/MIDI fakes |
| `@dhaakon/motion/devtools` | `mountInspector` — a plain-DOM transport bar + timeline lanes overlay |

## Compatibility notes (0.4)

Everything above 0.3 keeps working unchanged, with two documented exceptions:

- Playing a **nested** timeline directly now throws (`Timeline.add()` didn't exist before 0.4, so this can only affect code already updated to nest timelines) — control the composition through its root `Transport` instead.
- `Transport.seek()` fires any cue it crosses by default (pass `{ cues: 'skip' }` to suppress); this is a new method, not a change to `Timeline.seek(progress)`, which keeps its 0–1 fraction signature exactly as before.

## Experimental Rust / WebAssembly engine

The `feat/rust-wasm-engine` branch adds an opt-in compiled Track evaluator while
preserving the existing TypeScript/React APIs. See
[implementation status, usage and migration notes](docs/ENGINE-MIGRATION.md)
before using `@dhaakon/motion/compiled`. Wasm is not downloaded or selected by
ordinary imports. The GPU renderer and native video exporter are later milestones.
