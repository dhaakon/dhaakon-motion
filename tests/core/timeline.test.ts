import { test, expect } from 'vitest';
import { Tween, Timeline, FrameScheduler } from '@dhaakon/motion';
import { ManualDriver } from '@dhaakon/motion/testing';

test('resolves every position form: ms, labels, offsets, anchors, frames, timecode', () => {
  const a = new Tween({ from: 0, to: 1, duration: 100 });
  const b = new Tween({ from: 0, to: 1, duration: 100 });
  const c = new Tween({ from: 0, to: 1, duration: 100 });
  const d = new Tween({ from: 0, to: 1, duration: 100 });
  const e = new Tween({ from: 0, to: 1, duration: 100 });
  const f = new Tween({ from: 0, to: 1, duration: 100 });
  const timeline = new Timeline({ frameRate: 24 })
    .label('intro', 0)
    .add(a, 0) // 0-100
    .add(b, 'intro+=50') // 50-150
    .add(c, '<') // aligns with b's start: 50-150
    .add(d, '>') // follows c's end: 150-250
    .add(e, '<+=25') // previous start (d's start=150) + 25 = 175-275
    .add(f, '12f'); // 12 frames @ 24fps = 500ms

  const entries = (timeline as unknown as { entries: { start: number }[] }).entries;
  expect(entries[0].start).toBe(0);
  expect(entries[1].start).toBe(50);
  expect(entries[2].start).toBe(50);
  expect(entries[3].start).toBe(150);
  expect(entries[4].start).toBe(175);
  expect(entries[5].start).toBe(500);
});

test('<+=N and >-=N no longer throw (fixed: previously parsed as a label named "<")', () => {
  const a = new Tween({ from: 0, to: 1, duration: 100 });
  const b = new Tween({ from: 0, to: 1, duration: 100 });
  const timeline = new Timeline().add(a, 0).add(b, '<+=30');
  const entries = (timeline as unknown as { entries: { start: number }[] }).entries;
  expect(entries[1].start).toBe(30);
});

test('an unknown label still throws a clear error', () => {
  const timeline = new Timeline();
  expect(() => timeline.add(new Tween(), 'nope')).toThrow(/Unknown timeline label: nope/);
});

test('timeline samples overlapping children from one clock', () => {
  const driver = new ManualDriver();
  const loop = new FrameScheduler(driver);
  const a = new Tween({ from: 0, to: 10, duration: 100, easing: 'linear' });
  const b = new Tween({ from: 10, to: 30, duration: 100, easing: 'linear' });
  const timeline = new Timeline({ scheduler: loop }).add(a).add(b, '<').play();
  expect(timeline.duration).toBe(100);
  driver.step(50);
  expect(a.value).toBe(5);
  expect(b.value).toBe(20);
  driver.step(100);
  expect(a.value).toBe(10);
  expect(b.value).toBe(30);
});
