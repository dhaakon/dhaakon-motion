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

function buildRepeatingChild() {
  const a = new Tween({ from: 0, to: 10, duration: 100, easing: 'linear' });
  const b = new Tween({ from: 100, to: 200, duration: 60, easing: 'linear' });
  const timeline = new Timeline({ repeat: 1, yoyo: true }).add(a, 0).add(b, 40);
  return { timeline, a, b };
}

test('a nested timeline samples equivalently to sampling it directly at (t - start)', () => {
  const standalone = buildRepeatingChild();
  const nested = buildRepeatingChild();
  const parent = new Timeline();
  parent.label('intro', 50);
  parent.add(nested.timeline, 'intro');

  const span = 50 + nested.timeline.totalDuration + 20;
  for (let t = 0; t <= span; t += 3) {
    parent.sampleAt(t);
    standalone.timeline.sampleAt(Math.max(0, t - 50));
    expect(nested.a.value).toBeCloseTo(standalone.a.value as number, 6);
    expect(nested.b.value).toBeCloseTo(standalone.b.value as number, 6);
  }
});

test('a yoyo timeline reverses its children continuously on the alternate lap', () => {
  const child = new Tween({ from: 0, to: 100, duration: 100, easing: 'linear' });
  let completions = 0;
  const timeline = new Timeline({ repeat: 1, repeatDelay: 20, yoyo: true, onComplete: () => { completions += 1; } }).add(child, 0);

  const samples = [0, 25, 99, 100, 110, 119, 120, 121, 145, 219, 220].map((time) => {
    timeline.sampleAt(time);
    return child.value;
  });

  expect(samples).toEqual([0, 25, 99, 100, 100, 100, 100, 99, 75, 1, 0]);
  expect(completions).toBe(1);
});

test('a timeline with an infinite child keeps finite sample times', () => {
  const child = new Tween({ from: 0, to: 100, duration: 100, repeat: Infinity, easing: 'linear' });
  const timeline = new Timeline({ yoyo: true }).add(child, 0);

  expect(timeline.sampleAt(75)).toBe(75);
  expect(child.value).toBe(75);
});

test('three levels of nesting sample equivalently to sampling the leaf directly', () => {
  const leafStandalone = new Tween({ from: 0, to: 1, duration: 100, easing: 'linear' });
  const leafNested = new Tween({ from: 0, to: 1, duration: 100, easing: 'linear' });

  const grandchild = new Timeline().add(leafNested, 0);
  const child = new Timeline().label('inner', 30).add(grandchild, 'inner');
  const root = new Timeline().label('outer', 20).add(child, 'outer');

  for (let t = 0; t <= 20 + 30 + 100 + 10; t += 4) {
    root.sampleAt(t);
    leafStandalone.sampleAt(Math.max(0, t - 20 - 30));
    expect(leafNested.value).toBeCloseTo(leafStandalone.value as number, 6);
  }
});

test('a nested timeline without its own frameRate inherits the parent\'s at attach time', () => {
  const parent = new Timeline({ frameRate: 24 });
  const child = new Timeline();
  parent.add(child, 0);
  expect(child.frameRate).toEqual(parent.frameRate);
});

test('a nested timeline keeps its own explicit frameRate', () => {
  const parent = new Timeline({ frameRate: 24 });
  const child = new Timeline({ frameRate: 30 });
  parent.add(child, 0);
  expect(child.frameRate.fps).toBe(30);
});

test('playing a nested timeline directly throws', () => {
  const parent = new Timeline();
  const child = new Timeline();
  parent.add(child, 0);
  expect(() => child.play()).toThrow(/nested/);
});

test('attaching an already-attached or already-played timeline throws', () => {
  const a = new Timeline();
  const b = new Timeline();
  b.add(new Timeline(), 0);
  const shared = new Timeline();
  a.add(shared, 0);
  expect(() => b.add(shared, 0)).toThrow(/already attached/);

  const played = new Timeline();
  played.play();
  expect(() => a.add(played, 0)).toThrow(/own transport/);
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

test('seek on an infinite timeline addresses one content cycle', () => {
  const value = new Tween({ from: 0, to: 100, duration: 100, easing: 'linear' });
  const timeline = new Timeline({ repeat: Infinity }).add(value, 0);
  timeline.seek(.75);
  expect(timeline.rootTransport?.time).toBe(75); expect(value.value).toBe(75);
});
