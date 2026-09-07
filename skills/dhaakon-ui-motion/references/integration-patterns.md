# UI and motion integration patterns

Read only the section that matches the requested interaction.

## Accessible exit presence

Keep semantic state distinct from visual presence:

1. On open, mount first, expose the region/dialog, then target the open variant.
2. On close, immediately set `aria-hidden`/`inert` as appropriate and return focus if it
   is inside content becoming unavailable.
3. Keep the element mounted while its exit transition runs.
4. Hide or unmount only when the current exit playback completes.
5. A rapid reopen must invalidate a stale close completion so it cannot hide open UI.
6. Reduced motion completes immediately and follows the same semantic state machine.

Prefer the kit's Modal/Dialog/Drawer for modal behavior. A motion wrapper adds visual
presentation; it does not replace focus containment, Escape handling or accessible names.

## Gesture-controlled interface

Use a kit component for the semantic control and attach the motion gesture to a stable
ref or MotionValue. Preserve pointer capture, keyboard alternatives, scroll cooperation,
bounds and cancellation. State updates/callback changes must not leak stale bindings.
On unmount, dispose recognizers and any inertia/spring follow-through.

## Coordinated production timeline

Author one timeline with labels/cues and one transport. Set its frame rate before adding
frame-based positions. Attach DOM/SVG/Canvas/Three/audio outputs so they draw after all
values for the tick have been written. Cue callbacks represent control events; renderer
state should remain sampleable at an arbitrary time without relying on history.

## Canvas or Three.js with compiled evaluation

Use typed/numeric groups when profiling shows meaningful evaluator load. Compile only
portable data, explicitly create and own the Wasm runtime, sample it from the chosen
transport/offline clock, then apply output arrays in a single renderer update. Retain a
JS reference path and compare large boundary/time sample sets. Dispose compiled handles,
geometry, materials, renderer and context in the owning lifecycle.

## Offline output

Create a fresh show instance, select a rational frame rate, sample exact frame indices,
apply all outputs, then capture. Keep random seeds and external resources deterministic.
For video, verify dimensions, duration, decoded frame count and representative decoded
pixels against fresh live renders at the same frame. Hashes establish artifact identity,
not visual parity.

## Handoff evidence

State which path was chosen and why, the actual package versions, keyboard/reduced-motion
results, lifecycle cleanup, exact frame coverage if relevant, and known browser/device
limits. Distinguish local source builds, registry publication and docs deployment.
