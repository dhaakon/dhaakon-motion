# @dhaakon/motion

The small tween engine behind the original `dhaak-anim`, repackaged for the Dhaakon network. It has no runtime dependencies, works in browser and Node environments, and keeps the familiar `Tween`, `Timeline`, `Line`, and `Easing` primitives.

```js
import { Tween, Easing } from '@dhaakon/motion';

new Tween({ duration: 500, curve: [0, 1], easing: Easing.easeOutCubic,
  onUpdate: (progress) => element.style.opacity = progress
}).play();
```

Install from the network registry with `@dhaakon:registry=http://dhaakon-ubuntu:21760/`.
