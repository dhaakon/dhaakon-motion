---
name: dhaakon-ui-motion
description: Build or revise React interfaces with @dhaakon/ui and @dhaakon/motion, including accessible components, shared tokens, CSS-native UI transitions, gestures, timelines, Canvas/Three outputs, and exact-frame motion graphics. Use for Dhaakon product UI, homelab tools, research interfaces, and motion studies; do not use for unrelated design systems.
---

# Dhaakon UI + Motion

Create interfaces that feel authored as one system: Dhaakon UI owns semantics,
components and visual tokens; Dhaakon Motion owns time, transition lifecycle and
renderer coordination. Preserve the user's product requirements and the host
application's architecture.

## Start with evidence

1. Find the consumer and both kit repositories. Read their `AGENTS.md` files and
   inspect the consumer's installed package versions and export maps. Source docs
   can be newer than the registry package; never invent an API from a live demo.
2. Inspect nearby screens and reuse their routing, state, data and test patterns.
3. Check the current component registry before building a substitute. Prefer a
   kit primitive or composite when it satisfies the interaction contract.
4. Keep audits read-only unless the user also asks for implementation. A request
   to build does not imply permission to publish, deploy, push or upgrade packages.

## Choose the layer deliberately

- `@dhaakon/ui`: accessible primitives and `DhaakonProvider`.
- `@dhaakon/ui/app`: application/research composites such as shells, data views,
  experiment controls and operational feedback.
- `@dhaakon/ui/site`: expressive editorial patterns derived from dhaakon.com.
- `@dhaakon/ui/tokens`: token data for code that cannot consume CSS custom properties.
- `@dhaakon/motion/css` + `/react` `cssMotion`: browser-owned CSS presentation
  transitions for ordinary interface state.
- Existing `@dhaakon/motion/react` `motion`, hooks and gesture APIs: reactive or
  input-driven motion whose values are application-controlled.
- `Timeline` + `Transport`: coordinated cues, frame stepping, seeking, outputs and
  exact offline sampling.
- `/compiled` with an explicitly created Rust/Wasm runtime: opt-in dense numeric
  evaluation for Canvas/Three workloads. It does not render and must not become an
  implicit backend.

Read [the UI system reference](references/ui-system.md) for component selection,
provider, styling or accessibility work. Read [the motion system reference](references/motion-system.md)
whenever motion is requested. Read [integration patterns](references/integration-patterns.md)
for CSS-native presence, gestures, production timelines, Canvas/Three, or offline output.

## Shared contracts

- Import `@dhaakon/ui/styles.css` once and place application UI under
  `DhaakonProvider`. Use semantic tokens and existing variants; raw palette values
  are exceptional illustration data, not interface styling.
- UI state owns meaning. Animation may delay visual removal, but it must not delay
  `aria-hidden`, `inert`, disabled state, focus return or other interaction semantics.
- Use real buttons, links, labels and React Aria-based kit controls. Preserve refs,
  native form behavior, accessible names, descriptions, errors and instance-safe IDs.
- Respect `MotionConfig reducedMotion="user"`. Reduced motion removes nonessential
  movement while retaining content, state changes and usable controls.
- One system owns each animated property. Do not stack `cssMotion`, CSS transitions
  and another animation library on the same declarations.
- CSS values remain CSS at the UI surface. Do not pre-encode authoring into matrices.
  The browser may internally compose transforms; that is an execution detail.
- Canvas, SVG, Three.js, audio and hardware outputs retain explicit resource owners.
  Dispose animations, transports, listeners, observers, renderers and contexts on
  unmount, including React StrictMode setup-cleanup-setup.
- Keep claims measurable. Browser-owned animation is not a universal GPU guarantee;
  Wasm evaluation is not rendering; a state hash is not pixel parity.

## Finish proportionally

Exercise the changed interaction with keyboard and reduced motion. Run the consumer's
focused tests plus its documented package/docs/browser gates. For production motion,
verify exact frame boundaries and cleanup; for offline visuals, compare decoded pixels
or frames rather than only JSON/state hashes. Report what passed, what was not tested,
the package versions actually used, and whether anything was published or deployed.
