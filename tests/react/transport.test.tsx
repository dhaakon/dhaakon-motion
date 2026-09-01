import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import {
  Transport, Sequence, Track, Tween, Cue, Marker, Region,
  useTransport, useCue, usePlayhead, useSceneState, useTransportState,
} from '@dhaakon/motion/react';
import { MotionValue, Transport as CoreTransport } from '@dhaakon/motion';
import { createTestScheduler } from '@dhaakon/motion/testing';

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

function Probe({ onTransport }: { onTransport: (t: CoreTransport) => void }) {
  const transport = useTransport();
  onTransport(transport);
  return null;
}

test('useTransport throws a helpful error outside <Transport>', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() => render(<Probe onTransport={() => {}} />)).toThrow(/useTransport\(\)/);
  spy.mockRestore();
});

test('<Transport> provides a transport instance, idle until autoplay/paused controls it', async () => {
  let seen: CoreTransport | null = null;
  render(<Transport><Probe onTransport={(t) => { seen = t; }} /></Transport>);
  expect(seen).not.toBeNull();
  expect(seen!.state).toBe('idle');
});

test('<Sequence> registers its children in declaration order, matching an imperative build', async () => {
  const { scheduler } = createTestScheduler();
  const transport = new CoreTransport({ scheduler });
  const a = new MotionValue<number>(0);
  const b = new MotionValue<number>(0);
  const c = new MotionValue<number>(0);

  render(
    <Transport transport={transport}>
      <Sequence name="show">
        <Tween target={a} from={0} to={1} duration={100} />
        <Tween target={b} from={0} to={1} duration={100} at=">" />
        <Tween target={c} from={0} to={1} duration={100} at=">" />
      </Sequence>
    </Transport>,
  );
  await flush();

  const show = transport.root.items[0];
  expect(show.item.name).toBe('show');
  const inspected = transport.root.inspect();
  const showNode = inspected.children[0];
  expect(showNode.children.map((child) => child.start)).toEqual([0, 100, 200]);
});

test('a rebuild after a prop change preserves the playhead', async () => {
  const { scheduler } = createTestScheduler();
  const transport = new CoreTransport({ scheduler, duration: 2000 }); // larger than any content, so seek(1200) below isn't clamped
  const a = new MotionValue<number>(0);

  function App({ duration }: { duration: number }) {
    return (
      <Transport transport={transport}>
        <Sequence name="show">
          <Tween target={a} from={0} to={1} duration={duration} />
        </Sequence>
      </Transport>
    );
  }

  const { rerender } = render(<App duration={100} />);
  await flush();
  transport.seek(1200);
  expect(transport.time).toBe(1200);

  rerender(<App duration={200} />); // changes the Tween's key, forcing a rebuild
  await flush();
  expect(transport.time).toBe(1200); // rebuild re-seeks to where the playhead was, not back to 0
});

test('unmounting a child removes it; unmounting the root detaches everything', async () => {
  const { scheduler } = createTestScheduler();
  const transport = new CoreTransport({ scheduler });
  const a = new MotionValue<number>(0);

  function App({ showChild }: { showChild: boolean }) {
    return (
      <Transport transport={transport}>
        <Sequence name="show">{showChild && <Tween target={a} from={0} to={1} duration={100} />}</Sequence>
      </Transport>
    );
  }

  const { rerender, unmount } = render(<App showChild />);
  await flush();
  expect(transport.root.inspect().children[0].children.length).toBe(1);

  rerender(<App showChild={false} />);
  await flush();
  expect(transport.root.inspect().children[0].children.length).toBe(0);

  unmount();
  await flush();
  expect(transport.root.items.length).toBe(0);
});

test('StrictMode double-invocation produces the same tree and fires cues once', async () => {
  const { driver, scheduler } = createTestScheduler();
  const transport = new CoreTransport({ scheduler });
  const a = new MotionValue<number>(0);
  const fires: string[] = [];

  render(
    <React.StrictMode>
      <Transport transport={transport}>
        <Sequence name="show">
          <Tween target={a} from={0} to={1} duration={100} />
          <Cue name="mid" at={50} onFire={() => fires.push('mid')} />
        </Sequence>
      </Transport>
    </React.StrictMode>,
  );
  await flush();

  const nonStrictScheduler = createTestScheduler();
  const nonStrictTransport = new CoreTransport({ scheduler: nonStrictScheduler.scheduler });
  const b = new MotionValue<number>(0);
  render(
    <Transport transport={nonStrictTransport}>
      <Sequence name="show">
        <Tween target={b} from={0} to={1} duration={100} />
        <Cue name="mid" at={50} onFire={() => {}} />
      </Sequence>
    </Transport>,
  );
  await flush();

  expect(transport.root.inspect()).toEqual(nonStrictTransport.root.inspect());

  transport.seek(0);
  transport.seek(60);
  expect(fires).toEqual(['mid']);
});

test('useCue fires exactly once when stepped across', async () => {
  const { driver, scheduler } = createTestScheduler();
  const transport = new CoreTransport({ scheduler, duration: 200 });
  const fires: number[] = [];

  function CueUser() {
    useCue(100, (e) => fires.push(e.time));
    return null;
  }
  render(<Transport transport={transport}><CueUser /></Transport>);
  await flush();

  transport.play();
  driver.step(50);
  expect(fires).toEqual([]);
  driver.step(150);
  expect(fires).toEqual([100]);
});

test('a controlled `paused` prop toggles play/pause reactively', async () => {
  const { driver, scheduler } = createTestScheduler();
  const transport = new CoreTransport({ scheduler, duration: 1000 });

  function App({ paused }: { paused: boolean }) {
    return <Transport transport={transport} paused={paused} />;
  }
  const { rerender } = render(<App paused={false} />);
  await flush();
  expect(transport.state).toBe('playing');

  rerender(<App paused />);
  await flush();
  expect(transport.state).toBe('paused');

  rerender(<App paused={false} />);
  await flush();
  expect(transport.state).toBe('playing');
});

test('usePlayhead updates at no more than `fps` React renders per second', async () => {
  const { driver, scheduler } = createTestScheduler();
  const transport = new CoreTransport({ scheduler, duration: 10_000 });
  let renders = 0;
  let wallNow = 0;
  const perfSpy = vi.spyOn(performance, 'now').mockImplementation(() => wallNow);

  function Readout() {
    usePlayhead({ fps: 10 }); // one update per 100ms of wall time, at most
    renders += 1;
    return null;
  }
  render(<Transport transport={transport}><Readout /></Transport>);
  await flush();
  renders = 0; // ignore mount renders

  act(() => { transport.play(); });
  // 60 ticks of 16ms transport time, and (since this test controls performance.now() directly) 16ms
  // of wall time each: 60 * 16ms = 960ms of wall time, throttled to at most 1 update per 100ms.
  act(() => {
    for (let i = 0; i < 60; i += 1) { wallNow += 16; driver.advance(16); }
  });
  expect(renders).toBeLessThanOrEqual(10);
  expect(renders).toBeGreaterThan(0);

  perfSpy.mockRestore();
});

test('useSceneState captures targets and writes them back via applyScene', () => {
  const x = new MotionValue<number>(0);
  let api: ReturnType<typeof useSceneState> | null = null;
  function App() {
    api = useSceneState({ x });
    return null;
  }
  render(<App />);
  expect(api![0]).toEqual({ x: 0 });
  act(() => { api![1]({ x: 42 }); });
  expect(x.get()).toBe(42);
});

test('<Track> writes interpolated keyframe values as the transport plays', async () => {
  const { driver, scheduler } = createTestScheduler();
  const transport = new CoreTransport({ scheduler, duration: 200 });
  const energy = new MotionValue<number>(0);

  render(
    <Transport transport={transport}>
      <Track target={energy} keyframes={[{ at: 0, value: 0 }, { at: 100, value: 10, easing: 'linear' }]} />
    </Transport>,
  );
  await flush();

  transport.play();
  driver.step(50);
  expect(energy.get()).toBeCloseTo(5, 6);
});

test('<Marker> and <Region> register into the tree and fire in both directions', async () => {
  const { scheduler } = createTestScheduler();
  const transport = new CoreTransport({ scheduler, duration: 200 });
  const events: string[] = [];

  render(
    <Transport transport={transport}>
      <Marker name="verse" at={20} />
      <Region name="chorus" from={50} to={150} onEnter={() => events.push('enter')} onExit={() => events.push('exit')} />
    </Transport>,
  );
  await flush();

  expect(transport.root.markers.map((m) => m.name)).toEqual(['verse']);
  transport.seek(0);
  transport.seek(100);
  transport.seek(200);
  expect(events).toEqual(['enter', 'exit']);
});

test('useTransportState updates only when state/rate/duration/frameRate actually change', async () => {
  const { driver, scheduler } = createTestScheduler();
  const transport = new CoreTransport({ scheduler, duration: 1000 });
  let renders = 0;
  const seenStates: string[] = [];

  function Readout() {
    const { state } = useTransportState();
    renders += 1;
    seenStates.push(state);
    return null;
  }
  render(<Transport transport={transport}><Readout /></Transport>);
  await flush();

  act(() => { transport.play(); }); // idle -> playing: a real change, must render
  const afterPlay = renders;
  expect(seenStates.at(-1)).toBe('playing');

  act(() => { driver.step(10); driver.step(20); driver.step(30); }); // ticks alone: no state/rate/duration change
  expect(renders).toBe(afterPlay);

  act(() => { transport.pause(); });
  expect(renders).toBe(afterPlay + 1);
  expect(seenStates.at(-1)).toBe('paused');
});
