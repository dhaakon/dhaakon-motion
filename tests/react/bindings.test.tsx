import { afterEach, beforeEach, expect, test } from 'vitest';
import { MotionValue, Timeline, Transport, Tween, scheduler } from '@dhaakon/motion';
import { drag, scrub, transformGesture } from '@dhaakon/motion/gesture';
import { installFrameDriver, installPointerEvents, ManualDriver, pointer } from '@dhaakon/motion/testing';

let restorePointers = () => {}; let restoreFrame = () => {};
beforeEach(() => { restorePointers = installPointerEvents(); const installed = installFrameDriver(new ManualDriver()); restoreFrame = installed.restore; });
afterEach(() => { restorePointers(); restoreFrame(); document.body.innerHTML = ''; });

test('drag coalesces many pointer moves into one frame write', () => {
  const element = document.createElement('div'); document.body.append(element); const x = new MotionValue<number>(0); let writes = 0; x.subscribe(() => writes += 1);
  const control = drag(x, element, { axis: 'x', momentum: false }); const stream = pointer(element);
  stream.down(0, 0, 0); stream.move(20, 0, 10); stream.move(40, 0, 20); stream.move(60, 0, 30);
  expect(x.get()).toBe(0); scheduler.flush(32);
  expect(x.get()).toBe(60); expect(writes).toBe(1); stream.up(60, 0, 40); control.dispose();
});

test('immediate drag writes every event and rubberbands beyond bounds', () => {
  const element = document.createElement('div'); document.body.append(element); const x = new MotionValue<number>(0); let writes = 0; x.subscribe(() => writes += 1);
  const control = drag(x, element, { axis: 'x', bounds: { min: 0, max: 100 }, immediate: true, momentum: false }); const stream = pointer(element);
  stream.down(0, 0, 0); stream.move(50, 0, 10); stream.move(160, 0, 20);
  expect(writes).toBe(2); expect(x.get()).toBeGreaterThan(100); expect(x.get()).toBeLessThan(160); control.dispose();
});

test('snap chooses the point nearest the projected fling endpoint', () => {
  const element = document.createElement('div'); document.body.append(element); const x = new MotionValue<number>(0); let target = -1;
  const control = drag(x, element, { axis: 'x', immediate: true, momentum: false, snap: [0, 100], onEnd: (_event, outcome) => { target = outcome.target; } }); const stream = pointer(element);
  stream.down(0, 0, 0); stream.move(40, 0, 40); stream.up(40, 0, 40);
  expect(target).toBe(100); control.dispose();
});

test('keyboard controls expose slider semantics and support accelerated steps', () => {
  const element = document.createElement('div'); document.body.append(element); const value = new MotionValue<number>(20);
  const control = drag(value, element, { axis: 'x', bounds: { min: 0, max: 100 }, momentum: false, step: 2, ariaLabel: 'Level' });
  expect(element.getAttribute('role')).toBe('slider'); expect(element.getAttribute('aria-label')).toBe('Level');
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true })); expect(value.get()).toBe(40);
  element.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); expect(value.get()).toBe(100); control.dispose();
});

test('scrub maps pointer distance to exact transport frames', () => {
  const element = document.createElement('div'); document.body.append(element); const root = new Timeline({ frameRate: 24 }).add(new Tween({ duration: 2000 })); const transport = new Transport({ root, frameRate: 24 });
  const control = scrub(transport, element, { pixelsPerFrame: 10, momentum: false, snapToFrames: true }); const stream = pointer(element);
  stream.down(0, 0, 0); stream.move(240, 0, 100); expect(transport.frame).toBe(24); stream.up(240, 0, 110); expect(transport.frame).toBe(24); control.dispose(); transport.dispose();
});

test('wheel zoom preserves the point beneath the cursor', () => {
  const element = document.createElement('div'); Object.defineProperty(element, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, x: 0, y: 0, toJSON() {} }) }); document.body.append(element);
  const scale = new MotionValue<number>(1); const x = new MotionValue<number>(0); const y = new MotionValue<number>(0); const binding = transformGesture(element, { scale, x, y });
  element.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 50, clientY: 75, cancelable: true }));
  expect(scale.get()).toBeGreaterThan(1); expect((50 - x.get()) / scale.get()).toBeCloseTo(50, 6); expect((75 - y.get()) / scale.get()).toBeCloseTo(75, 6); binding.dispose();
});
