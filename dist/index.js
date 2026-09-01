// src/easing.ts
var clamp = (n) => Math.min(1, Math.max(0, n));
function cubicBezier(x1, y1, x2, y2) {
  const sample = (a, b, t) => 3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  return (progress) => {
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
}
function spring({ stiffness = 170, damping = 26, mass = 1 } = {}) {
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
  return (t) => response(clamp(t) * duration) / end;
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
function resolveEasing(easing) {
  if (!easing) return Easing.dhaakon;
  return typeof easing === "string" ? Easing[easing] : easing;
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
function addFrames(tc, frames, rate) {
  return framesToTimecode(timecodeToFrames(tc, rate) + frames, rate);
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
    for (const [key, value] of Object.entries(options)) if (value !== void 0) this[key] = value;
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
  setDuration(duration) {
    this.duration = Math.max(0, duration);
    return this;
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
    const target = Math.max(0, Math.min(this.boundedDuration(), parseTime(to, this.frameRate)));
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
      while (len > 0 && guard++ < 1e4) {
        if (this._rate >= 0) {
          if (remaining <= b) break;
          this.renderAt(b, true);
          this.fireLoop();
          remaining = a + (remaining - b);
        } else {
          if (remaining >= a) break;
          this.renderAt(a, true);
          this.fireLoop();
          remaining = b + (remaining - a);
        }
      }
      this._time = Math.max(a, Math.min(b, remaining));
      this.renderAt(this._time, true);
      return;
    }
    const duration = this.duration;
    const clamped = Math.max(0, Math.min(duration, rawTime));
    this._time = clamped;
    this.renderAt(clamped, true);
    const reachedEnd = Number.isFinite(duration) && duration > 0 && (this._rate >= 0 && clamped >= duration || this._rate < 0 && clamped <= 0);
    if (reachedEnd && this._state === "playing") this.finish();
  }
  renderAt(time, fireCues) {
    const quantized = this.snap ? this.frameSnap(time) : time;
    const direction = quantized >= this.lastRenderedTime ? 1 : -1;
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
    this.root.sampleAt(quantized, { direction, fireCues, frame: info, transport: this });
    for (const output of this.outputs) {
      try {
        output.onTick?.(info);
      } catch (err) {
        this.onError(err);
      }
    }
    for (const listener of this.listeners) listener(info, this);
    this.lastRenderedTime = quantized;
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
  rateInput;
  points = [];
  markerMeta = /* @__PURE__ */ new Map();
  lastCycleTime = null;
  lastIteration = 0;
  parentTimeline;
  ownTransport;
  constructor(options = {}) {
    this.options = options;
    this.name = options.name;
    this.rateInput = options.frameRate;
    if (options.autoplay) queueMicrotask(() => this.play());
  }
  // ---- content length vs. playback length -------------------------------
  /** Content length: the furthest a child, marker, cue, or region reaches, before this timeline's own repeat/yoyo is applied. */
  get duration() {
    return Math.max(this.cursor, this.markerCursor);
  }
  /** Content length including this timeline's own repeat/repeatDelay. `Infinity` when `repeat` is `Infinity`. */
  get totalDuration() {
    return totalDuration({ duration: this.duration, delay: 0, repeat: this.options.repeat ?? 0, repeatDelay: this.options.repeatDelay ?? 0 });
  }
  get frameRate() {
    return frameRate(this.rateInput ?? 60);
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
      if (item.rateInput == null && this.rateInput != null) item.rateInput = this.rateInput;
    }
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
  // ---- playback (root timelines only) --------------------------------------
  nestedError() {
    return `Timeline${this.name ? ` "${this.name}"` : ""} is nested; control its root transport instead.`;
  }
  get transport() {
    if (this.parentTimeline) throw new Error(this.nestedError());
    if (!this.ownTransport) {
      this.ownTransport = new Transport({ root: this, scheduler: this.options.scheduler, frameRate: this.rateInput, snap: this.options.snap });
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
      repeatDelay: this.options.repeatDelay ?? 0,
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
      return Math.max(0, base2 + parseTime(offsetText, this.rateInput) * (op === "+=" ? 1 : -1));
    }
    if (TIME_LITERAL_RE.test(text)) return Math.max(0, parseTime(text, this.rateInput));
    const labelMatch = text.match(LABEL_OFFSET_RE);
    const labelName = labelMatch ? labelMatch[1] : text;
    const base = this.labels.get(labelName);
    if (base == null) throw new Error(`Unknown timeline label: ${at}`);
    if (!labelMatch) return Math.max(0, base);
    return Math.max(0, base + parseTime(labelMatch[3], this.rateInput) * (labelMatch[2] === "+=" ? 1 : -1));
  }
};
function defaultOnError(err) {
  console.error(err);
}

// src/index.ts
var src_default = { Tween, Timeline, Transport, Line, MotionValue, animate, stagger, Easing, cubicBezier, spring };
export {
  Easing,
  FrameRates,
  FrameScheduler,
  Line,
  MotionValue,
  Timeline,
  Transport,
  Tween,
  activeDuration,
  addFrames,
  animate,
  cubicBezier,
  src_default as default,
  defaultRenderContext,
  formatTime,
  formatTimecode,
  frameRate,
  frameToMs,
  framesToTimecode,
  interpolate,
  mix,
  msToFrame,
  msToTimecode,
  parseTime,
  parseTimecode,
  resolveEasing,
  sampleCycle,
  scheduler,
  snapToFrame,
  spring,
  stagger,
  timecodeToFrames,
  timecodeToMs,
  totalDuration
};
//# sourceMappingURL=index.js.map