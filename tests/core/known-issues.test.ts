import { expect, test } from 'vitest';
import { Timeline, Transport, Tween, loadSheet, renderFrames, saveSheet, validateSheet } from '@dhaakon/motion';

// Former expected failures, now executable phase-0 regression contracts.
// Authored save semantics and validation bounds are expanded in authored-contracts.

test('AUD-01: late frame-rate binding re-resolves authored placements', () => {
  const root = new Timeline().marker('TAKE', '24f')
    .add(new Tween({ duration: '24f' }), '24f');
  const transport = new Transport({ root, frameRate: 24 });
  expect(root.items[0].start).toBe(1000);
  expect(root.markers[0].time).toBe(1000);
  transport.dispose();
});

test('AUD-02: serialization preserves cue payload and once semantics', () => {
  const sheet = { $schema: 'dhaakon-motion/cue-sheet/1' as const, frameRate: 24,
    cues: [{ name: 'TAKE', at: 100, payload: { signal: 'CAM2' }, once: true }], items: [],
  };
  const saved = saveSheet(loadSheet(sheet));
  expect(saved.cues?.[0]).toMatchObject({ payload: { signal: 'CAM2' }, once: true });
});

test('AUD-03: the same timeline supports two offline render passes', async () => {
  const root = new Timeline({ frameRate: 24 }).add(new Tween({ duration: '2f' }));
  await renderFrames(root, () => {});
  await renderFrames(root, () => {});
});

test('AUD-04: validation rejects malformed region and duration values', () => {
  expect(validateSheet({ $schema: 'dhaakon-motion/cue-sheet/1', items: [], regions: 'invalid', duration: {} }).ok).toBe(false);
});
