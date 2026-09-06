import { useState } from 'react';
import { Button } from '@dhaakon/ui';
import { motion, useMotionValue, useMotionValueState } from '@dhaakon/motion/react';
import { Demo } from '../components/Demo';

function TweenPlayground() {
  const [run, setRun] = useState(0);
  return (
    <Demo
      title="Object tween"
      note="One tween interpolates transform, opacity, and color as a single value."
    >
      <div className="stage stage-grid">
        <motion.div
          key={run}
          className="motion-block"
          initial={{ x: 0, rotate: -8, scale: 0.8, opacity: 0.2, backgroundColor: '#2d62ff' }}
          animate={{ x: 230, rotate: 8, scale: 1, opacity: 1, backgroundColor: '#ff5a1f' }}
          transition={{ duration: 760, easing: 'dhaakon' }}
        >
          <span>01</span>
        </motion.div>
      </div>
      <Button variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}>
        Replay tween ↻
      </Button>
    </Demo>
  );
}

function EasingTracks() {
  const [run, setRun] = useState(0);
  const curves = ['linear', 'easeOutCubic', 'easeOutBack', 'dhaakon'] as const;
  return (
    <Demo title="Easing field" note="The house curve settles decisively without feeling abrupt.">
      <div className="easing-list" key={run}>
        {curves.map((name) => (
          <div className="ease-row" key={name}>
            <code>{name}</code>
            <div className="ease-track">
              <motion.i
                initial={{ x: 0 }}
                animate={{ x: 210 }}
                transition={{ duration: 900, easing: name }}
              />
            </div>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}>
        Run curves →
      </Button>
    </Demo>
  );
}

function MotionValueDemo() {
  const value = useMotionValue<number>(0);
  const current = useMotionValueState(value);
  const go = (target: number) => value.animate(target, { duration: 520, easing: 'dhaakon' });
  return (
    <Demo
      title="Motion values"
      note="An external store can drive canvas, WebGL, audio, or React without coupling the core to the DOM."
    >
      <div className="value-readout">
        <strong>{current.toFixed(1)}</strong>
        <div className="value-line">
          <i style={{ width: `${current}%` }} />
        </div>
      </div>
      <div className="button-row">
        <Button variant="outline" size="sm" onClick={() => go(0)}>
          Zero
        </Button>
        <Button variant="accent" size="sm" onClick={() => go(100)}>
          One hundred
        </Button>
      </div>
    </Demo>
  );
}

const tweenCode = `import { Tween, Easing } from '@dhaakon/motion';

new Tween({
  from: { x: 0, opacity: 0 },
  to: { x: 240, opacity: 1 },
  duration: 600,
  easing: Easing.dhaakon,
  onUpdate: value => render(value)
}).play();`;

export { TweenPlayground, EasingTracks, MotionValueDemo, tweenCode };
