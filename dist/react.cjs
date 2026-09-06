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
  CssMotionConfig: () => CssMotionConfig,
  Cue: () => Cue,
  Marker: () => Marker,
  Motion: () => Motion,
  MotionConfig: () => MotionConfig,
  Region: () => Region,
  Reveal: () => Reveal,
  Sequence: () => Sequence,
  Track: () => Track,
  Transport: () => Transport,
  Tween: () => Tween,
  createCssMotionComponent: () => createCssMotionComponent,
  createMotionComponent: () => createMotionComponent,
  cssMotion: () => cssMotion,
  motion: () => motion,
  useCue: () => useCue,
  useDrag: () => useDrag,
  useDragControls: () => useDragControls,
  useGesture: () => useGesture,
  useInView: () => useInView,
  useIsHovered: () => useIsHovered,
  useIsPressed: () => useIsPressed,
  useMotionValue: () => useMotionValue,
  useMotionValueState: () => useMotionValueState,
  usePinch: () => usePinch,
  usePlayhead: () => usePlayhead,
  usePlayheadValue: () => usePlayheadValue,
  useReducedMotion: () => useReducedMotion,
  useSceneState: () => useSceneState,
  useScrub: () => useScrub,
  useTimeline: () => useTimeline,
  useTransport: () => useTransport,
  useTransportState: () => useTransportState,
  useTween: () => useTween,
  useVelocity: () => useVelocity
});
module.exports = __toCommonJS(react_exports);
var import_react3 = __toESM(require("react"), 1);
var import_motion = require("@dhaakon/motion");
var import_gesture = require("@dhaakon/motion/gesture");

// src/react-config.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var MotionContext = (0, import_react.createContext)({ reducedMotion: "user" });
function MotionConfig({ children, ...value }) {
  const parent = (0, import_react.useContext)(MotionContext);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    MotionContext.Provider,
    {
      value: (0, import_react.useMemo)(
        () => ({ ...parent, ...value, transition: { ...parent.transition, ...value.transition } }),
        [parent, value.transition, value.reducedMotion, value.frameRate]
      ),
      children
    }
  );
}
function useReducedMotion() {
  const setting = (0, import_react.useContext)(MotionContext).reducedMotion;
  const query = (0, import_react.useMemo)(
    () => typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null,
    []
  );
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

// src/react-css.tsx
var import_react2 = __toESM(require("react"), 1);
var import_css = require("@dhaakon/motion/css");
var import_jsx_runtime2 = require("react/jsx-runtime");
var CssContext = (0, import_react2.createContext)(import_css.defaultCssMotionTokens);
function CssMotionConfig({
  tokens,
  children
}) {
  const parent = (0, import_react2.useContext)(CssContext);
  const value = (0, import_react2.useMemo)(() => ({ ...parent, ...tokens }), [parent, tokens]);
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CssContext.Provider, { value, children });
}
var useOwnedLayoutEffect = typeof window === "undefined" ? import_react2.useEffect : import_react2.useLayoutEffect;
function resolveVariant(value, variants) {
  if (typeof value !== "string") return value;
  if (!variants || !Object.hasOwn(variants, value))
    throw new Error(`Unknown CSS variant: ${value}`);
  return variants[value];
}
function createCssMotionComponent(tag) {
  const Component = (0, import_react2.forwardRef)(
    function CssMotionElement(rawProps, forwardedRef) {
      const {
        initial,
        animate,
        variants,
        transition,
        onMotionStart,
        onMotionComplete,
        style,
        ...props
      } = rawProps;
      const tokens = (0, import_react2.useContext)(CssContext);
      const reduced = useReducedMotion();
      const target = resolveVariant(animate, variants);
      const timing = typeof transition === "string" ? Object.hasOwn(tokens, transition) ? tokens[transition] : (() => {
        throw new Error(`Unknown CSS motion token: ${transition}`);
      })() : transition ?? tokens.feedback;
      const first = (0, import_react2.useRef)({
        value: !reduced && initial ? { ...resolveVariant(initial, variants) } : { ...target },
        shouldAnimate: initial !== void 0 && initial !== false
      });
      const node = (0, import_react2.useRef)(null);
      const owner = (0, import_react2.useRef)(null);
      const fresh = (0, import_react2.useRef)(true);
      const callbacks = (0, import_react2.useRef)({ onMotionStart, onMotionComplete });
      callbacks.current = { onMotionStart, onMotionComplete };
      const targetKey = JSON.stringify(target);
      useOwnedLayoutEffect(() => {
        if (!node.current) return;
        const animator = (0, import_css.createCssAnimator)(node.current);
        owner.current = animator;
        fresh.current = true;
        try {
          animator.set(first.current.value);
        } catch (error) {
          owner.current = null;
          animator.dispose();
          throw error;
        }
        return () => {
          owner.current = null;
          animator.dispose();
        };
      }, []);
      useOwnedLayoutEffect(() => {
        const animator = owner.current;
        if (!animator) return;
        let valid = true;
        const skipEntry = fresh.current && !first.current.shouldAnimate;
        fresh.current = false;
        const playback = animator.animate(target, {
          ...timing,
          duration: skipEntry ? 0 : timing.duration,
          reducedMotion: reduced
        });
        callbacks.current.onMotionStart?.(playback);
        void playback.finished.then((result) => {
          if (valid && result.status === "finished") callbacks.current.onMotionComplete?.(result);
        });
        return () => {
          valid = false;
        };
      }, [targetKey, timing.duration, timing.delay, timing.easing, reduced]);
      const ref = (0, import_react2.useMemo)(
        () => (element) => {
          node.current = element;
          if (typeof forwardedRef === "function") forwardedRef(element);
          else if (forwardedRef) forwardedRef.current = element;
        },
        [forwardedRef]
      );
      return import_react2.default.createElement(tag, {
        ...props,
        ref,
        style: { ...style, ...first.current.value }
      });
    }
  );
  Component.displayName = `CssMotion(${typeof tag === "string" ? tag : "Component"})`;
  return Component;
}
var cssMotion = {
  div: createCssMotionComponent("div"),
  section: createCssMotionComponent("section"),
  article: createCssMotionComponent("article"),
  span: createCssMotionComponent("span"),
  button: createCssMotionComponent("button")
};

// src/react.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function useInView({ once = true, amount = "some", margin = "0px", disabled = false } = {}) {
  const ref = (0, import_react3.useRef)(null);
  const reduced = useReducedMotion();
  const [inView, setInView] = (0, import_react3.useState)(disabled || reduced);
  (0, import_react3.useEffect)(() => {
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
  const ref = (0, import_react3.useRef)(null);
  if (!ref.current) ref.current = new import_motion.MotionValue(initial);
  (0, import_react3.useEffect)(() => () => ref.current?.stop(), []);
  return ref.current;
}
function useMotionValueState(value) {
  return (0, import_react3.useSyncExternalStore)(value.subscribe, () => value.get(), () => value.get());
}
function useTween(from, to, options = {}) {
  const motionValue = useMotionValue(from);
  const tween = (0, import_react3.useRef)(null);
  const reduced = useReducedMotion();
  const config = (0, import_react3.useContext)(MotionContext);
  const transition = config.transition;
  const fromKey = stableKey(from);
  const toKey = stableKey(to);
  (0, import_react3.useEffect)(() => {
    motionValue.set(from);
    tween.current = motionValue.animate(to, { frameRate: config.frameRate, ...transition, ...options, duration: reduced ? 0 : options.duration ?? transition?.duration });
    return () => {
      tween.current?.cancel();
    };
  }, [motionValue, fromKey, toKey, reduced, config.frameRate, transition?.frameRate, options.frameRate, options.duration, options.delay, options.repeat, options.repeatDelay, options.yoyo, options.easing, options.ease]);
  return { value: useMotionValueState(motionValue), motionValue, controls: tween };
}
function useTimeline(factory, dependencies = []) {
  const timeline = (0, import_react3.useRef)(null);
  (0, import_react3.useEffect)(() => {
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
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_jsx_runtime3.Fragment, { children: children(result.value, result.controls) });
}
function createMotionComponent(tag) {
  const Component = (0, import_react3.forwardRef)(function DhaakonMotionElement(rawProps, forwardedRef) {
    const {
      as,
      initial,
      animate: target,
      whileInView,
      viewport,
      transition,
      style,
      whileHover,
      whileTap,
      whileDrag,
      whileFocus,
      drag,
      dragAxis,
      dragBounds,
      dragElastic,
      dragMomentum,
      dragSnap,
      dragPropagation,
      dragListener,
      dragKeyboard,
      dragControls,
      onTap,
      onLongPress,
      onPanStart,
      onPan,
      onPanEnd,
      onPinch,
      onDragStart,
      onDrag,
      onDragEnd,
      onMotionStart,
      onMotionComplete,
      ...props
    } = rawProps;
    const localRef = (0, import_react3.useRef)(null);
    const config = (0, import_react3.useContext)(MotionContext);
    const reduced = useReducedMotion();
    const gestureHandlers = (0, import_react3.useRef)({ onTap, onLongPress, onPanStart, onPan, onPanEnd, onPinch, onDragStart, onDrag, onDragEnd });
    gestureHandlers.current = { onTap, onLongPress, onPanStart, onPan, onPanEnd, onPinch, onDragStart, onDrag, onDragEnd };
    const dragBoundsRef = (0, import_react3.useRef)(dragBounds);
    dragBoundsRef.current = dragBounds;
    const [inViewRef, inView] = useInView({ ...viewport, disabled: !whileInView });
    const hasAnimated = (0, import_react3.useRef)(false);
    const visual = (0, import_react3.useRef)({});
    const interactionTween = (0, import_react3.useRef)(null);
    (0, import_react3.useImperativeHandle)(forwardedRef, () => localRef.current);
    const initialKey = stableKey(initial);
    const targetKey = stableKey(target);
    const viewKey = stableKey(whileInView);
    (0, import_react3.useLayoutEffect)(() => {
      if (localRef.current && initial) {
        visual.current = { ...initial };
        (0, import_motion.writeStyle)(localRef.current, initial);
      }
    }, [initialKey]);
    (0, import_react3.useEffect)(() => {
      const node = localRef.current;
      const activeTarget = whileInView ? inView ? whileInView : initial || void 0 : target;
      if (!node || !activeTarget) return;
      const from = hasAnimated.current || initial === false ? (0, import_motion.readStyle)(node, activeTarget) : { ...initial || (0, import_motion.readStyle)(node, activeTarget) };
      hasAnimated.current = true;
      if (reduced) {
        visual.current = { ...visual.current, ...activeTarget };
        (0, import_motion.writeStyle)(node, activeTarget);
        onMotionComplete?.();
        return;
      }
      const tween = new import_motion.Tween({
        frameRate: config.frameRate,
        ...config.transition,
        ...transition,
        from,
        to: activeTarget,
        onStart: () => onMotionStart?.(),
        onUpdate: (value) => {
          visual.current = { ...visual.current, ...value };
          (0, import_motion.writeStyle)(node, visual.current);
        },
        onComplete: () => onMotionComplete?.()
      }).play();
      return () => {
        tween.cancel();
      };
    }, [initialKey, targetKey, viewKey, inView, reduced, config.frameRate, config.transition?.frameRate, transition?.frameRate, transition?.duration, transition?.delay, transition?.repeat, transition?.repeatDelay, transition?.yoyo, transition?.easing]);
    const hoverKey = stableKey(whileHover);
    const tapKey = stableKey(whileTap);
    const dragKey = stableKey(whileDrag);
    const focusKey = stableKey(whileFocus);
    const boundsKey = typeof dragBounds === "function" ? "function" : stableKey(dragBounds);
    const snapKey = stableKey(dragSnap);
    (0, import_react3.useEffect)(() => {
      const node = localRef.current;
      if (!node) return;
      let liveDragValues;
      const preserveDragPosition = (value) => {
        if (!liveDragValues) return value;
        const next = { ...value };
        if (liveDragValues.x) next.x = liveDragValues.x.get();
        if (liveDragValues.y) next.y = liveDragValues.y.get();
        return next;
      };
      const resting = (0, import_motion.readStyle)(node, { ...whileHover, ...whileFocus, ...whileTap, ...whileDrag });
      visual.current = { ...resting, ...visual.current };
      const active = { hover: false, focus: false, tap: false, drag: false };
      const base = () => ({ ...resting, ...whileInView && inView ? whileInView : target ?? (initial || {}) });
      const animateInteraction = () => {
        const next = { ...base(), ...active.hover ? whileHover : {}, ...active.focus ? whileFocus : {}, ...active.tap ? whileTap : {}, ...active.drag ? whileDrag : {} };
        interactionTween.current?.cancel();
        if (reduced) {
          visual.current = preserveDragPosition({ ...visual.current, ...next });
          (0, import_motion.writeStyle)(node, visual.current);
          return;
        }
        interactionTween.current = new import_motion.Tween({ ...config.transition, ...transition, from: { ...visual.current }, to: next, onUpdate: (value) => {
          visual.current = preserveDragPosition(value);
          (0, import_motion.writeStyle)(node, visual.current);
        } }).play();
      };
      const setActive = (kind, value) => {
        if (active[kind] === value) return;
        active[kind] = value;
        animateInteraction();
      };
      const disposers = [];
      if (whileHover) {
        const binding = (0, import_gesture.hover)(node, { onChange: (value) => setActive("hover", value) });
        disposers.push(binding.dispose);
      }
      if (whileTap) {
        const binding = (0, import_gesture.press)(node, { onChange: (value) => setActive("tap", value) });
        disposers.push(binding.dispose);
      }
      if (whileFocus) {
        const focus = () => setActive("focus", true);
        const blur = () => setActive("focus", false);
        node.addEventListener("focus", focus);
        node.addEventListener("blur", blur);
        disposers.push(() => {
          node.removeEventListener("focus", focus);
          node.removeEventListener("blur", blur);
        });
      }
      if (onTap || onLongPress || onPanStart || onPan || onPanEnd || onPinch) {
        const recognizers = [];
        if (onTap) {
          const recognizer = (0, import_gesture.tapRecognizer)();
          recognizer.subscribe((event) => gestureHandlers.current.onTap?.(event));
          recognizers.push(recognizer);
        }
        if (onLongPress) {
          const recognizer = (0, import_gesture.longPressRecognizer)();
          recognizer.subscribe((event) => gestureHandlers.current.onLongPress?.(event));
          recognizers.push(recognizer);
        }
        if (onPanStart || onPan || onPanEnd) {
          const recognizer = (0, import_gesture.panRecognizer)({ axis: dragAxis });
          recognizer.subscribe((event) => {
            if (event.phase === "began") gestureHandlers.current.onPanStart?.(event);
            else if (event.phase === "changed") gestureHandlers.current.onPan?.(event);
            else if (event.phase === "ended") gestureHandlers.current.onPanEnd?.(event);
          });
          recognizers.push(recognizer);
        }
        if (onPinch) {
          const recognizer = (0, import_gesture.pinchRecognizer)();
          recognizer.subscribe((event) => gestureHandlers.current.onPinch?.(event));
          recognizers.push(recognizer);
        }
        const arena = new import_gesture.GestureArena(node, recognizers);
        disposers.push(() => arena.dispose());
      }
      if (drag) {
        const x = new import_motion.MotionValue(Number(visual.current.x ?? 0));
        const y = new import_motion.MotionValue(Number(visual.current.y ?? 0));
        const axis = dragAxis ?? (drag === true ? "any" : drag);
        liveDragValues = axis === "x" ? { x } : axis === "y" ? { y } : { x, y };
        const writeDrag = () => {
          visual.current = preserveDragPosition(visual.current);
          (0, import_motion.writeStyle)(node, visual.current);
        };
        const ux = liveDragValues.x ? x.subscribe(writeDrag) : () => {
        };
        const uy = liveDragValues.y ? y.subscribe(writeDrag) : () => {
        };
        const currentBounds = () => {
          const value = dragBoundsRef.current;
          return typeof value === "function" ? value() : value;
        };
        const binding = (0, import_gesture.drag)(axis === "x" ? x : axis === "y" ? y : { x, y }, node, {
          axis,
          bounds: currentBounds,
          elastic: dragElastic,
          momentum: dragMomentum,
          snap: dragSnap,
          propagate: dragPropagation,
          dragListener,
          keyboard: dragKeyboard,
          onStart: (event) => gestureHandlers.current.onDragStart?.(event),
          onMove: (event) => gestureHandlers.current.onDrag?.(event),
          onEnd: (event) => gestureHandlers.current.onDragEnd?.(event)
        });
        const dragging = binding.isDragging.subscribe(() => setActive("drag", binding.isDragging.get()));
        dragControls?._bind(binding);
        disposers.push(() => {
          dragging();
          dragControls?._unbind(binding);
          ux();
          uy();
          binding.dispose();
        });
      }
      return () => {
        interactionTween.current?.cancel();
        disposers.forEach((dispose) => dispose());
      };
    }, [hoverKey, tapKey, dragKey, focusKey, boundsKey, snapKey, Boolean(drag), dragAxis, dragElastic, dragMomentum, dragPropagation, dragListener, dragKeyboard, Boolean(onTap), Boolean(onLongPress), Boolean(onPanStart || onPan || onPanEnd), Boolean(onPinch), dragControls, reduced]);
    return import_react3.default.createElement(as || tag, { ...props, style, ref: (node) => {
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
function useGesture(ref, recognizers) {
  const key = recognizers.map((recognizer) => recognizer.kind).join("|");
  (0, import_react3.useEffect)(() => {
    if (!ref.current) return;
    const arena = new import_gesture.GestureArena(ref.current, recognizers);
    return () => arena.dispose();
  }, [ref, key]);
}
function useDrag(ref, target, options = {}) {
  const controls = (0, import_react3.useRef)(null);
  const key = stableKey(options);
  (0, import_react3.useEffect)(() => {
    if (!ref.current) return;
    controls.current = (0, import_gesture.drag)(target, ref.current, options);
    return () => {
      controls.current?.dispose();
      controls.current = null;
    };
  }, [ref, target, key]);
  return controls;
}
function usePinch(ref, options) {
  const key = stableKey(options);
  (0, import_react3.useEffect)(() => {
    if (!ref.current) return;
    const binding = (0, import_gesture.transformGesture)(ref.current, options);
    return binding.dispose;
  }, [ref, key]);
}
function useScrub(ref, transport, options = {}) {
  const inherited = (0, import_react3.useContext)(TransportContext);
  const active = transport ?? inherited;
  const key = stableKey(options);
  (0, import_react3.useEffect)(() => {
    if (!ref.current || !active) return;
    const binding = (0, import_gesture.scrub)(active, ref.current, options);
    return binding.dispose;
  }, [ref, active, key]);
}
function useDragControls() {
  const active = (0, import_react3.useRef)(null);
  return (0, import_react3.useMemo)(() => ({ start: (event) => active.current?.start(event), cancel: () => active.current?.cancel(), _bind: (control) => {
    active.current = control;
  }, _unbind: (control) => {
    if (active.current === control) active.current = null;
  } }), []);
}
function useVelocity(value) {
  const output = useMotionValue(value.velocity);
  (0, import_react3.useEffect)(() => value.subscribe(() => output.set(value.velocity)), [value, output]);
  return output;
}
function useIsPressed(ref) {
  const state = useMotionValue(false);
  (0, import_react3.useEffect)(() => {
    if (!ref.current) return;
    const binding = (0, import_gesture.press)(ref.current, { onChange: (value) => state.set(value) });
    return binding.dispose;
  }, [ref, state]);
  return useMotionValueState(state);
}
function useIsHovered(ref) {
  const state = useMotionValue(false);
  (0, import_react3.useEffect)(() => {
    if (!ref.current) return;
    const binding = (0, import_gesture.hover)(ref.current, { onChange: (value) => state.set(value) });
    return binding.dispose;
  }, [ref, state]);
  return useMotionValueState(state);
}
function Reveal({ from = { y: 28, opacity: 0 }, to = { y: 0, opacity: 1 }, once = true, amount = "some", margin = "0px 0px -8% 0px", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(motion.div, { ...props, initial: from, whileInView: to, viewport: { once, amount, margin } });
}
var SequenceContext = (0, import_react3.createContext)(null);
var TransportContext = (0, import_react3.createContext)(null);
function requireSequence(componentName) {
  const value = (0, import_react3.useContext)(SequenceContext);
  if (!value) throw new Error(`<${componentName}> (or use${componentName}()) must be used inside <Transport>, directly or nested inside a <Sequence>.`);
  return value;
}
function createSequenceValue(timeline, onRebuilt) {
  const items = /* @__PURE__ */ new Map();
  const cues = /* @__PURE__ */ new Map();
  const markers = /* @__PURE__ */ new Map();
  const regions = /* @__PURE__ */ new Map();
  let orderCounter = 0;
  let scheduled = false;
  const rebuild = () => {
    timeline.clear();
    const sorted = [...items.values()].sort((a, b) => a.order - b.order);
    for (const entry of sorted) timeline.add(entry.item, entry.at);
    for (const marker of markers.values()) timeline.marker(marker.name, marker.at, marker.options);
    for (const cue of cues.values()) timeline.cue(cue.name, cue.at, cue.handler, cue.options);
    for (const region of regions.values()) timeline.region(region.name, region.from, region.to, region.options);
    onRebuilt();
  };
  const invalidate = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      rebuild();
    });
  };
  return {
    timeline,
    register(key, item, at) {
      const existing = items.get(key);
      items.set(key, { item, at, order: existing?.order ?? orderCounter++ });
      invalidate();
    },
    unregister(key) {
      if (items.delete(key)) invalidate();
    },
    registerCue(key, spec) {
      cues.set(key, spec);
      invalidate();
    },
    unregisterCue(key) {
      if (cues.delete(key)) invalidate();
    },
    registerMarker(key, spec) {
      markers.set(key, spec);
      invalidate();
    },
    unregisterMarker(key) {
      if (markers.delete(key)) invalidate();
    },
    registerRegion(key, spec) {
      regions.set(key, spec);
      invalidate();
    },
    unregisterRegion(key) {
      if (regions.delete(key)) invalidate();
    },
    invalidate
  };
}
function Transport(props) {
  const reduced = useReducedMotion();
  const respect = props.respectReducedMotion !== false;
  const ownsInstance = (0, import_react3.useRef)(false);
  const loopRef = (0, import_react3.useRef)(props.loop);
  loopRef.current = props.loop;
  const instanceRef = (0, import_react3.useRef)(null);
  if (!instanceRef.current) {
    if (props.transport) {
      instanceRef.current = props.transport;
      ownsInstance.current = false;
    } else {
      instanceRef.current = new import_motion.Transport({ frameRate: props.frameRate, snap: props.snap, rate: props.rate, loop: props.loop, clock: props.clock, scheduler: props.scheduler });
      ownsInstance.current = true;
    }
  }
  const transport = instanceRef.current;
  (0, import_react3.useEffect)(() => () => {
    if (ownsInstance.current) transport.dispose();
  }, [transport]);
  (0, import_react3.useEffect)(() => {
    const detachers = (props.outputs ?? []).map((output) => transport.attach(output));
    return () => {
      detachers.forEach((detach) => detach());
    };
  }, [transport, stableKey(props.outputs?.map((o) => o.name))]);
  const onStateChangeRef = (0, import_react3.useRef)(props.onStateChange);
  onStateChangeRef.current = props.onStateChange;
  (0, import_react3.useEffect)(() => transport.attach({ onStateChange: (state) => onStateChangeRef.current?.(state) }), [transport]);
  const onFinishRef = (0, import_react3.useRef)(props.onFinish);
  onFinishRef.current = props.onFinish;
  (0, import_react3.useEffect)(() => {
    let cancelled = false;
    transport.finished.then(() => {
      if (!cancelled) onFinishRef.current?.();
    });
    return () => {
      cancelled = true;
    };
  }, [transport, transport.state]);
  const controlled = props.paused !== void 0;
  const shouldRun = (props.autoplay || controlled) && props.paused !== true && !(respect && reduced);
  (0, import_react3.useEffect)(() => {
    if (!props.autoplay && !controlled) return;
    if (respect && reduced) {
      transport.seek(transport.duration);
      return;
    }
    if (shouldRun) {
      for (const output of props.outputs ?? []) output.unlock?.();
      transport.play();
    } else {
      transport.pause();
    }
  }, [transport, shouldRun, respect, reduced]);
  const sequenceValue = (0, import_react3.useMemo)(
    () => createSequenceValue(transport.root, () => {
      if (ownsInstance.current) transport.setLoop(loopRef.current);
      transport.seek(transport.time, { cues: "skip" });
    }),
    [transport]
  );
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(TransportContext.Provider, { value: transport, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(SequenceContext.Provider, { value: sequenceValue, children: props.children }) });
}
function useTransport() {
  const transport = (0, import_react3.useContext)(TransportContext);
  if (!transport) throw new Error("useTransport() must be called inside <Transport>.");
  return transport;
}
function useTransportState() {
  const transport = useTransport();
  const snapshotRef = (0, import_react3.useRef)({ state: transport.state, rate: transport.rate, duration: transport.duration, frameRate: transport.frameRate });
  const getSnapshot = () => {
    const prev = snapshotRef.current;
    if (prev.state !== transport.state || prev.rate !== transport.rate || prev.duration !== transport.duration || prev.frameRate !== transport.frameRate) {
      snapshotRef.current = { state: transport.state, rate: transport.rate, duration: transport.duration, frameRate: transport.frameRate };
    }
    return snapshotRef.current;
  };
  return (0, import_react3.useSyncExternalStore)(
    (listener) => transport.attach({ onStateChange: () => listener(), onRateChange: () => listener() }),
    getSnapshot,
    getSnapshot
  );
}
function usePlayhead(options = {}) {
  const transport = useTransport();
  const fps = Math.max(1, options.fps ?? 30);
  const [snapshot, setSnapshot] = (0, import_react3.useState)(() => ({ time: transport.time, frame: transport.frame, timecode: transport.timecode, progress: transport.progress }));
  (0, import_react3.useEffect)(() => {
    const minInterval = 1e3 / fps;
    let last = 0;
    let trailing;
    const publish = () => {
      trailing = void 0;
      last = globalThis.performance?.now?.() ?? Date.now();
      setSnapshot({ time: transport.time, frame: transport.frame, timecode: transport.timecode, progress: transport.progress });
    };
    const unsubscribe = transport.subscribe(() => {
      const now = globalThis.performance?.now?.() ?? Date.now();
      const remaining = minInterval - (now - last);
      if (remaining <= 0) {
        if (trailing) clearTimeout(trailing);
        publish();
        return;
      }
      if (!trailing) trailing = setTimeout(publish, remaining);
    });
    return () => {
      unsubscribe();
      if (trailing) clearTimeout(trailing);
    };
  }, [transport, fps]);
  return snapshot;
}
function usePlayheadValue() {
  const transport = useTransport();
  const motionValue = useMotionValue(transport.time);
  (0, import_react3.useEffect)(() => transport.subscribe((info) => motionValue.set(info.time)), [transport, motionValue]);
  return motionValue;
}
function useCue(at, handler, deps = []) {
  const parent = requireSequence("Cue");
  const id = (0, import_react3.useId)();
  const handlerRef = (0, import_react3.useRef)(handler);
  handlerRef.current = handler;
  const stableHandler = (0, import_react3.useRef)((e) => handlerRef.current(e)).current;
  (0, import_react3.useLayoutEffect)(() => {
    parent.registerCue(id, { name: id, at, handler: stableHandler });
    return () => parent.unregisterCue(id);
  }, [parent, id, stableKey(at), ...deps]);
}
function Track({ target, keyframes, at, ...options }) {
  const parent = requireSequence("Track");
  const id = (0, import_react3.useId)();
  const key = `${stableKey(keyframes)}:${stableKey(options)}`;
  const built = (0, import_react3.useRef)(null);
  if (!built.current || built.current.key !== key) {
    const item = target instanceof import_motion.MotionValue ? new import_motion.Track({ ...options, keyframes, target }) : new import_motion.Track({ ...options, keyframes, apply: target });
    built.current = { item, key };
  }
  (0, import_react3.useLayoutEffect)(() => {
    parent.register(id, built.current.item, at);
    return () => parent.unregister(id);
  }, [parent, id, stableKey(at), key]);
  return null;
}
function Tween({ target, from, to, at, ...options }) {
  const parent = requireSequence("Tween");
  const id = (0, import_react3.useId)();
  const key = `${stableKey(from)}:${stableKey(to)}:${stableKey(options)}`;
  const built = (0, import_react3.useRef)(null);
  if (!built.current || built.current.key !== key) {
    const write = target instanceof import_motion.MotionValue ? (value) => target.set(value) : target;
    built.current = { item: new import_motion.Tween({ ...options, from, to, onUpdate: (value) => write(value) }), key };
  }
  (0, import_react3.useLayoutEffect)(() => {
    parent.register(id, built.current.item, at);
    return () => parent.unregister(id);
  }, [parent, id, stableKey(at), key]);
  return null;
}
function Marker({ name, at, color, payload }) {
  const parent = requireSequence("Marker");
  const id = (0, import_react3.useId)();
  (0, import_react3.useLayoutEffect)(() => {
    parent.registerMarker(id, { name, at, options: { color, payload } });
    return () => parent.unregisterMarker(id);
  }, [parent, id, name, stableKey(at), color, stableKey(payload)]);
  return null;
}
function Cue({ name, at, onFire, payload, once }) {
  const parent = requireSequence("Cue");
  const id = (0, import_react3.useId)();
  const handlerRef = (0, import_react3.useRef)(onFire);
  handlerRef.current = onFire;
  const stableHandler = (0, import_react3.useRef)((e) => handlerRef.current(e)).current;
  (0, import_react3.useLayoutEffect)(() => {
    parent.registerCue(id, { name, at, handler: stableHandler, options: { payload, once } });
    return () => parent.unregisterCue(id);
  }, [parent, id, name, stableKey(at), stableKey(payload), once]);
  return null;
}
function Region({ name, from, to, onEnter, onExit, payload, once }) {
  const parent = requireSequence("Region");
  const id = (0, import_react3.useId)();
  const enterRef = (0, import_react3.useRef)(onEnter);
  enterRef.current = onEnter;
  const exitRef = (0, import_react3.useRef)(onExit);
  exitRef.current = onExit;
  const stableEnter = (0, import_react3.useRef)((e) => enterRef.current?.(e)).current;
  const stableExit = (0, import_react3.useRef)((e) => exitRef.current?.(e)).current;
  (0, import_react3.useLayoutEffect)(() => {
    parent.registerRegion(id, { name, from, to, options: { payload, once, onEnter: stableEnter, onExit: stableExit } });
    return () => parent.unregisterRegion(id);
  }, [parent, id, name, stableKey(from), stableKey(to), stableKey(payload), once]);
  return null;
}
function Sequence({ name, at, repeat, repeatDelay, yoyo, frameRate, snap, onComplete, children }) {
  const parent = requireSequence("Sequence");
  const id = (0, import_react3.useId)();
  const timelineRef = (0, import_react3.useRef)(null);
  if (!timelineRef.current) timelineRef.current = new import_motion.Timeline({ name, repeat, repeatDelay, yoyo, frameRate, snap, onComplete });
  const timeline = timelineRef.current;
  const valueRef = (0, import_react3.useRef)(null);
  if (!valueRef.current) valueRef.current = createSequenceValue(timeline, () => parent.invalidate());
  (0, import_react3.useLayoutEffect)(() => {
    parent.register(id, timeline, at);
    return () => parent.unregister(id);
  }, [parent, id, stableKey(at)]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(SequenceContext.Provider, { value: valueRef.current, children });
}
function useSceneState(targets) {
  const [state, setState] = (0, import_react3.useState)(() => (0, import_motion.captureScene)(targets));
  const targetsRef = (0, import_react3.useRef)(targets);
  targetsRef.current = targets;
  const set = (next, transition) => {
    (0, import_motion.applyScene)(next, targetsRef.current, transition ? { transition } : void 0);
    setState((prev) => ({ ...prev, ...next }));
  };
  return [state, set];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CssMotionConfig,
  Cue,
  Marker,
  Motion,
  MotionConfig,
  Region,
  Reveal,
  Sequence,
  Track,
  Transport,
  Tween,
  createCssMotionComponent,
  createMotionComponent,
  cssMotion,
  motion,
  useCue,
  useDrag,
  useDragControls,
  useGesture,
  useInView,
  useIsHovered,
  useIsPressed,
  useMotionValue,
  useMotionValueState,
  usePinch,
  usePlayhead,
  usePlayheadValue,
  useReducedMotion,
  useSceneState,
  useScrub,
  useTimeline,
  useTransport,
  useTransportState,
  useTween,
  useVelocity
});
//# sourceMappingURL=react.cjs.map