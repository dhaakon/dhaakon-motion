import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameScheduler, Line, Timeline, Tween, interpolate } from '../dist/index.js';

class ManualDriver {
  time = 0; callback = null; requests = 0;
  now = () => this.time;
  request = (callback) => { this.callback = callback; this.requests += 1; return this.requests; };
  cancel = () => { this.callback = null; };
  step(time) { this.time = time; const callback = this.callback; this.callback = null; callback?.(time); }
}

test('interpolates nested values, units, colors, and lines', () => {
  assert.equal(interpolate(10, 20, 0.25), 12.5);
  assert.equal(interpolate('10px', '20px', 0.5), '15px');
  assert.equal(interpolate('#000000', '#ffffff', 0.5), 'rgba(128, 128, 128, 1)');
  assert.deepEqual(interpolate({ x: 0, scale: 1 }, { x: 100, scale: 2 }, 0.5), { x: 50, scale: 1.5 });
  assert.deepEqual(new Line([0, 10], [10, 30]).value(0.5), [5, 20]);
});

test('many tweens share one requested animation frame', () => {
  const driver = new ManualDriver(); const loop = new FrameScheduler(driver);
  new Tween({ from: 0, to: 1, duration: 100, scheduler: loop }).play();
  new Tween({ from: 0, to: 1, duration: 100, scheduler: loop }).play();
  assert.equal(loop.size, 2); assert.equal(driver.requests, 1);
});

test('tween accounts for delay, pause, resume, and completion', async () => {
  const driver = new ManualDriver(); const loop = new FrameScheduler(driver); const values = [];
  const tween = new Tween({ from: 0, to: 10, duration: 100, delay: 20, easing: 'linear', scheduler: loop, onUpdate: (value) => values.push(value) }).play();
  driver.step(50); assert.equal(tween.state, 'running'); assert.equal(tween.value, 3);
  tween.pause(); driver.step(80); assert.equal(tween.value, 3);
  tween.play(); driver.step(150); assert.equal(tween.value, 10); assert.equal(tween.state, 'finished');
  assert.equal(await tween.finished, tween); assert.ok(values.length >= 2);
});

test('timeline samples overlapping children from one clock', () => {
  const driver = new ManualDriver(); const loop = new FrameScheduler(driver);
  const a = new Tween({ from: 0, to: 10, duration: 100, easing: 'linear' }); const b = new Tween({ from: 10, to: 30, duration: 100, easing: 'linear' });
  const timeline = new Timeline({ scheduler: loop }).add(a).add(b, '<').play();
  assert.equal(timeline.duration, 100); driver.step(50);
  assert.equal(a.value, 5); assert.equal(b.value, 20);
  driver.step(100); assert.equal(a.value, 10); assert.equal(b.value, 30);
});

test('alternate direction returns to its starting value', () => {
  const tween = new Tween({ from: 0, to: 10, duration: 100, repeat: 1, yoyo: true });
  tween.sampleAt(100); assert.equal(tween.value, 10);
  tween.sampleAt(200); assert.equal(tween.value, 0);
});
