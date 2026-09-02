import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GestureArena, cooperateWithScroll, hoverRecognizer, panRecognizer, pinchRecognizer, pressRecognizer, tapRecognizer, wheelRecognizer } from '@dhaakon/motion/gesture';
import { installPointerEvents, pointer } from '@dhaakon/motion/testing';

let restore = () => {};
beforeEach(() => { restore = installPointerEvents(); });
afterEach(() => { restore(); vi.useRealTimers(); document.body.innerHTML = ''; });

test('a four-pixel click sweeps to tap while pan never begins', () => {
  const element = document.createElement('div'); document.body.append(element);
  const tap = tapRecognizer(); const pan = panRecognizer(); const tapped: string[] = []; const panned: string[] = [];
  tap.subscribe((event) => tapped.push(event.phase)); pan.subscribe((event) => panned.push(event.phase));
  const arena = new GestureArena(element, [tap, pan]); const stream = pointer(element);
  stream.down(0, 0, 0); stream.move(4, 0, 20); stream.up(4, 0, 40);
  expect(tapped).toEqual(['ended']); expect(panned).toEqual([]); arena.dispose();
});

test('pan axis arbitration claims the matching direction and yields the wrong one', () => {
  const element = document.createElement('div'); document.body.append(element);
  const x = panRecognizer({ axis: 'x' }); const y = panRecognizer({ axis: 'y' }); const events: string[] = [];
  x.subscribe((event) => events.push(`x:${event.phase}`)); y.subscribe((event) => events.push(`y:${event.phase}`));
  const arena = new GestureArena(element, [x, y]); const stream = pointer(element);
  stream.down(0, 0, 0); stream.move(2, 20, 20); stream.up(2, 30, 40);
  expect(events).toContain('y:began'); expect(events).not.toContain('x:began'); arena.dispose();
});

test('an inner arena cancels an ancestor unless propagation is enabled', () => {
  const outer = document.createElement('div'); const inner = document.createElement('div'); outer.append(inner); document.body.append(outer);
  const outerPan = panRecognizer(); const innerPan = panRecognizer(); const events: string[] = [];
  outerPan.subscribe((event) => events.push(`outer:${event.phase}`)); innerPan.subscribe((event) => events.push(`inner:${event.phase}`));
  const outerArena = new GestureArena(outer, [outerPan]); const innerArena = new GestureArena(inner, [innerPan]); const stream = pointer(inner);
  stream.down(0, 0, 0); stream.move(20, 0, 20); stream.up(30, 0, 40);
  expect(events).toContain('inner:began'); expect(events).not.toContain('outer:began'); innerArena.dispose(); outerArena.dispose();
});

test('scroll cooperation claims only when dragging away from the configured edge', () => {
  const scroller = document.createElement('div'); Object.defineProperties(scroller, { clientHeight: { value: 100 }, scrollHeight: { value: 300 } }); scroller.scrollTop = 0; document.body.append(scroller);
  const downward = cooperateWithScroll(panRecognizer({ axis: 'y' }), scroller, { edge: 'top' }); const events: string[] = []; downward.subscribe((event) => events.push(event.phase));
  const arena = new GestureArena(scroller, [downward]); const stream = pointer(scroller);
  stream.down(0, 0, 0); stream.move(0, 20, 20); stream.up(0, 20, 30);
  expect(events).toContain('began'); arena.dispose();
});

test('pinch reports scale from two independent pointer histories', () => {
  const element = document.createElement('div'); document.body.append(element); const pinch = pinchRecognizer(); const scales: number[] = [];
  pinch.subscribe((event) => { if (event.scale) scales.push(event.scale); }); const arena = new GestureArena(element, [pinch]);
  const a = pointer(element, { id: 1 }); const b = pointer(element, { id: 2 }); a.down(0, 0, 0); b.down(100, 0, 0); b.move(130, 0, 20); b.up(130, 0, 30); a.up(0, 0, 30);
  expect(scales.some((scale) => scale > 1.2)).toBe(true); arena.dispose();
});

test('hover ignores touch and wheel detects a decaying inertial series', () => {
  vi.useFakeTimers(); const element = document.createElement('div'); document.body.append(element);
  const hover = hoverRecognizer(); const wheel = wheelRecognizer(); const hoverEvents: string[] = []; const inertia: boolean[] = [];
  hover.subscribe((event) => hoverEvents.push(event.phase)); wheel.subscribe((event) => inertia.push(Boolean(event.inertial)));
  const arena = new GestureArena(element, [hover, wheel, pressRecognizer()]);
  element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch', pointerId: 1 }));
  element.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', pointerId: 2 }));
  element.dispatchEvent(new WheelEvent('wheel', { deltaY: 20 })); element.dispatchEvent(new WheelEvent('wheel', { deltaY: 10 }));
  expect(hoverEvents).toEqual(['began']); expect(inertia).toEqual([false, true]); arena.dispose();
});

