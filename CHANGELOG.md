# Changelog

## 0.5.0

Frame-native tween authoring and a complete production-control documentation suite.

### Added

- `Tween` timing fields `duration`, `delay`, and `repeatDelay` now accept the complete `TimeInput` vocabulary: milliseconds, seconds, frames, and SMPTE timecode.
- `TweenOptions.frameRate` provides an explicit local timebase. Otherwise a tween inherits its containing `Timeline`/`Transport` rate and re-resolves authored timing when attached; an explicit tween or nested-timeline rate always wins.
- `Track.repeatDelay`, `Timeline.repeatDelay`, React `MotionTransition`, declarative `<Tween>`, and `<Sequence repeatDelay>` use the same time vocabulary. `MotionConfig` can provide a frame rate for standalone React motion.
- Documentation now contains seven large live production labs covering SMPTE/frame control, deterministic offline passes, nested cue orchestration, unified DOM/Three.js/Canvas/audio/hardware output, React lifecycle, serializable cue sheets/scene state, and timeline testing/inspection.

### Changed

- Cue-sheet construction preserves authored time literals through item creation instead of eagerly converting them to milliseconds.
- Scene-state stagger is represented as timeline placement, allowing the transition's own delay to retain an inherited frame/timecode timebase.

## 0.4.0

Transport, SMPTE timecode, nested cue timelines, deterministic offline rendering, outputs for DOM/Three.js/audio/MIDI, serializable cue sheets and scene states, a declarative React composition layer, and stronger test tooling and inspection.

### Added

- **Time.** `FrameRate`/`frameRate()`/`FrameRates` (presets `23.976`–`60`, incl. `29.97df`/`59.94df`), `frameToMs`/`msToFrame`/`snapToFrame`, `parseTime`/`formatTime` for the `TimeInput` vocabulary (plain ms, `'12f'`, `'1.5s'`, `'500ms'`, SMPTE timecode). `parseTimecode`/`formatTimecode`/`timecodeToFrames`/`framesToTimecode`/`msToTimecode`/`timecodeToMs`/`addFrames`, implementing standard SMPTE drop-frame correction.
- **Transport.** `Transport` — time/rate/state, a pluggable `Clock`, `snap`, `loop` (whole duration or a `[from, to]` region, wrapping with the overshoot carried forward), `seek`/`seekFrame`/`seekTimecode`/`step`, `setRate`/`reverse`, `chase()` for following an external clock, `attach()` for `TransportOutput`s, `subscribe()`, `finished`, `trace()`. `Transport.tick(now)` drives it manually.
- **Nested timelines.** `Timeline.add()` accepts another `Timeline` (nesting inherits `frameRate` unless set); `.remove()`/`.clear()`, `.items`/`.parent`/`.rootTransport`, `.frames`/`.timecode()`. A root (unparented) timeline lazily owns a private `Transport`.
- **Markers, cues, regions.** `Timeline.marker()`/`.cue()`/`.region()` alongside the existing `.label()`. Cues carry direction and fire correctly across scrubs, seeks, and repeat/yoyo lap turnovers; `once`; a cue-only timeline (no tweens) still has a real, sampleable duration.
- **Offline rendering.** `renderFrames()`/`frames()` (accumulation-free, frame-indexed), `OfflineTransport`.
- **Inspection.** `Timeline.inspect()`/`.toAscii()`/`.explain()`, `transport.trace()`/`Trace`.
- **Track.** `Track<T>` — N-keyframe generalization of a two-key `Tween`, with per-segment easing; `track()`; `Tween.toTrack()`.
- **Easing.** `registerEasing`/`resolveEasing`/`serializeEasing`, a `['cubicBezier', ...]`/`['spring', ...]`/`['steps', n]` tuple form, `steps()`.
- **Outputs.** `drawOutput`/`signalOutput` (core). `./three`: `threeOutput`, `objectTrack`/`uniformTrack`/`cameraTrack`, `frameCapture`. `./audio`: `audioClock`, `AudioClip`, `audioOutput`, `paramTrack`, `renderAudio`. `./midi`: `midi.*` byte builders, `midiOutput`, `noteCue`.
- **Cue sheets and scene states.** `loadSheet`/`saveSheet`/`validateSheet` (JSON `CueSheet` format, `$schema: "dhaakon-motion/cue-sheet/1"`); `captureScene`/`applyScene`/`sceneTransition`/`sceneSheet`.
- **React.** `<Transport>`/`<Sequence>`/`<Track>`/`<Tween>`/`<Marker>`/`<Cue>`/`<Region>`; `useTransport`/`useTransportState`/`usePlayhead`/`usePlayheadValue`/`useCue`/`useSceneState`.
- **Testing.** `./testing` gains `expectSample`, `stepFrames`, `runUntil`, `sample`, `snapshotTimeline`, and Web Audio/MIDI fakes (`fakeAudioContext`, `fakeOfflineAudioContext`, `fakeAudioBuffer`, `fakeMidiPort`).
- **Devtools.** New `./devtools` entry: `mountInspector()`, a dependency-free plain-DOM transport bar and timeline-lanes overlay.
- `Tween.frameAt()`/`.timecodeAt()`; `Tween`/`Timeline`/`Track` gain a `name` field/option.

### Fixed

- Timeline position `'<+=100'`/`'>-=50'` previously threw ("Unknown timeline label: <") — `<`/`>` now accept `+=`/`-=` offsets in any `TimeInput` form.
- `Tween.getCurrentFrame()` used `Math.ceil`; it (and the new `frameAt()`) now floor, matching the frame actually on screen at a given instant.

### Changed (documented, narrow)

- Playing a **nested** timeline directly now throws (`"is nested; control its root transport instead"`). Nesting itself (`Timeline.add(timeline)`) is new in 0.4, so this can only affect code already written against 0.4's nesting API.
- `Transport.seek()` — a new method, not `Timeline.seek(progress)` — fires cues it crosses by default; pass `{ cues: 'skip' }` to suppress them. `Timeline.seek(progress)` is unchanged: still a 0–1 fraction.

### Scope notes

- `mtcOutput` (MIDI Timecode quarter-frame output) is not implemented — the plan that shaped this release named it an explicit stretch goal.
- Audio clip positions inside a *repeating* nested timeline are not lap-aware (`audioOutput`/`renderAudio` place them as if that timeline never repeats); put clips on the root or a non-repeating container.
- No `<AudioClip>` React component — `useTransport()` to add one imperatively, keeping the `react` entry free of a Web Audio dependency.
- `Track`-level "current value" isn't exposed for `./testing`'s `sample()`/`expectSample()` (Tween-only, documented as a stopgap).

## 0.3.2 and earlier

See git history.
