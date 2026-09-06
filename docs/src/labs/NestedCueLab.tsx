import { useEffect, useRef, useState } from 'react';
import { Timeline, Track, Transport, Tween } from '@dhaakon/motion';
import { control } from '../components/Demo';

function NestedCueLab() {
  const transportRef = useRef<Transport | null>(null);
  const [snapshot, setSnapshot] = useState({
    timecode: '00:00:00:00',
    progress: 0,
    event: 'STANDBY',
  });
  const [ascii, setAscii] = useState('');
  useEffect(() => {
    const log = (label: string) => (e: { direction: 1 | -1 }) =>
      setSnapshot((s) => ({
        ...s,
        event: `${e.direction > 0 ? 'FORWARD' : 'REVERSE'} / ${label}`,
      }));
    const titles = new Timeline({
      frameRate: 24,
      name: 'TITLES',
      repeat: 1,
      repeatDelay: '6f',
      yoyo: true,
    })
      .marker('TITLE-IN', 0)
      .cue('KEY', '12f', log('KEY TITLE'))
      .add(new Tween({ name: 'title-opacity', duration: '24f' }), 0);
    const cameras = new Timeline({ frameRate: 24, name: 'CAMERAS' })
      .region('CAM-2', '0f', '36f', { onEnter: log('CAM 2 LIVE'), onExit: log('CAM 2 OUT') })
      .add(
        new Track({
          name: 'dolly',
          keyframes: [
            { at: '0f', value: 0 },
            { at: '36f', value: 1 },
          ],
          apply: () => {},
        }),
        0,
      );
    const audio = new Timeline({ frameRate: 24, name: 'AUDIO' })
      .cue('STING', '8f', log('ROLL STING'))
      .add(new Tween({ name: 'gain-envelope', duration: '48f' }), 0);
    const act = new Timeline({ frameRate: 24, name: 'ACT 01' })
      .marker('ACT-01', 0)
      .add(titles, 0)
      .add(cameras, '12f')
      .add(audio, '24f');
    const master = new Timeline({ frameRate: 24, name: 'SHOW MASTER' })
      .marker('TOP', 0)
      .marker('BREAK', '00:00:03:00')
      .add(act, 0)
      .cue('BLACK', '00:00:03:00', log('BLACKOUT'));
    // The twelve-frame post-roll keeps BREAK seekable instead of mapping the
    // loop's half-open endpoint straight back to TOP.
    const transport = new Transport({ root: master, frameRate: 24, duration: '84f', loop: true });
    transportRef.current = transport;
    setAscii(master.toAscii({ width: 34 }));
    const off = transport.subscribe((info) =>
      setSnapshot((s) => ({ ...s, timecode: info.timecode, progress: transport.progress })),
    );
    transport.play();
    return () => {
      off();
      transport.dispose();
    };
  }, []);
  return (
    <div className="lab lab-nested">
      <div className="nested-head">
        <span>{snapshot.event}</span>
        <strong>{snapshot.timecode}</strong>
      </div>
      <div className="lane-stack">
        {[
          ['MASTER', 0, 100],
          ['ACT 01', 2, 84],
          ['TITLES', 3, 31],
          ['CAMERAS', 18, 38],
          ['AUDIO', 34, 50],
        ].map(([name, left, width], index) => (
          <div key={String(name)}>
            <code>{name}</code>
            <span>
              <i className={`lane-${index}`} style={{ left: `${left}%`, width: `${width}%` }} />
              <b style={{ left: `${snapshot.progress * 100}%` }} />
            </span>
          </div>
        ))}
      </div>
      <pre className="mini-ascii">{ascii}</pre>
      <div className="lab-controls">
        {control('Top', () => transportRef.current?.seek(0))}
        {control('Next marker', () => {
          const t = transportRef.current;
          const m = t?.root.nextMarker(t.time) ?? t?.root.markers[0];
          if (t && m) t.seek(m.time);
        })}
        {control('Reverse cues', () => transportRef.current?.reverse(), true)}
      </div>
    </div>
  );
}

export { NestedCueLab };
export const exampleCode = `import { Timeline, Transport, Tween } from '@dhaakon/motion';

const titles = new Timeline({ frameRate: 24, repeat: 1, yoyo: true })
  .add(new Tween({ from: 0, to: 1, duration: '24f' }), 0)
  .cue('KEY', '12f', event => console.log(event.direction));
const master = new Timeline({ frameRate: 24 })
  .marker('TOP', 0)
  .add(titles, 'TOP+=12f')
  .cue('BLACK', '72f', () => console.log('blackout'));
const transport = new Transport({ root: master, frameRate: 24 });
transport.play();
console.log(master.toAscii());
// Owner cleanup: transport.dispose();`;
