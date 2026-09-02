// src/interpolate.ts
var unit = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i;
function parseColor(value) {
  const hex = value.trim().match(/^#([\da-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
    if (expanded.length === 6 || expanded.length === 8) return [
      parseInt(expanded.slice(0, 2), 16),
      parseInt(expanded.slice(2, 4), 16),
      parseInt(expanded.slice(4, 6), 16),
      expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1
    ];
  }
  const rgb = value.trim().match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] == null ? 1 : Number(rgb[4])] : null;
}
var mix = (from, to, progress) => from + (to - from) * progress;
function interpolate(from, to, progress) {
  if (typeof from === "number" && typeof to === "number") return mix(from, to, progress);
  if (typeof from === "string" && typeof to === "string") {
    const fromColor = parseColor(from);
    const toColor = parseColor(to);
    if (fromColor && toColor) {
      const [r, g, b2, a2] = fromColor.map((v, i) => mix(v, toColor[i], progress));
      return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b2)}, ${Number(a2.toFixed(3))})`;
    }
    const a = from.match(unit);
    const b = to.match(unit);
    if (a && b && a[2] === b[2]) return `${Number(mix(Number(a[1]), Number(b[1]), progress).toFixed(5))}${a[2]}`;
    return progress < 1 ? from : to;
  }
  if (Array.isArray(from) && Array.isArray(to)) return from.map((value, index) => interpolate(value, to[index] ?? value, progress));
  if (from && to && typeof from === "object" && typeof to === "object") {
    const output = {};
    for (const key of /* @__PURE__ */ new Set([...Object.keys(from), ...Object.keys(to)])) {
      const a = from[key];
      const b = to[key];
      output[key] = a == null ? b : b == null ? a : interpolate(a, b, progress);
    }
    return output;
  }
  return progress < 1 ? from : to;
}

// src/easing.ts
var clamp = (n) => Math.min(1, Math.max(0, n));
var easingSource = /* @__PURE__ */ new WeakMap();
function cubicBezier(x1, y1, x2, y2) {
  const sample = (a, b, t) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  const fn = (progress) => {
    const x = clamp(progress);
    let low = 0;
    let high = 1;
    let t = x;
    for (let i = 0; i < 12; i += 1) {
      const estimate = sample(x1, x2, t);
      if (Math.abs(estimate - x) < 1e-4) break;
      if (estimate < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return sample(y1, y2, t);
  };
  easingSource.set(fn, ["cubicBezier", x1, y1, x2, y2]);
  return fn;
}
function spring(options = {}) {
  const { stiffness = 170, damping = 26, mass = 1 } = options;
  const omega = Math.sqrt(stiffness / mass);
  const ratio = damping / (2 * Math.sqrt(stiffness * mass));
  const duration = 1;
  const response = (t) => {
    if (ratio < 1) {
      const damped = omega * Math.sqrt(1 - ratio * ratio);
      return 1 - Math.exp(-ratio * omega * t) * (Math.cos(damped * t) + ratio * omega / damped * Math.sin(damped * t));
    }
    return 1 - Math.exp(-omega * t) * (1 + omega * t);
  };
  const end = response(duration) || 1;
  const fn = (t) => response(clamp(t) * duration) / end;
  easingSource.set(fn, ["spring", options]);
  return fn;
}
function steps(count, position = "end") {
  const n = Math.max(1, Math.round(count));
  const fn = (t) => {
    const x = clamp(t);
    const step = position === "start" ? Math.ceil(x * n) : Math.floor(x * n);
    return Math.min(1, Math.max(0, step / n));
  };
  easingSource.set(fn, ["steps", n]);
  return fn;
}
var Easing = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2,
  easeInCubic: (t) => t ** 3,
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t) => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
  easeInQuart: (t) => t ** 4,
  easeOutQuart: (t) => 1 - (1 - t) ** 4,
  easeInOutQuart: (t) => t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2,
  easeOutBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  dhaakon: cubicBezier(0.16, 1, 0.3, 1)
};
var builtinNames = new Map(
  Object.entries(Easing).map(([name, fn]) => [fn, name])
);
var registry = /* @__PURE__ */ new Map();
function resolveEasing(easing) {
  if (!easing) return Easing.dhaakon;
  if (typeof easing === "function") return easing;
  if (typeof easing === "string") {
    if (easing in Easing) return Easing[easing];
    const registered = registry.get(easing);
    if (registered) return registered;
    throw new Error(`Unknown easing: "${easing}"`);
  }
  const [kind, ...args] = easing;
  if (kind === "cubicBezier") return cubicBezier(...args);
  if (kind === "spring") return spring(args[0]);
  if (kind === "steps") return steps(args[0]);
  throw new Error(`Unknown easing tuple: ${JSON.stringify(easing)}`);
}

// src/timecode.ts
function dropCount(fpsRounded) {
  return fpsRounded / 15;
}
var TC_RE = /^(\d{1,2}):(\d{2}):(\d{2})([:;])(\d{1,2})$/;
function parseTimecode(text, rate) {
  const match = text.trim().match(TC_RE);
  if (!match) throw new Error(`Invalid timecode: "${text}"`);
  const [, h, m, s, sep, f] = match;
  const dropFrame = sep === ";";
  if (dropFrame && !rate.dropFrame) {
    throw new Error(`Timecode "${text}" uses ';' (drop-frame) but the frame rate ${rate.label} is not drop-frame`);
  }
  const hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s);
  const frames = Number(f);
  const fpsRounded = Math.round(rate.fps);
  if (minutes > 59 || seconds > 59) throw new Error(`Invalid timecode "${text}": minutes and seconds must be 0-59`);
  if (frames >= fpsRounded) throw new Error(`Invalid timecode "${text}": frames must be 0-${fpsRounded - 1} at ${rate.label}`);
  if (rate.dropFrame) {
    const df = dropCount(fpsRounded);
    const isDroppedInstant = minutes % 10 !== 0 && seconds === 0 && frames < df;
    if (isDroppedInstant) {
      throw new Error(`Invalid drop-frame timecode "${text}": frame ${frames} is dropped at the start of minute ${minutes}`);
    }
  }
  return { hours, minutes, seconds, frames, dropFrame };
}
function timecodeToFrames(tc, rate) {
  const fpsRounded = Math.round(rate.fps);
  const totalMinutes = 60 * tc.hours + tc.minutes;
  let frame = fpsRounded * 3600 * tc.hours + fpsRounded * 60 * tc.minutes + fpsRounded * tc.seconds + tc.frames;
  if (rate.dropFrame) {
    frame -= dropCount(fpsRounded) * (totalMinutes - Math.floor(totalMinutes / 10));
  }
  return frame;
}
function framesToTimecode(frame, rate) {
  const fpsRounded = Math.round(rate.fps);
  if (!rate.dropFrame) {
    const framesPart2 = (frame % fpsRounded + fpsRounded) % fpsRounded;
    const totalSeconds2 = Math.floor(frame / fpsRounded);
    const secondsPart2 = (totalSeconds2 % 60 + 60) % 60;
    const totalMinutes2 = Math.floor(totalSeconds2 / 60);
    const minutesPart2 = (totalMinutes2 % 60 + 60) % 60;
    const hoursPart2 = Math.floor(totalMinutes2 / 60);
    return { hours: hoursPart2, minutes: minutesPart2, seconds: secondsPart2, frames: framesPart2, dropFrame: false };
  }
  const df = dropCount(fpsRounded);
  const framesPer24Hours = fpsRounded * 3600 * 24;
  const framesPer10Minutes = Math.round(rate.fps * 60 * 10);
  const framesPerMinute = fpsRounded * 60 - df;
  let f = (frame % framesPer24Hours + framesPer24Hours) % framesPer24Hours;
  const tenMinuteBlocks = Math.floor(f / framesPer10Minutes);
  const remainder = f % framesPer10Minutes;
  f += remainder > df ? df * 9 * tenMinuteBlocks + df * Math.floor((remainder - df) / framesPerMinute) : df * 9 * tenMinuteBlocks;
  const framesPart = f % fpsRounded;
  const totalSeconds = Math.floor(f / fpsRounded);
  const secondsPart = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutesPart = totalMinutes % 60;
  const hoursPart = Math.floor(totalMinutes / 60);
  return { hours: hoursPart, minutes: minutesPart, seconds: secondsPart, frames: framesPart, dropFrame: true };
}
function pad(n, width = 2) {
  return String(Math.trunc(n)).padStart(width, "0");
}
function formatTimecode(tc) {
  return `${pad(tc.hours)}:${pad(tc.minutes)}:${pad(tc.seconds)}${tc.dropFrame ? ";" : ":"}${pad(tc.frames)}`;
}
function msToTimecode(ms, rate) {
  return framesToTimecode(msToFrame(ms, rate), rate);
}
function timecodeToMs(input, rate) {
  const tc = typeof input === "string" ? parseTimecode(input, rate) : input;
  return frameToMs(timecodeToFrames(tc, rate), rate);
}

// src/time.ts
var gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
function trimFps(fps) {
  return String(Math.round(fps * 1e3) / 1e3);
}
function buildFrameRate(num, den, dropFrame) {
  if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) {
    throw new Error(`Invalid frame rate: ${num}/${den}`);
  }
  const divisor = gcd(Math.round(num), Math.round(den)) || 1;
  const n = Math.round(num) / divisor;
  const d = Math.round(den) / divisor;
  if (dropFrame && !(n === 3e4 && d === 1001 || n === 6e4 && d === 1001)) {
    throw new Error(`Drop-frame timecode is only valid at 29.97 or 59.94 fps, got ${n}/${d} (${trimFps(n / d)} fps)`);
  }
  const fps = n / d;
  return { num: n, den: d, dropFrame, fps, label: dropFrame ? `${trimFps(fps)}df` : trimFps(fps) };
}
var NTSC_TABLE = [
  { fps: 24e3 / 1001, num: 24e3, den: 1001 },
  { fps: 3e4 / 1001, num: 3e4, den: 1001 },
  { fps: 6e4 / 1001, num: 6e4, den: 1001 }
];
function frameRateFromNumber(numeric, dropFrame) {
  if (!Number.isFinite(numeric) || numeric <= 0) throw new Error(`Invalid frame rate: ${numeric}`);
  const ntsc = NTSC_TABLE.find((entry) => Math.abs(entry.fps - numeric) < 1e-3);
  if (ntsc) return buildFrameRate(ntsc.num, ntsc.den, dropFrame);
  if (Number.isInteger(numeric)) return buildFrameRate(numeric, 1, dropFrame);
  return buildFrameRate(Math.round(numeric * 1e3), 1e3, dropFrame);
}
function frameRateFromString(text) {
  const trimmed = text.trim();
  const dropFrame = /df$/i.test(trimmed);
  const numeric = Number(trimmed.replace(/df$/i, ""));
  return frameRateFromNumber(numeric, dropFrame);
}
var FrameRates = {
  "23.976": buildFrameRate(24e3, 1001, false),
  "24": buildFrameRate(24, 1, false),
  "25": buildFrameRate(25, 1, false),
  "29.97": buildFrameRate(3e4, 1001, false),
  "29.97df": buildFrameRate(3e4, 1001, true),
  "30": buildFrameRate(30, 1, false),
  "50": buildFrameRate(50, 1, false),
  "59.94": buildFrameRate(6e4, 1001, false),
  "59.94df": buildFrameRate(6e4, 1001, true),
  "60": buildFrameRate(60, 1, false)
};
function frameRate(input) {
  if (typeof input === "number") return frameRateFromNumber(input, false);
  if (typeof input === "string") return frameRateFromString(input);
  if (input && typeof input === "object" && "num" in input) {
    return buildFrameRate(input.num, input.den ?? 1, Boolean(input.dropFrame));
  }
  throw new Error(`Invalid frame rate: ${JSON.stringify(input)}`);
}
var FRAME_EPSILON = 1e-6;
function frameToMs(frame, rate) {
  return frame * 1e3 * rate.den / rate.num;
}
function msToFrame(ms, rate) {
  return Math.floor(ms * rate.num / (1e3 * rate.den) + FRAME_EPSILON);
}
var FRAMES_RE = /^(-?\d+(?:\.\d+)?)f$/i;
var SECONDS_RE = /^(-?\d+(?:\.\d+)?)s$/i;
var MS_RE = /^(-?\d+(?:\.\d+)?)ms$/i;
var TIMECODE_RE = /^\d{1,2}:\d{2}:\d{2}[:;]\d{1,2}$/;
function parseTime(input, rate) {
  if (typeof input === "number") return input;
  const text = input.trim();
  const framesMatch = text.match(FRAMES_RE);
  if (framesMatch) {
    if (rate == null) throw new Error(`parseTime: "${input}" is a frame value and needs a frameRate`);
    return frameToMs(Number(framesMatch[1]), frameRate(rate));
  }
  const secondsMatch = text.match(SECONDS_RE);
  if (secondsMatch) return Number(secondsMatch[1]) * 1e3;
  const msMatch = text.match(MS_RE);
  if (msMatch) return Number(msMatch[1]);
  if (TIMECODE_RE.test(text)) {
    if (rate == null) throw new Error(`parseTime: "${input}" is a timecode and needs a frameRate`);
    return timecodeToMs(text, frameRate(rate));
  }
  const plain = Number(text);
  if (text !== "" && Number.isFinite(plain)) return plain;
  throw new Error(`parseTime: unrecognized time value "${input}"`);
}

// src/cycle.ts
function activeDuration(spec) {
  if (spec.repeat === Infinity) return Infinity;
  return spec.duration * (spec.repeat + 1) + spec.repeatDelay * spec.repeat;
}
function totalDuration(spec) {
  return spec.delay + activeDuration(spec);
}
function sampleCycle(spec, milliseconds) {
  const active = Math.max(0, milliseconds - spec.delay);
  const cycleDuration = spec.duration + spec.repeatDelay;
  const iteration = spec.duration === 0 ? spec.repeat : Math.min(spec.repeat, Math.floor(active / Math.max(1, cycleDuration)));
  const cycleTime = Math.min(spec.duration, Math.max(0, active - iteration * cycleDuration));
  let raw = spec.duration === 0 ? 1 : cycleTime / spec.duration;
  const alternating = spec.direction === "alternate" || spec.direction === "alternate-reverse";
  const startsReverse = spec.direction === "reverse" || spec.direction === "alternate-reverse";
  if (startsReverse !== (alternating && iteration % 2 === 1) !== spec.reversed) raw = 1 - raw;
  const progress = Math.max(0, Math.min(1, raw));
  return { iteration, cycleTime, progress, active };
}

// src/scheduler.ts
var now = () => globalThis.performance?.now?.() ?? Date.now();
var driver = {
  request: typeof globalThis.requestAnimationFrame === "function" ? (callback) => globalThis.requestAnimationFrame(callback) : (callback) => globalThis.setTimeout(() => callback(now()), 16),
  cancel: typeof globalThis.cancelAnimationFrame === "function" ? (id) => globalThis.cancelAnimationFrame(id) : (id) => globalThis.clearTimeout(id),
  now
};
var FrameScheduler = class {
  constructor(driver2 = globalThisDriver) {
    this.driver = driver2;
  }
  driver;
  tasks = /* @__PURE__ */ new Set();
  frame = null;
  get size() {
    return this.tasks.size;
  }
  now() {
    return this.driver.now();
  }
  add(task) {
    this.tasks.add(task);
    this.wake();
    return () => this.delete(task);
  }
  delete(task) {
    this.tasks.delete(task);
    if (!this.tasks.size && this.frame != null) {
      this.driver.cancel(this.frame);
      this.frame = null;
    }
  }
  flush(time = this.now()) {
    for (const task of [...this.tasks]) if (task(time) === false) this.tasks.delete(task);
  }
  clear() {
    this.tasks.clear();
    if (this.frame != null) this.driver.cancel(this.frame);
    this.frame = null;
  }
  /** Swap the underlying time/frame source (used by tests). Cancels any pending frame and re-wakes on the new driver if tasks are active. */
  setDriver(driver2) {
    if (this.frame != null) this.driver.cancel(this.frame);
    this.frame = null;
    this.driver = driver2;
    if (this.tasks.size) this.wake();
  }
  wake() {
    if (this.frame == null) this.frame = this.driver.request(this.tick);
  }
  tick = (time) => {
    this.frame = null;
    this.flush(time);
    if (this.tasks.size) this.wake();
  };
};
var globalThisDriver = driver;
var scheduler = new FrameScheduler(globalThisDriver);

// src/track.ts
var Track = class {
  kind = "track";
  name;
  resolvedKeyframes = [];
  authoredKeyframes;
  segments = [];
  apply;
  repeat;
  repeatDelay;
  repeatDelayInput;
  direction;
  explicitRateInput;
  inheritedRateInput;
  defaultEasing;
  constructor(options) {
    if (!options.apply && !options.target) throw new Error("Track needs either `apply` or `target`.");
    this.name = options.name;
    this.apply = options.apply ?? ((value) => options.target.set(value));
    this.repeat = options.repeat ?? 0;
    this.repeatDelayInput = options.repeatDelay ?? 0;
    this.repeatDelay = 0;
    this.direction = options.direction ?? "normal";
    this.explicitRateInput = options.frameRate;
    this.defaultEasing = options.easing;
    this.authoredKeyframes = options.keyframes.map((key) => ({ ...key }));
    if (!options.keyframes.length) throw new Error("Track needs at least one keyframe.");
    this.resolveTiming();
  }
  get keyframes() {
    return this.resolvedKeyframes;
  }
  get frameRate() {
    const authored = [...this.authoredKeyframes.map((keyframe) => keyframe.at), this.repeatDelayInput];
    const provisional = authored.some((input) => typeof input === "string" && input.includes(";")) ? "29.97df" : 60;
    return frameRate(this.explicitRateInput ?? this.inheritedRateInput ?? provisional);
  }
  bindFrameRate(rate) {
    this.inheritedRateInput = rate;
    this.resolveTiming();
  }
  resolveTiming() {
    const rate = this.frameRate;
    const resolved = this.authoredKeyframes.map((key) => ({ at: parseTime(key.at, rate), value: key.value, easing: key.easing })).sort((a, b) => a.at - b.at);
    this.resolvedKeyframes = resolved.map(({ at, value }) => ({ at, value }));
    this.repeatDelay = Math.max(0, parseTime(this.repeatDelayInput, rate));
    this.segments = [];
    for (let i = 1; i < resolved.length; i += 1) {
      this.segments.push({ from: resolved[i - 1].at, to: resolved[i].at, ease: resolveEasing(resolved[i].easing ?? this.defaultEasing) });
    }
  }
  /** Content length: the last keyframe's time. */
  get duration() {
    return this.keyframes.at(-1)?.at ?? 0;
  }
  get totalDuration() {
    return totalDuration({ duration: this.duration, delay: 0, repeat: this.repeat, repeatDelay: this.repeatDelay });
  }
  /** Pure: the interpolated value at a content-local time, without writing it anywhere. */
  valueAt(ms) {
    const first = this.keyframes[0];
    const last = this.keyframes.at(-1);
    if (this.keyframes.length === 1 || ms <= first.at) return first.value;
    if (ms >= last.at) return last.value;
    const index = this.segments.findIndex((segment2) => ms <= segment2.to);
    const segment = this.segments[index === -1 ? this.segments.length - 1 : index];
    const from = this.keyframes[index];
    const to = this.keyframes[index + 1];
    const span = segment.to - segment.from;
    const t = span <= 0 ? 1 : (ms - segment.from) / span;
    return interpolate(from.value, to.value, segment.ease(Math.max(0, Math.min(1, t))));
  }
  sampleAt(localMs, ctx) {
    const spec = { duration: this.duration, delay: 0, repeat: this.repeat, repeatDelay: this.repeatDelay, direction: this.direction, reversed: false };
    const { cycleTime } = sampleCycle(spec, localMs);
    this.apply(this.valueAt(cycleTime), ctx);
  }
};

// src/items.ts
var defaultRenderContext = { direction: 1, fireCues: true };

// src/trace.ts
var wallNow = () => globalThis.performance?.now?.() ?? Date.now();
function createTrace(options = {}) {
  const capacity = Math.max(1, options.capacity ?? 200);
  let tickCount = 0;
  let state = "idle";
  let lastTickAt = null;
  const trace = {
    name: "trace",
    entries: [],
    onStateChange(next) {
      state = next;
    },
    onTick(info) {
      const now2 = wallNow();
      const durationMs = lastTickAt == null ? 0 : now2 - lastTickAt;
      lastTickAt = now2;
      const cues = (info.cues ?? []).map((cue) => cue.name);
      trace.entries.push({ tick: tickCount, time: info.time, frame: info.frame, rate: info.rate, state, cues, durationMs });
      if (trace.entries.length > capacity) trace.entries.splice(0, trace.entries.length - capacity);
      tickCount += 1;
    },
    clear() {
      trace.entries.length = 0;
      tickCount = 0;
      lastTickAt = null;
    },
    toText() {
      return trace.entries.map((entry) => {
        const cues = entry.cues.length ? ` cues=[${entry.cues.join(", ")}]` : "";
        return `#${entry.tick} t=${entry.time.toFixed(1)}ms f=${entry.frame} rate=${entry.rate} state=${entry.state}${cues}`;
      }).join("\n");
    }
  };
  return trace;
}

// src/transport.ts
var Transport = class {
  frameRate;
  root;
  onError = (err) => {
    console.error(err);
  };
  schedulerRef;
  clock;
  _time = 0;
  lastRenderedTime = 0;
  _rate;
  _state = "idle";
  snap;
  anchorClock = 0;
  anchorTime = 0;
  loopRegion = null;
  explicitDuration;
  removeFrame;
  outputs = /* @__PURE__ */ new Set();
  pendingCues = null;
  listeners = /* @__PURE__ */ new Set();
  loopListeners = /* @__PURE__ */ new Set();
  resolveFinished;
  finished;
  constructor(options = {}) {
    this.schedulerRef = options.scheduler ?? scheduler;
    this.clock = options.clock ?? { now: () => this.schedulerRef.now() };
    this.frameRate = frameRate(options.frameRate ?? 60);
    this._rate = options.rate ?? 1;
    this.snap = options.snap ?? false;
    this.root = options.root ?? new Timeline({ scheduler: options.scheduler });
    this.root.bindTransport(this);
    if (options.duration != null) this.explicitDuration = parseTime(options.duration, this.frameRate);
    this.finished = this.newFinished();
    if (options.loop) this.setLoop(options.loop);
  }
  get time() {
    return this._time;
  }
  get rate() {
    return this._rate;
  }
  get state() {
    return this._state;
  }
  get duration() {
    return this.explicitDuration ?? this.root.totalDuration;
  }
  get frame() {
    return msToFrame(this._time, this.frameRate);
  }
  get timecode() {
    return formatTimecode(msToTimecode(this._time, this.frameRate));
  }
  get progress() {
    const d = this.duration;
    return d && Number.isFinite(d) ? this._time / d : 0;
  }
  add(item, at) {
    this.root.add(item, at);
    return this;
  }
  attach(output) {
    this.outputs.add(output);
    output.onAttach?.(this);
    return () => {
      if (this.outputs.delete(output)) output.onDetach?.();
    };
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /** Notified once per lap when a loop region wraps. */
  onLoop(listener) {
    this.loopListeners.add(listener);
    return () => {
      this.loopListeners.delete(listener);
    };
  }
  /** Attach a ring-buffer trace output that records every tick (and the cues that fired during it). */
  trace(options = {}) {
    const trace = createTrace(options);
    this.attach(trace);
    return trace;
  }
  play() {
    if (this._state === "playing") return this;
    if (this._state === "finished") {
      this._time = this._rate >= 0 ? 0 : this.boundedDuration();
      this.lastRenderedTime = this._time;
      this.root.reset?.();
      this.finished = this.newFinished();
    }
    this._state = "playing";
    this.anchorClock = this.clock.now();
    this.anchorTime = this._time;
    this.removeFrame = this.schedulerRef.add(this.onFrame);
    this.emitStateChange();
    return this;
  }
  pause() {
    if (this._state !== "playing") return this;
    this.removeFrame?.();
    this._state = "paused";
    this.emitStateChange();
    return this;
  }
  stop() {
    this.removeFrame?.();
    this._state = "idle";
    this._time = 0;
    this.root.reset?.();
    this.renderAt(0, false);
    this.emitStateChange();
    return this;
  }
  toggle() {
    return this._state === "playing" ? this.pause() : this.play();
  }
  seek(to, options = {}) {
    let target = Math.max(0, Math.min(this.boundedDuration(), parseTime(to, this.frameRate)));
    if (this.loopRegion && target === this.loopRegion[1]) {
      const [a, b] = this.loopRegion;
      const carriedCues = this.renderAt(b, options.cues !== "skip", { emit: false, direction: 1 });
      this.fireLoop();
      this.renderAt(a, false, { emit: false, direction: 1 });
      target = a;
      this._time = target;
      if (this._state === "playing") {
        this.anchorClock = this.clock.now();
        this.anchorTime = target;
      }
      this.renderAt(target, false, { direction: 1, carriedCues });
      this.emitSeek();
      return this;
    }
    this._time = target;
    if (this._state === "playing") {
      this.anchorClock = this.clock.now();
      this.anchorTime = target;
    }
    this.renderAt(target, options.cues !== "skip");
    this.emitSeek();
    return this;
  }
  seekFrame(frame) {
    return this.seek(frameToMs(frame, this.frameRate));
  }
  seekTimecode(tc) {
    return this.seek(tc);
  }
  step(frames = 1) {
    this.pause();
    return this.seekFrame(this.frame + frames);
  }
  setRate(rate) {
    if (this._state === "playing") {
      this.anchorClock = this.clock.now();
      this.anchorTime = this._time;
    }
    this._rate = rate;
    for (const output of this.outputs) output.onRateChange?.(rate);
    return this;
  }
  reverse() {
    return this.setRate(-this._rate);
  }
  setLoop(loop) {
    if (!loop) {
      this.loopRegion = null;
      return this;
    }
    if (loop === true) {
      const duration = this.duration;
      if (!Number.isFinite(duration)) throw new Error("Transport.setLoop(true) needs a finite duration; pass an explicit duration or a [from, to] region.");
      this.loopRegion = [0, duration];
      return this;
    }
    const [a, b] = loop;
    this.loopRegion = [parseTime(a, this.frameRate), parseTime(b, this.frameRate)];
    return this;
  }
  /** Follow an external clock (an LTC/MTC decoder, an OSC message, another transport). Hard-seeks past `threshold`; otherwise nudges rate to converge. */
  chase(externalMs, options = {}) {
    const smoothingWindow = (options.smoothing ?? 0.1) * 1e3;
    const threshold = options.threshold ?? 40;
    if (this._state !== "playing") this.play();
    const diff = externalMs - this._time;
    if (Math.abs(diff) > threshold) {
      const direction = this._rate >= 0 ? 1 : -1;
      this.seek(externalMs);
      this.setRate(direction);
      return this;
    }
    this.setRate(1 + diff / smoothingWindow);
    return this;
  }
  /** Manually drive the transport from an absolute clock value. Used by offline rendering and tests. */
  tick(now2) {
    this.advance(now2);
  }
  dispose() {
    this.removeFrame?.();
    for (const output of this.outputs) output.onDetach?.();
    this.outputs.clear();
    this.listeners.clear();
    this.loopListeners.clear();
  }
  // The scheduler is only a tick source; the time source is `this.clock` (which may
  // differ, e.g. an AudioContext clock), so the scheduler's own `now` is ignored here.
  onFrame = () => {
    this.advance(this.clock.now());
    return this._state === "playing";
  };
  advance(now2) {
    const elapsed = now2 - this.anchorClock;
    this.advanceTo(this.anchorTime + elapsed * this._rate);
  }
  advanceTo(rawTime) {
    if (this.loopRegion) {
      const [a, b] = this.loopRegion;
      const len = b - a;
      let remaining = rawTime;
      let guard = 0;
      const carriedCues = [];
      while (len > 0 && guard++ < 1e4) {
        if (this._rate >= 0) {
          if (remaining < b) break;
          carriedCues.push(...this.renderAt(b, true, { emit: false, direction: 1 }));
          this.fireLoop();
          remaining = a + (remaining - b);
          this.renderAt(a, false, { emit: false, direction: 1 });
        } else {
          if (remaining >= a) break;
          carriedCues.push(...this.renderAt(a, true, { emit: false, direction: -1 }));
          this.fireLoop();
          remaining = b + (remaining - a);
          this.renderAt(b, false, { emit: false, direction: -1 });
        }
      }
      this._time = Math.max(a, Math.min(b, remaining));
      this.renderAt(this._time, true, { direction: this._rate >= 0 ? 1 : -1, carriedCues });
      return;
    }
    const duration = this.duration;
    const clamped = Math.max(0, Math.min(duration, rawTime));
    this._time = clamped;
    this.renderAt(clamped, true);
    const reachedEnd = Number.isFinite(duration) && duration > 0 && (this._rate >= 0 && clamped >= duration || this._rate < 0 && clamped <= 0);
    if (reachedEnd && this._state === "playing") this.finish();
  }
  renderAt(time, fireCues, options = {}) {
    const quantized = this.snap ? this.frameSnap(time) : time;
    const direction = options.direction ?? (quantized >= this.lastRenderedTime ? 1 : -1);
    const delta = quantized - this.lastRenderedTime;
    this._time = quantized;
    const info = {
      time: quantized,
      frame: msToFrame(quantized, this.frameRate),
      timecode: formatTimecode(msToTimecode(quantized, this.frameRate)),
      delta,
      rate: this._rate,
      direction,
      frameRate: this.frameRate
    };
    this.pendingCues = options.carriedCues?.length ? options.carriedCues.slice() : null;
    this.root.sampleAt(quantized, { direction, fireCues, frame: info, transport: this });
    if (this.pendingCues) info.cues = this.pendingCues;
    if (options.emit !== false) {
      for (const output of this.outputs) {
        try {
          output.onTick?.(info);
        } catch (err) {
          this.onError(err);
        }
      }
      for (const listener of this.listeners) listener(info, this);
    }
    this.lastRenderedTime = quantized;
    return info.cues ?? [];
  }
  /** Records that a cue fired during the current tick (called by `Timeline`). Not usually called directly. */
  noteCue(event) {
    (this.pendingCues ??= []).push(event);
  }
  frameSnap(ms) {
    return frameToMs(msToFrame(ms, this.frameRate), this.frameRate);
  }
  emitSeek() {
    const info = {
      time: this._time,
      frame: this.frame,
      timecode: this.timecode,
      delta: 0,
      rate: this._rate,
      direction: 1,
      frameRate: this.frameRate
    };
    for (const output of this.outputs) output.onSeek?.(info);
  }
  emitStateChange() {
    for (const output of this.outputs) output.onStateChange?.(this._state, this);
  }
  fireLoop() {
    for (const listener of this.loopListeners) listener();
  }
  boundedDuration() {
    const duration = this.duration;
    return Number.isFinite(duration) ? duration : 0;
  }
  finish() {
    this._state = "finished";
    this.emitStateChange();
    this.resolveFinished(this);
  }
  newFinished() {
    return new Promise((resolve) => {
      this.resolveFinished = resolve;
    });
  }
};

// src/timeline.ts
var TIME_LITERAL_RE = /^-?\d+(?:\.\d+)?(?:f|s|ms)$|^\d{1,2}:\d{2}:\d{2}[:;]\d{1,2}$/i;
var ANCHOR_RE = /^([<>])(?:([+-]=)(.+))?$/;
var LABEL_OFFSET_RE = /^(.+?)([+-]=)(.+)$/;
var Timeline = class _Timeline {
  kind = "timeline";
  name;
  options;
  entries = [];
  labels = /* @__PURE__ */ new Map();
  cursor = 0;
  /** The furthest a marker/cue/region reaches; a cue-only timeline (no content) still has a real, sampleable duration. */
  markerCursor = 0;
  explicitRateInput;
  inheritedRateInput;
  points = [];
  markerMeta = /* @__PURE__ */ new Map();
  lastCycleTime = null;
  lastIteration = 0;
  parentTimeline;
  ownTransport;
  constructor(options = {}) {
    this.options = options;
    this.name = options.name;
    this.explicitRateInput = options.frameRate;
    if (options.autoplay) queueMicrotask(() => this.play());
  }
  // ---- content length vs. playback length -------------------------------
  /** Content length: the furthest a child, marker, cue, or region reaches, before this timeline's own repeat/yoyo is applied. */
  get duration() {
    return Math.max(this.cursor, this.markerCursor);
  }
  /** Content length including this timeline's own repeat/repeatDelay. `Infinity` when `repeat` is `Infinity`. */
  get totalDuration() {
    return totalDuration({ duration: this.duration, delay: 0, repeat: this.options.repeat ?? 0, repeatDelay: this.repeatDelay });
  }
  get frameRate() {
    return frameRate(this.explicitRateInput ?? this.inheritedRateInput ?? 60);
  }
  get repeatDelay() {
    return Math.max(0, parseTime(this.options.repeatDelay ?? 0, this.frameRate));
  }
  get frames() {
    return msToFrame(this.duration, this.frameRate);
  }
  timecode(ms = this.duration) {
    return msToTimecode(ms, this.frameRate);
  }
  // ---- tree ---------------------------------------------------------------
  get parent() {
    return this.parentTimeline;
  }
  get items() {
    return this.entries;
  }
  /** Walks up to the outermost timeline and returns its private transport, if it has been played. */
  get rootTransport() {
    let node = this;
    while (node.parentTimeline) node = node.parentTimeline;
    return node.ownTransport;
  }
  /** Called by a `Transport`'s constructor when it adopts this timeline as its `root` (including its own default root). Not usually called directly. */
  bindTransport(transport) {
    if (this.parentTimeline) throw new Error(this.nestedError());
    if (this.ownTransport && this.ownTransport !== transport) {
      throw new Error(`Timeline${this.name ? ` "${this.name}"` : ""} already has its own transport (it was played directly, or is already another transport's root).`);
    }
    this.bindFrameRate(transport.frameRate);
    this.ownTransport = transport;
  }
  /** Adopt a containing timeline/transport timebase and remeasure every descendant item. Explicit timeline rates still win. */
  bindFrameRate(rate) {
    this.inheritedRateInput = rate;
    for (const entry of this.entries) {
      entry.item.bindFrameRate?.(this.frameRate);
      entry.end = entry.start + entry.item.totalDuration;
    }
    this.cursor = this.entries.reduce((max, entry) => Math.max(max, entry.end), 0);
  }
  label(name, at = this.cursor) {
    const time = this.resolvePosition(at, this.entries.at(-1));
    this.labels.set(name, time);
    this.markerCursor = Math.max(this.markerCursor, time);
    return this;
  }
  add(item, at) {
    if (item instanceof _Timeline) {
      if (item.parentTimeline) throw new Error(`Timeline${item.name ? ` "${item.name}"` : ""} is already attached to another timeline.`);
      if (item.ownTransport) throw new Error(`Timeline${item.name ? ` "${item.name}"` : ""} already has its own transport (it was played directly); nest it before playing it.`);
      item.parentTimeline = this;
    }
    if (this.explicitRateInput !== void 0 || this.inheritedRateInput !== void 0) item.bindFrameRate?.(this.frameRate);
    const previous = this.entries.at(-1);
    const start = this.resolvePosition(at, previous);
    const end = start + item.totalDuration;
    this.entries.push({ item, start, end });
    this.cursor = Math.max(this.cursor, end);
    return this;
  }
  /** @deprecated kept for the pre-0.4 API; identical to `add`. */
  addTween(tween, at) {
    return this.add(tween, at);
  }
  addTweens(tweens) {
    tweens.forEach((tween) => this.add(tween));
    return this;
  }
  remove(item) {
    const index = this.entries.findIndex((entry) => entry.item === item);
    if (index === -1) return this;
    this.entries.splice(index, 1);
    if (item instanceof _Timeline && item.parentTimeline === this) item.parentTimeline = void 0;
    this.cursor = this.entries.reduce((max, entry) => Math.max(max, entry.end), 0);
    return this;
  }
  clear() {
    for (const entry of this.entries) if (entry.item instanceof _Timeline && entry.item.parentTimeline === this) entry.item.parentTimeline = void 0;
    this.entries = [];
    this.labels.clear();
    this.markerMeta.clear();
    this.points = [];
    this.cursor = 0;
    this.markerCursor = 0;
    this.lastCycleTime = null;
    this.lastIteration = 0;
    return this;
  }
  // ---- markers, cues, regions ---------------------------------------------
  get markers() {
    return [...this.labels.entries()].map(([name, time]) => ({ kind: "marker", name, time, ...this.markerMeta.get(name) })).sort((a, b) => a.time - b.time);
  }
  get cues() {
    return this.points.map((p) => ({ name: p.name, time: p.time })).sort((a, b) => a.time - b.time);
  }
  marker(name, at = this.cursor, options = {}) {
    const time = this.resolvePosition(at, this.entries.at(-1));
    this.labels.set(name, time);
    this.markerCursor = Math.max(this.markerCursor, time);
    if (options.color != null || options.payload !== void 0) this.markerMeta.set(name, options);
    return this;
  }
  cue(name, at, handler, options = {}) {
    const time = this.resolvePosition(at, this.entries.at(-1));
    this.insertPoint({ name, time, payload: options.payload, once: options.once ?? false, fired: false, onForward: handler, onBackward: handler });
    return this;
  }
  region(name, from, to, options = {}) {
    const previous = this.entries.at(-1);
    const fromTime = this.resolvePosition(from, previous);
    const toTime = this.resolvePosition(to, previous);
    const payload = options.payload;
    const once = options.once ?? false;
    this.insertPoint({ name, time: fromTime, payload, once, fired: false, onForward: options.onEnter, onBackward: options.onExit });
    this.insertPoint({ name, time: toTime, payload, once, fired: false, onForward: options.onExit, onBackward: options.onEnter });
    return this;
  }
  insertPoint(point) {
    const index = this.points.findIndex((existing) => existing.time > point.time);
    if (index === -1) this.points.push(point);
    else this.points.splice(index, 0, point);
    this.markerCursor = Math.max(this.markerCursor, point.time);
  }
  seekToMarker(name) {
    const time = this.labels.get(name);
    if (time == null) throw new Error(`Unknown timeline label: ${name}`);
    this.seek(this.totalDuration ? time / this.totalDuration : 0);
    return this;
  }
  nextMarker(fromMs = this.lastCycleTime ?? 0) {
    return this.markers.find((marker) => marker.time > fromMs);
  }
  previousMarker(fromMs = this.lastCycleTime ?? 0) {
    return [...this.markers].reverse().find((marker) => marker.time < fromMs);
  }
  // ---- inspection -----------------------------------------------------------
  inspect() {
    return this.inspectAsChild(0, this.totalDuration);
  }
  inspectAsChild(start, end) {
    return {
      kind: this.kind,
      name: this.name,
      start,
      end,
      duration: this.duration,
      totalDuration: this.totalDuration,
      repeat: this.options.repeat ?? 0,
      direction: this.options.yoyo ? "alternate" : "normal",
      startTimecode: formatTimecode(msToTimecode(start, this.frameRate)),
      children: this.entries.map((entry) => entry.item instanceof _Timeline ? entry.item.inspectAsChild(entry.start, entry.end) : {
        kind: entry.item.kind,
        name: entry.item.name,
        start: entry.start,
        end: entry.end,
        duration: entry.item.totalDuration,
        totalDuration: entry.item.totalDuration,
        repeat: 0,
        direction: "normal",
        children: [],
        markers: [],
        cues: []
      }),
      markers: this.markers,
      cues: this.cues
    };
  }
  /** A stable, human-readable rendering of the tree, its markers, and its cues. */
  toAscii(options = {}) {
    const width = Math.max(10, options.width ?? 60);
    const root = this.inspect();
    const total = Math.max(1, Number.isFinite(root.totalDuration) ? root.totalDuration : root.duration);
    const scale = (t) => Math.max(0, Math.min(width, Math.round(Math.min(t, total) / total * width)));
    const lines = [`${this.name ?? "timeline"}  0 .. ${Math.round(total)}ms`];
    const renderNode = (node, depth, isLast, prefix) => {
      const connector = depth === 0 ? "" : isLast ? "\u2514 " : "\u251C ";
      const barStart = scale(node.start);
      const barEnd = Math.max(barStart + 1, scale(node.end));
      const bar = `${" ".repeat(barStart)}${"\u2588".repeat(Math.min(width, barEnd) - barStart)}`;
      const label = (node.name ?? node.kind).padEnd(10);
      lines.push(`${prefix}${connector}${label} ${node.kind.padEnd(8)} ${bar}`);
      const childPrefix = depth === 0 ? "" : `${prefix}${isLast ? "  " : "\u2502 "}`;
      node.children.forEach((child, index) => renderNode(child, depth + 1, index === node.children.length - 1, childPrefix));
    };
    root.children.forEach((child, index) => renderNode(child, 1, index === root.children.length - 1, ""));
    if (options.labels !== false) {
      const markerText = this.markers.map((marker) => `\u25C6 ${marker.name} @ ${Math.round(marker.time)}`).join("   ");
      const cueText = this.cues.map((cue) => `\u25CF ${cue.name} @ ${Math.round(cue.time)}`).join("   ");
      if (markerText) lines.push(markerText);
      if (cueText) lines.push(cueText);
    }
    return lines.join("\n");
  }
  /** How a position string resolved: its absolute time, and (for a label/anchor form) the base it was measured from. */
  explain(position) {
    const previous = this.entries.at(-1);
    const ms = this.resolvePosition(position, previous);
    const result = {
      ms,
      frame: msToFrame(ms, this.frameRate),
      timecode: formatTimecode(msToTimecode(ms, this.frameRate))
    };
    if (typeof position === "string") {
      const text = position.trim();
      const anchorMatch = text.match(ANCHOR_RE);
      if (anchorMatch) {
        result.base = anchorMatch[1];
        if (anchorMatch[3]) result.offset = parseTime(anchorMatch[3], this.frameRate) * (anchorMatch[2] === "+=" ? 1 : -1);
      } else {
        const labelMatch = text.match(LABEL_OFFSET_RE);
        if (labelMatch) {
          result.base = labelMatch[1];
          result.offset = parseTime(labelMatch[3], this.frameRate) * (labelMatch[2] === "+=" ? 1 : -1);
        }
      }
    }
    return result;
  }
  // ---- playback (root timelines only) --------------------------------------
  nestedError() {
    return `Timeline${this.name ? ` "${this.name}"` : ""} is nested; control its root transport instead.`;
  }
  get transport() {
    if (this.parentTimeline) throw new Error(this.nestedError());
    if (!this.ownTransport) {
      this.ownTransport = new Transport({ root: this, scheduler: this.options.scheduler, frameRate: this.frameRate, snap: this.options.snap });
    }
    return this.ownTransport;
  }
  get state() {
    return this.transport.state;
  }
  get finished() {
    return this.transport.finished;
  }
  play() {
    this.transport.play();
    return this;
  }
  start() {
    return this.play();
  }
  pause() {
    this.transport.pause();
    return this;
  }
  stop() {
    this.transport.stop();
    return this;
  }
  reverse() {
    this.transport.reverse();
    return this;
  }
  /** `progress` is a 0..1 fraction of `totalDuration`, matching the pre-0.4 API. */
  seek(progress) {
    const duration = this.totalDuration;
    this.transport.seek(Number.isFinite(duration) ? Math.max(0, Math.min(1, progress)) * duration : 0);
    return this;
  }
  loop(value = true) {
    this.options.repeat = value ? Infinity : 0;
    return this;
  }
  // ---- sampling -------------------------------------------------------------
  sampleAt(localMs, ctx = defaultRenderContext) {
    const spec = {
      duration: this.duration,
      delay: 0,
      repeat: this.options.repeat ?? 0,
      repeatDelay: this.repeatDelay,
      direction: this.options.yoyo ? "alternate" : "normal",
      reversed: false
    };
    const { cycleTime, iteration, progress } = sampleCycle(spec, localMs);
    if (ctx.fireCues && this.points.length) this.fireCrossings(cycleTime, iteration, ctx);
    this.lastCycleTime = cycleTime;
    this.lastIteration = iteration;
    for (const entry of this.entries) entry.item.sampleAt(cycleTime - entry.start, ctx);
    this.options.onUpdate?.(cycleTime, progress);
    if (progress >= 1 && iteration >= (this.options.repeat ?? 0)) this.options.onComplete?.();
    return cycleTime;
  }
  /** Alias of `sampleAt` for absolute (not delay-relative) callers, matching the pre-0.4 API. */
  render(time) {
    this.sampleAt(time);
  }
  reset() {
    this.lastCycleTime = null;
    this.lastIteration = 0;
    for (const point of this.points) point.fired = false;
    for (const entry of this.entries) entry.item.reset?.();
  }
  iterationReversed(iteration) {
    return this.options.yoyo === true && iteration % 2 === 1;
  }
  fireCrossings(cycleTime, iteration, ctx) {
    if (this.lastCycleTime == null) {
      this.fireSegment(ctx.direction >= 0 ? -Infinity : Infinity, cycleTime, ctx);
      return;
    }
    if (iteration === this.lastIteration) {
      this.fireSegment(this.lastCycleTime, cycleTime, ctx);
      return;
    }
    const stepDir = iteration > this.lastIteration ? 1 : -1;
    let iter = this.lastIteration;
    let from = this.lastCycleTime;
    let guard = 0;
    while (iter !== iteration && guard++ < 2e3) {
      const tail = this.iterationReversed(iter) ? 0 : this.duration;
      this.fireSegment(from, tail, ctx);
      iter += stepDir;
      from = this.iterationReversed(iter) ? this.duration : 0;
    }
    this.fireSegment(from, cycleTime, ctx);
  }
  fireSegment(fromT, toT, ctx) {
    if (toT === fromT || !this.points.length) return;
    const forward = toT > fromT;
    const ordered = forward ? this.points : [...this.points].reverse();
    for (const point of ordered) {
      const crossed = forward ? point.time > fromT && point.time <= toT : point.time <= fromT && point.time > toT;
      if (!crossed) continue;
      if (point.once && point.fired) continue;
      const handler = forward ? point.onForward : point.onBackward;
      if (!handler) continue;
      point.fired = true;
      const event = { name: point.name, time: point.time, direction: forward ? 1 : -1, payload: point.payload, timeline: this, frame: ctx.frame };
      try {
        handler(event);
        this.rootTransport?.noteCue(event);
      } catch (err) {
        (this.rootTransport?.onError ?? defaultOnError)(err);
      }
    }
  }
  // ---- positions --------------------------------------------------------
  resolvePosition(at, previous) {
    if (at == null) return previous?.end ?? 0;
    if (typeof at === "number") return Math.max(0, at);
    const text = at.trim();
    const anchorMatch = text.match(ANCHOR_RE);
    if (anchorMatch) {
      const [, anchor, op, offsetText] = anchorMatch;
      const base2 = anchor === "<" ? previous?.start ?? 0 : previous?.end ?? 0;
      if (!op) return Math.max(0, base2);
      return Math.max(0, base2 + parseTime(offsetText, this.frameRate) * (op === "+=" ? 1 : -1));
    }
    if (TIME_LITERAL_RE.test(text)) return Math.max(0, parseTime(text, this.frameRate));
    const labelMatch = text.match(LABEL_OFFSET_RE);
    const labelName = labelMatch ? labelMatch[1] : text;
    const base = this.labels.get(labelName);
    if (base == null) throw new Error(`Unknown timeline label: ${at}`);
    if (!labelMatch) return Math.max(0, base);
    return Math.max(0, base + parseTime(labelMatch[3], this.frameRate) * (labelMatch[2] === "+=" ? 1 : -1));
  }
};
function defaultOnError(err) {
  console.error(err);
}

// src/audio.ts
function audioClock(context) {
  return { now: () => context.currentTime * 1e3 };
}
var AudioClip = class {
  kind = "audio";
  name;
  context;
  buffer;
  destination;
  offset;
  gain;
  loop;
  explicitDuration;
  constructor(options) {
    this.context = options.context;
    this.buffer = options.buffer;
    this.destination = options.destination;
    this.offset = options.offset ?? 0;
    this.gain = options.gain ?? 1;
    this.loop = options.loop ?? false;
    this.explicitDuration = options.duration;
    this.name = options.name;
  }
  get totalDuration() {
    return this.explicitDuration ?? Math.max(0, this.buffer.duration * 1e3 - this.offset);
  }
  /** No-op: `AudioClip` has no per-frame value. Scheduling is owned by `audioOutput`/`renderAudio`, which read absolute clip positions directly. */
  sampleAt() {
  }
};
function collectAudioClips(timeline, offset, out) {
  for (const entry of timeline.items) {
    const start = offset + entry.start;
    const end = offset + entry.end;
    if (entry.item instanceof AudioClip) out.push({ clip: entry.item, start, end });
    else if (entry.item instanceof Timeline) collectAudioClips(entry.item, start, out);
  }
  return out;
}
function audioOutput(context, options = {}) {
  const driftThreshold = options.driftThreshold ?? 25;
  const active = /* @__PURE__ */ new Map();
  let clips = [];
  const stopVoice = (clip) => {
    const voice = active.get(clip);
    if (!voice) return;
    try {
      voice.source.stop();
    } catch {
    }
    active.delete(clip);
  };
  const stopAll = () => {
    for (const clip of [...active.keys()]) stopVoice(clip);
  };
  const startVoice = (placed, info) => {
    const source = context.createBufferSource();
    source.buffer = placed.clip.buffer;
    source.loop = placed.clip.loop;
    source.playbackRate.value = Math.max(0, Math.abs(info.rate));
    const gainNode = context.createGain();
    gainNode.gain.value = placed.clip.gain;
    source.connect(gainNode);
    gainNode.connect(placed.clip.destination ?? context.destination);
    const offsetIntoClip = Math.max(0, (info.time - placed.start) / 1e3 + placed.clip.offset / 1e3);
    source.start(context.currentTime, offsetIntoClip);
    active.set(placed.clip, { source, startedAtContextTime: context.currentTime, startedAtTransportTime: info.time });
  };
  return {
    name: options.name ?? "audio",
    supportsOffline: false,
    onAttach(transport) {
      clips = collectAudioClips(transport.root, 0, []);
    },
    onStateChange(state) {
      if (state !== "playing") stopAll();
    },
    // No onSeek handler: Transport fires onTick (with the new time) before onSeek, so
    // stopping here would undo whatever the tick's drift check just correctly started.
    // A seek already reads as a large drift on the next tick and restarts naturally.
    onRateChange(rate) {
      if (rate <= 0) {
        stopAll();
        return;
      }
      for (const voice of active.values()) voice.source.playbackRate.value = Math.abs(rate);
    },
    onTick(info) {
      if (info.rate <= 0) {
        stopAll();
        return;
      }
      for (const placed of clips) {
        const shouldPlay = info.time >= placed.start && info.time < placed.end;
        if (!shouldPlay) {
          stopVoice(placed.clip);
          continue;
        }
        const voice = active.get(placed.clip);
        if (!voice) {
          startVoice(placed, info);
          continue;
        }
        const expectedContextTime = voice.startedAtContextTime + (info.time - voice.startedAtTransportTime) / 1e3 * info.rate;
        const driftMs = Math.abs(context.currentTime - expectedContextTime) * 1e3;
        if (driftMs > driftThreshold) {
          stopVoice(placed.clip);
          startVoice(placed, info);
        }
      }
    },
    onDetach() {
      stopAll();
    },
    async unlock() {
      if (context.state === "suspended") await context.resume();
    }
  };
}
function paramTrack(param, keyframes, options) {
  const { context, ...rest } = options;
  return new Track({ ...rest, keyframes, apply: (value) => {
    param.linearRampToValueAtTime(value, context.currentTime + 1 / 60);
  } });
}
async function renderAudio(source, context, options = {}) {
  const root = source instanceof Transport ? source.root : source;
  const clips = collectAudioClips(root, 0, []);
  const from = options.from ?? 0;
  const to = options.to ?? Infinity;
  for (const placed of clips) {
    if (placed.end <= from || placed.start >= to) continue;
    const bufferSource = context.createBufferSource();
    bufferSource.buffer = placed.clip.buffer;
    bufferSource.loop = placed.clip.loop;
    const gainNode = context.createGain();
    gainNode.gain.value = placed.clip.gain;
    bufferSource.connect(gainNode);
    gainNode.connect(placed.clip.destination ?? context.destination);
    const startAt = Math.max(0, (placed.start - from) / 1e3);
    bufferSource.start(startAt, placed.clip.offset / 1e3);
  }
  return context.startRendering();
}
export {
  AudioClip,
  audioClock,
  audioOutput,
  paramTrack,
  renderAudio
};
//# sourceMappingURL=audio.js.map