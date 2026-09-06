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

// src/css.ts
var css_exports = {};
__export(css_exports, {
  createCssAnimator: () => createCssAnimator,
  createCssMotionTokens: () => createCssMotionTokens,
  defaultCssMotionTokens: () => defaultCssMotionTokens
});
module.exports = __toCommonJS(css_exports);
var defaultCssMotionTokens = Object.freeze({
  "surface.enter": Object.freeze({ duration: 360, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }),
  "surface.exit": Object.freeze({ duration: 120, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }),
  feedback: Object.freeze({ duration: 200, easing: "cubic-bezier(0.16, 1, 0.3, 1)" })
});
function milliseconds(value) {
  const match = /^\s*(\d+(?:\.\d+)?|\.\d+)(ms|s)\s*$/.exec(value);
  if (!match) throw new Error(`Expected a CSS duration in ms or s: ${value}`);
  const result = Number(match[1]) * (match[2] === "s" ? 1e3 : 1);
  if (!Number.isFinite(result)) throw new Error("CSS duration must be finite");
  return result;
}
function createCssMotionTokens(source) {
  return Object.freeze({
    "surface.enter": Object.freeze({
      duration: milliseconds(source.durationSlow),
      easing: source.ease
    }),
    "surface.exit": Object.freeze({
      duration: milliseconds(source.durationFast),
      easing: source.ease
    }),
    feedback: Object.freeze({ duration: milliseconds(source.duration), easing: source.ease })
  });
}
var owners = /* @__PURE__ */ new WeakMap();
var cssName = (key) => key.startsWith("--") ? key : key === "cssFloat" ? "float" : key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).replace(/^ms-/, "-ms-");
var frameName = (key) => key.startsWith("--") ? key : key === "offset" ? "cssOffset" : key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
function normalize(element, input) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null)
    throw new Error("CSS targets must be plain property records");
  const result = /* @__PURE__ */ new Map();
  const probe = element.ownerDocument.createElement("div").style;
  for (const key of Object.keys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!("value" in descriptor)) throw new Error("CSS target accessors are unsupported");
    const value = descriptor.value;
    if (typeof value !== "string" && typeof value !== "number" || typeof value === "number" && !Number.isFinite(value))
      throw new Error(`Invalid CSS value for ${key}`);
    const property = cssName(key);
    if (!/^(--[\w-]+|-?[a-z][a-z0-9-]*)$/.test(property) || /^(animation|transition)(-|$)/.test(property) || property === "all")
      throw new Error(`CSS motion cannot own ${key}`);
    probe.setProperty(property, String(value));
    const normalized = probe.getPropertyValue(property);
    if (!normalized.trim() || String(value).includes("!important"))
      throw new Error(`Unsupported CSS declaration: ${key}: ${value}`);
    if (result.has(property)) throw new Error(`Duplicate CSS property: ${property}`);
    result.set(property, normalized);
    probe.removeProperty(property);
  }
  if (result.size > 128) throw new Error("CSS target property limit exceeded");
  return result;
}
function createCssAnimator(element) {
  if (owners.has(element)) throw new Error("This element already has a CSS motion owner");
  const originals = /* @__PURE__ */ new Map();
  let disposed = false;
  let active;
  const live = () => {
    if (disposed) throw new Error("CSS animator is disposed");
  };
  const acquire = (target) => {
    for (const property of target.keys())
      if (!originals.has(property))
        originals.set(property, {
          value: element.style.getPropertyValue(property),
          priority: element.style.getPropertyPriority(property)
        });
  };
  const write = (target) => {
    for (const [property, value] of target) element.style.setProperty(property, value);
  };
  const snapshot = (properties) => {
    const computed = element.ownerDocument.defaultView.getComputedStyle(element);
    return new Map(
      [...properties].map((property) => [property, computed.getPropertyValue(property)])
    );
  };
  const cancel = (preserve) => {
    const previous = active;
    if (!previous) return;
    const current = preserve ? snapshot(previous.target.keys()) : void 0;
    active = void 0;
    if (current) write(current);
    previous.animation.cancel();
    previous.settle({ status: "cancelled", backend: "waapi" });
  };
  const restoreOmitted = (target) => {
    for (const [property, original] of originals)
      if (!target.has(property)) {
        if (original.value) element.style.setProperty(property, original.value, original.priority);
        else element.style.removeProperty(property);
        originals.delete(property);
      }
  };
  const instant = (target, reason) => {
    write(target);
    return {
      backend: "instant",
      finished: Promise.resolve({ status: "finished", backend: "instant", reason }),
      cancel() {
      }
    };
  };
  const animator = {
    set(input) {
      live();
      const target = normalize(element, input);
      cancel(false);
      restoreOmitted(target);
      acquire(target);
      write(target);
    },
    animate(input, options = {}) {
      live();
      const target = normalize(element, input);
      const duration = options.duration ?? 200;
      const delay = options.delay ?? 0;
      const easing = options.easing ?? "cubic-bezier(0.16, 1, 0.3, 1)";
      if (!Number.isFinite(duration) || duration < 0 || !Number.isFinite(delay) || delay < 0)
        throw new Error("CSS duration and delay must be finite nonnegative milliseconds");
      const probe = element.ownerDocument.createElement("div").style;
      probe.animationTimingFunction = easing;
      if (!probe.animationTimingFunction || /\b(var|inherit|initial|unset|revert)\b/.test(easing) || easing.includes(";"))
        throw new Error("Expected a resolved CSS easing, not a token or CSS variable");
      const from = snapshot(target.keys());
      cancel(true);
      restoreOmitted(target);
      acquire(target);
      if (options.reducedMotion || duration === 0 || target.size === 0)
        return instant(target, options.reducedMotion ? "reduced-motion" : "immediate");
      if (typeof element.animate !== "function")
        return instant(target, "Web Animations unavailable");
      const keyframe = (values) => Object.fromEntries([...values].map(([key, value]) => [frameName(key), value]));
      let animation;
      try {
        animation = element.animate([keyframe(from), keyframe(target)], {
          duration,
          delay,
          easing,
          fill: "both"
        });
      } catch {
        return instant(target, "Browser rejected this animation; final CSS applied");
      }
      let settle;
      const finished = new Promise((resolve) => {
        settle = resolve;
      });
      const record = { animation, target, settle };
      active = record;
      void animation.finished.then(
        () => {
          if (active !== record || disposed) return;
          write(target);
          active = void 0;
          animation.cancel();
          settle({ status: "finished", backend: "waapi" });
        },
        () => {
          if (active !== record || disposed) return;
          active = void 0;
          write(target);
          settle({
            status: "finished",
            backend: "instant",
            reason: "Native animation cancelled externally; final CSS applied"
          });
        }
      );
      return {
        backend: "waapi",
        finished,
        cancel() {
          if (active === record) cancel(true);
        }
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel(false);
      restoreOmitted(/* @__PURE__ */ new Map());
      owners.delete(element);
    }
  };
  owners.set(element, animator);
  return animator;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createCssAnimator,
  createCssMotionTokens,
  defaultCssMotionTokens
});
//# sourceMappingURL=css.cjs.map