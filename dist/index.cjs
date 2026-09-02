"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  Easing: () => Easing,
  FrameRates: () => FrameRates,
  FrameScheduler: () => FrameScheduler,
  Line: () => Line,
  MotionValue: () => MotionValue,
  OfflineTransport: () => OfflineTransport,
  Timeline: () => Timeline,
  Track: () => Track,
  Transport: () => Transport,
  Tween: () => Tween,
  activeDuration: () => activeDuration,
  addFrames: () => addFrames,
  animate: () => animate,
  applyScene: () => applyScene,
  captureScene: () => captureScene,
  createTrace: () => createTrace,
  cubicBezier: () => cubicBezier,
  default: () => src_default,
  defaultRenderContext: () => defaultRenderContext,
  drawOutput: () => drawOutput,
  formatTime: () => formatTime,
  formatTimecode: () => formatTimecode,
  frameRate: () => frameRate,
  frameToMs: () => frameToMs,
  frames: () => frames,
  framesToTimecode: () => framesToTimecode,
  interpolate: () => interpolate,
  loadSheet: () => loadSheet,
  mix: () => mix,
  msToFrame: () => msToFrame,
  msToTimecode: () => msToTimecode,
  parseTime: () => parseTime,
  parseTimecode: () => parseTimecode,
  readStyle: () => readStyle,
  registerEasing: () => registerEasing,
  renderFrames: () => renderFrames,
  resolveEasing: () => resolveEasing,
  sampleCycle: () => sampleCycle,
  saveSheet: () => saveSheet,
  sceneSheet: () => sceneSheet,
  sceneTransition: () => sceneTransition,
  scheduler: () => scheduler,
  serializeEasing: () => serializeEasing,
  signalOutput: () => signalOutput,
  snapToFrame: () => snapToFrame,
  spring: () => spring,
  stagger: () => stagger,
  steps: () => steps,
  styleTrack: () => styleTrack,
  timecodeToFrames: () => timecodeToFrames,
  timecodeToMs: () => timecodeToMs,
  totalDuration: () => totalDuration,
  track: () => track,
  validateSheet: () => validateSheet,
  writeStyle: () => writeStyle
});
module.exports = __toCommonJS(src_exports);

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
function registerEasing(name, fn) {
  registry.set(name, fn);
  return fn;
}
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
function serializeEasing(input) {
  if (input == null) return void 0;
  if (typeof input !== "function") return input;
  const builtin = builtinNames.get(input);
  if (builtin) return builtin;
  for (const [name, fn] of registry) if (fn === input) return name;
  return easingSource.get(input);
}

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
  const frames2 = Number(f);
  const fpsRounded = Math.round(rate.fps);
  if (minutes > 59 || seconds > 59) throw new Error(`Invalid timecode "${text}": minutes and seconds must be 0-59`);
  if (frames2 >= fpsRounded) throw new Error(`Invalid timecode "${text}": frames must be 0-${fpsRounded - 1} at ${rate.label}`);
  if (rate.dropFrame) {
    const df = dropCount(fpsRounded);
    const isDroppedInstant = minutes % 10 !== 0 && seconds === 0 && frames2 < df;
    if (isDroppedInstant) {
      throw new Error(`Invalid drop-frame timecode "${text}": frame ${frames2} is dropped at the start of minute ${minutes}`);
    }
  }
  return { hours, minutes, seconds, frames: frames2, dropFrame };
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
function addFrames(tc, frames2, rate) {
  return framesToTimecode(timecodeToFrames(tc, rate) + frames2, rate);
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
function snapToFrame(ms, rate) {
  return frameToMs(msToFrame(ms, rate), rate);
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
function formatTime(ms, rate, style = "ms") {
  if (style === "ms") return `${Math.round(ms)}ms`;
  if (style === "seconds") return `${(ms / 1e3).toFixed(3)}s`;
  if (rate == null) throw new Error(`formatTime: style "${style}" needs a frameRate`);
  const resolved = frameRate(rate);
  if (style === "frames") return `${msToFrame(ms, resolved)}f`;
  return formatTimecode(msToTimecode(ms, resolved));
}

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
function track(target, keyframes, options = {}) {
  return target instanceof MotionValue ? new Track({ ...options, keyframes, target }) : new Track({ ...options, keyframes, apply: target });
}

// src/core.ts
var Line = class {
  curves;
  constructor(start, end) {
    if (start.length !== end.length) throw new Error(`Uneven amount of lines: ${start.length} != ${end.length}`);
    this.curves = [start.slice(), end.slice()];
  }
  value(progress) {
    return interpolate(this.curves[0], this.curves[1], progress);
  }
};
var Tween = class {
  static Line = Line;
  kind = "tween";
  name;
  duration = 300;
  delay = 0;
  repeat = 0;
  repeatDelay = 0;
  direction = "normal";
  state = "idle";
  isAnimating = false;
  isPaused = false;
  isReversed = false;
  node = null;
  properties;
  from = 0;
  toValue = 1;
  easing = resolveEasing();
  onBegin;
  onStart;
  onUpdate;
  onEnd;
  onComplete;
  value = this.from;
  progress = 0;
  elapsed = 0;
  durationInput = 300;
  delayInput = 0;
  repeatDelayInput = 0;
  explicitRateInput;
  inheritedRateInput;
  frameLoop = scheduler;
  startedAt = 0;
  removeFrame;
  resolveFinished;
  finished;
  constructor(options = {}) {
    this.finished = this.newFinishedPromise();
    this.configure(options);
    if (options.autoplay) queueMicrotask(() => this.play());
  }
  configure(options) {
    const timingKeys = /* @__PURE__ */ new Set(["duration", "delay", "repeatDelay", "frameRate"]);
    for (const [key, value] of Object.entries(options)) if (value !== void 0 && !timingKeys.has(key)) this[key] = value;
    if (options.duration !== void 0) this.durationInput = options.duration;
    if (options.delay !== void 0) this.delayInput = options.delay;
    if (options.repeatDelay !== void 0) this.repeatDelayInput = options.repeatDelay;
    if (options.frameRate !== void 0) this.explicitRateInput = options.frameRate;
    this.resolveTiming();
    if (options.scheduler) this.frameLoop = options.scheduler;
    if (options.ease || options.easing) this.easing = resolveEasing(options.ease ?? options.easing);
    if (options.yoyo) this.direction = "alternate";
    if (options.curve instanceof Line) {
      this.from = options.curve.curves[0];
      this.toValue = options.curve.curves[1];
    } else if (options.curve) [this.from, this.toValue] = options.curve;
    if (options.from !== void 0) this.from = options.from;
    if (options.to !== void 0) this.toValue = options.to;
    if (options.properties) {
      this.properties = options.properties;
      this.from = Object.fromEntries(Object.entries(options.properties).map(([key, range]) => [key, range.start]));
      this.toValue = Object.fromEntries(Object.entries(options.properties).map(([key, range]) => [key, range.end]));
    }
    this.value = this.from;
    return this;
  }
  to(options) {
    this.stop();
    return this.configure(options);
  }
  play(options) {
    if (options) this.configure(options);
    if (this.isAnimating) return this;
    if (this.state === "finished" || this.state === "cancelled") {
      this.elapsed = 0;
      this.finished = this.newFinishedPromise();
    }
    this.isAnimating = true;
    this.isPaused = false;
    this.state = this.elapsed < this.delay ? "delayed" : "running";
    this.startedAt = this.frameLoop.now() - this.elapsed;
    if (this.elapsed === 0) {
      this.onBegin?.(this);
      this.onStart?.(this);
    }
    this.removeFrame = this.frameLoop.add(this.advance);
    return this;
  }
  pause() {
    if (!this.isAnimating) return this;
    this.removeFrame?.();
    this.isAnimating = false;
    this.isPaused = true;
    this.state = "paused";
    return this;
  }
  stop() {
    this.removeFrame?.();
    this.isAnimating = false;
    this.isPaused = false;
    this.state = "idle";
    this.elapsed = 0;
    this.sampleAt(0);
    return this;
  }
  cancel() {
    this.removeFrame?.();
    this.isAnimating = false;
    this.isPaused = false;
    this.state = "cancelled";
    this.resolveFinished(this);
    return this;
  }
  reverse() {
    const active = Math.max(0, this.elapsed - this.delay);
    this.isReversed = !this.isReversed;
    if (this.repeat === Infinity) {
      const cycleDuration = Math.max(1, this.duration + this.repeatDelay);
      const iteration = Math.floor(active / cycleDuration);
      const cycleTime = Math.min(this.duration, Math.max(0, active - iteration * cycleDuration));
      this.elapsed = this.delay + iteration * cycleDuration + Math.max(0, this.duration - cycleTime);
    } else this.elapsed = this.delay + Math.max(0, this.activeDuration - active);
    if (this.isAnimating) this.startedAt = this.frameLoop.now() - this.elapsed;
    this.sampleAt(this.elapsed);
    return this;
  }
  seek(progress) {
    const seekDuration = this.repeat === Infinity ? this.duration : this.activeDuration;
    return this.seekTime(this.delay + Math.max(0, Math.min(1, progress)) * seekDuration);
  }
  seekTime(milliseconds) {
    if (!Number.isFinite(milliseconds)) return this;
    this.elapsed = Math.max(0, Math.min(this.totalDuration, milliseconds));
    this.sampleAt(this.elapsed);
    if (this.isAnimating) this.startedAt = this.frameLoop.now() - this.elapsed;
    return this;
  }
  setDuration(duration, rate) {
    this.durationInput = duration;
    if (rate !== void 0) this.explicitRateInput = rate;
    this.resolveTiming();
    return this;
  }
  /** Effective timebase for authored frame/SMPTE fields. A standalone `;` timecode provisionally implies 29.97df until attached. */
  get frameRate() {
    const authored = [this.durationInput, this.delayInput, this.repeatDelayInput];
    const provisional = authored.some((input) => typeof input === "string" && input.includes(";")) ? "29.97df" : 60;
    return frameRate(this.explicitRateInput ?? this.inheritedRateInput ?? provisional);
  }
  /** Called by Timeline/Transport attachment. An explicit `frameRate` option is never overwritten. */
  bindFrameRate(rate) {
    this.inheritedRateInput = rate;
    this.resolveTiming();
  }
  /** The frame index the tween's active time falls in, at `rate` (default 60 fps). Floor-based: matches which frame is on screen. */
  frameAt(rate = 60) {
    return msToFrame(Math.max(0, this.elapsed - this.delay), frameRate(rate));
  }
  /** The SMPTE timecode for the tween's active time, at `rate`. */
  timecodeAt(rate) {
    return msToTimecode(Math.max(0, this.elapsed - this.delay), frameRate(rate));
  }
  getCurrentFrame(fps = 60) {
    return this.frameAt(fps);
  }
  /**
   * A two-keyframe `Track` equivalent to this tween's `from`/`to`/`duration`/`easing`/`repeat`/`repeatDelay`/`direction`.
   * Its `apply` forwards sampled values to this tween's own `onUpdate` (progress is not recomputed — read `value` from the callback).
   */
  toTrack() {
    return new Track({
      name: this.name,
      keyframes: [{ at: this.delay, value: this.from }, { at: this.delay + this.duration, value: this.toValue, easing: this.easing }],
      repeat: this.repeat,
      repeatDelay: this.repeatDelay,
      direction: this.direction,
      apply: (value) => {
        this.value = value;
        this.onUpdate?.(value, this.progress, this);
      }
    });
  }
  get activeDuration() {
    return this.repeat === Infinity ? Infinity : this.duration * (this.repeat + 1) + this.repeatDelay * this.repeat;
  }
  get totalDuration() {
    return this.delay + this.activeDuration;
  }
  sampleAt(milliseconds, _ctx) {
    const { progress } = sampleCycle(
      { duration: this.duration, delay: this.delay, repeat: this.repeat, repeatDelay: this.repeatDelay, direction: this.direction, reversed: this.isReversed },
      milliseconds
    );
    this.progress = progress;
    this.value = interpolate(this.from, this.toValue, this.easing(this.progress));
    if (this.node && this.properties && typeof this.value === "object" && !Array.isArray(this.value)) {
      for (const [key, value] of Object.entries(this.value)) this.node.style.setProperty(key, `${value}${this.properties[key]?.unit ?? ""}`);
    }
    this.onUpdate?.(this.value, this.progress, this);
    return this.value;
  }
  advance = (time) => {
    this.elapsed = Math.min(this.totalDuration, Math.max(0, time - this.startedAt));
    this.state = this.elapsed < this.delay ? "delayed" : "running";
    this.sampleAt(this.elapsed);
    if (this.elapsed < this.totalDuration) return true;
    this.isAnimating = false;
    this.isPaused = false;
    this.state = "finished";
    this.onEnd?.(this);
    this.onComplete?.(this);
    this.resolveFinished(this);
    return false;
  };
  resolveTiming() {
    const rate = this.frameRate;
    this.duration = Math.max(0, parseTime(this.durationInput, rate));
    this.delay = Math.max(0, parseTime(this.delayInput, rate));
    this.repeatDelay = Math.max(0, parseTime(this.repeatDelayInput, rate));
  }
  newFinishedPromise() {
    return new Promise((resolve) => {
      this.resolveFinished = resolve;
    });
  }
};
var MotionValue = class {
  constructor(current) {
    this.current = current;
  }
  current;
  listeners = /* @__PURE__ */ new Set();
  animation;
  get() {
    return this.current;
  }
  set(value) {
    if (Object.is(value, this.current)) return;
    this.current = value;
    for (const listener of this.listeners) listener();
  }
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  animate(to, options = {}) {
    this.stop();
    this.animation = new Tween({ ...options, from: this.current, to, onUpdate: (value) => this.set(value) }).play();
    return this.animation;
  }
  stop() {
    this.animation?.cancel();
    this.animation = void 0;
  }
};
function animate(from, to, options = {}) {
  return new Tween({ ...options, from, to }).play();
}
function stagger(interval = 60, { start = 0 } = {}) {
  return (index) => start + index * interval;
}

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
  step(frames2 = 1) {
    this.pause();
    return this.seekFrame(this.frame + frames2);
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

// src/offline.ts
var OfflineTransport = class extends Transport {
  attach(output) {
    return attachForOffline(this, output, (o) => super.attach(o));
  }
};
function resolveOfflineTransport(source, options) {
  if (source instanceof Transport) return source;
  return new OfflineTransport({ root: source, frameRate: options.frameRate ?? source.frameRate });
}
var warnedOffline = /* @__PURE__ */ new WeakSet();
function attachForOffline(transport, output, doAttach = (o) => transport.attach(o)) {
  if (output.supportsOffline === false) {
    if (!warnedOffline.has(output)) {
      warnedOffline.add(output);
      console.warn(`renderFrames/frames: output${output.name ? ` "${output.name}"` : ""} does not support offline rendering and was skipped.`);
    }
    return () => {
    };
  }
  return doAttach(output);
}
function resolveRange(transport, rate, options) {
  const from = options.from != null ? parseTime(options.from, rate) : 0;
  const to = options.to != null ? parseTime(options.to, rate) : transport.duration;
  if (!Number.isFinite(to)) throw new Error("renderFrames/frames: the transport has an infinite duration; pass an explicit `to`.");
  return { from, to };
}
async function renderFrames(source, onFrame, options = {}) {
  const transport = resolveOfflineTransport(source, options);
  const rate = options.frameRate ? frameRate(options.frameRate) : transport.frameRate;
  const { from, to } = resolveRange(transport, rate, options);
  const detachers = (options.outputs ?? []).map((output) => attachForOffline(transport, output));
  let latest;
  const unsubscribe = transport.subscribe((info) => {
    latest = info;
  });
  try {
    if (from <= 0) transport.root.reset?.();
    transport.seek(from, { cues: "skip" });
    const startFrame = msToFrame(from, rate);
    const endFrame = msToFrame(to, rate);
    let count = 0;
    for (let frame = startFrame; frame <= endFrame; frame += 1) {
      if (options.signal?.aborted) break;
      transport.seek(frameToMs(frame, rate), { cues: "fire" });
      const result = onFrame(latest);
      if (result) await result;
      count += 1;
      if (options.yieldEvery && count % options.yieldEvery === 0) await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    return { frames: count, from, to };
  } finally {
    unsubscribe();
    for (const detach of detachers) detach();
  }
}
function* frames(source, options = {}) {
  const transport = resolveOfflineTransport(source, options);
  const rate = options.frameRate ? frameRate(options.frameRate) : transport.frameRate;
  const { from, to } = resolveRange(transport, rate, options);
  let latest;
  const unsubscribe = transport.subscribe((info) => {
    latest = info;
  });
  try {
    if (from <= 0) transport.root.reset?.();
    transport.seek(from, { cues: "skip" });
    const startFrame = msToFrame(from, rate);
    const endFrame = msToFrame(to, rate);
    for (let frame = startFrame; frame <= endFrame; frame += 1) {
      transport.seek(frameToMs(frame, rate), { cues: "fire" });
      yield latest;
    }
  } finally {
    unsubscribe();
  }
}

// src/dom.ts
var transformKeys = /* @__PURE__ */ new Set(["x", "y", "z", "scale", "scaleX", "scaleY", "rotate", "rotateX", "rotateY", "skewX", "skewY"]);
var unitless = /* @__PURE__ */ new Set(["opacity", "zIndex", "fontWeight", "lineHeight", "scale", "scaleX", "scaleY", "flexGrow", "flexShrink"]);
function writeStyle(node, values) {
  const transforms = [];
  for (const [key, value] of Object.entries(values)) {
    if (transformKeys.has(key)) {
      const unit2 = key.startsWith("rotate") || key.startsWith("skew") ? "deg" : key.startsWith("scale") ? "" : "px";
      const name = key === "x" ? "translateX" : key === "y" ? "translateY" : key === "z" ? "translateZ" : key;
      transforms.push(`${name}(${typeof value === "number" ? `${value}${unit2}` : value})`);
    } else {
      const cssKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      node.style.setProperty(cssKey, typeof value === "number" && !unitless.has(key) ? `${value}px` : String(value));
    }
  }
  if (transforms.length) node.style.transform = transforms.join(" ");
}
function readStyle(node, target) {
  const computed = getComputedStyle(node);
  const values = {};
  for (const key of Object.keys(target)) {
    if (transformKeys.has(key)) {
      values[key] = key.startsWith("scale") ? 1 : 0;
      continue;
    }
    const css = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const value = computed.getPropertyValue(css);
    values[key] = Number.isNaN(Number(value)) || value.trim() === "" ? value : Number(value);
  }
  return values;
}
function styleTrack(node, keyframes, options = {}) {
  return new Track({ ...options, keyframes, apply: (value) => writeStyle(node, value) });
}

// src/outputs.ts
function drawOutput(draw, options = {}) {
  return { name: options.name ?? "draw", onTick: draw };
}
function signalOutput(send, options = {}) {
  return {
    name: options.name ?? "signal",
    onTick(info) {
      for (const cue of info.cues ?? []) {
        if (options.filter && !options.filter(cue)) continue;
        const signal = cue.payload && typeof cue.payload === "object" && "signal" in cue.payload ? cue.payload.signal : cue.payload;
        send(signal, cue, info);
      }
    }
  };
}

// src/sheet.ts
var targetKeys = /* @__PURE__ */ new WeakMap();
function resolveEasingWithBindings(input, easings) {
  if (input == null) return void 0;
  if (typeof input === "string" && easings?.[input]) return easings[input];
  return resolveEasing(input);
}
function resolveTarget(key, bindings, strict, path) {
  if (key == null) return void 0;
  const target = bindings.targets?.[key];
  if (target == null) {
    const message = `${path}: unknown target "${key}"`;
    if (strict) throw new Error(message);
    console.warn(`loadSheet: ${message}; skipping the write.`);
    return void 0;
  }
  return target instanceof MotionValue ? (value) => target.set(value) : target;
}
function buildItem(item, bindings, strict, path, rate) {
  if (item.type === "tween") {
    const tween_ = item;
    const write = resolveTarget(tween_.target, bindings, strict, path);
    const tween = new Tween({
      name: tween_.name,
      from: tween_.from,
      to: tween_.to,
      duration: tween_.duration,
      delay: tween_.delay,
      repeat: tween_.repeat,
      repeatDelay: tween_.repeatDelay,
      frameRate: rate,
      yoyo: tween_.yoyo,
      easing: resolveEasingWithBindings(tween_.easing, bindings.easings),
      onUpdate: write ? (value) => write(value) : void 0
    });
    if (tween_.target) targetKeys.set(tween, tween_.target);
    return tween;
  }
  if (item.type === "track") {
    const track_ = item;
    const write = resolveTarget(track_.target, bindings, strict, path);
    const track2 = new Track({
      name: track_.name,
      frameRate: rate,
      keyframes: track_.keyframes.map((k) => ({ at: k.at, value: k.value, easing: k.easing })),
      repeat: track_.repeat,
      repeatDelay: track_.repeatDelay,
      direction: track_.direction === "alternate" ? "alternate" : "normal",
      easing: resolveEasingWithBindings(track_.easing, bindings.easings),
      apply: write ?? (() => {
      })
    });
    if (track_.target) targetKeys.set(track2, track_.target);
    return track2;
  }
  if (item.type === "timeline") {
    return buildTimeline(item, bindings, strict, path, rate);
  }
  const built = bindings.createItem?.(item, { bindings, strict });
  if (built) return built;
  const message = `${path}: unknown item type "${item.type}"`;
  if (strict) throw new Error(message);
  console.warn(`loadSheet: ${message}; skipping it. Pass bindings.createItem to handle it.`);
  return void 0;
}
function applyMarkersCuesRegions(timeline, sheet, bindings) {
  for (const marker of sheet.markers ?? []) timeline.marker(marker.name, marker.at, { color: marker.color, payload: marker.payload });
  for (const cue of sheet.cues ?? []) {
    const handler = bindings.cues?.[cue.name] ?? (() => {
    });
    const options = { payload: cue.payload, once: cue.once };
    timeline.cue(cue.name, cue.at, handler, options);
  }
  for (const region of sheet.regions ?? []) {
    timeline.region(region.name, region.from, region.to, {
      payload: region.payload,
      once: region.once,
      onEnter: bindings.cues?.[`${region.name}:enter`],
      onExit: bindings.cues?.[`${region.name}:exit`]
    });
  }
}
function buildTimeline(sheet, bindings, strict, path, inheritedRate) {
  const rate = sheet.frameRate ?? inheritedRate;
  const options = {
    name: sheet.name,
    frameRate: rate,
    repeat: sheet.repeat,
    repeatDelay: sheet.repeatDelay,
    yoyo: sheet.direction === "alternate"
  };
  const timeline = new Timeline(options);
  applyMarkersCuesRegions(timeline, sheet, bindings);
  sheet.items.forEach((item, index) => {
    const item_ = item;
    const built = buildItem(item, bindings, strict, `${path}.items[${index}]`, rate);
    if (built) timeline.add(built, item_.at);
  });
  return timeline;
}
function loadSheet(sheet, bindings = {}, options = {}) {
  const parsed = typeof sheet === "string" ? JSON.parse(sheet) : sheet;
  const strict = options.strict ?? true;
  const validated = validateSheet(parsed);
  if (!validated.ok) {
    const message = validated.errors.map((e) => `${e.path}: ${e.message}`).join("\n");
    throw new Error(`loadSheet: invalid cue sheet:
${message}`);
  }
  return buildTimeline(parsed, bindings, strict, "$", void 0);
}
function saveSheet(timeline) {
  return {
    $schema: "dhaakon-motion/cue-sheet/1",
    ...timeline.name ? { name: timeline.name } : {},
    frameRate: timeline.frameRate,
    ...timeline.options.repeat ? { repeat: timeline.options.repeat } : {},
    ...timeline.options.repeatDelay ? { repeatDelay: timeline.options.repeatDelay } : {},
    ...timeline.options.yoyo ? { direction: "alternate" } : {},
    ...timeline.markers.length ? { markers: timeline.markers.map((m) => ({ name: m.name, at: m.time, ...m.color ? { color: m.color } : {}, ...m.payload !== void 0 ? { payload: m.payload } : {} })) } : {},
    ...timeline.cues.length ? { cues: timeline.cues.map((c) => ({ name: c.name, at: c.time })) } : {},
    items: timeline.items.map(({ item, start }) => saveItem(item, start))
  };
}
function saveItem(item, at) {
  const target = targetKeys.get(item);
  if (item instanceof Timeline) {
    return {
      type: "timeline",
      ...item.name ? { name: item.name } : {},
      at,
      frameRate: item.frameRate,
      ...item.options.repeat ? { repeat: item.options.repeat } : {},
      ...item.options.yoyo ? { direction: "alternate" } : {},
      ...item.markers.length ? { markers: item.markers.map((m) => ({ name: m.name, at: m.time })) } : {},
      ...item.cues.length ? { cues: item.cues.map((c) => ({ name: c.name, at: c.time })) } : {},
      items: item.items.map((entry) => saveItem(entry.item, entry.start))
    };
  }
  if (item instanceof Tween) {
    return {
      type: "tween",
      ...item.name ? { name: item.name } : {},
      at,
      ...target ? { target } : {},
      from: item.from,
      to: item.toValue,
      duration: item.duration,
      ...item.delay ? { delay: item.delay } : {},
      ...item.repeat ? { repeat: item.repeat } : {},
      ...item.repeatDelay ? { repeatDelay: item.repeatDelay } : {},
      ...item.direction === "alternate" ? { yoyo: true } : {},
      ...serializeEasing(item.easing) !== void 0 ? { easing: serializeEasing(item.easing) } : {}
    };
  }
  if (item instanceof Track) {
    return {
      type: "track",
      ...item.name ? { name: item.name } : {},
      at,
      ...target ? { target } : {},
      keyframes: item.keyframes.map((k) => ({ at: k.at, value: k.value }))
    };
  }
  return { type: item.kind, ...item.name ? { name: item.name } : {}, at };
}
function validateSheet(input) {
  const errors = [];
  const push = (path, message) => errors.push({ path, message });
  if (typeof input !== "object" || input === null) {
    push("$", "must be an object");
    return { ok: false, errors };
  }
  const sheet = input;
  if (sheet.$schema !== "dhaakon-motion/cue-sheet/1") push("$.$schema", 'must be "dhaakon-motion/cue-sheet/1"');
  if (sheet.frameRate != null) {
    try {
      frameRate(sheet.frameRate);
    } catch (err) {
      push("$.frameRate", err.message);
    }
  }
  if (!Array.isArray(sheet.items)) push("$.items", "must be an array");
  else sheet.items.forEach((item, index) => validateItem(item, `$.items[${index}]`, push));
  for (const label of ["markers", "cues"]) {
    const list = sheet[label];
    if (list != null && !Array.isArray(list)) push(`$.${label}`, "must be an array");
  }
  return errors.length ? { ok: false, errors } : { ok: true, sheet };
}
function validateEasing(value, path, push) {
  if (value == null) return;
  try {
    resolveEasing(value);
  } catch (err) {
    push(path, err.message);
  }
}
function validateItem(item, path, push) {
  if (typeof item !== "object" || item === null) {
    push(path, "must be an object");
    return;
  }
  const value = item;
  if (typeof value.type !== "string") {
    push(`${path}.type`, "is required");
    return;
  }
  if (value.type === "tween") {
    if (value.from === void 0) push(`${path}.from`, "is required");
    if (value.to === void 0) push(`${path}.to`, "is required");
    validateEasing(value.easing, `${path}.easing`, push);
  } else if (value.type === "track") {
    if (!Array.isArray(value.keyframes) || value.keyframes.length === 0) push(`${path}.keyframes`, "must be a non-empty array");
    else {
      let lastNumeric;
      value.keyframes.forEach((keyframe, index) => {
        if (typeof keyframe !== "object" || keyframe === null) {
          push(`${path}.keyframes[${index}]`, "must be an object");
          return;
        }
        const kf = keyframe;
        if (kf.at === void 0) push(`${path}.keyframes[${index}].at`, "is required");
        if (kf.value === void 0) push(`${path}.keyframes[${index}].value`, "is required");
        validateEasing(kf.easing, `${path}.keyframes[${index}].easing`, push);
        if (typeof kf.at === "number") {
          if (lastNumeric != null && kf.at < lastNumeric) push(`${path}.keyframes[${index}].at`, "keyframes must be in non-decreasing time order");
          lastNumeric = kf.at;
        }
      });
    }
    validateEasing(value.easing, `${path}.easing`, push);
  } else if (value.type === "timeline") {
    if (value.frameRate != null) {
      try {
        frameRate(value.frameRate);
      } catch (err) {
        push(`${path}.frameRate`, err.message);
      }
    }
    if (!Array.isArray(value.items)) push(`${path}.items`, "must be an array");
    else value.items.forEach((child, index) => validateItem(child, `${path}.items[${index}]`, push));
  }
}
function writerFor(target) {
  return target instanceof MotionValue ? (value) => target.set(value) : target;
}
function captureScene(targets) {
  const state = {};
  for (const [key, target] of Object.entries(targets ?? {})) if (target instanceof MotionValue) state[key] = target.get();
  return state;
}
function applyScene(state, targets, options = {}) {
  const entries = Object.entries(state).filter(([key]) => targets?.[key] != null);
  if (!options.transition) {
    for (const [key, value] of entries) writerFor(targets[key])(value);
    return;
  }
  const { stagger: stagger2, ...transitionOptions } = options.transition;
  const timeline = new Timeline();
  entries.forEach(([key, value], index) => {
    const target = targets[key];
    const from = target instanceof MotionValue ? target.get() : value;
    const staggerDelay = typeof stagger2 === "function" ? stagger2(key, index) : (stagger2 ?? 0) * index;
    timeline.add(new Tween({
      ...transitionOptions,
      from,
      to: value,
      onUpdate: (value2) => writerFor(target)(value2)
    }), staggerDelay);
  });
  timeline.play();
  return timeline;
}
function sceneTransition(from, to, targets, options = {}) {
  const timeline = new Timeline();
  const keys = [.../* @__PURE__ */ new Set([...Object.keys(from), ...Object.keys(to)])];
  keys.forEach((key, index) => {
    const target = targets?.[key];
    if (!target) return;
    const staggerDelay = typeof options.stagger === "function" ? options.stagger(key, index) : (options.stagger ?? 0) * index;
    timeline.add(new Tween({
      from: from[key] ?? to[key],
      to: to[key] ?? from[key],
      duration: options.duration,
      delay: options.delay,
      easing: options.easing != null ? resolveEasing(options.easing) : void 0,
      onUpdate: (value) => writerFor(target)(value)
    }), staggerDelay);
  });
  return timeline;
}
function sceneSheet(states, order, options = {}) {
  const holdMs = options.hold != null ? parseTime(options.hold) : 1e3;
  const transitionMs = options.transition != null ? parseTime(options.transition) : 500;
  const stepMs = holdMs + transitionMs;
  const keys = /* @__PURE__ */ new Set();
  for (const name of order) for (const key of Object.keys(states[name] ?? {})) keys.add(key);
  const items = [];
  for (const key of keys) {
    const keyframes = [];
    order.forEach((name, index) => {
      const state = states[name];
      if (state && key in state) keyframes.push({ at: index * stepMs, value: state[key], easing: options.easing });
    });
    if (keyframes.length) items.push({ type: "track", target: key, keyframes });
  }
  const markers = order.map((name, index) => ({ name, at: index * stepMs }));
  return { $schema: "dhaakon-motion/cue-sheet/1", markers, items };
}

// src/index.ts
var src_default = { Tween, Timeline, Transport, Track, Line, MotionValue, animate, stagger, Easing, cubicBezier, spring };
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Easing,
  FrameRates,
  FrameScheduler,
  Line,
  MotionValue,
  OfflineTransport,
  Timeline,
  Track,
  Transport,
  Tween,
  activeDuration,
  addFrames,
  animate,
  applyScene,
  captureScene,
  createTrace,
  cubicBezier,
  defaultRenderContext,
  drawOutput,
  formatTime,
  formatTimecode,
  frameRate,
  frameToMs,
  frames,
  framesToTimecode,
  interpolate,
  loadSheet,
  mix,
  msToFrame,
  msToTimecode,
  parseTime,
  parseTimecode,
  readStyle,
  registerEasing,
  renderFrames,
  resolveEasing,
  sampleCycle,
  saveSheet,
  sceneSheet,
  sceneTransition,
  scheduler,
  serializeEasing,
  signalOutput,
  snapToFrame,
  spring,
  stagger,
  steps,
  styleTrack,
  timecodeToFrames,
  timecodeToMs,
  totalDuration,
  track,
  validateSheet,
  writeStyle
});
//# sourceMappingURL=index.cjs.map