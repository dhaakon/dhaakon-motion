import { test, expect } from 'vitest';
import { Tween, Timeline, Transport, FrameScheduler } from '@dhaakon/motion';
import { ManualDriver, recordValues } from '@dhaakon/motion/testing';

test('tween accounts for delay, pause, resume, and completion', async () => {
  const driver = new ManualDriver();
  const loop = new FrameScheduler(driver);
  const tween = new Tween({ from: 0, to: 10, duration: 100, delay: 20, easing: 'linear', scheduler: loop }).play();
  const values = recordValues(tween);

  driver.step(50);
  expect(tween.state).toBe('running');
  expect(tween.value).toBe(3);

  tween.pause();
  driver.step(80);
  expect(tween.value).toBe(3);

  tween.play();
  driver.step(150);
  expect(tween.value).toBe(10);
  expect(tween.state).toBe('finished');

  expect(await tween.finished).toBe(tween);
  expect(values.length).toBeGreaterThanOrEqual(2);
});

test('alternate direction returns to its starting value', () => {
  const tween = new Tween({ from: 0, to: 10, duration: 100, repeat: 1, yoyo: true });
  tween.sampleAt(100);
  expect(tween.value).toBe(10);
  tween.sampleAt(200);
  expect(tween.value).toBe(0);
});

test('infinite repeat remains finite and stays on the frame loop', () => {
  const driver = new ManualDriver();
  const loop = new FrameScheduler(driver);
  const tween = new Tween({ from: 0, to: 1, duration: 1000, repeat: Infinity, yoyo: true, easing: 'linear', scheduler: loop }).play();
  driver.step(500);
  expect(tween.value).toBe(0.5);
  expect(tween.state).toBe('running');
  driver.step(1500);
  expect(tween.value).toBe(0.5);
  expect(tween.state).toBe('running');
  expect(Number.isFinite(tween.value)).toBe(true);
  expect(loop.size).toBe(1);
});

test('infinite repeat can seek and reverse within its current cycle', () => {
  const driver = new ManualDriver();
  const loop = new FrameScheduler(driver);
  const tween = new Tween({ from: 0, to: 1, duration: 1000, repeat: Infinity, yoyo: true, easing: 'linear', scheduler: loop }).play();
  tween.seek(0.78);
  expect(tween.value).toBe(0.78);
  expect(Number.isFinite(tween.elapsed)).toBe(true);
  tween.reverse();
  expect(Math.abs(tween.value - 0.78)).toBeLessThan(1e-10);
  expect(Number.isFinite(tween.elapsed)).toBe(true);
  driver.step(100);
  expect(tween.value).toBeLessThan(0.78);
  expect(Number.isFinite(tween.value)).toBe(true);
});

test('getCurrentFrame reports the elapsed active time in frames', () => {
  const tween = new Tween({ from: 0, to: 1, duration: 1000, easing: 'linear' });
  tween.seekTime(500);
  expect(tween.getCurrentFrame(60)).toBe(30);
});

test('all tween clock fields accept TimeInput with an explicit frame rate', () => {
  const tween = new Tween({
    from: 0, to: 1, frameRate: 24,
    duration: '24f', delay: '00:00:00:12', repeat: 1, repeatDelay: '6f',
  });
  expect(tween.duration).toBeCloseTo(1000, 6);
  expect(tween.delay).toBeCloseTo(500, 6);
  expect(tween.repeatDelay).toBeCloseTo(250, 6);
  expect(tween.totalDuration).toBeCloseTo(2750, 6);
});

test('a tween inherits and re-resolves against its Transport frame rate', () => {
  const tween = new Tween({ from: 0, to: 1, duration: '24f', delay: '12f', repeatDelay: '6f' });
  const root = new Timeline().add(tween);
  expect(tween.duration).toBeCloseTo(400, 6); // standalone/default timeline timebase is 60fps
  const transport = new Transport({ root, frameRate: 24 });
  expect(tween.frameRate).toMatchObject({ num: 24, den: 1 });
  expect(tween.duration).toBeCloseTo(1000, 6);
  expect(tween.delay).toBeCloseTo(500, 6);
  expect(root.duration).toBeCloseTo(1500, 6);
  transport.dispose();
});

test('an explicit tween rate wins over an inherited nested timeline rate', () => {
  const inherited = new Tween({ duration: '24f' });
  const explicit = new Tween({ duration: '24f', frameRate: 48 });
  const nested = new Timeline().add(inherited).add(explicit, 0);
  const root = new Timeline().add(nested);
  const transport = new Transport({ root, frameRate: 24 });
  expect(inherited.duration).toBeCloseTo(1000, 6);
  expect(explicit.duration).toBeCloseTo(500, 6);
  expect(nested.duration).toBeCloseTo(1000, 6);
  expect(root.duration).toBeCloseTo(1000, 6);
  transport.dispose();
});

test('configure and setDuration keep authored TimeInput values re-bindable', () => {
  const tween = new Tween({ duration: '30f', frameRate: 30 });
  tween.configure({ delay: '15f', repeatDelay: '3f' });
  expect(tween.delay).toBe(500);
  expect(tween.repeatDelay).toBe(100);
  tween.setDuration('24f', 24);
  expect(tween.duration).toBe(1000);
});

test('drop-frame SMPTE can be authored before the drop-frame Transport exists', () => {
  const tween = new Tween({ duration: '00:00:00;18', delay: '6f' });
  expect(tween.frameRate).toMatchObject({ num: 30000, den: 1001, dropFrame: true });
  const root = new Timeline().add(tween);
  const transport = new Transport({ root, frameRate: '59.94df' });
  expect(tween.frameRate).toMatchObject({ num: 60000, den: 1001, dropFrame: true });
  expect(tween.duration).toBeCloseTo(18 * 1001 / 60, 6);
  transport.dispose();
});
