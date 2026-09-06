import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { frameToMs, loadSheet, validateSheet } from '@dhaakon/motion';
import {
  ADVANCED_CUE_FRAMES,
  advancedCueSheet,
  advancedCueSheetSource,
  advancedCueLayers,
  initialCueStates,
  cueActs,
  type CueState,
  type CueTarget,
} from '../../docs/src/advancedCueSheet';
import { assertCueState } from '../../docs/src/cue-sheet/renderer';
import { contourPath, ribbonPath, SHARDS } from '../../docs/src/cue-sheet/geometry';
import { videoFrame, videoSyncReport } from '../../docs/src/cue-sheet/videoSync';

describe('advanced SVG cue sheet', () => {
  test('ships a source-matched 1080p, twenty-four-second offline master', () => {
    const manifest = JSON.parse(
      readFileSync(resolve('docs/public/media/ink-signal-v2.json'), 'utf8'),
    );
    const video = readFileSync(resolve('docs/public/media', manifest.filename));
    expect(manifest).toMatchObject({
      width: 1920,
      height: 1080,
      fps: 24,
      frames: 576,
      duration: 24,
      frameRange: [0, 575],
    });
    expect(video.byteLength).toBe(manifest.bytes);
    expect(video.subarray(4, 8).toString('ascii')).toBe('ftyp');
    expect(createHash('sha256').update(video).digest('hex')).toBe(manifest.sha256);
    expect(createHash('sha256').update(advancedCueSheetSource).digest('hex')).toBe(
      manifest.sourceSha256,
    );
  });
  test('covers five acts and gives every renderer target exactly one lane and writer', () => {
    expect(validateSheet(advancedCueSheet)).toEqual({ ok: true, sheet: advancedCueSheet });
    const names = advancedCueLayers.map((layer) => layer.target);
    expect(names).toHaveLength(23);
    expect(new Set(names).size).toBe(23);
    expect(names.toSorted()).toEqual(Object.keys(initialCueStates).toSorted());
    expect(cueActs.map((act) => act.from)).toEqual([0, 96, 216, 336, 444]);
    expect(cueActs.at(-1)?.to).toBe(576);
    const timeline = loadSheet(advancedCueSheet, {
      targets: Object.fromEntries(names.map((name) => [name, () => {}])),
    });
    expect(timeline.duration).toBe(24000);
    expect(timeline.frames).toBe(ADVANCED_CUE_FRAMES);
    expect(timeline.markers.find((m) => m.name === 'OUT')?.time).toBeCloseTo(
      frameToMs(575, timeline.frameRate),
    );
    expect(timeline.items.map(({ item }) => item.totalDuration)).toEqual([
      24000, 24000, 24000, 24000, 24000,
    ]);
  });
  test('samples every authored frame with finite controls and repeatable backwards seeks', () => {
    const states: Record<string, CueState> = {};
    const targets = Object.fromEntries(
      Object.keys(initialCueStates).map((name) => [
        name,
        (value: CueState) => {
          assertCueState(name as CueTarget, value);
          states[name] = value;
        },
      ]),
    );
    const timeline = loadSheet(advancedCueSheet, { targets });
    const hashes: string[] = [];
    for (let frame = 0; frame <= 576; frame++) {
      timeline.sampleAt(frameToMs(frame, timeline.frameRate));
      hashes.push(JSON.stringify(states));
    }
    for (const frame of [504, 0, 396, 168, 72, 300, 575, 24, 456]) {
      timeline.sampleAt(frameToMs(frame, timeline.frameRate));
      expect(JSON.stringify(states)).toBe(hashes[frame]);
    }
    timeline.sampleAt(frameToMs(168, timeline.frameRate));
    expect(states.ink).toMatchObject({ opacity: 1, reveal: 1 });
    timeline.sampleAt(frameToMs(396, timeline.frameRate));
    expect(states.shards).toMatchObject({ opacity: 1, explode: 1, rotate: 32 });
    expect(states.ink.opacity).toBe(0);
    timeline.sampleAt(frameToMs(504, timeline.frameRate));
    expect(states.title).toMatchObject({ opacity: 1, reveal: 1 });
    expect(states.ink.opacity).toBe(1);
  });
  test('derives morphing geometry directly from controls without random or accumulated state', () => {
    expect(SHARDS).toHaveLength(48);
    expect(contourPath(3, 1, 75, 1.1)).toBe(contourPath(3, 1, 75, 1.1));
    expect(contourPath(3, 0, 75, 1.1)).not.toBe(contourPath(3, 1, 75, 1.1));
    expect(ribbonPath(2, 3, 1, 0.5)).not.toMatch(/NaN|Infinity/);
    expect(contourPath(3, 1, 75, 1.1)).not.toMatch(/NaN|Infinity/);
  });
  test('never promotes a commanded seek to a decoded frame or zero drift', () => {
    expect(videoSyncReport(168, null, true)).toEqual({ frame: '—', delta: 'WAIT' });
    expect(videoSyncReport(168, 20, true)).toEqual({ frame: '020', delta: '-148F / SEEK' });
    expect(videoSyncReport(168, 168, false)).toEqual({ frame: '168', delta: '+0F' });
    expect(videoFrame(575 / 24, 24, 576)).toBe(575);
    expect(videoFrame(24, 24, 576)).toBe(575);
  });
});
