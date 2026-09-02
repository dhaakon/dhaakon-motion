// src/react.tsx
import React, { createContext, forwardRef, useContext, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import { Fragment, jsx } from "react/jsx-runtime";
var MotionContext = createContext({ reducedMotion: "user" });
function MotionConfig({ children, ...value }) {
  const parent = useContext(MotionContext);
  return /* @__PURE__ */ jsx(MotionContext.Provider, { value: useMemo(() => ({ ...parent, ...value, transition: { ...parent.transition, ...value.transition } }), [parent, value.transition, value.reducedMotion, value.frameRate]), children });
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
  const config = useContext(MotionContext);
  const transition = config.transition;
  const fromKey = stableKey(from);
  const toKey = stableKey(to);
  useEffect(() => {
    motionValue.set(from);
    tween.current = motionValue.animate(to, { frameRate: config.frameRate, ...transition, ...options, duration: reduced ? 0 : options.duration ?? transition?.duration });
    return () => {
      tween.current?.cancel();
    };
  }, [motionValue, fromKey, toKey, reduced, config.frameRate, transition?.frameRate, options.frameRate, options.duration, options.delay, options.repeat, options.repeatDelay, options.yoyo, options.easing, options.ease]);
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
function createMotionComponent(tag) {
  const Component = forwardRef(function DhaakonMotionElement(rawProps, forwardedRef) {
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
    const localRef = useRef(null);
    const config = useContext(MotionContext);
    const reduced = useReducedMotion();
    const [inViewRef, inView] = useInView({ ...viewport, disabled: !whileInView });
    const hasAnimated = useRef(false);
    const visual = useRef({});
    const interactionTween = useRef(null);
    useImperativeHandle(forwardedRef, () => localRef.current);
    const initialKey = stableKey(initial);
    const targetKey = stableKey(target);
    const viewKey = stableKey(whileInView);
    useLayoutEffect(() => {
      if (localRef.current && initial) {
        visual.current = { ...initial };
        writeStyle(localRef.current, initial);
      }
    }, [initialKey]);
    useEffect(() => {
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
    const boundsKey = stableKey(dragBounds);
    const snapKey = stableKey(dragSnap);
    useEffect(() => {
      const node = localRef.current;
      if (!node) return;
      const base = () => whileInView && inView ? whileInView : target ?? (initial || {});
      const animateInteraction = (state) => {
        const next = { ...base(), ...state ?? {} };
        interactionTween.current?.cancel();
        if (reduced) {
          visual.current = { ...visual.current, ...next };
          writeStyle(node, visual.current);
          return;
        }
        interactionTween.current = new CoreTween({ ...config.transition, ...transition, from: { ...visual.current }, to: next, onUpdate: (value) => {
          visual.current = value;
          writeStyle(node, value);
        } }).play();
      };
      const disposers = [];
      if (whileHover) {
        const binding = bindHover(node, { onChange: (active) => animateInteraction(active ? whileHover : void 0) });
        disposers.push(binding.dispose);
      }
      if (whileTap) {
        const binding = bindPress(node, { onChange: (active) => animateInteraction(active ? whileTap : void 0) });
        disposers.push(binding.dispose);
      }
      if (whileFocus) {
        const focus = () => animateInteraction(whileFocus);
        const blur = () => animateInteraction();
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
          recognizer.subscribe(onTap);
          recognizers.push(recognizer);
        }
        if (onLongPress) {
          const recognizer = longPressRecognizer();
          recognizer.subscribe(onLongPress);
          recognizers.push(recognizer);
        }
        if (onPanStart || onPan || onPanEnd) {
          const recognizer = panRecognizer({ axis: dragAxis });
          recognizer.subscribe((event) => {
            if (event.phase === "began") onPanStart?.(event);
            else if (event.phase === "changed") onPan?.(event);
            else if (event.phase === "ended") onPanEnd?.(event);
          });
          recognizers.push(recognizer);
        }
        if (onPinch) {
          const recognizer = pinchRecognizer();
          recognizer.subscribe(onPinch);
          recognizers.push(recognizer);
        }
        const arena = new GestureArena(node, recognizers);
        disposers.push(() => arena.dispose());
      }
      if (drag) {
        const x = new MotionValue(Number(visual.current.x ?? 0));
        const y = new MotionValue(Number(visual.current.y ?? 0));
        const writeDrag = () => {
          visual.current = { ...visual.current, x: x.get(), y: y.get() };
          writeStyle(node, visual.current);
        };
        const ux = x.subscribe(writeDrag);
        const uy = y.subscribe(writeDrag);
        const axis = dragAxis ?? (drag === true ? "any" : drag);
        const binding = bindDrag(axis === "x" ? x : axis === "y" ? y : { x, y }, node, {
          axis,
          bounds: dragBounds,
          elastic: dragElastic,
          momentum: dragMomentum,
          snap: dragSnap,
          propagate: dragPropagation,
          onStart: (event) => {
            animateInteraction(whileDrag);
            onDragStart?.(event);
          },
          onMove: (event) => onDrag?.(event),
          onEnd: (event) => {
            animateInteraction();
            onDragEnd?.(event);
          }
        });
        dragControls?._bind(binding);
        disposers.push(() => {
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
    }, [hoverKey, tapKey, dragKey, focusKey, boundsKey, snapKey, Boolean(drag), dragAxis, dragElastic, dragMomentum, dragPropagation, reduced]);
    return React.createElement(as || tag, { ...props, style, ref: (node) => {
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
  useEffect(() => {
    if (!ref.current) return;
    const arena = new GestureArena(ref.current, recognizers);
    return () => arena.dispose();
  }, [ref, key]);
}
function useDrag(ref, target, options = {}) {
  const controls = useRef(null);
  const key = stableKey(options);
  useEffect(() => {
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
  useEffect(() => {
    if (!ref.current) return;
    const binding = transformGesture(ref.current, options);
    return binding.dispose;
  }, [ref, key]);
}
function useScrub(ref, transport, options = {}) {
  const inherited = useContext(TransportContext);
  const active = transport ?? inherited;
  const key = stableKey(options);
  useEffect(() => {
    if (!ref.current || !active) return;
    const binding = bindScrub(active, ref.current, options);
    return binding.dispose;
  }, [ref, active, key]);
}
function useDragControls() {
  const active = useRef(null);
  return useMemo(() => ({ start: (event) => active.current?.start(event), cancel: () => active.current?.cancel(), _bind: (control) => {
    active.current = control;
  }, _unbind: (control) => {
    if (active.current === control) active.current = null;
  } }), []);
}
function useVelocity(value) {
  const output = useMotionValue(value.velocity);
  useEffect(() => value.subscribe(() => output.set(value.velocity)), [value, output]);
  return output;
}
function useIsPressed(ref) {
  const state = useMotionValue(false);
  useEffect(() => {
    if (!ref.current) return;
    const binding = bindPress(ref.current, { onChange: (value) => state.set(value) });
    return binding.dispose;
  }, [ref, state]);
  return useMotionValueState(state);
}
function useIsHovered(ref) {
  const state = useMotionValue(false);
  useEffect(() => {
    if (!ref.current) return;
    const binding = bindHover(ref.current, { onChange: (value) => state.set(value) });
    return binding.dispose;
  }, [ref, state]);
  return useMotionValueState(state);
}
function Reveal({ from = { y: 28, opacity: 0 }, to = { y: 0, opacity: 1 }, once = true, amount = "some", margin = "0px 0px -8% 0px", ...props }) {
  return /* @__PURE__ */ jsx(motion.div, { ...props, initial: from, whileInView: to, viewport: { once, amount, margin } });
}
var SequenceContext = createContext(null);
var TransportContext = createContext(null);
function requireSequence(componentName) {
  const value = useContext(SequenceContext);
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
  const ownsInstance = useRef(false);
  const instanceRef = useRef(null);
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
  useEffect(() => () => {
    if (ownsInstance.current) transport.dispose();
  }, [transport]);
  useEffect(() => {
    const detachers = (props.outputs ?? []).map((output) => transport.attach(output));
    return () => {
      detachers.forEach((detach) => detach());
    };
  }, [transport, stableKey(props.outputs?.map((o) => o.name))]);
  const onStateChangeRef = useRef(props.onStateChange);
  onStateChangeRef.current = props.onStateChange;
  useEffect(() => transport.attach({ onStateChange: (state) => onStateChangeRef.current?.(state) }), [transport]);
  const onFinishRef = useRef(props.onFinish);
  onFinishRef.current = props.onFinish;
  useEffect(() => {
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
  useEffect(() => {
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
  const sequenceValue = useMemo(
    () => createSequenceValue(transport.root, () => transport.seek(transport.time, { cues: "skip" })),
    [transport]
  );
  return /* @__PURE__ */ jsx(TransportContext.Provider, { value: transport, children: /* @__PURE__ */ jsx(SequenceContext.Provider, { value: sequenceValue, children: props.children }) });
}
function useTransport() {
  const transport = useContext(TransportContext);
  if (!transport) throw new Error("useTransport() must be called inside <Transport>.");
  return transport;
}
function useTransportState() {
  const transport = useTransport();
  const snapshotRef = useRef({ state: transport.state, rate: transport.rate, duration: transport.duration, frameRate: transport.frameRate });
  const getSnapshot = () => {
    const prev = snapshotRef.current;
    if (prev.state !== transport.state || prev.rate !== transport.rate || prev.duration !== transport.duration || prev.frameRate !== transport.frameRate) {
      snapshotRef.current = { state: transport.state, rate: transport.rate, duration: transport.duration, frameRate: transport.frameRate };
    }
    return snapshotRef.current;
  };
  return useSyncExternalStore(
    (listener) => transport.attach({ onStateChange: () => listener(), onRateChange: () => listener() }),
    getSnapshot,
    getSnapshot
  );
}
function usePlayhead(options = {}) {
  const transport = useTransport();
  const fps = Math.max(1, options.fps ?? 30);
  const [snapshot, setSnapshot] = useState(() => ({ time: transport.time, frame: transport.frame, timecode: transport.timecode, progress: transport.progress }));
  useEffect(() => {
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
  useEffect(() => transport.subscribe((info) => motionValue.set(info.time)), [transport, motionValue]);
  return motionValue;
}
function useCue(at, handler, deps = []) {
  const parent = requireSequence("Cue");
  const id = useId();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const stableHandler = useRef((e) => handlerRef.current(e)).current;
  useLayoutEffect(() => {
    parent.registerCue(id, { name: id, at, handler: stableHandler });
    return () => parent.unregisterCue(id);
  }, [parent, id, stableKey(at), ...deps]);
}
function Track({ target, keyframes, at, ...options }) {
  const parent = requireSequence("Track");
  const id = useId();
  const key = `${stableKey(keyframes)}:${stableKey(options)}`;
  const built = useRef(null);
  if (!built.current || built.current.key !== key) {
    const item = target instanceof MotionValue ? new CoreTrack({ ...options, keyframes, target }) : new CoreTrack({ ...options, keyframes, apply: target });
    built.current = { item, key };
  }
  useLayoutEffect(() => {
    parent.register(id, built.current.item, at);
    return () => parent.unregister(id);
  }, [parent, id, stableKey(at), key]);
  return null;
}
function Tween({ target, from, to, at, ...options }) {
  const parent = requireSequence("Tween");
  const id = useId();
  const key = `${stableKey(from)}:${stableKey(to)}:${stableKey(options)}`;
  const built = useRef(null);
  if (!built.current || built.current.key !== key) {
    const write = target instanceof MotionValue ? (value) => target.set(value) : target;
    built.current = { item: new CoreTween({ ...options, from, to, onUpdate: (value) => write(value) }), key };
  }
  useLayoutEffect(() => {
    parent.register(id, built.current.item, at);
    return () => parent.unregister(id);
  }, [parent, id, stableKey(at), key]);
  return null;
}
function Marker({ name, at, color, payload }) {
  const parent = requireSequence("Marker");
  const id = useId();
  useLayoutEffect(() => {
    parent.registerMarker(id, { name, at, options: { color, payload } });
    return () => parent.unregisterMarker(id);
  }, [parent, id, name, stableKey(at), color, stableKey(payload)]);
  return null;
}
function Cue({ name, at, onFire, payload, once }) {
  const parent = requireSequence("Cue");
  const id = useId();
  const handlerRef = useRef(onFire);
  handlerRef.current = onFire;
  const stableHandler = useRef((e) => handlerRef.current(e)).current;
  useLayoutEffect(() => {
    parent.registerCue(id, { name, at, handler: stableHandler, options: { payload, once } });
    return () => parent.unregisterCue(id);
  }, [parent, id, name, stableKey(at), stableKey(payload), once]);
  return null;
}
function Region({ name, from, to, onEnter, onExit, payload, once }) {
  const parent = requireSequence("Region");
  const id = useId();
  const enterRef = useRef(onEnter);
  enterRef.current = onEnter;
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const stableEnter = useRef((e) => enterRef.current?.(e)).current;
  const stableExit = useRef((e) => exitRef.current?.(e)).current;
  useLayoutEffect(() => {
    parent.registerRegion(id, { name, from, to, options: { payload, once, onEnter: stableEnter, onExit: stableExit } });
    return () => parent.unregisterRegion(id);
  }, [parent, id, name, stableKey(from), stableKey(to), stableKey(payload), once]);
  return null;
}
function Sequence({ name, at, repeat, repeatDelay, yoyo, frameRate, snap, onComplete, children }) {
  const parent = requireSequence("Sequence");
  const id = useId();
  const timelineRef = useRef(null);
  if (!timelineRef.current) timelineRef.current = new Timeline({ name, repeat, repeatDelay, yoyo, frameRate, snap, onComplete });
  const timeline = timelineRef.current;
  const valueRef = useRef(null);
  if (!valueRef.current) valueRef.current = createSequenceValue(timeline, () => parent.invalidate());
  useLayoutEffect(() => {
    parent.register(id, timeline, at);
    return () => parent.unregister(id);
  }, [parent, id, stableKey(at)]);
  return /* @__PURE__ */ jsx(SequenceContext.Provider, { value: valueRef.current, children });
}
function useSceneState(targets) {
  const [state, setState] = useState(() => captureScene(targets));
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const set = (next, transition) => {
    applyScene(next, targetsRef.current, transition ? { transition } : void 0);
    setState((prev) => ({ ...prev, ...next }));
  };
  return [state, set];
}
export {
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
  createMotionComponent,
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