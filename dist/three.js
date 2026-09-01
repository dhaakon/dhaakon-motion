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
function frameToMs(frame, rate) {
  return frame * 1e3 * rate.den / rate.num;
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

// src/track.ts
var Track = class {
  kind = "track";
  name;
  keyframes;
  segments = [];
  apply;
  repeat;
  repeatDelay;
  direction;
  constructor(options) {
    if (!options.apply && !options.target) throw new Error("Track needs either `apply` or `target`.");
    this.name = options.name;
    this.apply = options.apply ?? ((value) => options.target.set(value));
    this.repeat = options.repeat ?? 0;
    this.repeatDelay = options.repeatDelay ?? 0;
    this.direction = options.direction ?? "normal";
    if (!options.keyframes.length) throw new Error("Track needs at least one keyframe.");
    const rate = options.frameRate ? frameRate(options.frameRate) : void 0;
    const resolved = options.keyframes.map((key) => ({ at: typeof key.at === "number" ? key.at : parseTime(key.at, rate), value: key.value, easing: key.easing })).sort((a, b) => a.at - b.at);
    this.keyframes = resolved.map(({ at, value }) => ({ at, value }));
    for (let i = 1; i < resolved.length; i += 1) {
      this.segments.push({ from: resolved[i - 1].at, to: resolved[i].at, ease: resolveEasing(resolved[i].easing ?? options.easing) });
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

// src/three.ts
function threeOutput(options) {
  return {
    name: options.name ?? "three",
    onTick(info) {
      options.onBeforeRender?.(info);
      if (options.composer) options.composer.render();
      else options.renderer.render(options.scene, options.camera);
    }
  };
}
function objectTrack(object, keyframes, options = {}) {
  return new Track({
    ...options,
    keyframes,
    apply: (value) => {
      if (value.position) object.position.set(...value.position);
      if (value.rotation) object.rotation.set(...value.rotation);
      if (value.scale != null) {
        if (typeof value.scale === "number") object.scale.setScalar(value.scale);
        else object.scale.set(...value.scale);
      }
    }
  });
}
function applyUniformValue(uniforms, key, value) {
  const uniform = uniforms[key];
  if (!uniform) return;
  const current = uniform.value;
  if (typeof value === "string" && current?.setStyle) {
    current.setStyle(value);
    return;
  }
  if (Array.isArray(value) && current?.fromArray) {
    current.fromArray(value);
    return;
  }
  uniform.value = value;
}
function uniformTrack(material, keyframes, options = {}) {
  return new Track({
    ...options,
    keyframes,
    apply: (value) => {
      for (const [key, v] of Object.entries(value)) applyUniformValue(material.uniforms, key, v);
    }
  });
}
function cameraTrack(camera, keyframes, options = {}) {
  return new Track({
    ...options,
    keyframes,
    apply: (value) => {
      if (value.position) camera.position.set(...value.position);
      if (value.fov != null) {
        camera.fov = value.fov;
        camera.updateProjectionMatrix();
      }
      if (value.target) camera.lookAt(...value.target);
      if (value.roll != null) camera.rotateZ(value.roll);
    }
  });
}
function frameCapture(renderer) {
  return () => new Promise((resolve, reject) => {
    const canvas = renderer.domElement;
    if (!canvas.toBlob) {
      reject(new Error("frameCapture: the renderer's canvas has no toBlob()."));
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("frameCapture: toBlob() returned null."));
    });
  });
}
export {
  cameraTrack,
  frameCapture,
  objectTrack,
  threeOutput,
  uniformTrack
};
//# sourceMappingURL=three.js.map