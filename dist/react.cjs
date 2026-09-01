"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/react.tsx
var react_exports = {};
__export(react_exports, {
  Motion: () => Motion,
  MotionConfig: () => MotionConfig,
  Reveal: () => Reveal,
  createMotionComponent: () => createMotionComponent,
  motion: () => motion,
  useInView: () => useInView,
  useMotionValue: () => useMotionValue,
  useMotionValueState: () => useMotionValueState,
  useReducedMotion: () => useReducedMotion,
  useTimeline: () => useTimeline,
  useTween: () => useTween
});
module.exports = __toCommonJS(react_exports);
var import_react = __toESM(require("react"), 1);
var import_motion = require("@dhaakon/motion");
var import_jsx_runtime = require("react/jsx-runtime");
var MotionContext = (0, import_react.createContext)({ reducedMotion: "user" });
function MotionConfig({ children, ...value }) {
  const parent = (0, import_react.useContext)(MotionContext);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MotionContext.Provider, { value: (0, import_react.useMemo)(() => ({ ...parent, ...value, transition: { ...parent.transition, ...value.transition } }), [parent, value.transition, value.reducedMotion]), children });
}
function useReducedMotion() {
  const setting = (0, import_react.useContext)(MotionContext).reducedMotion;
  const query = (0, import_react.useMemo)(() => typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null, []);
  const system = (0, import_react.useSyncExternalStore)(
    (listener) => {
      query?.addEventListener("change", listener);
      return () => query?.removeEventListener("change", listener);
    },
    () => query?.matches ?? false,
    () => false
  );
  return setting === "always" || setting !== "never" && system;
}
function useInView({ once = true, amount = "some", margin = "0px", disabled = false } = {}) {
  const ref = (0, import_react.useRef)(null);
  const reduced = useReducedMotion();
  const [inView, setInView] = (0, import_react.useState)(disabled || reduced);
  (0, import_react.useEffect)(() => {
    if (disabled || reduced || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const threshold = amount === "all" ? 1 : amount === "some" ? 0.15 : Math.max(0, Math.min(1, amount));
    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting && entry.intersectionRatio >= threshold;
      if (visible) {
        setInView(true);
        if (once) observer.disconnect();
      } else if (!once) setInView(false);
    }, { rootMargin: margin, threshold });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [once, amount, margin, disabled, reduced]);
  return [ref, inView];
}
function useMotionValue(initial) {
  const ref = (0, import_react.useRef)(null);
  if (!ref.current) ref.current = new import_motion.MotionValue(initial);
  (0, import_react.useEffect)(() => () => ref.current?.stop(), []);
  return ref.current;
}
function useMotionValueState(value) {
  return (0, import_react.useSyncExternalStore)(value.subscribe, () => value.get(), () => value.get());
}
function useTween(from, to, options = {}) {
  const motionValue = useMotionValue(from);
  const tween = (0, import_react.useRef)(null);
  const reduced = useReducedMotion();
  const transition = (0, import_react.useContext)(MotionContext).transition;
  const fromKey = stableKey(from);
  const toKey = stableKey(to);
  (0, import_react.useEffect)(() => {
    motionValue.set(from);
    tween.current = motionValue.animate(to, { ...transition, ...options, duration: reduced ? 0 : options.duration ?? transition?.duration });
    return () => {
      tween.current?.cancel();
    };
  }, [motionValue, fromKey, toKey, reduced, options.duration, options.delay, options.repeat, options.repeatDelay, options.yoyo, options.easing, options.ease]);
  return { value: useMotionValueState(motionValue), motionValue, controls: tween };
}
function useTimeline(factory, dependencies = []) {
  const timeline = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    timeline.current = factory();
    return () => {
      timeline.current?.stop();
      timeline.current = null;
    };
  }, dependencies);
  return timeline;
}
function Motion({ from, to, children, ...options }) {
  const result = useTween(from, to, options);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children: children(result.value, result.controls) });
}
function createMotionComponent(tag) {
  const Component = (0, import_react.forwardRef)(function DhaakonMotionElement(rawProps, forwardedRef) {
    const { as, initial, animate: target, whileInView, viewport, transition, style, onMotionStart, onMotionComplete, ...props } = rawProps;
    const localRef = (0, import_react.useRef)(null);
    const config = (0, import_react.useContext)(MotionContext);
    const reduced = useReducedMotion();
    const [inViewRef, inView] = useInView({ ...viewport, disabled: !whileInView });
    const hasAnimated = (0, import_react.useRef)(false);
    (0, import_react.useImperativeHandle)(forwardedRef, () => localRef.current);
    const initialKey = stableKey(initial);
    const targetKey = stableKey(target);
    const viewKey = stableKey(whileInView);
    (0, import_react.useLayoutEffect)(() => {
      if (localRef.current && initial) (0, import_motion.writeStyle)(localRef.current, initial);
    }, [initialKey]);
    (0, import_react.useEffect)(() => {
      const node = localRef.current;
      const activeTarget = whileInView ? inView ? whileInView : initial || void 0 : target;
      if (!node || !activeTarget) return;
      const from = hasAnimated.current || initial === false ? (0, import_motion.readStyle)(node, activeTarget) : { ...initial || (0, import_motion.readStyle)(node, activeTarget) };
      hasAnimated.current = true;
      if (reduced) {
        (0, import_motion.writeStyle)(node, activeTarget);
        onMotionComplete?.();
        return;
      }
      const tween = new import_motion.Tween({
        ...config.transition,
        ...transition,
        from,
        to: activeTarget,
        onStart: () => onMotionStart?.(),
        onUpdate: (value) => (0, import_motion.writeStyle)(node, value),
        onComplete: () => onMotionComplete?.()
      }).play();
      return () => {
        tween.cancel();
      };
    }, [initialKey, targetKey, viewKey, inView, reduced, transition?.duration, transition?.delay, transition?.repeat, transition?.repeatDelay, transition?.yoyo, transition?.easing]);
    return import_react.default.createElement(as || tag, { ...props, style, ref: (node) => {
      localRef.current = node;
      inViewRef.current = node;
    } });
  });
  return Component;
}
function stableKey(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
var cache = /* @__PURE__ */ new Map();
var motion = new Proxy({}, { get: (_, tag) => {
  if (!cache.has(tag)) cache.set(tag, createMotionComponent(tag));
  return cache.get(tag);
} });
function Reveal({ from = { y: 28, opacity: 0 }, to = { y: 0, opacity: 1 }, once = true, amount = "some", margin = "0px 0px -8% 0px", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(motion.div, { ...props, initial: from, whileInView: to, viewport: { once, amount, margin } });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Motion,
  MotionConfig,
  Reveal,
  createMotionComponent,
  motion,
  useInView,
  useMotionValue,
  useMotionValueState,
  useReducedMotion,
  useTimeline,
  useTween
});
//# sourceMappingURL=react.cjs.map