// Minimal Web Audio / Web MIDI fakes for tests: jsdom and node have neither API.

export class FakeAudioParam {
  value = 0;
  calls: Array<{ type: 'ramp' | 'target'; value: number; time: number }> = [];
  linearRampToValueAtTime(value: number, time: number) { this.value = value; this.calls.push({ type: 'ramp', value, time }); }
  setTargetAtTime(value: number, time: number) { this.value = value; this.calls.push({ type: 'target', value, time }); }
}

export class FakeGainNode {
  gain = new FakeAudioParam();
  connect() { return this; }
  disconnect() {}
}

export class FakeBufferSource {
  buffer: unknown = null;
  loop = false;
  playbackRate = new FakeAudioParam();
  started = false;
  stopped = false;
  startTime = 0;
  startOffset = 0;
  connect() { return this; }
  disconnect() {}
  start(when = 0, offset = 0) { this.started = true; this.startTime = when; this.startOffset = offset; }
  stop() { this.stopped = true; }
}

export class FakeAudioContext {
  currentTime = 0;
  state: 'running' | 'suspended' | 'closed' = 'running';
  destination = {};
  sources: FakeBufferSource[] = [];
  createBufferSource(): FakeBufferSource { const source = new FakeBufferSource(); this.sources.push(source); return source; }
  createGain(): FakeGainNode { return new FakeGainNode(); }
  async resume() { this.state = 'running'; }
}

export class FakeOfflineAudioContext extends FakeAudioContext {
  constructor(readonly length = 1, readonly sampleRate = 44100) { super(); }
  async startRendering() { return { length: this.length, sampleRate: this.sampleRate, duration: this.length / this.sampleRate }; }
}

export function fakeAudioBuffer(durationSeconds: number) {
  return { duration: durationSeconds };
}

export class FakeMIDIOutput {
  sent: Array<{ data: number[]; timestamp?: number }> = [];
  send(data: number[] | Uint8Array, timestamp?: number) { this.sent.push({ data: Array.from(data), timestamp }); }
}
