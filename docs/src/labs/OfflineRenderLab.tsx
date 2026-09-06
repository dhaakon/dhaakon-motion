import { useState } from 'react';
import { MotionValue, Timeline, Track, Transport, frames } from '@dhaakon/motion';
import { control } from '../components/Demo';

function makeOfflinePass() {
  const value = new MotionValue({ x: 0, energy: 0, exposure: 0.7 });
  const show = new Timeline({ name: 'offline-master' }).add(
    new Track({
      name: 'camera+shader',
      target: value,
      keyframes: [
        { at: '0f', value: { x: 0, energy: 0, exposure: 0.7 } },
        { at: '24f', value: { x: 100, energy: 1, exposure: 1.4 }, easing: 'dhaakon' },
        { at: '48f', value: { x: 12, energy: 0.25, exposure: 0.85 }, easing: 'easeInOutCubic' },
      ],
    }),
    0,
  );
  const transport = new Transport({ root: show, frameRate: 24, snap: true });
  const samples: string[] = [];
  for (const info of frames(transport, { to: '48f' })) {
    const v = value.get();
    samples.push(`${info.frame}:${v.x.toFixed(4)}:${v.energy.toFixed(4)}:${v.exposure.toFixed(4)}`);
  }
  transport.dispose();
  return samples;
}

function hashStrings(values: string[]) {
  let hash = 2166136261;
  for (const value of values)
    for (let i = 0; i < value.length; i += 1)
      hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function OfflineRenderLab() {
  const [result, setResult] = useState(() => {
    const a = makeOfflinePass();
    const b = makeOfflinePass();
    return { a, b, run: 1 };
  });
  const render = () => {
    const a = makeOfflinePass();
    const b = makeOfflinePass();
    setResult((old) => ({ a, b, run: old.run + 1 }));
  };
  const aHash = hashStrings(result.a);
  const bHash = hashStrings(result.b);
  const thumbs = [0, 8, 16, 24, 32, 40, 48].map((frame) => ({
    frame,
    x: Number(result.a[frame]?.split(':')[1] ?? 0),
  }));
  return (
    <div className="lab lab-offline">
      <div className="render-verdict">
        <span>EXPORT AUDIT / PASS {String(result.run).padStart(2, '0')}</span>
        <strong>{aHash === bHash ? 'STATE MATCH' : 'MISMATCH'}</strong>
        <small>2 × {result.a.length} frames</small>
      </div>
      <div className="filmstrip">
        {thumbs.map(({ frame, x }) => (
          <div key={frame}>
            <div className="film-frame">
              <i
                style={{
                  transform: `translateX(${Math.min(72, x * 0.72)}px) rotate(${x * 0.18}deg)`,
                }}
              />
            </div>
            <code>{String(frame).padStart(2, '0')}f</code>
          </div>
        ))}
      </div>
      <div className="hash-compare">
        <div>
          <small>PASS A · STATE SAMPLES</small>
          <code>fnv1a:{aHash}</code>
        </div>
        <i>=</i>
        <div>
          <small>PASS B · FRESH TIMELINE</small>
          <code>fnv1a:{bHash}</code>
        </div>
      </div>
      <div className="lab-controls">
        {control('Render twice + compare', render, true)}
        <span>No RAF · no wall clock · exact rational frame steps</span>
      </div>
    </div>
  );
}

export { OfflineRenderLab };
export const exampleCode = `import { MotionValue, Timeline, Track, frames } from '@dhaakon/motion';

const pass = () => {
  const x = new MotionValue(0);
  const show = new Timeline({ frameRate: 24 }).add(new Track({
    target: x, easing: 'linear',
    keyframes: [{ at: 0, value: 0 }, { at: '48f', value: 100 }]
  }));
  const samples: Array<[number, number]> = [];
  for (const info of frames(show, { to: '48f' })) {
    samples.push([info.frame, x.get()]);
  }
  show.rootTransport?.dispose();
  return samples;
};

// 49 inclusive state samples from fresh timelines, not pixel hashes.
console.log(JSON.stringify(pass()) === JSON.stringify(pass()));`;
