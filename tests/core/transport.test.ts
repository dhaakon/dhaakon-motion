import { test, expect } from 'vitest';
import { Transport, frameRate, frameToMs, msToFrame } from '@dhaakon/motion';
import { createTestScheduler } from '@dhaakon/motion/testing';

test('play/pause/resume keeps the anchor correct', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: 1000 });
  transport.play();
  driver.step(100);
  expect(transport.time).toBe(100);

  transport.pause();
  driver.step(500); // no pending callback while paused: a no-op for the transport
  expect(transport.time).toBe(100);

  transport.play();
  driver.step(600);
  expect(transport.time).toBe(200);
});

test('rate doubles progress', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: 1000, rate: 2 });
  transport.play();
  driver.step(100);
  expect(transport.time).toBe(200);
});

test('a negative rate plays backward and finishes at 0', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: 1000, rate: -1 });
  transport.seek(1000);
  transport.play();
  driver.step(400);
  expect(transport.time).toBe(600);
  expect(transport.state).toBe('playing');
  driver.step(1000);
  expect(transport.time).toBe(0);
  expect(transport.state).toBe('finished');
});

test('a loop region wraps and carries the overshoot forward', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: 1000, loop: [0, 200] });
  let laps = 0;
  transport.onLoop(() => { laps += 1; });
  transport.play();
  driver.step(250);
  expect(transport.time).toBe(50);
  expect(laps).toBe(1);
  expect(transport.state).toBe('playing'); // a loop never finishes
});

test('finished resolves once the end is reached without a loop', async () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: 100 });
  transport.play();
  driver.step(150);
  expect(transport.state).toBe('finished');
  expect(transport.time).toBe(100);
  await expect(transport.finished).resolves.toBe(transport);
});

test('snap quantizes every rendered time to a frame boundary', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: 1000, snap: true, frameRate: 24 });
  const rate = frameRate(24);
  const seen: number[] = [];
  transport.subscribe((info) => seen.push(info.time));
  transport.play();
  for (const t of [10, 37, 100.5, 250.9, 400]) driver.step(t);
  expect(seen.length).toBeGreaterThan(0);
  for (const time of seen) expect(frameToMs(msToFrame(time, rate), rate)).toBeCloseTo(time, 6);
});

test('a custom clock, not the scheduler driver, is the time source', () => {
  let fakeNow = 0;
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, clock: { now: () => fakeNow }, duration: 1000 });
  transport.play();
  fakeNow = 300;
  driver.step(999999); // the scheduler's own time is irrelevant once a custom clock is set
  expect(transport.time).toBe(300);
});
