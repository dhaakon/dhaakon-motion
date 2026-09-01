import { test, expect } from 'vitest';
import { Timeline, Tween, Transport } from '@dhaakon/motion';
import { createTestScheduler } from '@dhaakon/motion/testing';

test('a cue fires forward and backward, carrying direction in the event', () => {
  const timeline = new Timeline();
  const fires: number[] = [];
  timeline.cue('mid', 50, (e) => fires.push(e.direction));
  timeline.sampleAt(0);
  timeline.sampleAt(60);
  timeline.sampleAt(40);
  expect(fires).toEqual([1, -1]);
});

test('scrubbing over several cues fires them in time order, both directions', () => {
  const timeline = new Timeline();
  const order: string[] = [];
  timeline.cue('a', 10, () => order.push('a'));
  timeline.cue('c', 90, () => order.push('c'));
  timeline.cue('b', 50, () => order.push('b'));
  timeline.sampleAt(0);
  timeline.sampleAt(100);
  expect(order).toEqual(['a', 'b', 'c']);
  order.length = 0;
  timeline.sampleAt(0);
  expect(order).toEqual(['c', 'b', 'a']);
});

test('a cue at time 0 fires on the very first render', () => {
  const timeline = new Timeline();
  let fired = false;
  timeline.cue('start', 0, () => { fired = true; });
  timeline.sampleAt(0);
  expect(fired).toBe(true);
});

test('a cue at the end of a repeating timeline fires exactly once per lap', () => {
  const timeline = new Timeline({ repeat: 2 }); // 3 total laps
  const fires: number[] = [];
  timeline.cue('end', 100, (e) => fires.push(e.time));
  timeline.add(new Tween({ from: 0, to: 1, duration: 100 }), 0);
  for (const t of [0, 100, 150, 200, 300]) timeline.sampleAt(t);
  expect(fires).toEqual([100, 100, 100]);
});

test('a once cue fires at most once, even across repeated scrubs', () => {
  const timeline = new Timeline();
  let count = 0;
  timeline.cue('mid', 50, () => { count += 1; }, { once: true });
  timeline.sampleAt(0);
  timeline.sampleAt(100);
  timeline.sampleAt(0);
  timeline.sampleAt(100);
  expect(count).toBe(1);
});

test('reset() re-arms a once cue', () => {
  const timeline = new Timeline();
  let count = 0;
  timeline.cue('mid', 50, () => { count += 1; }, { once: true });
  timeline.sampleAt(0);
  timeline.sampleAt(100);
  timeline.reset();
  timeline.sampleAt(0);
  timeline.sampleAt(100);
  expect(count).toBe(2);
});

test('a region fires onEnter/onExit correctly in both directions', () => {
  const timeline = new Timeline();
  const events: string[] = [];
  timeline.region('chorus', 20, 80, {
    onEnter: (e) => events.push(`enter:${e.direction}`),
    onExit: (e) => events.push(`exit:${e.direction}`),
  });
  timeline.sampleAt(0);
  timeline.sampleAt(50); // crosses 20 forward
  timeline.sampleAt(100); // crosses 80 forward
  timeline.sampleAt(50); // crosses 80 backward
  timeline.sampleAt(0); // crosses 20 backward
  expect(events).toEqual(['enter:1', 'exit:1', 'enter:-1', 'exit:-1']);
});

test('seek({cues: "skip"}) suppresses cues without losing crossing state', () => {
  const { scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: 100 });
  const fires: number[] = [];
  transport.root.cue('mid', 50, (e) => fires.push(e.time));

  transport.seek(60); // default: fires
  expect(fires).toEqual([50]);
  transport.seek(10, { cues: 'skip' }); // crosses 50 backward but must not fire
  expect(fires).toEqual([50]);
  transport.seek(60); // crosses 50 forward again for real — fires
  expect(fires).toEqual([50, 50]);
});

test('a cue handler that throws does not stop the tick or later cues', () => {
  const timeline = new Timeline();
  const seen: string[] = [];
  timeline.cue('boom', 10, () => { throw new Error('boom'); });
  timeline.cue('after', 20, () => seen.push('after'));
  const errors: unknown[] = [];
  const originalConsoleError = console.error;
  console.error = (err: unknown) => errors.push(err);
  try {
    timeline.sampleAt(0);
    timeline.sampleAt(30);
  } finally {
    console.error = originalConsoleError;
  }
  expect(seen).toEqual(['after']);
  expect(errors.length).toBe(1);
});
