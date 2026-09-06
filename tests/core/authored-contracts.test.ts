import { expect, test } from 'vitest';
import { Timeline, Track, Transport, Tween, frames, loadSheet, renderFrames, saveSheet, validateSheet, type CueSheet } from '@dhaakon/motion';
import { createTestScheduler } from '@dhaakon/motion/testing';

test('failed timeline attachment does not acquire child ownership or change the parent', () => {
  const parent = new Timeline({ frameRate: 24 });
  const child = new Timeline().add(new Tween({ duration: '24f' }));
  expect(() => parent.add(child, 'missing')).toThrow(/label/);
  expect(child.parent).toBeUndefined();
  expect(child.frameRate.fps).toBe(60);
  expect(parent.items).toHaveLength(0);
  parent.add(child, 0);
  expect(child.parent).toBe(parent);
});

test('late timebase binding replays authored item, marker, cue and region expressions in order', () => {
  const fired: string[] = [];
  const root = new Timeline().marker('IN', '24f')
    .add(new Tween({ duration: '24f' }), 'IN')
    .marker('END').add(new Tween({ duration: '12f' }), '>+=12f')
    .cue('take', 'END', () => fired.push('take'))
    .region('window', 'END', 'END+=12f', { onEnter: () => fired.push('enter') });
  root.bindFrameRate(24);
  expect(root.items.map((entry) => [entry.start, entry.end])).toEqual([[1000, 2000], [2500, 3000]]);
  expect(root.markers.map((marker) => marker.time)).toEqual([1000, 2000]);
  expect(root.cues.map((cue) => cue.time)).toEqual([2000, 2000, 2500]);
  root.bindFrameRate(48);
  expect(root.items.map((entry) => [entry.start, entry.end])).toEqual([[500, 1000], [1250, 1500]]);
  root.sampleAt(1001);
  expect(fired).toEqual(['take', 'enter']);
});

test('loaded authored snapshots preserve metadata and are detached from input, output and runtime edits', () => {
  const sheet: CueSheet = { $schema: 'dhaakon-motion/cue-sheet/1', frameRate: 24, duration: '100f',
    cues: [{ name: 'take', at: 0, once: true, payload: { signal: 'go' } }],
    regions: [{ name: 'active', from: '1f', to: '3f', once: true, payload: { x: 1 } }],
    items: [{ type: 'timeline', at: '2f', repeatDelay: '1f', markers: [{ name: 'm', at: 0, color: 'red' }],
      items: [{ type: 'track', repeat: 2, repeatDelay: '2f', direction: 'alternate',
        keyframes: [{ at: 0, value: { x: 0 } }, { at: '2f', value: { x: 10 }, easing: 'linear' }] }] }],
  };
  const expected = structuredClone(sheet);
  const timeline = loadSheet(sheet);
  (sheet.cues![0].payload as { signal: string }).signal = 'changed';
  const saved = saveSheet(timeline);
  expect(saved).toEqual(expected);
  (saved.cues![0].payload as { signal: string }).signal = 'changed again';
  timeline.add(new Tween({ duration: 1 }));
  expect(saveSheet(timeline)).toEqual(expected);
  expect(saveSheet(timeline, { source: 'runtime' }).items).toHaveLength(2);
  expect(saveSheet(loadSheet(saveSheet(timeline)))).toEqual(expected);
});

test('runtime serialization retains track direction, repeat and segment easing plus cue/region metadata', () => {
  const root = new Timeline({ frameRate: 24 }).cue('take', 0, () => {}, { once: true, payload: 7 })
    .region('window', 1, 2, { once: true, payload: 'p' })
    .add(new Track({ keyframes: [{ at: 0, value: 0 }, { at: 100, value: 1, easing: 'linear' }],
      apply: () => {}, repeat: 2, repeatDelay: 10, direction: 'alternate' }));
  const sheet = saveSheet(root, { source: 'runtime' });
  expect(sheet.cues).toEqual([{ name: 'take', at: 0, once: true, payload: 7 }]);
  expect(sheet.regions).toEqual([{ name: 'window', from: 1, to: 2, once: true, payload: 'p' }]);
  expect(sheet.items[0]).toMatchObject({ repeat: 2, repeatDelay: 10, direction: 'alternate', keyframes: [{ at: 0, value: 0 }, { at: 100, value: 1, easing: 'linear' }] });
});

test('offline repeats use one owner, include start cues once and retain resume state', async () => {
  const root = new Timeline({ frameRate: 24 }).add(new Tween({ duration: '3f' }));
  const cues: string[] = [];
  root.cue('start', 0, () => cues.push('start'), { once: true });
  root.cue('middle', '1f', () => cues.push('middle'), { once: true });
  await renderFrames(root, () => {}, { to: '1f' });
  const owner = root.rootTransport;
  expect(cues).toEqual(['start', 'middle']);
  await renderFrames(root, () => {}, { from: '1f', to: '3f' });
  expect(cues).toEqual(['start', 'middle']);
  expect(root.rootTransport).toBe(owner);
  await renderFrames(root, () => {}, { to: '1f' });
  expect(cues).toEqual(['start', 'middle', 'start', 'middle']);
  expect([...frames(root, { to: '1f' })].map((info) => info.frame)).toEqual([0, 1]);
});

test('offline rejects live owners and conflicting rates before producing a frame', async () => {
  const { scheduler } = createTestScheduler();
  const transport = new Transport({ scheduler, frameRate: 24, duration: 1000 }).play();
  await expect(renderFrames(transport, () => {})).rejects.toThrow(/playing|pause/i);
  transport.pause();
  await expect(renderFrames(transport, () => {}, { frameRate: 30 })).rejects.toThrow(/frame.rate/i);
  await expect(renderFrames(transport, () => {}, { from: 100, to: 50 })).rejects.toThrow(/range/i);
  transport.dispose();
});

test('validation resolves inherited timebases, local easing names, and rejects malformed/bounded data', () => {
  const custom = (x: number) => x;
  const sheet: CueSheet = { $schema: 'dhaakon-motion/cue-sheet/1', frameRate: 24, items: [
    { type: 'track', keyframes: [{ at: '1f', value: 0 }, { at: '2f', value: 1, easing: 'local' }] },
  ] };
  expect(loadSheet(sheet, { easings: { local: custom } }).duration).toBeCloseTo(1000 / 12);
  const bad = (patch: object) => validateSheet({ $schema: 'dhaakon-motion/cue-sheet/1', items: [], ...patch }).ok;
  expect(bad({ duration: {} })).toBe(false);
  expect(bad({ regions: [{ name: 'bad', from: 2, to: 1 }] })).toBe(false);
  expect(bad({ items: [{ type: 'tween', from: 0, to: NaN }] })).toBe(false);
  expect(bad({ frameRate: 24, items: [{ type: 'track', keyframes: [{ at: '2f', value: 0 }, { at: '1f', value: 1 }] }] })).toBe(false);
  expect(validateSheet(sheet, { limits: { maxKeyframes: 1 }, easings: { local: custom } }).ok).toBe(false);
  const cyclic: any = { $schema: 'dhaakon-motion/cue-sheet/1', items: [] };
  cyclic.items.push({ type: 'timeline', items: [cyclic] });
  expect(validateSheet(cyclic).ok).toBe(false);
  expect(bad(JSON.parse('{"__proto__":{"polluted":true}}'))).toBe(false);
});

test('binary track lookup preserves exact duplicate-key boundary selection and endpoint references', () => {
  const first = { x: 0 }; const last = { x: 30 };
  const track = new Track({ apply: () => {}, easing: 'linear', keyframes: [
    { at: 0, value: first }, { at: 10, value: { x: 10 } }, { at: 10, value: { x: 20 } }, { at: 20, value: last },
  ] });
  expect(track.valueAt(0)).toBe(first);
  expect(track.valueAt(20)).toBe(last);
  for (const time of [10, 15, 5, 10, 19, 1]) {
    expect(track.valueAt(time).x).toBe(time <= 10 ? time : time + 10);
  }
});

test('rebinding tied cues preserves original declaration order and explicitly rated nested children', () => {
  const fired: string[] = [];
  const nested = new Timeline({ frameRate: 12 }).add(new Tween({ duration: '12f' }), '12f');
  const root = new Timeline().cue('first', '1f', () => fired.push('first')).cue('second', 20, () => fired.push('second')).add(nested);
  root.bindFrameRate(24);
  root.bindFrameRate(50);
  root.sampleAt(20);
  expect(fired).toEqual(['first', 'second']);
  expect(nested.items[0].start).toBe(1000);
  expect(nested.items[0].end).toBe(2000);
});

test('fresh partial offline ranges include their boundary cue, not earlier cues', async () => {
  const updates: number[] = [];
  const root = new Timeline({ frameRate: 10 }).add(new Tween({ from: 0, to: 1000, duration: 1000, easing: 'linear', onUpdate: (value) => updates.push(value) }));
  const cues: string[] = [];
  for (const [name, at] of [['before', 100], ['start', 200], ['after', 300]] as const) root.cue(name, at, () => cues.push(name));
  await renderFrames(root, () => {}, { from: 200, to: 300 });
  expect(cues).toEqual(['start', 'after']);
  expect(updates).toEqual([200, 300]);
});

test('async capture owns the clock, rejects concurrent export, and releases on errors or generator return', async () => {
  const { scheduler } = createTestScheduler();
  const transport = new Transport({ scheduler, frameRate: 10, duration: 1000 });
  let continueCapture!: () => void;
  const pending = new Promise<void>((resolve) => { continueCapture = resolve; });
  const render = renderFrames(transport, () => pending, { to: 0 });
  expect(() => transport.play()).toThrow(/offline/);
  expect(() => transport.tick(1)).toThrow(/offline/);
  expect(() => transport.attach({ supportsOffline: false })).toThrow(/live output/);
  await expect(renderFrames(transport, () => {})).rejects.toThrow(/already active/);
  continueCapture();
  await render;
  expect(() => transport.play()).not.toThrow();
  transport.pause();
  await expect(renderFrames(transport, () => { throw new Error('capture failed'); })).rejects.toThrow('capture failed');
  const iterator = frames(transport);
  iterator.next();
  expect(() => transport.play()).toThrow(/offline/);
  iterator.return();
  expect(() => transport.play()).not.toThrow();
  transport.dispose();
});

test('preexisting live outputs must be detached before offline capture', async () => {
  const transport = new Transport({ duration: 100 });
  let ticks = 0;
  const detach = transport.attach({ supportsOffline: false, onTick: () => ticks++ });
  await expect(renderFrames(transport, () => {})).rejects.toThrow(/Detach live outputs/);
  expect(ticks).toBe(0);
  detach();
  await expect(renderFrames(transport, () => {}, { to: 0 })).resolves.toMatchObject({ frames: 1 });
  transport.dispose();
});

test('offline sampling ignores playback loop wrapping and resets first-frame delta on each pass', async () => {
  const transport = new Transport({ frameRate: 10, duration: 200, loop: true });
  const sample = async () => {
    const values: Array<[number, number, number]> = [];
    await renderFrames(transport, (info) => { values.push([info.time, info.frame, info.delta]); });
    return values;
  };
  const expected = [[0, 0, 0], [100, 1, 100], [200, 2, 100]];
  expect(await sample()).toEqual(expected);
  expect(await sample()).toEqual(expected);
  transport.seek(200);
  expect(transport.time).toBe(0); // Playback loop configuration was not mutated.
  transport.dispose();
});

test('validation does not invoke getters and bounds sparse arrays, nodes, depth and extension factories', () => {
  let reads = 0;
  const getter = { $schema: 'dhaakon-motion/cue-sheet/1', items: [] };
  Object.defineProperty(getter, 'regions', { get: () => { reads++; return []; } });
  expect(validateSheet(getter).ok).toBe(false);
  expect(reads).toBe(0);
  expect(validateSheet({ $schema: 'dhaakon-motion/cue-sheet/1', items: new Array(1000000) }).ok).toBe(false);
  expect(validateSheet({ $schema: 'dhaakon-motion/cue-sheet/1', items: [{ type: 'tween', from: { repeat: Infinity }, to: 1 }] }).ok).toBe(false);
  const basic = { $schema: 'dhaakon-motion/cue-sheet/1', items: [{ type: 'tween', from: 0, to: 1 }] };
  expect(validateSheet(basic, { limits: { maxDepth: 1 } }).ok).toBe(false);
  expect(validateSheet(basic, { limits: { maxNodes: 2 } }).ok).toBe(false);
  expect(validateSheet({ ...basic, items: [{ type: 'custom' }] }).ok).toBe(false);
  expect(validateSheet({ ...basic, items: [{ type: 'custom' }] }, { allowExtensions: true }).ok).toBe(true);
  const backwards = { $schema: 'dhaakon-motion/cue-sheet/1', items: [], markers: [{ name: 'end', at: 100 }], regions: [{ name: 'r', from: 'end', to: 'end-=10ms' }] };
  expect(validateSheet(backwards).ok).toBe(false);
  expect(validateSheet({ ...basic, frameRate: { num: 0.1, den: 0.1 }, items: [{ type: 'timeline', items: [] }] }).ok).toBe(false);
});

test('disposing during awaited capture prevents later writes and releases the reusable transport', async () => {
  const transport = new Transport({ duration: 1000, frameRate: 10 });
  let resolve!: () => void;
  const pending = new Promise<void>((done) => { resolve = done; });
  let count = 0;
  const rendering = renderFrames(transport, () => { count++; return pending; });
  transport.dispose();
  resolve();
  await expect(rendering).rejects.toThrow(/disposed during offline/);
  expect(count).toBe(1);
  await expect(renderFrames(transport, () => {}, { to: 0 })).resolves.toMatchObject({ frames: 1 });
  transport.dispose();
});

test('a fresh partial export includes cue zero at an exactly aligned nested-child start', async () => {
  const cues: string[] = [];
  const child = new Timeline().cue('child start', 0, () => cues.push('child start'), { once: true })
    .add(new Tween({ duration: 200 }));
  const root = new Timeline({ frameRate: 10 }).cue('earlier', 50, () => cues.push('earlier')).add(child, 100);
  await renderFrames(root, () => {}, { from: 100, to: 200 });
  expect(cues).toEqual(['child start']);
  root.rootTransport?.dispose();
});

test('offline cleanup attempts every detacher and releases the clock when one throws', async () => {
  const { scheduler } = createTestScheduler();
  const transport = new Transport({ scheduler, duration: 100 });
  const detached: string[] = [];
  await expect(renderFrames(transport, () => {}, { to: 0, outputs: [
    { onDetach() { detached.push('first'); throw new Error('first detach failed'); } },
    { onDetach() { detached.push('second'); } },
  ] })).rejects.toThrow('first detach failed');
  expect(detached).toEqual(['first', 'second']);
  expect(() => transport.play()).not.toThrow();
  transport.dispose();
  expect(detached).toEqual(['first', 'second']);
});
