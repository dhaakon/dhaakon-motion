import { test, expect } from 'vitest';
import { Timeline, Tween, Transport } from '@dhaakon/motion';
import { createTestScheduler } from '@dhaakon/motion/testing';

function buildComposition() {
  const camera = new Tween({ from: 0, to: 1, duration: 2000, easing: 'linear' });
  camera.name = 'camera';
  const title = new Tween({ from: 0, to: 1, duration: 600, easing: 'linear' });
  title.name = 'title';
  const intro = new Timeline({ name: 'intro', repeat: 1, yoyo: true }).add(title, 0);
  const root = new Timeline({ name: 'show' })
    .label('verse', 200)
    .add(camera, 0)
    .add(intro, 'verse')
    .cue('blackout', 1800, () => {});
  return root;
}

test('inspect() reports a tree matching a 3-level composition', () => {
  const root = buildComposition();
  const node = root.inspect();
  expect(node.kind).toBe('timeline');
  expect(node.name).toBe('show');
  expect(node.children.map((c) => c.name)).toEqual(['camera', 'intro']);
  const introNode = node.children[1];
  expect(introNode.kind).toBe('timeline');
  expect(introNode.repeat).toBe(1);
  expect(introNode.direction).toBe('alternate');
  expect(introNode.children.map((c) => c.name)).toEqual(['title']);
  expect(node.markers.map((m) => m.name)).toEqual(['verse']);
  expect(node.cues.map((c) => c.name)).toEqual(['blackout']);
});

test('toAscii() is stable across calls and mentions every item, marker, and cue', () => {
  const root = buildComposition();
  const first = root.toAscii();
  const second = root.toAscii();
  expect(second).toBe(first);
  expect(first).toContain('camera');
  expect(first).toContain('intro');
  expect(first).toContain('title');
  expect(first).toContain('verse');
  expect(first).toContain('blackout');
});

test('explain() reports the resolved ms/frame/timecode and, for a label offset, its base', () => {
  const root = buildComposition();
  const plain = root.explain(1000);
  expect(plain.ms).toBe(1000);
  expect(plain.base).toBeUndefined();

  const offset = root.explain('verse+=12f');
  expect(offset.base).toBe('verse');
  expect(offset.offset).toBeCloseTo(200, 6); // 12f at the timeline's default 60fps = 200ms
});

test('explain() resolves an offset in the timeline\'s own frame rate', () => {
  const root = new Timeline({ frameRate: 24 }).label('a', 0);
  const explained = root.explain('a+=12f');
  expect(explained.offset).toBeCloseTo(500, 6);
  expect(explained.ms).toBeCloseTo(500, 6);
});

test('transport.trace() records ticks and the cues fired during them', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const transport = new Transport({ scheduler: loop, duration: 100 });
  transport.root.cue('mid', 50, () => {});
  const trace = transport.trace({ capacity: 10 });
  transport.play();
  driver.step(60);
  expect(trace.entries.length).toBeGreaterThan(0);
  const withCue = trace.entries.find((entry) => entry.cues.includes('mid'));
  expect(withCue).toBeDefined();
  expect(trace.toText()).toContain('cues=[mid]');
  trace.clear();
  expect(trace.entries).toEqual([]);
});
