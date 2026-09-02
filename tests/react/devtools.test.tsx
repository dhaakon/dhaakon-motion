import { test, expect } from 'vitest';
import { Transport, Tween } from '@dhaakon/motion';
import { createTestScheduler } from '@dhaakon/motion/testing';
import { mountInspector } from '@dhaakon/motion/devtools';

test('mountInspector renders a transport bar and one lane per item, then cleans up on unmount', () => {
  const { driver, scheduler } = createTestScheduler();
  const transport = new Transport({ scheduler, duration: 200 });
  transport.root.add(new Tween({ from: 0, to: 1, duration: 100, name: 'a' }), 0);
  transport.root.marker('verse', 20);
  transport.root.cue('blackout', 60, () => {});

  const inspector = mountInspector(transport);
  const host = document.querySelector('.dhk-inspector');
  expect(host).not.toBeNull();
  expect(host!.querySelectorAll('.dhk-lane').length).toBe(2); // the root's own markers/cues row, plus the "a" tween's lane
  expect(host!.querySelectorAll('.dhk-mark').length).toBe(1);
  expect(host!.querySelector('[data-cue="blackout"]')).not.toBeNull();

  const playButton = host!.querySelectorAll('button')[0] as HTMLButtonElement;
  playButton.click();
  expect(transport.state).toBe('playing');

  driver.step(65); // crosses the "blackout" cue at 60
  const cueMark = host!.querySelector('[data-cue="blackout"]')!;
  expect(cueMark.classList.contains('dhk-cue--fired')).toBe(true);

  inspector.unmount();
  expect(document.querySelector('.dhk-inspector')).toBeNull();
});

test('mountInspector accepts a container and starts collapsed on request', () => {
  const { scheduler } = createTestScheduler();
  const transport = new Transport({ scheduler, duration: 100 });
  const container = document.createElement('div');
  document.body.append(container);

  const inspector = mountInspector(transport, { container, collapsed: true });
  const lanes = container.querySelector('.dhk-lanes') as HTMLElement;
  expect(lanes.hidden).toBe(true);
  expect(container.querySelector('.dhk-inspector')).not.toBeNull();

  inspector.unmount();
  container.remove();
});

test('gesture overlay traces pointers, reports arena claims, and disposes cleanly', () => {
  const { scheduler } = createTestScheduler();
  const transport = new Transport({ scheduler, duration: 100 });
  const inspector = mountInspector(transport, { gestures: true });
  const move = new MouseEvent('pointermove', { clientX: 40, clientY: 30 });
  Object.defineProperty(move, 'pointerId', { value: 4 });
  document.dispatchEvent(move);
  document.dispatchEvent(new CustomEvent('dhaakon-motion:arena', { detail: { kind: 'pan', priority: 10 } }));
  expect(document.querySelector('.dhk-gesture-overlay circle')).not.toBeNull();
  expect(document.querySelector('.dhk-gesture-state')?.textContent).toContain('PAN');
  inspector.unmount();
  expect(document.querySelector('.dhk-gesture-overlay')).toBeNull();
});
