import { expect, test } from 'vitest';
import { Timeline, Track, Transport } from '@dhaakon/motion';
import { createTestScheduler } from '@dhaakon/motion/testing';

test.each([1, -1])('loop anchors do not replay historical laps at rate %s', (rate) => {
  const { driver, scheduler } = createTestScheduler();
  let laps = 0;
  const cues: number[] = [];
  const root = new Timeline().cue('middle', 100, () => cues.push(1));
  const transport = new Transport({ root, scheduler, duration: 200, loop: true, rate });
  transport.onLoop(() => { laps += 1; });
  if (rate < 0) transport.seek(190);
  cues.length = 0;
  transport.play();
  driver.step(250);
  expect(laps).toBe(1);
  expect(cues).toHaveLength(1);
  driver.step(260);
  expect(laps).toBe(1);
  expect(cues).toHaveLength(1);
  driver.step(650);
  expect(laps).toBe(3);
  expect(cues).toHaveLength(3);
  transport.dispose();
});

test('loop rebasing preserves sub-frame clock accumulation', () => {
  const { driver, scheduler } = createTestScheduler();
  const transport = new Transport({ scheduler, frameRate: 24, snap: true, duration: '24f', loop: true });
  transport.play();
  for (let time = 0; time <= 3125; time += 5) driver.step(time);
  expect(transport.frame).toBe(3);
  transport.dispose();
});

test.each([
  ['reverse', [80, 0, 80]],
  ['alternate', [20, 100, 80]],
  ['alternate-reverse', [80, 0, 20]],
] as const)('Track honors %s across repeats and repeat delay', (direction, expected) => {
  const values: number[] = [];
  const track = new Track({ direction, repeat: 1, repeatDelay: 20, easing: 'linear',
    keyframes: [{ at: 0, value: 0 }, { at: 100, value: 100 }], apply: (value) => values.push(value),
  });
  [20, 110, 140].forEach((time) => track.sampleAt(time));
  expect(values).toEqual(expected);
});

test('a callback canceled during a scheduler flush never runs after cleanup', () => {
  const { driver, scheduler } = createTestScheduler();
  const seen: string[] = [];
  scheduler.add(() => { seen.push('first'); cancel(); return false; });
  const cancel = scheduler.add(() => { seen.push('disposed'); });
  driver.step(16);
  expect(seen).toEqual(['first']);
  expect(scheduler.size).toBe(0);
});

test('timeline ownership rejects self and ancestor cycles without corrupting the tree', () => {
  const parent = new Timeline();
  const child = new Timeline();
  expect(() => parent.add(parent)).toThrow(/itself or an ancestor/);
  parent.add(child);
  expect(() => child.add(parent)).toThrow(/itself or an ancestor/);
  expect(parent.parent).toBeUndefined();
  expect(child.parent).toBe(parent);
});

test('a disposed playing transport can be reattached by a StrictMode setup', () => {
  const { driver, scheduler } = createTestScheduler();
  const transport = new Transport({ scheduler, duration: 1000 });
  transport.play();
  driver.step(10);
  transport.dispose();
  expect(scheduler.size).toBe(0);
  expect(transport.state).not.toBe('playing');
  transport.play();
  driver.step(20);
  expect(transport.time).toBe(20);
  transport.dispose();
});
