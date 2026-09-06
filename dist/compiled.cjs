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

// src/compiled.ts
var compiled_exports = {};
__export(compiled_exports, {
  NUMERIC_BINARY_VERSION: () => NUMERIC_BINARY_VERSION,
  NUMERIC_IR_VERSION: () => NUMERIC_IR_VERSION,
  compileTracks: () => compileTracks,
  createCompiledPlayer: () => createCompiledPlayer,
  createJsEvaluator: () => createJsEvaluator,
  createWasmRuntime: () => createWasmRuntime,
  encodeNumericPlan: () => encodeNumericPlan,
  loadWasmRuntime: () => loadWasmRuntime,
  numericLimits: () => numericLimits,
  validateNumericPlan: () => validateNumericPlan
});
module.exports = __toCommonJS(compiled_exports);

// src/backends/compiler.ts
var import_motion2 = require("@dhaakon/motion");

// src/backends/numeric.ts
var import_motion = require("@dhaakon/motion");
var NUMERIC_IR_VERSION = 1;
var numericLimits = Object.freeze({
  tracks: 1e5,
  keys: 4096,
  width: 64,
  scalars: 4e6,
  output: 1e6
});
var builtins = /* @__PURE__ */ new Set([
  "linear",
  "easeInQuad",
  "easeOutQuad",
  "easeInOutQuad",
  "easeInCubic",
  "easeOutCubic",
  "easeInOutCubic",
  "easeInQuart",
  "easeOutQuart",
  "easeInOutQuart",
  "easeOutBack",
  "dhaakon"
]);
var functions = {
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
  easeOutBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2
};
var finite = (n, min, max) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
var fail = (path, message) => {
  throw new Error(`Numeric IR ${path}: ${message}`);
};
function fields(value, names, path) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    fail(path, "expected plain descriptor");
  if (Object.getOwnPropertySymbols(value).length) fail(path, "symbol properties are not supported");
  for (const key of Object.getOwnPropertyNames(value)) {
    if (!names.includes(key) || !("value" in Object.getOwnPropertyDescriptor(value, key)))
      fail(path, `unknown/accessor field ${key}`);
  }
}
function dense(value, path) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length)
    fail(path, "expected dense plain array");
  const keys = Object.getOwnPropertyNames(value);
  if (keys.length !== value.length + 1) fail(path, "sparse/custom-property array");
  for (let i = 0; i < value.length; i++)
    if (!Object.hasOwn(value, i) || !("value" in Object.getOwnPropertyDescriptor(value, i)))
      fail(path, "sparse/accessor array");
}
function validateCurve(curve2, path = "easing") {
  if (!curve2 || typeof curve2.kind !== "string" || !Array.isArray(curve2.args))
    fail(path, "invalid descriptor");
  fields(curve2, ["kind", "args"], path);
  dense(curve2.args, path + ".args");
  const a = curve2.args;
  if (builtins.has(curve2.kind) && a.length === 0) return;
  if (curve2.kind === "cubicBezier" && a.length === 4 && finite(a[0], 0, 1) && finite(a[2], 0, 1) && finite(a[1], -100, 100) && finite(a[3], -100, 100))
    return;
  if (curve2.kind === "spring" && a.length === 3 && finite(a[0], 1e-6, 1e6) && finite(a[1], 0, 1e6) && finite(a[2], 1e-6, 1e6))
    return;
  if (curve2.kind === "steps" && a.length === 2 && finite(a[0], 1, 1e6) && Number.isInteger(a[0]) && (a[1] === 0 || a[1] === 1))
    return;
  fail(path, "unsupported curve or invalid parameters");
}
function curveFunction(curve2) {
  if (curve2.kind === "dhaakon") return (0, import_motion.resolveEasing)(["cubicBezier", 0.16, 1, 0.3, 1]);
  if (curve2.kind === "cubicBezier")
    return (0, import_motion.resolveEasing)(["cubicBezier", ...curve2.args]);
  if (curve2.kind === "spring")
    return (0, import_motion.resolveEasing)([
      "spring",
      { stiffness: curve2.args[0], damping: curve2.args[1], mass: curve2.args[2] }
    ]);
  if (curve2.kind === "steps") {
    const [count, start] = curve2.args;
    return (t) => Math.min(1, Math.max(0, (start ? Math.ceil(t * count) : Math.floor(t * count)) / count));
  }
  return functions[curve2.kind];
}
function validateNumericPlan(plan) {
  if (!plan || plan.version !== 1 || !Array.isArray(plan.tracks))
    fail("version", "expected version 1 tracks");
  fields(plan, ["version", "tracks"], "plan");
  dense(plan.tracks, "tracks");
  if (plan.tracks.length > numericLimits.tracks) fail("tracks", "resource limit exceeded");
  const ids = /* @__PURE__ */ new Set();
  let scalars = 0;
  let output = 0;
  for (const [i, track] of plan.tracks.entries()) {
    const path = `tracks[${i}]`;
    fields(track, ["id", "times", "values", "easings", "repeat", "repeatDelay", "direction"], path);
    if (!track || typeof track.id !== "string" || !track.id.length || new TextEncoder().encode(track.id).length > 256 || ids.has(track.id))
      fail(path, "invalid or duplicate id");
    ids.add(track.id);
    if (!Array.isArray(track.times) || !track.times.length || track.times.length > numericLimits.keys || !Array.isArray(track.values) || track.values.length !== track.times.length)
      fail(path, "invalid key arrays");
    dense(track.times, path + ".times");
    dense(track.values, path + ".values");
    const width = track.values[0]?.length;
    if (!width || width > numericLimits.width) fail(path, "invalid vector width");
    output += width;
    scalars += width * track.times.length;
    if (output > numericLimits.output || scalars > numericLimits.scalars)
      fail(path, "resource limit exceeded");
    for (let k = 0; k < track.times.length; k++) {
      if (!finite(track.times[k], 0, 1e12) || k && track.times[k] < track.times[k - 1])
        fail(`${path}.times[${k}]`, "expected finite nondecreasing times");
      if (!Array.isArray(track.values[k]) || track.values[k].length !== width || Array.from(track.values[k]).some((n) => !finite(n, -1e100, 1e100)))
        fail(`${path}.values[${k}]`, "invalid numeric vector");
      dense(track.values[k], `${path}.values[${k}]`);
    }
    if (!Array.isArray(track.easings) || track.easings.length !== track.times.length - 1)
      fail(path, "one easing per segment required");
    dense(track.easings, path + ".easings");
    for (let k = 0; k < track.easings.length; k++)
      validateCurve(track.easings[k], `${path}.easings[${k}]`);
    if (!(track.repeat === -1 || finite(track.repeat, 0, 1e6) && Number.isInteger(track.repeat)) || !finite(track.repeatDelay, 0, 1e12))
      fail(path, "invalid repeat");
    if (!["normal", "reverse", "alternate", "alternate-reverse"].includes(track.direction))
      fail(path, "invalid direction");
  }
  return output;
}
function contentTime(track, ms) {
  const duration = track.times[track.times.length - 1];
  if (duration === 0) return 0;
  const active = Math.max(0, ms);
  const cycle = duration + track.repeatDelay;
  const iteration = track.repeat === -1 ? Math.floor(active % (2 * cycle) / cycle) : Math.min(track.repeat, Math.floor(active / cycle));
  const local = Math.min(
    duration,
    Math.max(0, track.repeat === -1 ? active % cycle : active - iteration * cycle)
  );
  const alternating = track.direction === "alternate" || track.direction === "alternate-reverse";
  const reverse = (track.direction === "reverse" || track.direction === "alternate-reverse") !== (alternating && iteration % 2 === 1);
  const progress = local / duration;
  return Math.min(1, Math.max(0, reverse ? 1 - progress : progress)) * duration;
}
function createJsEvaluator(plan) {
  const length = validateNumericPlan(plan);
  const tracks = plan.tracks.map((track) => ({
    ...track,
    times: [...track.times],
    values: track.values.map((value) => Float64Array.from(value)),
    curves: track.easings.map(curveFunction)
  }));
  const output = new Float64Array(length);
  let disposed = false;
  return {
    backend: "js",
    length,
    sample(ms) {
      if (disposed) throw new Error("Compiled evaluator is disposed");
      if (!Number.isFinite(ms) || Math.abs(ms) > 1e15)
        throw new Error("Compiled sample time must be finite and within \xB11e15ms");
      let offset = 0;
      for (const track of tracks) {
        const time = contentTime(track, ms);
        const last = track.times.length - 1;
        if (last === 0 || time <= track.times[0]) output.set(track.values[0], offset);
        else if (time >= track.times[last]) output.set(track.values[last], offset);
        else {
          let low = 1, high = last;
          while (low < high) {
            const middle = low + high >>> 1;
            if (track.times[middle] < time) low = middle + 1;
            else high = middle;
          }
          const span = track.times[low] - track.times[low - 1];
          const p = track.curves[low - 1](
            span <= 0 ? 1 : Math.min(1, Math.max(0, (time - track.times[low - 1]) / span))
          );
          const from = track.values[low - 1], to = track.values[low];
          for (let channel = 0; channel < from.length; channel++)
            output[offset + channel] = from[channel] + (to[channel] - from[channel]) * p;
        }
        offset += track.values[0].length;
      }
      return output;
    },
    dispose() {
      disposed = true;
    }
  };
}

// src/backends/shape.ts
var unit = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i;
function color(value) {
  const hex = value.trim().match(/^#([\da-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map((c) => c + c).join("") : hex;
    if (expanded.length === 6 || expanded.length === 8)
      return [
        parseInt(expanded.slice(0, 2), 16),
        parseInt(expanded.slice(2, 4), 16),
        parseInt(expanded.slice(4, 6), 16),
        expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1
      ];
  }
  const rgb = value.trim().match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] == null ? 1 : Number(rgb[4])] : void 0;
}
function snapshotValue(value, depth = 0, ancestors = /* @__PURE__ */ new Set(), budget = { nodes: 4e6, characters: 16e6 }) {
  if (--budget.nodes < 0) throw new Error("Authored value node budget exceeded");
  if (depth > 16) throw new Error("Value nesting limit exceeded");
  if (typeof value === "string" && (budget.characters -= value.length) < 0)
    throw new Error("Authored string budget exceeded");
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Math.abs(value) > 1e100)
      throw new Error("Value must be finite and bounded");
    return value;
  }
  if (typeof value === "string" || typeof value === "boolean" || value === void 0) return value;
  if (!value || typeof value !== "object" || ancestors.has(value))
    throw new Error("Value must be an acyclic motion value");
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    throw new Error("Value must be a plain object");
  ancestors.add(value);
  if (Array.isArray(value) && value.length > Math.min(1024, budget.nodes))
    throw new Error("Value array resource limit exceeded");
  const out = Array.isArray(value) ? new Array(value.length) : {};
  if (Object.keys(value).length > 1024) throw new Error("Value property limit exceeded");
  for (const key of Object.keys(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error(`Reserved value key: ${key}`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!("value" in descriptor)) throw new Error("Value accessors are not supported");
    out[key] = snapshotValue(
      descriptor.value,
      depth + 1,
      ancestors,
      budget
    );
  }
  ancestors.delete(value);
  return Object.freeze(out);
}
function compileShape(first) {
  if (typeof first === "number")
    return {
      width: 1,
      flatten(value) {
        if (typeof value !== "number") throw new Error("Changing value shape");
        return [value];
      },
      materialize(values, offset) {
        return values[offset];
      }
    };
  if (typeof first === "string") {
    if (color(first))
      return {
        width: 4,
        flatten(value) {
          const result = typeof value === "string" ? color(value) : void 0;
          if (!result) throw new Error("Changing color shape");
          return result;
        },
        materialize(values, offset) {
          return `rgba(${Math.round(values[offset])}, ${Math.round(values[offset + 1])}, ${Math.round(values[offset + 2])}, ${Number(values[offset + 3].toFixed(3))})`;
        }
      };
    const parsed = first.match(unit);
    if (parsed)
      return {
        width: 1,
        flatten(value) {
          const result = typeof value === "string" ? value.match(unit) : null;
          if (!result || result[2] !== parsed[2]) throw new Error("Changing CSS unit");
          return [Number(result[1])];
        },
        materialize(values, offset) {
          return `${Number(values[offset].toFixed(5))}${parsed[2]}`;
        }
      };
    throw new Error("Discrete strings use host interpolation");
  }
  if (typeof first === "boolean" || first === void 0)
    throw new Error("Discrete/optional values use host interpolation");
  const array = Array.isArray(first);
  const keys = Object.keys(first);
  if (array && (keys.length !== first.length || keys.some((key, i) => key !== String(i))))
    throw new Error("Sparse/custom-property arrays use host interpolation");
  if (!keys.length) throw new Error("Empty values use host interpolation");
  const parts = keys.map((key) => compileShape(first[key]));
  return {
    width: parts.reduce((sum, part) => sum + part.width, 0),
    flatten(value) {
      if (!value || typeof value !== "object" || Array.isArray(value) !== array || Object.keys(value).length !== keys.length || Array.isArray(value) && value.length !== keys.length || keys.some((key) => !Object.hasOwn(value, key)))
        throw new Error("Changing compound shape");
      return parts.flatMap(
        (part, i) => part.flatten(value[keys[i]])
      );
    },
    materialize(values, offset) {
      const result = array ? [] : {};
      for (let i = 0; i < keys.length; i++) {
        result[keys[i]] = parts[i].materialize(
          values,
          offset
        );
        offset += parts[i].width;
      }
      return result;
    }
  };
}

// src/backends/compiler.ts
var prepared = /* @__PURE__ */ new WeakMap();
function curve(input) {
  const resolved = (0, import_motion2.resolveEasing)(input);
  const description = (0, import_motion2.serializeEasing)(resolved);
  if (typeof description === "string" && (0, import_motion2.resolveEasing)(description) !== resolved)
    throw new Error("Easing name does not identify the supplied function");
  if (description == null) throw new Error("Anonymous or replaced easing requires host execution");
  let result;
  if (description == null) result = { kind: "cubicBezier", args: [0.16, 1, 0.3, 1] };
  else if (typeof description === "string")
    result = description === "dhaakon" ? { kind: "cubicBezier", args: [0.16, 1, 0.3, 1] } : { kind: description, args: [] };
  else if (Array.isArray(description)) {
    if (description[0] === "spring") {
      const options = description[1] ?? {};
      result = {
        kind: "spring",
        args: [options.stiffness ?? 170, options.damping ?? 26, options.mass ?? 1]
      };
    } else if (description[0] === "steps") {
      const tuple = description;
      result = {
        kind: "steps",
        args: [Math.max(1, Math.round(tuple[1])), tuple[2] === "start" ? 1 : 0]
      };
    } else result = { kind: description[0], args: description.slice(1) };
  } else throw new Error("Custom easing functions require host execution");
  if (typeof input === "function" && description == null)
    throw new Error("Anonymous easing requires host execution");
  validateCurve(result);
  return Object.freeze({ kind: result.kind, args: Object.freeze([...result.args]) });
}
function snapshotEasing(input) {
  if (!Array.isArray(input)) return input;
  if (input[0] === "spring")
    return Object.freeze(["spring", Object.freeze({ ...input[1] })]);
  return Object.freeze([...input]);
}
function compileTracks(inputs, options = {}) {
  if (!Array.isArray(inputs) || inputs.length > 1e5)
    throw new Error("Compiled track count limit exceeded");
  const diagnostics = [];
  const entries = [];
  const ids = /* @__PURE__ */ new Set();
  const budget = { nodes: 4e6, characters: 16e6 };
  let offset = 0, totalDuration = 0, keyScalars = 0;
  for (const input of inputs) {
    if (!input || typeof input.id !== "string" || !input.id.length || new TextEncoder().encode(input.id).length > 256 || ids.has(input.id))
      throw new Error("Compiled tracks require unique bounded ids");
    ids.add(input.id);
    if (!Array.isArray(input.keyframes) || !input.keyframes.length || input.keyframes.length > 4096)
      throw new Error(`${input.id}: invalid keyframe count`);
    const rate = (0, import_motion2.frameRate)(
      input.frameRate ?? (input.keyframes.some(
        (key) => typeof key.at === "string" && key.at.includes(";")
      ) ? "29.97df" : 60)
    );
    const repeat = input.repeat ?? 0;
    if (repeat !== Infinity && (!Number.isInteger(repeat) || repeat < 0 || repeat > 1e6))
      throw new Error(`${input.id}: invalid authored repeat`);
    const repeatDelay = (0, import_motion2.parseTime)(input.repeatDelay ?? 0, rate);
    const direction = input.direction ?? "normal";
    const authored = {
      ...input,
      frameRate: input.frameRate && typeof input.frameRate === "object" ? Object.freeze({ ...input.frameRate }) : input.frameRate,
      easing: snapshotEasing(input.easing),
      keyframes: input.keyframes.map(
        (key) => Object.freeze({
          ...key,
          value: snapshotValue(key.value, 0, /* @__PURE__ */ new Set(), budget),
          easing: snapshotEasing(key.easing)
        })
      )
    };
    const keys = authored.keyframes.map((key) => ({ ...key, time: (0, import_motion2.parseTime)(key.at, rate) })).sort((a, b) => a.time - b.time);
    const numeric = {
      id: input.id,
      times: Object.freeze(keys.map((key) => key.time)),
      values: [],
      easings: [],
      repeat: repeat === Infinity ? -1 : repeat,
      repeatDelay,
      direction
    };
    validateNumericPlan({
      version: 1,
      tracks: [
        {
          ...numeric,
          values: keys.map(() => [0]),
          easings: keys.slice(1).map(() => ({ kind: "linear", args: [] }))
        }
      ]
    });
    let shape;
    try {
      shape = compileShape(keys[0].value);
      numeric.values = Object.freeze(keys.map((key) => Object.freeze(shape.flatten(key.value))));
      numeric.easings = Object.freeze(
        keys.slice(1).map((key) => curve(key.easing ?? input.easing))
      );
      validateNumericPlan({ version: 1, tracks: [numeric] });
    } catch (error) {
      shape = void 0;
      (0, import_motion2.resolveEasing)(input.easing);
      keys.slice(1).forEach((key) => (0, import_motion2.resolveEasing)(key.easing ?? input.easing));
      diagnostics.push(Object.freeze({ id: input.id, reason: error.message }));
    }
    if (shape) {
      keyScalars += shape.width * keys.length;
      if (keyScalars > 4e6 || offset + shape.width > 1e6)
        throw new Error("Compiled channel resource limit exceeded");
    }
    entries.push({
      authored,
      sortedValues: keys.map((key) => key.value),
      shape,
      numeric: Object.freeze(numeric),
      offset
    });
    if (shape) offset += shape.width;
    const duration = keys[keys.length - 1].time;
    totalDuration = Math.max(
      totalDuration,
      repeat === Infinity ? Infinity : duration * (repeat + 1) + repeatDelay * repeat
    );
    Object.freeze(authored.keyframes);
    Object.freeze(authored);
  }
  if (options.requirePortable && diagnostics.length)
    throw new Error(
      `Portable compilation unavailable: ${diagnostics.map((item) => `${item.id}: ${item.reason}`).join("; ")}`
    );
  const ir = Object.freeze({
    version: 1,
    tracks: Object.freeze(entries.filter((entry) => entry.shape).map((entry) => entry.numeric))
  });
  validateNumericPlan(ir);
  const plan = Object.freeze({
    version: 1,
    portable: diagnostics.length === 0,
    diagnostics: Object.freeze(diagnostics),
    ir,
    authored: Object.freeze(entries.map((entry) => entry.authored)),
    totalDuration
  });
  prepared.set(plan, entries);
  return plan;
}
function createCompiledPlayer(plan, options = {}) {
  const entries = prepared.get(plan);
  if (!entries)
    throw new Error("Expected a plan from this compiled entry; compile authored inputs again");
  if (options.backend === "wasm" && (!options.runtime || !plan.portable))
    throw new Error("Wasm requested but runtime is not ready or plan needs host execution");
  const wasm = plan.portable && options.runtime && (options.backend === "wasm" || options.backend === "auto");
  const evaluator = plan.portable ? wasm ? options.runtime.createEvaluator(plan.ir) : createJsEvaluator(plan.ir) : void 0;
  const reasons = [...plan.diagnostics];
  if (options.backend === "auto" && !options.runtime)
    reasons.push({ id: "*", reason: "Wasm runtime not supplied; JS selected at creation" });
  const values = /* @__PURE__ */ new Map();
  const bindings = entries.map(
    (entry) => Object.hasOwn(options.bindings ?? {}, entry.authored.id) ? options.bindings[entry.authored.id] : void 0
  );
  const host = evaluator ? [] : entries.map(
    (entry, i) => new import_motion2.Track({
      ...entry.authored,
      apply(value, ctx) {
        if (disposed) return;
        values.set(entry.authored.id, value);
        bindings[i]?.(value, ctx);
      }
    })
  );
  let disposed = false, sampling = false;
  return {
    kind: "compiled",
    totalDuration: plan.totalDuration,
    diagnostics: Object.freeze({
      engine: evaluator?.backend ?? "js-host",
      reasons: Object.freeze(reasons)
    }),
    sampleAt(ms, context) {
      if (disposed) throw new Error("Compiled player is disposed");
      if (sampling)
        throw new Error(
          "Reentrant compiled sampling is not supported; use the compatibility Timeline path"
        );
      if (!Number.isFinite(ms) || Math.abs(ms) > 1e15)
        throw new Error("Compiled sample time must be finite and within \xB11e15ms");
      sampling = true;
      try {
        if (!evaluator) {
          for (const track of host) {
            if (disposed) break;
            track.sampleAt(ms, context);
          }
          return;
        }
        const numeric = evaluator.sample(ms);
        for (const entry of entries) {
          const time = contentTime(entry.numeric, ms);
          const sorted = entry.numeric.times;
          const endpoint = time <= sorted[0] ? 0 : time >= sorted[sorted.length - 1] ? sorted.length - 1 : -1;
          const value = endpoint < 0 ? entry.shape.materialize(numeric, entry.offset) : entry.sortedValues[endpoint];
          values.set(entry.authored.id, value);
        }
        for (let i = 0; i < entries.length && !disposed; i++)
          bindings[i]?.(values.get(entries[i].authored.id), context);
      } finally {
        sampling = false;
      }
    },
    get(id) {
      return values.get(id);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        evaluator?.dispose();
      } finally {
        values.clear();
      }
    }
  };
}

// src/backends/binary.ts
var kinds = [
  "linear",
  "easeInQuad",
  "easeOutQuad",
  "easeInOutQuad",
  "easeInCubic",
  "easeOutCubic",
  "easeInOutCubic",
  "easeInQuart",
  "easeOutQuart",
  "easeInOutQuart",
  "easeOutBack",
  "dhaakon",
  "cubicBezier",
  "spring",
  "steps"
];
var directions = ["normal", "reverse", "alternate", "alternate-reverse"];
var NUMERIC_BINARY_VERSION = 1;
function encodeNumericPlan(plan) {
  validateNumericPlan(plan);
  const encoder = new TextEncoder();
  const ids = plan.tracks.map((track) => encoder.encode(track.id));
  let size = 12;
  for (let i = 0; i < plan.tracks.length; i++) {
    const track = plan.tracks[i];
    size += 4 + ids[i].length + 4 + 4 + 4 + 8 + 1;
    size += track.times.length * 8 + track.times.length * track.values[0].length * 8;
    for (const curve2 of track.easings) size += 2 + curve2.args.length * 8;
    if (size > 64 * 1024 * 1024) throw new Error("RESOURCE_LIMIT: binary plan exceeds 64 MiB");
  }
  const bytes = new Uint8Array(size);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  const u8 = (value) => {
    view.setUint8(offset, value);
    offset++;
  };
  const u32 = (value) => {
    view.setUint32(offset, value, true);
    offset += 4;
  };
  const i32 = (value) => {
    view.setInt32(offset, value, true);
    offset += 4;
  };
  const f64 = (value) => {
    view.setFloat64(offset, value, true);
    offset += 8;
  };
  bytes.set([68, 72, 77, 49]);
  offset = 4;
  u32(NUMERIC_BINARY_VERSION);
  u32(plan.tracks.length);
  for (let i = 0; i < plan.tracks.length; i++) {
    const track = plan.tracks[i];
    u32(ids[i].length);
    bytes.set(ids[i], offset);
    offset += ids[i].length;
    u32(track.values[0].length);
    u32(track.times.length);
    i32(track.repeat);
    f64(track.repeatDelay);
    u8(directions.indexOf(track.direction));
    for (const time of track.times) f64(time);
    for (const value of track.values) for (const channel of value) f64(channel);
    for (const curve2 of track.easings) {
      u8(kinds.indexOf(curve2.kind));
      u8(curve2.args.length);
      for (const arg of curve2.args) f64(arg);
    }
  }
  return bytes;
}

// src/backends/wasm.ts
function createWasmRuntime(bindings, memory) {
  if (bindings.version() !== NUMERIC_IR_VERSION)
    throw new Error("Motion Wasm ABI version mismatch");
  if (!memory || !memory.buffer) throw new Error("Motion Wasm memory is required");
  const evaluators = /* @__PURE__ */ new Set();
  let disposed = false;
  return {
    backend: "wasm",
    abiVersion: 1,
    createEvaluator(plan) {
      if (disposed) throw new Error("Motion Wasm runtime is disposed");
      const length = validateNumericPlan(plan);
      const handle = bindings.create_binary ? bindings.create_binary(encodeNumericPlan(plan)) : bindings.create(JSON.stringify(plan));
      let freed = false;
      let view;
      const evaluator = {
        backend: "wasm",
        length,
        sample(ms) {
          if (freed || disposed) throw new Error("Compiled evaluator is disposed");
          if (!Number.isFinite(ms) || Math.abs(ms) > 1e15)
            throw new Error("Compiled sample time must be finite and within \xB11e15ms");
          bindings.sample(handle, ms);
          const pointer = bindings.values_ptr(handle);
          const count = bindings.values_len(handle);
          if (count !== length || !Number.isSafeInteger(pointer) || pointer < 0 || pointer % 8 || pointer + count * 8 > memory.buffer.byteLength)
            throw new Error("Motion Wasm returned an invalid output buffer");
          if (!view || view.buffer !== memory.buffer || view.byteOffset !== pointer)
            view = new Float64Array(memory.buffer, pointer, count);
          return view;
        },
        dispose() {
          if (freed) return;
          freed = true;
          view = void 0;
          evaluators.delete(evaluator);
          bindings.free(handle);
        }
      };
      evaluators.add(evaluator);
      return evaluator;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      const errors = [];
      for (const evaluator of [...evaluators]) {
        try {
          evaluator.dispose();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length) throw new AggregateError(errors, "Motion Wasm runtime cleanup failed");
    }
  };
}
async function loadWasmRuntime(load) {
  const { bindings, memory } = await load();
  return createWasmRuntime(bindings, memory);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  NUMERIC_BINARY_VERSION,
  NUMERIC_IR_VERSION,
  compileTracks,
  createCompiledPlayer,
  createJsEvaluator,
  createWasmRuntime,
  encodeNumericPlan,
  loadWasmRuntime,
  numericLimits,
  validateNumericPlan
});
//# sourceMappingURL=compiled.cjs.map