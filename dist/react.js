// src/react.tsx
import React2, { createContext as createContext3, forwardRef as forwardRef2, useContext as useContext3, useEffect as useEffect2, useId, useImperativeHandle, useLayoutEffect as useLayoutEffect2, useMemo as useMemo3, useRef as useRef2, useState, useSyncExternalStore as useSyncExternalStore2 } from "react";
import {
  MotionValue,
  Timeline,
  Tween as CoreTween,
  Track as CoreTrack,
  Transport as CoreTransport,
  writeStyle,
  readStyle,
  captureScene,
  applyScene
} from "@dhaakon/motion";
import {
  GestureArena,
  drag as bindDrag,
  hover as bindHover,
  longPressRecognizer,
  panRecognizer,
  pinchRecognizer,
  press as bindPress,
  scrub as bindScrub,
  tapRecognizer,
  transformGesture
} from "@dhaakon/motion/gesture";

// src/react-config.tsx
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { jsx } from "react/jsx-runtime";
var MotionContext = createContext({ reducedMotion: "user" });
function MotionConfig({ children, ...value }) {
  const parent = useContext(MotionContext);
  return /* @__PURE__ */ jsx(
    MotionContext.Provider,
    {
      value: useMemo(
        () => ({ ...parent, ...value, transition: { ...parent.transition, ...value.transition } }),
        [parent, value.transition, value.reducedMotion, value.frameRate]
      ),
      children
    }
  );
}
function useReducedMotion() {
  const setting = useContext(MotionContext).reducedMotion;
  const query = useMemo(
    () => typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null,
    []
  );
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

// src/react-css.tsx
import React, {
  createContext as createContext2,
  forwardRef,
  useContext as useContext2,
  useEffect,
  useLayoutEffect,
  useMemo as useMemo2,
  useRef
} from "react";
import {
  createCssAnimator,
  defaultCssMotionTokens
} from "@dhaakon/motion/css";
import { jsx as jsx2 } from "react/jsx-runtime";
var CssContext = createContext2(defaultCssMotionTokens);
function CssMotionConfig({
  tokens,
  children
}) {
  const parent = useContext2(CssContext);
  const value = useMemo2(() => ({ ...parent, ...tokens }), [parent, tokens]);
  return /* @__PURE__ */ jsx2(CssContext.Provider, { value, children });
}
var useOwnedLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
function resolveVariant(value, variants) {
  if (typeof value !== "string") return value;
  if (!variants || !Object.hasOwn(variants, value))
    throw new Error(`Unknown CSS variant: ${value}`);
  return variants[value];
}
function createCssMotionComponent(tag) {
  const Component = forwardRef(
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
      const tokens = useContext2(CssContext);
      const reduced = useReducedMotion();
      const target = resolveVariant(animate, variants);
      const timing = typeof transition === "string" ? Object.hasOwn(tokens, transition) ? tokens[transition] : (() => {
        throw new Error(`Unknown CSS motion token: ${transition}`);
      })() : transition ?? tokens.feedback;
      const first = useRef({
        value: !reduced && initial ? { ...resolveVariant(initial, variants) } : { ...target },
        shouldAnimate: initial !== void 0 && initial !== false
      });
      const node = useRef(null);
      const owner = useRef(null);
      const fresh = useRef(true);
      const callbacks = useRef({ onMotionStart, onMotionComplete });
      callbacks.current = { onMotionStart, onMotionComplete };
      const targetKey = JSON.stringify(target);
      useOwnedLayoutEffect(() => {
        if (!node.current) return;
        const animator = createCssAnimator(node.current);
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
      const ref = useMemo2(
        () => (element) => {
          node.current = element;
          if (typeof forwardedRef === "function") forwardedRef(element);
          else if (forwardedRef) forwardedRef.current = element;
        },
        [forwardedRef]
      );
      return React.createElement(tag, {
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
import { Fragment, jsx as jsx3 } from "react/jsx-runtime";
function useInView({ once = true, amount = "some", margin = "0px", disabled = false } = {}) {
  const ref = useRef2(null);
  const reduced = useReducedMotion();
  const [inView, setInView] = useState(disabled || reduced);
  useEffect2(() => {
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
  const ref = useRef2(null);
  if (!ref.current) ref.current = new MotionValue(initial);
  useEffect2(() => () => ref.current?.stop(), []);
  return ref.current;
}
function useMotionValueState(value) {
  return useSyncExternalStore2(value.subscribe, () => value.get(), () => value.get());
}
function useTween(from, to, options = {}) {
  const motionValue = useMotionValue(from);
  const tween = useRef2(null);
  const reduced = useReducedMotion();
  const config = useContext3(MotionContext);
  const transition = config.transition;
  const fromKey = stableKey(from);
  const toKey = stableKey(to);
  useEffect2(() => {
    motionValue.set(from);
    tween.current = motionValue.animate(to, { frameRate: config.frameRate, ...transition, ...options, duration: reduced ? 0 : options.duration ?? transition?.duration });
    return () => {
      tween.current?.cancel();
    };
  }, [motionValue, fromKey, toKey, reduced, config.frameRate, transition?.frameRate, options.frameRate, options.duration, options.delay, options.repeat, options.repeatDelay, options.yoyo, options.easing, options.ease]);
  return { value: useMotionValueState(motionValue), motionValue, controls: tween };
}
function useTimeline(factory, dependencies = []) {
  const timeline = useRef2(null);
  useEffect2(() => {
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
  return /* @__PURE__ */ jsx3(Fragment, { children: children(result.value, result.controls) });
}
function createMotionComponent(tag) {
  const Component = forwardRef2(function DhaakonMotionElement(rawProps, forwardedRef) {
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
    const localRef = useRef2(null);
    const config = useContext3(MotionContext);
    const reduced = useReducedMotion();
    const gestureHandlers = useRef2({ onTap, onLongPress, onPanStart, onPan, onPanEnd, onPinch, onDragStart, onDrag, onDragEnd });
    gestureHandlers.current = { onTap, onLongPress, onPanStart, onPan, onPanEnd, onPinch, onDragStart, onDrag, onDragEnd };
    const dragBoundsRef = useRef2(dragBounds);
    dragBoundsRef.current = dragBounds;
    const [inViewRef, inView] = useInView({ ...viewport, disabled: !whileInView });
    const hasAnimated = useRef2(false);
    const visual = useRef2({});
    const interactionTween = useRef2(null);
    useImperativeHandle(forwardedRef, () => localRef.current);
    const initialKey = stableKey(initial);
    const targetKey = stableKey(target);
    const viewKey = stableKey(whileInView);
    useLayoutEffect2(() => {
      if (localRef.current && initial) {
        visual.current = { ...initial };
        writeStyle(localRef.current, initial);
      }
    }, [initialKey]);
    useEffect2(() => {
      const node = localRef.current;
      const activeTarget = whileInView ? inView ? whileInView : initial || void 0 : target;
      if (!node || !activeTarget) return;
      const from = hasAnimated.current || initial === false ? readStyle(node, activeTarget) : { ...initial || readStyle(node, activeTarget) };
      hasAnimated.current = true;
      if (reduced) {
        visual.current = { ...visual.current, ...activeTarget };
        writeStyle(node, activeTarget);
        onMotionComplete?.();
        return;
      }
      const tween = new CoreTween({
        frameRate: config.frameRate,
        ...config.transition,
        ...transition,
        from,
        to: activeTarget,
        onStart: () => onMotionStart?.(),
        onUpdate: (value) => {
          visual.current = { ...visual.current, ...value };
          writeStyle(node, visual.current);
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
    useEffect2(() => {
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
      const resting = readStyle(node, { ...whileHover, ...whileFocus, ...whileTap, ...whileDrag });
      visual.current = { ...resting, ...visual.current };
      const active = { hover: false, focus: false, tap: false, drag: false };
      const base = () => ({ ...resting, ...whileInView && inView ? whileInView : target ?? (initial || {}) });
      const animateInteraction = () => {
        const next = { ...base(), ...active.hover ? whileHover : {}, ...active.focus ? whileFocus : {}, ...active.tap ? whileTap : {}, ...active.drag ? whileDrag : {} };
        interactionTween.current?.cancel();
        if (reduced) {
          visual.current = preserveDragPosition({ ...visual.current, ...next });
          writeStyle(node, visual.current);
          return;
        }
        interactionTween.current = new CoreTween({ ...config.transition, ...transition, from: { ...visual.current }, to: next, onUpdate: (value) => {
          visual.current = preserveDragPosition(value);
          writeStyle(node, visual.current);
        } }).play();
      };
      const setActive = (kind, value) => {
        if (active[kind] === value) return;
        active[kind] = value;
        animateInteraction();
      };
      const disposers = [];
      if (whileHover) {
        const binding = bindHover(node, { onChange: (value) => setActive("hover", value) });
        disposers.push(binding.dispose);
      }
      if (whileTap) {
        const binding = bindPress(node, { onChange: (value) => setActive("tap", value) });
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
          const recognizer = tapRecognizer();
          recognizer.subscribe((event) => gestureHandlers.current.onTap?.(event));
          recognizers.push(recognizer);
        }
        if (onLongPress) {
          const recognizer = longPressRecognizer();
          recognizer.subscribe((event) => gestureHandlers.current.onLongPress?.(event));
          recognizers.push(recognizer);
        }
        if (onPanStart || onPan || onPanEnd) {
          const recognizer = panRecognizer({ axis: dragAxis });
          recognizer.subscribe((event) => {
            if (event.phase === "began") gestureHandlers.current.onPanStart?.(event);
            else if (event.phase === "changed") gestureHandlers.current.onPan?.(event);
            else if (event.phase === "ended") gestureHandlers.current.onPanEnd?.(event);
          });
          recognizers.push(recognizer);
        }
        if (onPinch) {
          const recognizer = pinchRecognizer();
          recognizer.subscribe((event) => gestureHandlers.current.onPinch?.(event));
          recognizers.push(recognizer);
        }
        const arena = new GestureArena(node, recognizers);
        disposers.push(() => arena.dispose());
      }
      if (drag) {
        const x = new MotionValue(Number(visual.current.x ?? 0));
        const y = new MotionValue(Number(visual.current.y ?? 0));
        const axis = dragAxis ?? (drag === true ? "any" : drag);
        liveDragValues = axis === "x" ? { x } : axis === "y" ? { y } : { x, y };
        const writeDrag = () => {
          visual.current = preserveDragPosition(visual.current);
          writeStyle(node, visual.current);
        };
        const ux = liveDragValues.x ? x.subscribe(writeDrag) : () => {
        };
        const uy = liveDragValues.y ? y.subscribe(writeDrag) : () => {
        };
        const currentBounds = () => {
          const value = dragBoundsRef.current;
          return typeof value === "function" ? value() : value;
        };
        const binding = bindDrag(axis === "x" ? x : axis === "y" ? y : { x, y }, node, {
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
    return React2.createElement(as || tag, { ...props, style, ref: (node) => {
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
  useEffect2(() => {
    if (!ref.current) return;
    const arena = new GestureArena(ref.current, recognizers);
    return () => arena.dispose();
  }, [ref, key]);
}
function useDrag(ref, target, options = {}) {
  const controls = useRef2(null);
  const key = stableKey(options);
  useEffect2(() => {
    if (!ref.current) return;
    controls.current = bindDrag(target, ref.current, options);
    return () => {
      controls.current?.dispose();
      controls.current = null;
    };
  }, [ref, target, key]);
  return controls;
}
function usePinch(ref, options) {
  const key = stableKey(options);
  useEffect2(() => {
    if (!ref.current) return;
    const binding = transformGesture(ref.current, options);
    return binding.dispose;
  }, [ref, key]);
}
function useScrub(ref, transport, options = {}) {
  const inherited = useContext3(TransportContext);
  const active = transport ?? inherited;
  const key = stableKey(options);
  useEffect2(() => {
    if (!ref.current || !active) return;
    const binding = bindScrub(active, ref.current, options);
    return binding.dispose;
  }, [ref, active, key]);
}
function useDragControls() {
  const active = useRef2(null);
  return useMemo3(() => ({ start: (event) => active.current?.start(event), cancel: () => active.current?.cancel(), _bind: (control) => {
    active.current = control;
  }, _unbind: (control) => {
    if (active.current === control) active.current = null;
  } }), []);
}
function useVelocity(value) {
  const output = useMotionValue(value.velocity);
  useEffect2(() => value.subscribe(() => output.set(value.velocity)), [value, output]);
  return output;
}
function useIsPressed(ref) {
  const state = useMotionValue(false);
  useEffect2(() => {
    if (!ref.current) return;
    const binding = bindPress(ref.current, { onChange: (value) => state.set(value) });
    return binding.dispose;
  }, [ref, state]);
  return useMotionValueState(state);
}
function useIsHovered(ref) {
  const state = useMotionValue(false);
  useEffect2(() => {
    if (!ref.current) return;
    const binding = bindHover(ref.current, { onChange: (value) => state.set(value) });
    return binding.dispose;
  }, [ref, state]);
  return useMotionValueState(state);
}
function Reveal({ from = { y: 28, opacity: 0 }, to = { y: 0, opacity: 1 }, once = true, amount = "some", margin = "0px 0px -8% 0px", ...props }) {
  return /* @__PURE__ */ jsx3(motion.div, { ...props, initial: from, whileInView: to, viewport: { once, amount, margin } });
}
var SequenceContext = createContext3(null);
var TransportContext = createContext3(null);
function requireSequence(componentName) {
  const value = useContext3(SequenceContext);
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
  const ownsInstance = useRef2(false);
  const loopRef = useRef2(props.loop);
  loopRef.current = props.loop;
  const instanceRef = useRef2(null);
  if (!instanceRef.current) {
    if (props.transport) {
      instanceRef.current = props.transport;
      ownsInstance.current = false;
    } else {
      instanceRef.current = new CoreTransport({ frameRate: props.frameRate, snap: props.snap, rate: props.rate, loop: props.loop, clock: props.clock, scheduler: props.scheduler });
      ownsInstance.current = true;
    }
  }
  const transport = instanceRef.current;
  useEffect2(() => () => {
    if (ownsInstance.current) transport.dispose();
  }, [transport]);
  useEffect2(() => {
    const detachers = (props.outputs ?? []).map((output) => transport.attach(output));
    return () => {
      detachers.forEach((detach) => detach());
    };
  }, [transport, stableKey(props.outputs?.map((o) => o.name))]);
  const onStateChangeRef = useRef2(props.onStateChange);
  onStateChangeRef.current = props.onStateChange;
  useEffect2(() => transport.attach({ onStateChange: (state) => onStateChangeRef.current?.(state) }), [transport]);
  const onFinishRef = useRef2(props.onFinish);
  onFinishRef.current = props.onFinish;
  useEffect2(() => {
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
  useEffect2(() => {
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
  const sequenceValue = useMemo3(
    () => createSequenceValue(transport.root, () => {
      if (ownsInstance.current) transport.setLoop(loopRef.current);
      transport.seek(transport.time, { cues: "skip" });
    }),
    [transport]
  );
  return /* @__PURE__ */ jsx3(TransportContext.Provider, { value: transport, children: /* @__PURE__ */ jsx3(SequenceContext.Provider, { value: sequenceValue, children: props.children }) });
}
function useTransport() {
  const transport = useContext3(TransportContext);
  if (!transport) throw new Error("useTransport() must be called inside <Transport>.");
  return transport;
}
function useTransportState() {
  const transport = useTransport();
  const snapshotRef = useRef2({ state: transport.state, rate: transport.rate, duration: transport.duration, frameRate: transport.frameRate });
  const getSnapshot = () => {
    const prev = snapshotRef.current;
    if (prev.state !== transport.state || prev.rate !== transport.rate || prev.duration !== transport.duration || prev.frameRate !== transport.frameRate) {
      snapshotRef.current = { state: transport.state, rate: transport.rate, duration: transport.duration, frameRate: transport.frameRate };
    }
    return snapshotRef.current;
  };
  return useSyncExternalStore2(
    (listener) => transport.attach({ onStateChange: () => listener(), onRateChange: () => listener() }),
    getSnapshot,
    getSnapshot
  );
}
function usePlayhead(options = {}) {
  const transport = useTransport();
  const fps = Math.max(1, options.fps ?? 30);
  const [snapshot, setSnapshot] = useState(() => ({ time: transport.time, frame: transport.frame, timecode: transport.timecode, progress: transport.progress }));
  useEffect2(() => {
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
  useEffect2(() => transport.subscribe((info) => motionValue.set(info.time)), [transport, motionValue]);
  return motionValue;
}
function useCue(at, handler, deps = []) {
  const parent = requireSequence("Cue");
  const id = useId();
  const handlerRef = useRef2(handler);
  handlerRef.current = handler;
  const stableHandler = useRef2((e) => handlerRef.current(e)).current;
  useLayoutEffect2(() => {
    parent.registerCue(id, { name: id, at, handler: stableHandler });
    return () => parent.unregisterCue(id);
  }, [parent, id, stableKey(at), ...deps]);
}
function Track({ target, keyframes, at, ...options }) {
  const parent = requireSequence("Track");
  const id = useId();
  const key = `${stableKey(keyframes)}:${stableKey(options)}`;
  const built = useRef2(null);
  if (!built.current || built.current.key !== key) {
    const item = target instanceof MotionValue ? new CoreTrack({ ...options, keyframes, target }) : new CoreTrack({ ...options, keyframes, apply: target });
    built.current = { item, key };
  }
  useLayoutEffect2(() => {
    parent.register(id, built.current.item, at);
    return () => parent.unregister(id);
  }, [parent, id, stableKey(at), key]);
  return null;
}
function Tween({ target, from, to, at, ...options }) {
  const parent = requireSequence("Tween");
  const id = useId();
  const key = `${stableKey(from)}:${stableKey(to)}:${stableKey(options)}`;
  const built = useRef2(null);
  if (!built.current || built.current.key !== key) {
    const write = target instanceof MotionValue ? (value) => target.set(value) : target;
    built.current = { item: new CoreTween({ ...options, from, to, onUpdate: (value) => write(value) }), key };
  }
  useLayoutEffect2(() => {
    parent.register(id, built.current.item, at);
    return () => parent.unregister(id);
  }, [parent, id, stableKey(at), key]);
  return null;
}
function Marker({ name, at, color, payload }) {
  const parent = requireSequence("Marker");
  const id = useId();
  useLayoutEffect2(() => {
    parent.registerMarker(id, { name, at, options: { color, payload } });
    return () => parent.unregisterMarker(id);
  }, [parent, id, name, stableKey(at), color, stableKey(payload)]);
  return null;
}
function Cue({ name, at, onFire, payload, once }) {
  const parent = requireSequence("Cue");
  const id = useId();
  const handlerRef = useRef2(onFire);
  handlerRef.current = onFire;
  const stableHandler = useRef2((e) => handlerRef.current(e)).current;
  useLayoutEffect2(() => {
    parent.registerCue(id, { name, at, handler: stableHandler, options: { payload, once } });
    return () => parent.unregisterCue(id);
  }, [parent, id, name, stableKey(at), stableKey(payload), once]);
  return null;
}
function Region({ name, from, to, onEnter, onExit, payload, once }) {
  const parent = requireSequence("Region");
  const id = useId();
  const enterRef = useRef2(onEnter);
  enterRef.current = onEnter;
  const exitRef = useRef2(onExit);
  exitRef.current = onExit;
  const stableEnter = useRef2((e) => enterRef.current?.(e)).current;
  const stableExit = useRef2((e) => exitRef.current?.(e)).current;
  useLayoutEffect2(() => {
    parent.registerRegion(id, { name, from, to, options: { payload, once, onEnter: stableEnter, onExit: stableExit } });
    return () => parent.unregisterRegion(id);
  }, [parent, id, name, stableKey(from), stableKey(to), stableKey(payload), once]);
  return null;
}
function Sequence({ name, at, repeat, repeatDelay, yoyo, frameRate, snap, onComplete, children }) {
  const parent = requireSequence("Sequence");
  const id = useId();
  const timelineRef = useRef2(null);
  if (!timelineRef.current) timelineRef.current = new Timeline({ name, repeat, repeatDelay, yoyo, frameRate, snap, onComplete });
  const timeline = timelineRef.current;
  const valueRef = useRef2(null);
  if (!valueRef.current) valueRef.current = createSequenceValue(timeline, () => parent.invalidate());
  useLayoutEffect2(() => {
    parent.register(id, timeline, at);
    return () => parent.unregister(id);
  }, [parent, id, stableKey(at)]);
  return /* @__PURE__ */ jsx3(SequenceContext.Provider, { value: valueRef.current, children });
}
function useSceneState(targets) {
  const [state, setState] = useState(() => captureScene(targets));
  const targetsRef = useRef2(targets);
  targetsRef.current = targets;
  const set = (next, transition) => {
    applyScene(next, targetsRef.current, transition ? { transition } : void 0);
    setState((prev) => ({ ...prev, ...next }));
  };
  return [state, set];
}
export {
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
};
//# sourceMappingURL=react.js.map