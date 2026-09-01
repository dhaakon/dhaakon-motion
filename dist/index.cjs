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
  FrameScheduler: () => FrameScheduler,
  Line: () => Line,
  MotionValue: () => MotionValue,
  Timeline: () => Timeline,
  Tween: () => Tween,
  animate: () => animate,
  cubicBezier: () => cubicBezier,
  default: () => src_default,
  interpolate: () => interpolate,
  mix: () => mix,
  resolveEasing: () => resolveEasing,
  scheduler: () => scheduler,
  spring: () => spring,
  stagger: () => stagger
});
module.exports = __toCommonJS(src_exports);

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
    this.elapsed = this.delay + Math.max(0, this.activeDuration - active);
    if (this.isAnimating) this.startedAt = this.frameLoop.now() - this.elapsed;
    this.sampleAt(this.elapsed);
    return this;
  }
  seek(progress) {
    return this.seekTime(this.delay + Math.max(0, Math.min(1, progress)) * this.activeDuration);
  }
  seekTime(milliseconds) {
    this.elapsed = Math.max(0, Math.min(this.totalDuration, milliseconds));
    this.sampleAt(this.elapsed);
    if (this.isAnimating) this.startedAt = this.frameLoop.now() - this.elapsed;
    return this;
  }
  setDuration(duration) {
    this.duration = Math.max(0, duration);
    return this;
  }
  getCurrentFrame(fps = 60) {
    return Math.ceil(Math.max(0, this.elapsed - this.delay) / 1e3 * fps);
  }
  get activeDuration() {
    return this.repeat === Infinity ? Infinity : this.duration * (this.repeat + 1) + this.repeatDelay * this.repeat;
  }
  get totalDuration() {
    return this.delay + this.activeDuration;
  }
  sampleAt(milliseconds, notify = true) {
    const active = Math.max(0, milliseconds - this.delay);
    const cycleDuration = this.duration + this.repeatDelay;
    const iteration = this.duration === 0 ? this.repeat : Math.min(this.repeat, Math.floor(active / Math.max(1, cycleDuration)));
    const cycleTime = Math.min(this.duration, Math.max(0, active - iteration * cycleDuration));
    let raw = this.duration === 0 ? 1 : cycleTime / this.duration;
    const alternating = this.direction === "alternate" || this.direction === "alternate-reverse";
    const startsReverse = this.direction === "reverse" || this.direction === "alternate-reverse";
    if (startsReverse !== (alternating && iteration % 2 === 1) !== this.isReversed) raw = 1 - raw;
    this.progress = Math.max(0, Math.min(1, raw));
    this.value = interpolate(this.from, this.toValue, this.easing(this.progress));
    if (this.node && this.properties && typeof this.value === "object" && !Array.isArray(this.value)) {
      for (const [key, value] of Object.entries(this.value)) this.node.style.setProperty(key, `${value}${this.properties[key]?.unit ?? ""}`);
    }
    if (notify) this.onUpdate?.(this.value, this.progress, this);
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
var Timeline = class {
  entries = [];
  labels = /* @__PURE__ */ new Map();
  cursor = 0;
  driver;
  options;
  constructor(options = {}) {
    this.options = options;
    this.driver = new Tween({
      from: 0,
      to: 0,
      duration: 0,
      easing: "linear",
      repeat: options.repeat,
      yoyo: options.yoyo,
      scheduler: options.scheduler,
      onUpdate: (time) => this.render(time),
      onComplete: () => options.onComplete?.()
    });
    if (options.autoplay) queueMicrotask(() => this.play());
  }
  get duration() {
    return this.cursor;
  }
  get state() {
    return this.driver.state;
  }
  get finished() {
    return this.driver.finished;
  }
  label(name, at = this.cursor) {
    this.labels.set(name, at);
    return this;
  }
  add(tween, at) {
    const previous = this.entries.at(-1);
    const start = this.resolvePosition(at, previous);
    const end = start + tween.totalDuration;
    this.entries.push({ tween, start, end });
    this.cursor = Math.max(this.cursor, end);
    return this;
  }
  addTween(tween, at) {
    return this.add(tween, at);
  }
  addTweens(tweens) {
    tweens.forEach((tween) => this.add(tween));
    return this;
  }
  play() {
    const playback = { from: 0, to: this.duration, duration: this.duration };
    if (this.options.repeat != null) playback.repeat = this.options.repeat;
    if (this.options.yoyo != null) playback.yoyo = this.options.yoyo;
    this.driver.configure(playback).play();
    return this;
  }
  start() {
    return this.play();
  }
  pause() {
    this.driver.pause();
    return this;
  }
  stop() {
    this.driver.stop();
    this.render(0);
    return this;
  }
  reverse() {
    this.driver.reverse();
    return this;
  }
  seek(progress) {
    this.driver.seek(progress);
    return this;
  }
  loop(value = true) {
    this.driver.repeat = value ? Infinity : 0;
    return this;
  }
  render(time) {
    for (const entry of this.entries) entry.tween.sampleAt(time - entry.start);
    this.options.onUpdate?.(time, this.duration ? time / this.duration : 1);
  }
  resolvePosition(at, previous) {
    if (at == null || at === ">") return previous?.end ?? 0;
    if (at === "<") return previous?.start ?? 0;
    if (typeof at === "number") return Math.max(0, at);
    const match = at.match(/^([^+-]+)([+-]=)(\d+(?:\.\d+)?)$/);
    const base = this.labels.get(match?.[1] ?? at);
    if (base == null) throw new Error(`Unknown timeline label: ${at}`);
    return Math.max(0, base + (match ? Number(match[3]) * (match[2] === "+=" ? 1 : -1) : 0));
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

// src/index.ts
var src_default = { Tween, Timeline, Line, MotionValue, animate, stagger, Easing, cubicBezier, spring };
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Easing,
  FrameScheduler,
  Line,
  MotionValue,
  Timeline,
  Tween,
  animate,
  cubicBezier,
  interpolate,
  mix,
  resolveEasing,
  scheduler,
  spring,
  stagger
});
//# sourceMappingURL=index.cjs.map