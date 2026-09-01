// src/react.tsx
import React, { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { MotionValue, Tween } from "@dhaakon/motion";
import { Fragment, jsx } from "react/jsx-runtime";
var MotionContext = createContext({ reducedMotion: "user" });
function MotionConfig({ children, ...value }) {
  const parent = useContext(MotionContext);
  return /* @__PURE__ */ jsx(MotionContext.Provider, { value: useMemo(() => ({ ...parent, ...value, transition: { ...parent.transition, ...value.transition } }), [parent, value.transition, value.reducedMotion]), children });
}
function useReducedMotion() {
  const setting = useContext(MotionContext).reducedMotion;
  const query = useMemo(() => typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null, []);
  const system = useSyncExternalStore(
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
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const [inView, setInView] = useState(disabled || reduced);
  useEffect(() => {
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
  const ref = useRef(null);
  if (!ref.current) ref.current = new MotionValue(initial);
  useEffect(() => () => ref.current?.stop(), []);
  return ref.current;
}
function useMotionValueState(value) {
  return useSyncExternalStore(value.subscribe, () => value.get(), () => value.get());
}
function useTween(from, to, options = {}) {
  const motionValue = useMotionValue(from);
  const tween = useRef(null);
  const reduced = useReducedMotion();
  const transition = useContext(MotionContext).transition;
  const fromKey = stableKey(from);
  const toKey = stableKey(to);
  useEffect(() => {
    motionValue.set(from);
    tween.current = motionValue.animate(to, { ...transition, ...options, duration: reduced ? 0 : options.duration ?? transition?.duration });
    return () => {
      tween.current?.cancel();
    };
  }, [motionValue, fromKey, toKey, reduced, options.duration, options.delay, options.repeat, options.repeatDelay, options.yoyo, options.easing, options.ease]);
  return { value: useMotionValueState(motionValue), motionValue, controls: tween };
}
function useTimeline(factory, dependencies = []) {
  const timeline = useRef(null);
  useEffect(() => {
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
  return /* @__PURE__ */ jsx(Fragment, { children: children(result.value, result.controls) });
}
var transformKeys = /* @__PURE__ */ new Set(["x", "y", "z", "scale", "scaleX", "scaleY", "rotate", "rotateX", "rotateY", "skewX", "skewY"]);
var unitless = /* @__PURE__ */ new Set(["opacity", "zIndex", "fontWeight", "lineHeight", "scale", "scaleX", "scaleY", "flexGrow", "flexShrink"]);
function writeStyle(node, values) {
  const transforms = [];
  for (const [key, value] of Object.entries(values)) {
    if (transformKeys.has(key)) {
      const unit = key.startsWith("rotate") || key.startsWith("skew") ? "deg" : key.startsWith("scale") ? "" : "px";
      const name = key === "x" ? "translateX" : key === "y" ? "translateY" : key === "z" ? "translateZ" : key;
      transforms.push(`${name}(${typeof value === "number" ? `${value}${unit}` : value})`);
    } else {
      const cssKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      node.style.setProperty(cssKey, typeof value === "number" && !unitless.has(key) ? `${value}px` : String(value));
    }
  }
  if (transforms.length) node.style.transform = transforms.join(" ");
}
function createMotionComponent(tag) {
  const Component = forwardRef(function DhaakonMotionElement(rawProps, forwardedRef) {
    const { as, initial, animate: target, whileInView, viewport, transition, style, onMotionStart, onMotionComplete, ...props } = rawProps;
    const localRef = useRef(null);
    const config = useContext(MotionContext);
    const reduced = useReducedMotion();
    const [inViewRef, inView] = useInView({ ...viewport, disabled: !whileInView });
    const hasAnimated = useRef(false);
    useImperativeHandle(forwardedRef, () => localRef.current);
    const initialKey = stableKey(initial);
    const targetKey = stableKey(target);
    const viewKey = stableKey(whileInView);
    useLayoutEffect(() => {
      if (localRef.current && initial) writeStyle(localRef.current, initial);
    }, [initialKey]);
    useEffect(() => {
      const node = localRef.current;
      const activeTarget = whileInView ? inView ? whileInView : initial || void 0 : target;
      if (!node || !activeTarget) return;
      const from = hasAnimated.current || initial === false ? readStyle(node, activeTarget) : { ...initial || readStyle(node, activeTarget) };
      hasAnimated.current = true;
      if (reduced) {
        writeStyle(node, activeTarget);
        onMotionComplete?.();
        return;
      }
      const tween = new Tween({
        ...config.transition,
        ...transition,
        from,
        to: activeTarget,
        onStart: () => onMotionStart?.(),
        onUpdate: (value) => writeStyle(node, value),
        onComplete: () => onMotionComplete?.()
      }).play();
      return () => {
        tween.cancel();
      };
    }, [initialKey, targetKey, viewKey, inView, reduced, transition?.duration, transition?.delay, transition?.repeat, transition?.repeatDelay, transition?.yoyo, transition?.easing]);
    return React.createElement(as || tag, { ...props, style, ref: (node) => {
      localRef.current = node;
      inViewRef.current = node;
    } });
  });
  return Component;
}
function readStyle(node, target) {
  const computed = getComputedStyle(node);
  const values = {};
  for (const key of Object.keys(target)) {
    if (transformKeys.has(key)) values[key] = key.startsWith("scale") ? 1 : 0;
    else {
      const css = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      const value = computed.getPropertyValue(css);
      values[key] = Number.isNaN(Number(value)) || value.trim() === "" ? value : Number(value);
    }
  }
  return values;
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
  return /* @__PURE__ */ jsx(motion.div, { ...props, initial: from, whileInView: to, viewport: { once, amount, margin } });
}
export {
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
};
//# sourceMappingURL=react.js.map