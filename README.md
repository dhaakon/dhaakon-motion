# @dhaakon/motion

The original `dhaak-anim` tween vocabulary, rebuilt as the motion layer for the Dhaakon network. The core is dependency-free and framework-agnostic; React support is a separate, optional entry point.

Documentation and live playground: **http://dhaakon-ubuntu:21764**

## Install

Configure the network registry once:

```ini
@dhaakon:registry=http://dhaakon-ubuntu:21760/
```

```sh
npm install @dhaakon/motion
```

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

Positions can be absolute milliseconds, labels, relative label offsets, `<` (align with the previous start), or `>` (follow the previous end). A timeline samples children from its own clock, making overlaps, pause, seek, and reverse deterministic.

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
- `useTimeline` — lifecycle-safe timeline composition
- `MotionConfig` / `useReducedMotion` — shared transitions and accessible motion policy

React 18 and 19 are optional peer dependencies. Importing the core never loads React.

```tsx
<Reveal as="section" from={{ y: 36, opacity: 0 }} amount={0.2} once>
  <CourseModule />
</Reveal>
```

Reveal observers disconnect after the first entrance by default, and resolve immediately when reduced motion is requested. Use `once={false}` when a composition should respond each time it crosses the viewport.

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

```sh
npm test
npm run docs:dev       # http://localhost:5175
npm run docs:build
```

The documentation site imports the package source directly and uses `@dhaakon/ui`. Its network container is `dhaakon-motion-docs` in the `dhaakon-network` Compose stack.
