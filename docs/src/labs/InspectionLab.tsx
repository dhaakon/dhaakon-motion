import { useMemo, useState } from 'react';
import { Timeline, Tween } from '@dhaakon/motion';
import { expectSample, snapshotTimeline } from '@dhaakon/motion/testing';
import { control } from '../components/Demo';

function makeInspectionTimeline() {
  return new Timeline({ name: 'inspection-master', frameRate: 24 })
    .marker('TOP', 0)
    .marker('TAKE', '24f')
    .add(new Tween({ name: 'camera.x', from: 0, to: 100, duration: '48f', easing: 'linear' }), 0)
    .add(
      new Timeline({ name: 'graphics' }).add(
        new Tween({ name: 'lower.opacity', from: 0, to: 1, duration: '12f', easing: 'linear' }),
        0,
      ),
      '12f',
    );
}

function InspectionLab() {
  const [frame, setFrame] = useState(24);
  const [fault, setFault] = useState(false);
  const audit = useMemo(() => {
    const timeline = makeInspectionTimeline();
    const snapshot = snapshotTimeline(timeline, ['0f', '12f', '24f', '48f']);
    let assertion = 'PASS · camera.x @ 24f = 50';
    try {
      expectSample(timeline, '24f', { 'camera.x': fault ? 49 : 50 });
    } catch (err) {
      assertion = (err as Error).message;
    }
    timeline.sampleAt((frame * 1000) / 24);
    return { snapshot, assertion };
  }, [frame, fault]);
  const failed = audit.assertion.startsWith('expectSample');
  return (
    <div className="lab lab-inspect">
      <div className="inspect-toolbar">
        <span>FRAME-ACCURATE INSPECTOR</span>
        <code>{String(frame).padStart(4, '0')}f</code>
        <b className={failed ? 'fail' : ''}>{failed ? 'FAIL' : 'PASS'}</b>
      </div>
      <div className="inspect-grid">
        <div>
          <div className="inspect-ruler">
            {[0, 12, 24, 36, 48].map((n) => (
              <i key={n} style={{ left: `${(n / 48) * 100}%` }}>
                {n}
              </i>
            ))}
          </div>
          {audit.snapshot.inspect.children.map((node, index) => (
            <div className="inspect-lane" key={node.name}>
              <code>{node.name}</code>
              <span>
                <i
                  style={{
                    left: `${(node.start / 2000) * 100}%`,
                    width: `${(node.duration / 2000) * 100}%`,
                  }}
                />
                <b style={{ left: `${(frame / 48) * 100}%` }} />
              </span>
              {index === 1 &&
                node.children.map((child) => <small key={child.name}>{child.name}</small>)}
            </div>
          ))}
        </div>
        <pre>{failed ? audit.assertion : JSON.stringify(audit.snapshot.samples, null, 2)}</pre>
      </div>
      <input
        aria-label="Inspection frame"
        type="range"
        min={0}
        max={48}
        value={frame}
        onChange={(e) => setFrame(Number(e.target.value))}
      />
      <div className="lab-controls">
        {control('Step −1f', () => setFrame((f) => Math.max(0, f - 1)))}
        {control('Step +1f', () => setFrame((f) => Math.min(48, f + 1)))}
        {control(
          fault ? 'Restore assertion' : 'Inject regression',
          () => setFault((v) => !v),
          fault,
        )}
      </div>
    </div>
  );
}

export { InspectionLab };
export const exampleCode = `const { driver, scheduler } = createTestScheduler();
const transport = new Transport({ root: show, frameRate: 24, scheduler });
const trace = transport.trace({ capacity: 240 });

transport.play();
stepFrames(driver, 24, 24);
expectSample(show, '24f', { 'camera.x': 50, 'lower.opacity': 1 });
expect(snapshotTimeline(show, ['0f','12f','24f','48f']))
  .toMatchSnapshot();

// Failure output includes exact values plus the entire ASCII timeline.
console.log(trace.toText(), show.inspect(), show.toAscii());`;
