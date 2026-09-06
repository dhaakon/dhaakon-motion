import { useEffect, useRef, useState } from 'react';
import { Timeline, Transport, Tween } from '@dhaakon/motion';
import { control } from '../components/Demo';

function TimecodeConformLab() {
  const transportRef = useRef<Transport | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const lowerRef = useRef<HTMLDivElement | null>(null);
  const [head, setHead] = useState({ timecode: '00:00:00;00', frame: 0, state: 'idle', rate: 1 });
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    const show = new Timeline({ name: '29.97 DF master', frameRate: '29.97df' })
      .marker('PRE-ROLL', 0, { color: '#2d62ff' })
      .marker('PROGRAM', '00:00:01;00', { color: '#ff5a1f' })
      .marker('OUT', '00:00:03;15', { color: '#d9ff43' });
    const opener = new Timeline({ name: 'opener', frameRate: '29.97df' })
      .add(
        new Tween({
          name: 'hero',
          from: { x: -90, opacity: 0 },
          to: { x: 0, opacity: 1 },
          delay: '6f',
          duration: '24f',
          easing: 'dhaakon',
          onUpdate: ({ x, opacity }) => {
            if (heroRef.current) {
              heroRef.current.style.transform = `translateX(${x}px)`;
              heroRef.current.style.opacity = String(opacity);
            }
          },
        }),
        0,
      )
      .add(
        new Tween({
          name: 'lower',
          from: { y: 32, opacity: 0 },
          to: { y: 0, opacity: 1 },
          duration: '00:00:00;18',
          repeat: 1,
          repeatDelay: '6f',
          yoyo: true,
          onUpdate: ({ y, opacity }) => {
            if (lowerRef.current) {
              lowerRef.current.style.transform = `translateY(${y}px)`;
              lowerRef.current.style.opacity = String(opacity);
            }
          },
        }),
        '00:00:01;00',
      );
    show
      .add(opener, 0)
      .cue('TAKE', '00:00:01;00', (e) =>
        setEvents((old) =>
          [`${e.direction > 0 ? 'FWD' : 'REV'} · TAKE · ${e.frame?.timecode ?? '—'}`, ...old].slice(
            0,
            4,
          ),
        ),
      )
      .cue('ROLL', '00:00:02;12', (e) =>
        setEvents((old) =>
          [`${e.direction > 0 ? 'FWD' : 'REV'} · ROLL · ${e.frame?.timecode ?? '—'}`, ...old].slice(
            0,
            4,
          ),
        ),
      );
    // Leave a short post-roll after OUT so the end marker remains seekable in a loop.
    const transport = new Transport({
      root: show,
      frameRate: '29.97df',
      snap: true,
      duration: '00:00:04;00',
      loop: true,
    });
    transportRef.current = transport;
    let last = -1;
    const unsubscribe = transport.subscribe((info) => {
      if (info.frame !== last) {
        last = info.frame;
        setHead({
          timecode: info.timecode,
          frame: info.frame,
          state: transport.state,
          rate: transport.rate,
        });
      }
    });
    transport.play();
    return () => {
      unsubscribe();
      transport.dispose();
    };
  }, []);

  const jump = (marker: string) => {
    const t = transportRef.current;
    const found = t?.root.markers.find((m) => m.name === marker);
    if (t && found) t.seek(found.time);
  };
  return (
    <div className="lab lab-timecode">
      <div className="lab-console-head">
        <span>MASTER · 29.97 DF · FRAME LOCK</span>
        <strong>{head.timecode}</strong>
        <small>F {head.frame.toString().padStart(5, '0')}</small>
      </div>
      <div className="tc-stage">
        <div className="tc-safe" />
        <div ref={heroRef} className="tc-hero">
          <small>SCORSESE CENTER / STAGE A</small>
          <b>
            VIRTUAL
            <br />
            PRODUCTION
          </b>
        </div>
        <div ref={lowerRef} className="tc-lower">
          CAM 02 <i /> PROGRAM
        </div>
      </div>
      <div className="marker-strip">
        {[
          ['PRE-ROLL', 3],
          ['PROGRAM', 28],
          ['OUT', 88],
        ].map(([name, left]) => (
          <button key={name} style={{ left: `${left}%` }} onClick={() => jump(String(name))}>
            <i />
            {name}
          </button>
        ))}
      </div>
      <div className="lab-controls">
        {control('− 1 frame', () => transportRef.current?.step(-1))}
        {control(
          head.state === 'playing' ? 'Pause' : 'Play',
          () => {
            const t = transportRef.current;
            t?.toggle();
            if (t) setHead((h) => ({ ...h, state: t.state }));
          },
          true,
        )}
        {control('+ 1 frame', () => transportRef.current?.step(1))}
        {control(head.rate < 0 ? 'Forward' : 'Reverse', () => {
          const t = transportRef.current;
          t?.reverse();
          if (t) setHead((h) => ({ ...h, rate: t.rate }));
        })}
      </div>
      <div className="event-log">
        {events.length ? (
          events.map((event, index) => <code key={`${event}-${index}`}>{event}</code>)
        ) : (
          <code>waiting for cue crossings…</code>
        )}
      </div>
    </div>
  );
}

export { TimecodeConformLab };
export const exampleCode = `const master = new Timeline({ name: 'show', frameRate: '29.97df' })
  .marker('PROGRAM', '00:00:01;00')
  .add(new Tween({
    delay: '6f', duration: '00:00:00;24',
    repeat: 1, repeatDelay: '6f', yoyo: true
  }), 0)
  .cue('TAKE', '00:00:01;00', takeCamera);

// Tween timing inherits this rational timebase. No frameToMs().
const transport = new Transport({
  root: master, frameRate: '29.97df', snap: true
});
transport.seek('01:00:00;00');
transport.step(-1);`;
