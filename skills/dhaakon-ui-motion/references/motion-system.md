# Dhaakon Motion system reference

Read this reference whenever a request includes movement, gestures, choreography,
Canvas/Three work or offline output. Confirm exports against the installed version.

## Execution paths

| Need | Author with | Owner |
| --- | --- | --- |
| Ordinary UI enter/exit/feedback | `cssMotion`, CSS variants, UI motion tokens | Web Animations or immediate final CSS |
| Reactive DOM values and gestures | existing React `motion`, hooks, gesture entry | JavaScript scheduler/input lifecycle |
| Coordinated multi-output show | `Tween`/`Track` → `Timeline` → `Transport` | one explicit clock authority |
| Exact-frame export | fresh nonplaying timeline/transport + offline helpers | caller-selected frame index |
| Dense portable numeric groups | `/compiled`, optional explicit Wasm runtime | JS reference or Rust/Wasm evaluator |
| Canvas/Three rendering | transport output adapters | application renderer; never Wasm by implication |

## CSS-native UI path

```tsx
import { tokens } from '@dhaakon/ui';
import { createCssMotionTokens } from '@dhaakon/motion/css';
import { CssMotionConfig, cssMotion, MotionConfig } from '@dhaakon/motion/react';

const uiMotion = createCssMotionTokens(tokens.motion);
const variants = {
  closed: { opacity: 0, transform: 'translateY(8px)' },
  open: { opacity: 1, transform: 'translateY(0px)' },
};

<MotionConfig reducedMotion="user">
  <CssMotionConfig tokens={uiMotion}>
    <cssMotion.div
      initial={false}
      animate={open ? 'open' : 'closed'}
      variants={variants}
      transition={open ? 'surface.enter' : 'surface.exit'}
    />
  </CssMotionConfig>
</MotionConfig>;
```

`initial={false}` renders the target without entry motion. An explicit initial target or
variant enables entry. Named variants are complete targets. The token adapter maps slow
to `surface.enter`, fast to `surface.exit`, and normal to `feedback`.

For a ref-forwarding UI component, create its wrapper once at module scope:

```ts
const MotionCard = createCssMotionComponent(Card);
```

The root ref must resolve to a stable HTMLElement. The CSS animator owns its declared
properties exclusively, samples computed values once when interrupted, publishes final
authored CSS, cancels the native fill effect, and restores original inline declarations
on disposal. Unsupported or rejected Web Animations applies final CSS immediately.

This first slice does not provide automatic presence, intrinsic-height/layout
measurement, spring-to-WAAPI compilation, transport seeking or SVG wrappers.

## Time and ownership

All engine time is milliseconds. Public authoring may use seconds, frames or SMPTE, but
frame-authored positions need an explicit/inherited `frameRate`. Loops are half-open
`[in, out)`; offline frame ranges are inclusive `[from, to]`. A 240-frame result exports
0–239.

One transport owns playback state, rate, looping and ordered output delivery. Values are
written before outputs draw. Do not let nested timelines create independent clocks.
Offline work should use a fresh, nonplaying source so a wall clock cannot race capture.

## Compiled Rust/Wasm boundary

The compiled API serializes supported numeric groups into versioned IR/binary data and
evaluates them with the JS reference or explicitly loaded Wasm runtime. Keep callbacks,
mutable live graphs and unsupported values on the existing path. Wasm does not render
DOM, SVG, Canvas or Three.js; output adapters still own that work. Do not auto-load it,
silently switch backends or claim superiority without measured workload evidence and
conformance tests.

Run the repository's focused tests and `npm run check:all`. After compiled/package work,
also run `npm run test:wasm` and `npm run test:packed-engine`.
