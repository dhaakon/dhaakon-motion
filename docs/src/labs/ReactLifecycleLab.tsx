import { useState } from 'react';
import {
  Transport as ReactTransport,
  Sequence,
  Track as ReactTrack,
  Tween as ReactTween,
  Cue,
  Marker,
  Region,
  useMotionValue,
  usePlayhead,
  useTransport,
  useTransportState,
} from '@dhaakon/motion/react';
import { control } from '../components/Demo';

function LifecycleConsole({ onEvent }: { onEvent: (event: string) => void }) {
  const transport = useTransport();
  const playhead = usePlayhead({ fps: 12 });
  const state = useTransportState();
  return (
    <div className="lifecycle-console">
      <div>
        <small>REACT OWNER</small>
        <strong>{state.state.toUpperCase()}</strong>
        <code>{playhead.timecode}</code>
      </div>
      <div className="react-scene">
        <span style={{ transform: `translateX(${playhead.progress * 180}px)` }}>R</span>
      </div>
      <input
        aria-label="React transport position"
        type="range"
        min={0}
        max={1000}
        value={Math.round(playhead.progress * 1000)}
        onChange={(e) => transport.seek((Number(e.target.value) / 1000) * transport.duration)}
      />
      <div className="lab-controls">
        {control(state.state === 'playing' ? 'Pause' : 'Play', () => transport.toggle(), true)}
        {control('Unmount branch', () => onEvent('REQUEST / BRANCH TOGGLE'))}
        {control('Reverse', () => transport.reverse())}
      </div>
    </div>
  );
}

function ReactLifecycleLab() {
  const x = useMotionValue<number>(0);
  const opacity = useMotionValue<number>(0);
  const [mounted, setMounted] = useState(true);
  const [events, setEvents] = useState<string[]>(['MOUNT / TRANSPORT']);
  const log = (event: string) => setEvents((old) => [event, ...old].slice(0, 6));
  return (
    <div className="lab lab-react">
      <ReactTransport
        frameRate={24}
        loop={[0, '72f']}
        autoplay
        onStateChange={(state) => log(`STATE / ${state.toUpperCase()}`)}
      >
        <Marker name="TOP" at="0f" />
        <Cue
          name="TAKE"
          at="18f"
          onFire={(e) => log(`${e.direction > 0 ? 'FORWARD' : 'REVERSE'} / TAKE`)}
        />
        <Region
          name="PROGRAM"
          from="24f"
          to="60f"
          onEnter={() => log('ENTER / PROGRAM')}
          onExit={() => log('EXIT / PROGRAM')}
        />
        <Sequence name="graphics-package" at="6f">
          <ReactTween
            target={x}
            from={0}
            to={1}
            delay="6f"
            duration="30f"
            repeat={1}
            repeatDelay="4f"
            yoyo
          />
          {mounted && (
            <ReactTrack
              target={opacity}
              keyframes={[
                { at: '0f', value: 0 },
                { at: '12f', value: 1 },
                { at: '48f', value: 0.2 },
              ]}
            />
          )}
        </Sequence>
        <LifecycleConsole
          onEvent={() => {
            setMounted((value) => !value);
            log(mounted ? 'UNMOUNT / OPTIONAL TRACK' : 'MOUNT / OPTIONAL TRACK');
          }}
        />
      </ReactTransport>
      <div className="lifecycle-log">
        {events.map((event, i) => (
          <code key={`${event}-${i}`}>{event}</code>
        ))}
      </div>
      <div className="lifecycle-status">
        <span>strict-safe registration</span>
        <span>cleanup on unmount</span>
        <span>no 60fps React renders</span>
      </div>
    </div>
  );
}

export { ReactLifecycleLab };
export const exampleCode = `<Transport frameRate={24} loop autoplay outputs={outputs}>
  <Marker name="TOP" at="0f" />
  <Sequence name="graphics" at="6f" repeat={1} repeatDelay="4f" yoyo>
    <Tween target={position} from={0} to={1} delay="6f" duration="30f" />
    {mounted && <Track target={opacity} keyframes={fadeKeyframes} />}
    <Cue name="TAKE" at="18f" onFire={routeSwitcher} />
    <Region name="PROGRAM" from="24f" to="60f" onEnter={tallyOn} onExit={tallyOff} />
  </Sequence>
  <ControlSurface />
</Transport> // StrictMode-safe registration + deterministic cleanup`;
