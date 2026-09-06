# CSS-native UI motion

Status: v0.8.0 Git/docs release, developed on `feat/css-native-ui-motion`.
The feature page is `/css-ui`. Registry publication is separate from docs deployment.
Rust/Wasm remains opt-in and experimental; this release does not promote its backend.

## Execution boundary

| Workload | API | Execution owner |
| --- | --- | --- |
| UI state transitions, authored CSS values | `cssMotion`, `/css` | Browser Web Animations; immediate final CSS when unavailable |
| Existing tweens, gestures, frame-controlled compositions and offline output | `motion`, `Tween`, `Transport` | Existing JavaScript engine and output adapters |
| Opt-in dense numeric graphics evaluation | `/compiled` and explicit Wasm runtime | JS reference or Rust/Wasm evaluator; Canvas/Three still render |

CSS is a first-class authoring format, not an intermediate matrix encoding. The
UI layer owns semantics, state, focus and presence. Browser-owned playback avoids
an application per-frame loop for these transitions, but is not a guarantee of
GPU acceleration: property choice, paint, layout and browser decisions still matter.
These are explicit execution paths, not three interchangeable renderers.

## React with Dhaakon UI

```tsx
import { Card, tokens } from '@dhaakon/ui';
import { createCssMotionTokens } from '@dhaakon/motion/css';
import { CssMotionConfig, cssMotion, MotionConfig } from '@dhaakon/motion/react';

const uiMotion = createCssMotionTokens(tokens.motion);
const variants = {
  closed: { opacity: 0, transform: 'translateY(8px)' },
  open: { opacity: 1, transform: 'translateY(0px)' },
};

function Surface({ open }: { open: boolean }) {
  return (
    <MotionConfig reducedMotion="user">
      <CssMotionConfig tokens={uiMotion}>
        <cssMotion.div
          initial={false}
          animate={open ? 'open' : 'closed'}
          variants={variants}
          transition={open ? 'surface.enter' : 'surface.exit'}
        >
          <Card>Research session</Card>
        </cssMotion.div>
      </CssMotionConfig>
    </MotionConfig>
  );
}
```

This example animates presentation only; use the lab for full disclosure semantics.
The token adapter accepts the existing `@dhaakon/ui` `tokens.motion` object, with
no UI runtime dependency in the library. `durationSlow` maps to `surface.enter`,
`durationFast` to `surface.exit`, and `duration` to `feedback`; `ease` is shared.
Token durations accept CSS `ms` and `s`; playback durations/delays are milliseconds.
Named variants are complete targets, not patches against the previous variant.

`cssMotion` includes div, section, article, span and button. For an existing
ref-forwarding component, declare `createCssMotionComponent(Card)` at module scope.
The component must forward a stable HTMLElement ref. Native element props/ref
are preserved. SVG elements and changing root element types are outside this slice.

`initial={false}` or omitted `initial` renders the initial target without entry
animation. An explicit initial target/variant enables entry animation. Existing
`MotionConfig` reduced-motion policy is shared; `CssMotionConfig` supplies only CSS
tokens. Existing numeric `motion` behavior and transition types remain unchanged.

## Ownership and interruption

- `/css` exports `createCssAnimator(element)` for framework-independent use. It
  exposes `set`, `animate` and terminal, idempotent `dispose`.
- One animator owns an element. Targets accept CSS strings or unitless numbers;
  dimensional values need explicit units. Camel-case, kebab-case and custom
  properties are supported according to the browser's CSS parser. Interpolation
  support is the browser's decision; unregistered custom properties may be discrete.
- Animation/transition declarations and `all` cannot be owned. Do not combine
  shorthand/longhand ownership or independently mutate the same properties through
  React style updates, CSS transitions, `!important` rules or another animation library.
- Retargeting reads the current computed values once, cancels the old native effect
  and starts from that visual state. There is no per-frame style read or React render.
- Native completion writes final authored CSS and cancels the fill effect. Removed
  target properties and disposal restore the original inline declarations. Public
  cancellation freezes current computed values; disposal restores originals.
- `playback.finished` resolves with `status`, `backend` and an optional fallback
  `reason`. Superseded playback resolves cancelled, never rejects. React callbacks
  from superseded renders are invalidated; callback identity changes do not restart motion.
- Reduced motion settles immediately, including delayed or already-running motion.
  Unsupported/rejected Web Animations applies final CSS and reports `instant`.
  External cancellation also settles to the final target rather than leaving UI waiting.
- No browser globals, Wasm initialization or animation work occurs on package import.
  SSR emits initial CSS; explicitly forced reduced motion emits the final target.

## Accessible disclosure lab

`docs/src/labs/CssUiLab.tsx` uses actual Dhaakon UI Button/Card/Badge primitives.
The native trigger retains keyboard behavior and instance-safe `aria-controls`.
Closing returns focus when needed and makes the panel inert/aria-hidden immediately.
The panel remains rendered through exit, then becomes hidden on current completion.
Reopening invalidates stale completion; form state survives closing and reopening.
Reduced motion, slow playback, backend reporting and unmount/remount are visible controls.

This is not an automatic presence manager, dialog implementation, intrinsic-height
animation, layout measurement engine, spring compiler, CSS timeline scrubber or
offline CSS exporter. Opening changes layout immediately; closing removes its
space after exit. The existing Transport path remains appropriate for exact-frame
graphics, cue sheets and export. No performance superiority claim is made.

## Verification and change map

- `src/css.ts`: native effect ownership and UI token adaptation.
- `src/react-css.tsx`: CSS component lifecycle, variants and token context.
- `src/react-config.tsx`: existing shared MotionConfig/reduced-motion policy.
- `tests/react/css-motion.test.tsx`: deterministic ownership and accessible UI regressions.
- `docs/scripts/verify-css-ui.mjs`: actual Chrome playback, interrupted computed
  values, keyboard/focus, reduced-motion changes, fallback, cleanup and screenshots.
- `scripts/test-packed-engine.mjs`: isolated ESM/CJS package export resolution and
  React SSR, with fetch/Wasm initialization forbidden during import and SSR.

Run `npm run check:all` and `npm run test:packed-engine`. Browser results and desktop/
mobile screenshots are written under ignored `test-results/`. Chrome verification
does not certify Safari/Firefox, hydration, every CSS property, or GPU compositing.
Import `/css` canonically from the React adapter; bundling a private copy would
split the element-owner registry. Keep root core and `/compiled` independent of CSS.
