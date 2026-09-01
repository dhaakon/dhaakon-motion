import { test, expect } from 'vitest';
import { Tween, FrameScheduler } from '@dhaakon/motion';
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
