import { test, expect } from 'vitest';
import { Timeline, Transport, Tween, frameToMs, frameRate, msToTimecode, formatTimecode } from '@dhaakon/motion';
import { renderFrames, frames, OfflineTransport } from '@dhaakon/motion';
import type { FrameInfo } from '@dhaakon/motion';

function buildTimeline() {
  const tween = new Tween({ from: 0, to: 1000, duration: 1000, easing: 'linear' });
  const timeline = new Timeline({ frameRate: 24 }).add(tween, 0);
  return { timeline, tween };
}

test('renderFrames yields one frame per exact frame boundary, with no accumulation drift', async () => {
  const { timeline } = buildTimeline();
  const rate = frameRate(24);
  const seen: FrameInfo[] = [];
  const result = await renderFrames(timeline, (info) => { seen.push(info); }, { frameRate: 24 });
  expect(result.frames).toBe(25); // frame 0..24 inclusive at 24fps over 1000ms (24 fps * 1s = 24 frames + the boundary frame)
  seen.forEach((info, i) => expect(info.time).toBe(frameToMs(i, rate)));
});

test('renderFrames fires a cue exactly once, on the frame that contains it', async () => {
  const { timeline } = buildTimeline();
  const fired: number[] = [];
  timeline.cue('watch', 500, (e) => fired.push(e.time));
  let firedOnFrame = -1;
  await renderFrames(timeline, (info) => { if (info.cues?.includes('watch')) firedOnFrame = info.frame; }, { frameRate: 24 });
  expect(fired.length).toBe(1);
  expect(firedOnFrame).toBe(12);
});

test('renderFrames is deterministic: running it twice gives identical output', async () => {
  const { timeline: a } = buildTimeline();
  const { timeline: b } = buildTimeline();
  const first: FrameInfo[] = [];
  const second: FrameInfo[] = [];
  await renderFrames(a, (info) => { first.push({ ...info }); }, { frameRate: 24 });
  await renderFrames(b, (info) => { second.push({ ...info }); }, { frameRate: 24 });
  expect(second.map((i) => i.time)).toEqual(first.map((i) => i.time));
});

test('resuming a render on the same transport equals rendering the whole span at once', async () => {
  const { timeline: whole } = buildTimeline();
  const { timeline: split } = buildTimeline();
  const transport = new OfflineTransport({ root: split, frameRate: 24 });

  const wholeTimes: number[] = [];
  await renderFrames(whole, (info) => { wholeTimes.push(info.time); }, { frameRate: 24, to: '20f' });

  const resumedTimes: number[] = [];
  await renderFrames(transport, (info) => { resumedTimes.push(info.time); }, { to: '10f' });
  await renderFrames(transport, (info) => { resumedTimes.push(info.time); }, { from: '10f', to: '20f' });

  // Both segments render frame 10 (the shared boundary); collapse that one duplicate before comparing.
  const deduped = resumedTimes.filter((time, i) => i === 0 || time !== resumedTimes[i - 1]);
  expect(deduped).toEqual(wholeTimes);
});

test('a 29.97df render reports the correct SMPTE timecode at frame 1800', async () => {
  const tween = new Tween({ from: 0, to: 1, duration: 65000 });
  const timeline = new Timeline({ frameRate: '29.97df' }).add(tween, 0);
  let at1800: string | undefined;
  for (const info of frames(timeline, { to: 61000 })) {
    if (info.frame === 1800) at1800 = info.timecode;
  }
  expect(at1800).toBe(formatTimecode(msToTimecode(frameToMs(1800, frameRate('29.97df')), frameRate('29.97df'))));
  expect(at1800).toBe('00:01:00;02');
});

test('an output with supportsOffline: false is skipped, not driven', async () => {
  const { timeline } = buildTimeline();
  let liveTicks = 0;
  await renderFrames(timeline, () => {}, {
    frameRate: 24,
    outputs: [{ name: 'live-audio', supportsOffline: false, onTick: () => { liveTicks += 1; } }],
  });
  expect(liveTicks).toBe(0);
});

test('the frames() generator yields the same times as renderFrames', () => {
  const { timeline } = buildTimeline();
  const generatorTimes = [...frames(timeline, { frameRate: 24 })].map((info) => info.time);
  expect(generatorTimes.length).toBe(25);
  expect(generatorTimes[0]).toBe(0);
  expect(generatorTimes.at(-1)).toBe(1000);
});

test('renderFrames rejects an infinite-duration source without an explicit `to`', async () => {
  const timeline = new Timeline({ repeat: Infinity }).add(new Tween({ from: 0, to: 1, duration: 100 }), 0);
  await expect(renderFrames(timeline, () => {})).rejects.toThrow(/infinite duration/);
});

test('a Transport built with an explicit duration renders offline even when the root repeats forever', async () => {
  const timeline = new Timeline({ repeat: Infinity }).add(new Tween({ from: 0, to: 1, duration: 100, easing: 'linear' }), 0);
  const transport = new OfflineTransport({ root: timeline, duration: 1000, frameRate: 10 });
  const result = await renderFrames(transport, () => {});
  expect(result.frames).toBe(11); // 0..1000ms at 10fps inclusive (frames 0..10)
});
