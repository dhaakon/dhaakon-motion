// src/testing.ts
import {
  FrameScheduler,
  scheduler,
  Tween,
  Timeline,
  frameRate,
  parseTime
} from "@dhaakon/motion";
import { replay } from "@dhaakon/motion/gesture";
var ManualDriver = class {
  time = 0;
  requests = 0;
  callback = null;
  now = () => this.time;
  request = (callback) => {
    this.callback = callback;
    this.requests += 1;
    return this.requests;
  };
  cancel = () => {
    this.callback = null;
  };
  /** Jump to an absolute time and run the pending frame callback once, if any is queued. */
  step(time) {
    this.time = time;
    const callback = this.callback;
    this.callback = null;
    callback?.(time);
  }
  /** Advance by a relative delta and run the pending frame callback once, if any is queued. */
  advance(delta) {
    this.step(this.time + delta);
  }
};
function createTestScheduler() {
  const driver = new ManualDriver();
  return { driver, scheduler: new FrameScheduler(driver) };
}
function installFrameDriver(driver = new ManualDriver()) {
  const restore = installOnScheduler(scheduler, driver);
  return { driver, restore };
}
function installOnScheduler(target, driver) {
  const previous = target.driver;
  target.setDriver(driver);
  return () => target.setDriver(previous);
}
function recordValues(tween) {
  const values = [];
  const previous = tween.onUpdate;
  tween.onUpdate = (value, progress, instance) => {
    values.push(value);
    previous?.(value, progress, instance);
  };
  return values;
}
function stepFrames(driver, n, frameRateInput) {
  const rate = frameRate(frameRateInput);
  for (let i = 1; i <= n; i += 1) driver.advance(1e3 * rate.den / rate.num);
}
function runUntil(driver, predicate, options = {}) {
  const maxFrames = options.maxFrames ?? 1e4;
  const rate = frameRate(options.frameRate ?? 60);
  for (let i = 0; i < maxFrames; i += 1) {
    if (predicate()) return;
    driver.advance(1e3 * rate.den / rate.num);
  }
  if (!predicate()) throw new Error(`runUntil: predicate was still false after ${maxFrames} frames`);
}
function sample(timeline, times, frameRateInput) {
  const rate = frameRateInput ? frameRate(frameRateInput) : timeline.frameRate;
  return times.map((input) => {
    const ms = typeof input === "number" ? input : parseTime(input, rate);
    timeline.sampleAt(ms);
    return { time: ms, values: collectTweenValues(timeline, "") };
  });
}
function collectTweenValues(timeline, prefix) {
  const values = {};
  timeline.items.forEach((entry, index) => {
    const key = entry.item.name ?? `${prefix}${index}`;
    if (entry.item instanceof Timeline) Object.assign(values, collectTweenValues(entry.item, `${key}.`));
    else if (entry.item instanceof Tween) values[key] = entry.item.value;
  });
  return values;
}
function snapshotTimeline(timeline, times) {
  const duration = Number.isFinite(timeline.totalDuration) ? timeline.totalDuration : timeline.duration;
  const sampleTimes = times ?? [0, duration / 2, duration];
  return {
    ascii: timeline.toAscii(),
    inspect: timeline.inspect(),
    samples: sample(timeline, sampleTimes)
  };
}
function expectSample(timeline, at, expected, options = {}) {
  const tolerance = options.tolerance ?? 1e-6;
  const ms = typeof at === "number" ? at : parseTime(at, timeline.frameRate);
  timeline.sampleAt(ms);
  const values = collectTweenValues(timeline, "");
  const mismatches = [];
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actual = values[key];
    const matches = typeof expectedValue === "number" && typeof actual === "number" ? Math.abs(actual - expectedValue) <= tolerance : JSON.stringify(actual) === JSON.stringify(expectedValue);
    if (!matches) mismatches.push(`  "${key}": expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual)}`);
  }
  if (mismatches.length) {
    throw new Error(`expectSample: at ${ms}ms (${JSON.stringify(at)})
${mismatches.join("\n")}

${timeline.toAscii()}`);
  }
}
function installPointerEvents() {
  const scope = globalThis;
  const previous = scope.PointerEvent;
  const elementPrototype = globalThis.Element?.prototype;
  const previousSet = elementPrototype?.setPointerCapture;
  const previousRelease = elementPrototype?.releasePointerCapture;
  const previousHas = elementPrototype?.hasPointerCapture;
  if (!scope.PointerEvent) {
    class TestPointerEvent extends MouseEvent {
      pointerId;
      pointerType;
      pressure;
      isPrimary;
      constructor(type, init = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? "mouse";
        this.pressure = init.pressure ?? 0;
        this.isPrimary = init.isPrimary ?? true;
      }
      getCoalescedEvents() {
        return [this];
      }
      getPredictedEvents() {
        return [];
      }
    }
    scope.PointerEvent = TestPointerEvent;
  }
  const captures = /* @__PURE__ */ new WeakMap();
  if (elementPrototype && !elementPrototype.setPointerCapture) elementPrototype.setPointerCapture = function(id) {
    const set = captures.get(this) ?? /* @__PURE__ */ new Set();
    set.add(id);
    captures.set(this, set);
  };
  if (elementPrototype && !elementPrototype.releasePointerCapture) elementPrototype.releasePointerCapture = function(id) {
    captures.get(this)?.delete(id);
  };
  if (elementPrototype && !elementPrototype.hasPointerCapture) elementPrototype.hasPointerCapture = function(id) {
    return captures.get(this)?.has(id) ?? false;
  };
  return () => {
    if (previous) scope.PointerEvent = previous;
    else Reflect.deleteProperty(scope, "PointerEvent");
    if (elementPrototype) {
      elementPrototype.setPointerCapture = previousSet;
      elementPrototype.releasePointerCapture = previousRelease;
      elementPrototype.hasPointerCapture = previousHas;
    }
  };
}
function pointer(element, options = {}) {
  const id = options.id ?? 1;
  const type = options.type ?? "touch";
  let last = { x: 0, y: 0, t: 0 };
  const dispatch = (kind, x, y, t) => {
    last = { x, y, t };
    const name = `pointer${kind === "cancel" ? "cancel" : kind}`;
    const event = new PointerEvent(name, { bubbles: true, cancelable: true, pointerId: id, pointerType: type, clientX: x, clientY: y, button: 0, buttons: kind === "up" || kind === "cancel" ? 0 : 1, isPrimary: id === 1 });
    Object.defineProperty(event, "timeStamp", { value: t });
    if (options.coalesced?.length && kind === "move") Object.defineProperty(event, "getCoalescedEvents", { value: () => options.coalesced.map(([cx, cy, ct]) => {
      const sample2 = new PointerEvent("pointermove", { pointerId: id, pointerType: type, clientX: cx, clientY: cy, buttons: 1 });
      Object.defineProperty(sample2, "timeStamp", { value: ct });
      return sample2;
    }) });
    element.dispatchEvent(event);
    return event;
  };
  return {
    down(x, y, t = 0) {
      return dispatch("down", x, y, t);
    },
    move(x, y, t = last.t + 16) {
      return dispatch("move", x, y, t);
    },
    up(x = last.x, y = last.y, t = last.t + 16) {
      return dispatch("up", x, y, t);
    },
    cancel() {
      return dispatch("cancel", last.x, last.y, last.t);
    }
  };
}
async function stroke(element, points, options = {}) {
  if (!points.length) return;
  const stream = pointer(element, options);
  stream.down(...points[0]);
  points.slice(1).forEach(([x, y, t]) => stream.move(x, y, t));
  const last = points.at(-1);
  stream.up(last[0], last[1], last[2]);
}
async function fling(element, options) {
  const duration = options.duration ?? 96;
  const frames = Math.max(2, Math.round(duration / 16));
  const stream = pointer(element, { id: options.id, type: options.type });
  stream.down(options.from[0], options.from[1], 0);
  for (let index = 1; index <= frames; index += 1) {
    const t = duration * index / frames;
    stream.move(options.from[0] + options.velocity[0] * t, options.from[1] + options.velocity[1] * t, t);
  }
  stream.up(void 0, void 0, duration);
}
var replayGesture = replay;
function measureLatency(element, motionValue) {
  return new Promise((resolve) => {
    let eventTime = 0;
    let removeValue = () => {
    };
    const onEvent = (event) => {
      eventTime = event.timeStamp;
      removeValue = motionValue.subscribe(() => {
        const writeTime = globalThis.performance?.now?.() ?? Date.now();
        removeValue();
        element.removeEventListener("pointermove", onEvent);
        resolve({ eventToWrite: Math.max(0, writeTime - eventTime) });
      });
    };
    element.addEventListener("pointermove", onEvent, { once: true });
  });
}
var FakeAudioParam = class {
  value = 0;
  calls = [];
  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.calls.push({ type: "ramp", value, time });
  }
  setTargetAtTime(value, time) {
    this.value = value;
    this.calls.push({ type: "target", value, time });
  }
};
var FakeGainNode = class {
  gain = new FakeAudioParam();
  connect() {
    return this;
  }
  disconnect() {
  }
};
var FakeBufferSource = class {
  buffer = null;
  loop = false;
  playbackRate = new FakeAudioParam();
  started = false;
  stopped = false;
  startTime = 0;
  startOffset = 0;
  connect() {
    return this;
  }
  disconnect() {
  }
  start(when = 0, offset = 0) {
    this.started = true;
    this.startTime = when;
    this.startOffset = offset;
  }
  stop() {
    this.stopped = true;
  }
};
var FakeAudioContext = class {
  currentTime = 0;
  state = "running";
  destination = {};
  sources = [];
  createBufferSource() {
    const source = new FakeBufferSource();
    this.sources.push(source);
    return source;
  }
  createGain() {
    return new FakeGainNode();
  }
  async resume() {
    this.state = "running";
  }
};
var FakeOfflineAudioContext = class extends FakeAudioContext {
  constructor(length = 1, sampleRate = 44100) {
    super();
    this.length = length;
    this.sampleRate = sampleRate;
  }
  async startRendering() {
    return { length: this.length, sampleRate: this.sampleRate, duration: this.length / this.sampleRate };
  }
};
function fakeAudioContext() {
  return new FakeAudioContext();
}
function fakeOfflineAudioContext(length = 1, sampleRate = 44100) {
  return new FakeOfflineAudioContext(length, sampleRate);
}
function fakeAudioBuffer(durationSeconds) {
  return { duration: durationSeconds };
}
var FakeMIDIOutput = class {
  sent = [];
  send(data, timestamp) {
    this.sent.push({ data: Array.from(data), timestamp });
  }
};
function fakeMidiPort() {
  return new FakeMIDIOutput();
}
export {
  FakeAudioContext,
  FakeAudioParam,
  FakeBufferSource,
  FakeGainNode,
  FakeMIDIOutput,
  FakeOfflineAudioContext,
  ManualDriver,
  createTestScheduler,
  expectSample,
  fakeAudioBuffer,
  fakeAudioContext,
  fakeMidiPort,
  fakeOfflineAudioContext,
  fling,
  installFrameDriver,
  installPointerEvents,
  measureLatency,
  pointer,
  recordValues,
  replayGesture,
  runUntil,
  sample,
  snapshotTimeline,
  stepFrames,
  stroke
};
//# sourceMappingURL=testing.js.map