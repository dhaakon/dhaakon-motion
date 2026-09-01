import { test, expect } from 'vitest';
import { Timeline, Transport } from '@dhaakon/motion';
import { createTestScheduler } from '@dhaakon/motion/testing';
import { midi, midiOutput, noteCue } from '@dhaakon/motion/midi';
import { FakeMIDIOutput } from './fakes';

test('midi byte builders produce the expected status/data bytes', () => {
  expect(midi.noteOn(60, 100, 0)).toEqual([0x90, 60, 100]);
  expect(midi.noteOff(60, 0)).toEqual([0x80, 60, 0]);
  expect(midi.cc(7, 127, 1)).toEqual([0xb1, 7, 127]);
  expect(midi.programChange(5, 2)).toEqual([0xc2, 5]);
});

test('noteCue emits a note-on and a note-off, duration apart', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const timeline = new Timeline();
  noteCue(timeline, 100, 60, { velocity: 90, duration: 200 });
  const transport = new Transport({ scheduler: loop, root: timeline, duration: 400 });
  const port = new FakeMIDIOutput();
  transport.attach(midiOutput(port));
  transport.play();
  driver.step(110);
  expect(port.sent.map((m) => m.data)).toEqual([midi.noteOn(60, 90, 0)]);
  driver.step(305);
  expect(port.sent.map((m) => m.data)).toEqual([midi.noteOn(60, 90, 0), midi.noteOff(60, 0)]);
});

test('cue payload routing ignores cues without a `midi` payload', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const timeline = new Timeline();
  timeline.cue('not-midi', 50, () => {}, { payload: { signal: { type: 'dmx' } } });
  const transport = new Transport({ scheduler: loop, root: timeline, duration: 100 });
  const port = new FakeMIDIOutput();
  transport.attach(midiOutput(port));
  transport.play();
  driver.step(60);
  expect(port.sent).toEqual([]);
});

test('timestamps are monotonic across multiple cues in one tick', () => {
  const { driver, scheduler: loop } = createTestScheduler();
  const timeline = new Timeline();
  timeline.cue('a', 10, () => {}, { payload: { midi: midi.noteOn(60) } });
  timeline.cue('b', 10, () => {}, { payload: { midi: midi.noteOn(64) } });
  const transport = new Transport({ scheduler: loop, root: timeline, duration: 100 });
  const port = new FakeMIDIOutput();
  transport.attach(midiOutput(port));
  transport.play();
  driver.step(20);
  expect(port.sent.length).toBe(2);
});
