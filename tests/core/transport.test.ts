import { test, expect } from 'vitest';
import { Timeline, Transport, Tween, frameRate, frameToMs, msToFrame } from '@dhaakon/motion';
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

test('seek accepts a finite time when the root duration is infinite', () => {
  const value = new Tween({ from: 0, to: 100, duration: 100, easing: 'linear' });
  const root = new Timeline({ repeat: Infinity }).add(value, 0);
  const transport = new Transport({ root });
  expect(transport.duration).toBe(Infinity);
  transport.seek(75);
  expect(transport.time).toBe(75); expect(value.value).toBe(75);
});

test('seek still clamps positive infinity to a finite transport end', () => {
  const transport = new Transport({ duration: 100 });
  transport.seek(Infinity);
  expect(transport.time).toBe(100);
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

test('a reverse loop wraps below its lower bound and carries the overshoot backward', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: 1000, loop: [0, 200], rate: -1 });
  let laps = 0;
  transport.onLoop(() => { laps += 1; });
  transport.play();
  driver.step(50);
  expect(transport.time).toBe(150);
  expect(laps).toBe(1);
  expect(transport.state).toBe('playing');
});

test('a forward loop is half-open and never emits its upper-bound frame', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: '144f', frameRate: 24, snap: true, loop: ['0f', '144f'] });
  const frames: number[] = [];
  transport.subscribe((info) => frames.push(info.frame));
  transport.play();
  driver.step(6000); // exactly 144f: wraps to the first frame of the next lap
  expect(transport.frame).toBe(0);
  expect(frames).toEqual([0]);
  transport.seekFrame(143);
  transport.step(1);
  expect(transport.frame).toBe(0);
  expect(frames).not.toContain(144);
});

test('many realtime loop ticks emit exactly once and stay within frames 0 through 143', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: '144f', frameRate: 24, snap: true, loop: ['0f', '144f'] });
  const seen: number[] = [];
  transport.subscribe((info) => seen.push(info.frame));
  transport.play();
  for (let index = 0; index < 1000; index += 1) driver.advance(17);
  expect(seen).toHaveLength(1000);
  expect(Math.min(...seen)).toBeGreaterThanOrEqual(0);
  expect(Math.max(...seen)).toBeLessThanOrEqual(143);
  expect(seen).not.toContain(144);
});

test('stepping onto a loop upper bound carries its cue forward without backward misfires', () => {
  const { scheduler: loop } = createTestScheduler();
  const directions: number[] = [];
  const timeline = new Timeline().add(new Tween({ duration: 6000 }), 0)
    .cue('middle', 3000, (event) => directions.push(event.direction))
    .cue('OUT', 6000, (event) => directions.push(event.direction));
  const transport = new Transport({ scheduler: loop, root: timeline, frameRate: 24, loop: ['0f', '144f'] });
  const emitted: Array<{ frame: number; cues: string[] }> = [];
  transport.subscribe((info) => emitted.push({ frame: info.frame, cues: (info.cues ?? []).map((cue) => cue.name) }));
  transport.seek('143f', { cues: 'skip' });
  emitted.length = 0;
  directions.length = 0;
  transport.step(1);
  expect(emitted).toEqual([{ frame: 0, cues: ['OUT'] }]);
  expect(directions).toEqual([1]);
});

test('an end cue is carried onto the wrapped tick without emitting the upper bound', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const timeline = new Timeline().add(new Tween({ duration: 6000 }), 0);
  timeline.cue('OUT', 6000, () => {});
  const transport = new Transport({ scheduler: loop, root: timeline, frameRate: 24, loop: [0, 6000] });
  const ticks: Array<{ frame: number; cues: string[] }> = [];
  transport.subscribe((info) => ticks.push({ frame: info.frame, cues: (info.cues ?? []).map((cue) => cue.name) }));
  transport.play();
  driver.step(6000);
  expect(ticks).toEqual([{ frame: 0, cues: ['OUT'] }]);
});

test('a loop rebase does not misfire forward cues as backward crossings', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const directions: number[] = [];
  const timeline = new Timeline().add(new Tween({ duration: 200 }), 0).cue('mid', 50, (event) => directions.push(event.direction));
  const transport = new Transport({ scheduler: loop, root: timeline, loop: [0, 200] });
  transport.play();
  driver.step(60);
  driver.step(250);
  expect(directions).toEqual([1, 1]);
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

test('chase() converges rate to a clock running 2% fast, without hard-seeking', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: 1_000_000 });
  transport.play();
  let externalMs = 0;
  const stepMs = 10;
  for (let i = 0; i < 2000; i += 1) {
    driver.advance(stepMs);
    externalMs += stepMs * 1.02;
    transport.chase(externalMs);
  }
  expect(transport.rate).toBeCloseTo(1.02, 1);
  expect(Math.abs(transport.time - externalMs)).toBeLessThan(40); // stayed under the hard-seek threshold throughout
});

test('chase() hard-seeks once on a large jump, then resumes at rate 1', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: 1_000_000 });
  transport.play();
  driver.advance(100);
  transport.chase(600); // 500ms away from time(100): exceeds the default 40ms threshold
  expect(transport.time).toBe(600);
  expect(transport.rate).toBe(1);
});
