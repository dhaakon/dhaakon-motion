import { afterEach, beforeEach, expect, test } from 'vitest';
import { createPointerSession } from '@dhaakon/motion/gesture';
import { installPointerEvents, pointer } from '@dhaakon/motion/testing';

let restore = () => {};
beforeEach(() => { restore = installPointerEvents(); });
afterEach(() => restore());

test('PointerSession captures a normalized stream and restores touch-action', () => {
  const element = document.createElement('div'); element.style.touchAction = 'pan-y'; document.body.append(element);
  const samples: Array<{ id: number; x: number }> = []; const endings: boolean[] = [];
  const session = createPointerSession({ element, touchAction: 'none', onSample: (sample) => samples.push(sample), onEnd: (_sample, cancelled) => endings.push(cancelled) });
  expect(element.style.touchAction).toBe('none');
  const stream = pointer(element); stream.down(10, 20, 0); stream.move(30, 20, 16); stream.up(40, 20, 32);
  expect(samples.map(({ id, x }) => [id, x])).toEqual([[1, 10], [1, 30], [1, 40]]);
  expect(endings).toEqual([false]);
  session.dispose(); expect(element.style.touchAction).toBe('pan-y');
});

test('pointercancel is cancellation and multiple pointer histories stay independent', () => {
  const element = document.createElement('div'); document.body.append(element); const endings: boolean[] = [];
  const session = createPointerSession({ element, onSample: () => {}, onEnd: (_sample, cancelled) => endings.push(cancelled) });
  const first = pointer(element, { id: 1 }); const second = pointer(element, { id: 2 });
  first.down(0, 0, 0); second.down(10, 10, 0); first.move(5, 0, 10);
  expect(session.pointers.size).toBe(2); expect(session.pointers.get(1)?.length).toBe(2); expect(session.pointers.get(2)?.length).toBe(1);
  first.cancel(); expect(endings).toEqual([true]); expect(session.pointers.size).toBe(1);
  session.dispose(); expect(endings).toEqual([true, true]);
});

test('capture false listens for movement on document', () => {
  const element = document.createElement('div'); document.body.append(element); const xs: number[] = [];
  const session = createPointerSession({ element, capture: false, onSample: (sample) => xs.push(sample.x), onEnd: () => {} });
  pointer(element).down(1, 0, 0);
  const move = new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 9, clientY: 0, buttons: 1 }); Object.defineProperty(move, 'timeStamp', { value: 10 }); document.dispatchEvent(move);
  expect(xs).toEqual([1, 9]); session.dispose();
});

