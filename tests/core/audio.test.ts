import { test, expect } from 'vitest';
import { Timeline, Transport } from '@dhaakon/motion';
import { createTestScheduler } from '@dhaakon/motion/testing';
import { AudioClip, audioOutput, renderAudio, audioClock } from '@dhaakon/motion/audio';
import { FakeAudioContext, FakeOfflineAudioContext, fakeAudioBuffer } from './fakes';

function setup() {
  const { driver, scheduler: loop } = createTestScheduler();
  const context = new FakeAudioContext();
  const buffer = fakeAudioBuffer(2); // 2 seconds
  const timeline = new Timeline();
  const clip = new AudioClip({ context: context as never, buffer: buffer as never, name: 'vo' });
  timeline.add(clip, 100); // starts at 100ms transport-local
  const transport = new Transport({ scheduler: loop, root: timeline, duration: 3000 });
  const output = audioOutput(context as never);
  transport.attach(output);
  return { driver, context, timeline, clip, transport, output };
}

test('play starts a source at the correct offset into the clip', () => {
  const { driver, context, transport } = setup();
  transport.play();
  driver.step(600); // 500ms into a clip that started at 100ms
  expect(context.sources.length).toBe(1);
  expect(context.sources[0].started).toBe(true);
  expect(context.sources[0].startOffset).toBeCloseTo(0.5, 2);
});

test('a large seek reads as drift and restarts the source', () => {
  const { driver, context, transport } = setup();
  transport.play();
  driver.step(600);
  expect(context.sources.length).toBe(1);
  transport.seek(1100);
  expect(context.sources[0].stopped).toBe(true);
  expect(context.sources.length).toBe(2);
  expect(context.sources[1].started).toBe(true);
});

test('pause stops the source', () => {
  const { driver, context, transport } = setup();
  transport.play();
  driver.step(600);
  transport.pause();
  expect(context.sources[0].stopped).toBe(true);
});

test('drift beyond the threshold restarts the source', () => {
  const { driver, context, transport } = setup();
  transport.play();
  driver.step(600);
  context.currentTime += 0.5; // the audio clock jumps independently of the transport's own clock
  driver.step(650);
  expect(context.sources.length).toBe(2);
  expect(context.sources[0].stopped).toBe(true);
});

test('a non-positive rate stops every voice (no reverse audio)', () => {
  const { driver, context, transport } = setup();
  transport.play();
  driver.step(600);
  transport.setRate(-1);
  expect(context.sources[0].stopped).toBe(true);
});

test('renderAudio schedules each clip start at start/1000 seconds', async () => {
  const context = new FakeOfflineAudioContext(1, 44100);
  const buffer = fakeAudioBuffer(1);
  const timeline = new Timeline();
  const clip = new AudioClip({ context: context as never, buffer: buffer as never });
  timeline.add(clip, 250);
  await renderAudio(timeline, context as never);
  expect(context.sources.length).toBe(1);
  expect(context.sources[0].startTime).toBeCloseTo(0.25, 6);
});

test("audioClock reads the AudioContext's own clock, in ms", () => {
  const context = new FakeAudioContext();
  context.currentTime = 2.5;
  const clock = audioClock(context);
  expect(clock.now()).toBe(2500);
});
