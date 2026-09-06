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

// src/gesture/index.ts
var gesture_exports = {};
__export(gesture_exports, {
  GestureArena: () => GestureArena,
  VelocityEstimator: () => VelocityEstimator,
  cooperateWithScroll: () => cooperateWithScroll,
  createGestureArena: () => createGestureArena,
  createPointerSession: () => createPointerSession,
  drag: () => drag,
  gestureToTrack: () => gestureToTrack,
  hover: () => hover,
  hoverRecognizer: () => hoverRecognizer,
  installDragKeyboard: () => installDragKeyboard,
  longPressRecognizer: () => longPressRecognizer,
  panRecognizer: () => panRecognizer,
  pinchRecognizer: () => pinchRecognizer,
  press: () => press,
  pressRecognizer: () => pressRecognizer,
  record: () => record,
  replay: () => replay,
  rotateRecognizer: () => rotateRecognizer,
  scrub: () => scrub,
  swipeRecognizer: () => swipeRecognizer,
  tapRecognizer: () => tapRecognizer,
  transformGesture: () => transformGesture,
  wheelRecognizer: () => wheelRecognizer
});
module.exports = __toCommonJS(gesture_exports);

// src/gesture/pointer.ts
function normalize(event, predicted = false) {
  const type = event.pointerType === "touch" || event.pointerType === "pen" ? event.pointerType : "mouse";
  return { id: event.pointerId, type, x: event.clientX, y: event.clientY, t: event.timeStamp, pressure: event.pressure ?? 0, buttons: event.buttons, isPrimary: event.isPrimary, predicted, native: event };
}
function createPointerSession(options) {
  const element = options.element;
  const pointers = /* @__PURE__ */ new Map();
  const capture = options.capture ?? true;
  const coalesce = options.coalesce ?? true;
  const predict = options.predict ?? true;
  const styled = element;
  const previousTouchAction = styled.style?.touchAction;
  const previousSelect = styled.style?.webkitUserSelect;
  if (styled.style && options.touchAction !== "inherit") styled.style.touchAction = options.touchAction ?? "none";
  let listenerTarget = null;
  let scrollPrevented = false;
  let disposed = false;
  const listenerOptions = { passive: options.passive ?? true };
  const touchBlocker = (event) => event.preventDefault();
  const preventScroll = (active) => {
    if (active === scrollPrevented) return;
    scrollPrevented = active;
    if (active) {
      document.addEventListener("touchmove", touchBlocker, { passive: false });
      if (styled.style) styled.style.webkitUserSelect = "none";
    } else {
      document.removeEventListener("touchmove", touchBlocker);
      if (styled.style) styled.style.webkitUserSelect = previousSelect ?? "";
    }
  };
  const push = (event, predicted = false) => {
    const sample = normalize(event, predicted);
    if (!predicted) {
      const history = pointers.get(sample.id) ?? [];
      history.push(sample);
      if (history.length > 32) history.splice(0, history.length - 32);
      pointers.set(sample.id, history);
    }
    options.onSample(sample, pointers);
    return sample;
  };
  const attach = (external = false) => {
    if (listenerTarget) return;
    listenerTarget = external || !capture ? document : element;
    listenerTarget.addEventListener("pointermove", onMove, listenerOptions);
    listenerTarget.addEventListener("pointerup", onUp, listenerOptions);
    listenerTarget.addEventListener("pointercancel", onCancel, listenerOptions);
    element.addEventListener("lostpointercapture", onLost, listenerOptions);
    globalThis.addEventListener?.("blur", onBlur);
    document.addEventListener?.("visibilitychange", onVisibility);
  };
  const detach = () => {
    if (!listenerTarget) return;
    listenerTarget.removeEventListener("pointermove", onMove, listenerOptions);
    listenerTarget.removeEventListener("pointerup", onUp, listenerOptions);
    listenerTarget.removeEventListener("pointercancel", onCancel, listenerOptions);
    element.removeEventListener("lostpointercapture", onLost, listenerOptions);
    globalThis.removeEventListener?.("blur", onBlur);
    document.removeEventListener?.("visibilitychange", onVisibility);
    listenerTarget = null;
  };
  const finish = (event, cancelled) => {
    if (!pointers.has(event.pointerId)) return;
    const sample = push(event);
    options.onEnd(sample, cancelled);
    pointers.delete(event.pointerId);
    if (capture && element.hasPointerCapture?.(event.pointerId)) {
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {
      }
    }
    if (!pointers.size) {
      detach();
      preventScroll(false);
    }
  };
  function begin(event, external = false) {
    if (disposed || pointers.has(event.pointerId) || !options.secondaryButtons && event.pointerType === "mouse" && event.button !== 0) return;
    attach(external);
    push(event);
    if (capture) {
      try {
        element.setPointerCapture?.(event.pointerId);
      } catch {
      }
    }
  }
  function onDown(event) {
    begin(event);
  }
  function onMove(event) {
    if (!pointers.has(event.pointerId)) return;
    const actual = coalesce && event.getCoalescedEvents ? event.getCoalescedEvents() : [];
    if (actual.length) actual.forEach((sample) => push(sample));
    else push(event);
    if (predict && event.getPredictedEvents) event.getPredictedEvents().forEach((sample) => push(sample, true));
  }
  function onUp(event) {
    finish(event, false);
  }
  function onCancel(event) {
    finish(event, true);
  }
  function onLost(event) {
    finish(event, true);
  }
  function cancelAll() {
    for (const [id, history] of [...pointers]) {
      const last = history.at(-1);
      options.onEnd(last, true);
      pointers.delete(id);
    }
    detach();
    preventScroll(false);
  }
  function onBlur() {
    cancelAll();
  }
  function onVisibility() {
    if (document.visibilityState === "hidden") cancelAll();
  }
  if (options.listen !== false) element.addEventListener("pointerdown", onDown, listenerOptions);
  return {
    pointers,
    preventScroll,
    start(event) {
      begin(event, true);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAll();
      if (options.listen !== false) element.removeEventListener("pointerdown", onDown, listenerOptions);
      if (styled.style && options.touchAction !== "inherit") styled.style.touchAction = previousTouchAction ?? "";
      if (styled.style) styled.style.webkitUserSelect = previousSelect ?? "";
    }
  };
}

// src/gesture/velocity.ts
var VelocityEstimator = class {
  window;
  maxSamples;
  axes;
  samples = [];
  constructor(options = {}) {
    this.window = options.window ?? 100;
    this.maxSamples = options.maxSamples ?? 20;
    this.axes = options.axes ?? 2;
  }
  push(x, y, t) {
    if (!Number.isFinite(t)) return;
    const last = this.samples.at(-1);
    if (last && t < last.t) return;
    this.samples.push({ x, y: this.axes === 1 ? 0 : y, t });
    if (this.samples.length > this.maxSamples) this.samples.splice(0, this.samples.length - this.maxSamples);
    this.trim(t);
    return this;
  }
  velocity(now = this.samples.at(-1)?.t ?? 0) {
    const latest = this.samples.at(-1);
    if (!latest || now - latest.t > 60) return { x: 0, y: 0 };
    const previous = this.samples.at(-2);
    if (!previous || latest.t - previous.t > 60) return { x: 0, y: 0 };
    this.trim(now);
    if (this.samples.length < 2) return { x: 0, y: 0 };
    let weightSum = 0;
    let timeMean = 0;
    let xMean = 0;
    let yMean = 0;
    for (const sample of this.samples) {
      const weight = Math.exp(-(now - sample.t) / 40);
      weightSum += weight;
      timeMean += sample.t * weight;
      xMean += sample.x * weight;
      yMean += sample.y * weight;
    }
    timeMean /= weightSum;
    xMean /= weightSum;
    yMean /= weightSum;
    let denominator = 0;
    let xNumerator = 0;
    let yNumerator = 0;
    for (const sample of this.samples) {
      const weight = Math.exp(-(now - sample.t) / 40);
      const dt = sample.t - timeMean;
      denominator += weight * dt * dt;
      xNumerator += weight * dt * (sample.x - xMean);
      yNumerator += weight * dt * (sample.y - yMean);
    }
    if (denominator < 1e-9) return { x: 0, y: 0 };
    return { x: xNumerator / denominator, y: this.axes === 1 ? 0 : yNumerator / denominator };
  }
  reset() {
    this.samples.length = 0;
  }
  trim(now) {
    while (this.samples.length && now - this.samples[0].t > this.window) this.samples.shift();
  }
};

// src/gesture/recognizers.ts
var BaseRecognizer = class {
  priority;
  preventsScroll;
  propagate;
  state = "possible";
  listeners = /* @__PURE__ */ new Set();
  origin = { x: 0, y: 0 };
  last = { x: 0, y: 0 };
  estimator = new VelocityEstimator();
  pointerType = "mouse";
  native = new Event("gesture");
  constructor(options = {}) {
    this.priority = options.priority ?? 0;
    this.preventsScroll = options.preventsScroll ?? false;
    this.propagate = options.propagate ?? false;
  }
  onDown(sample, _session) {
    this.state = "possible";
    this.origin = this.last = { x: sample.x, y: sample.y };
    this.pointerType = sample.type;
    this.native = sample.native ?? this.native;
    this.estimator.reset();
    this.estimator.push(sample.x, sample.y, sample.t);
  }
  onUp(_sample, _session) {
  }
  cancel() {
    if (this.state === "began" || this.state === "changed") this.emit(this.last, this.last, 0, "cancelled", 1);
    this.state = "cancelled";
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  track(sample) {
    const previous = this.last;
    this.last = { x: sample.x, y: sample.y };
    this.native = sample.native ?? this.native;
    if (!sample.predicted) this.estimator.push(sample.x, sample.y, sample.t);
    return previous;
  }
  emit(point, previous, time, phase, pointers, extra = {}) {
    this.state = phase;
    const velocity = this.estimator.velocity(time);
    const native = this.native;
    const event = { kind: this.kind, phase, time, pointerType: this.pointerType, origin: this.origin, point, delta: { x: point.x - previous.x, y: point.y - previous.y }, offset: { x: point.x - this.origin.x, y: point.y - this.origin.y }, velocity, pointers, native, preventDefault: () => native.preventDefault(), ...extra };
    for (const listener of this.listeners) listener(event);
  }
};
var TapRecognizer = class extends BaseRecognizer {
  constructor(options = {}) {
    super({ priority: options.priority ?? 20, ...options });
    this.options = options;
  }
  kind = "tap";
  started = 0;
  valid = true;
  taps = 0;
  lastTap = -Infinity;
  onDown(sample, session) {
    super.onDown(sample, session);
    this.started = sample.t;
    this.valid = true;
  }
  onMove(sample) {
    this.track(sample);
    if (Math.hypot(sample.x - this.origin.x, sample.y - this.origin.y) > (this.options.threshold ?? 10)) {
      this.valid = false;
      return "yield";
    }
    return "wait";
  }
  onUp(sample) {
    this.track(sample);
    if (!this.valid || sample.t - this.started > (this.options.maxDuration ?? 250)) {
      this.state = "cancelled";
      return;
    }
    this.taps = sample.t - this.lastTap <= 300 ? this.taps + 1 : 1;
    this.lastTap = sample.t;
    if (this.taps >= (this.options.count ?? 1)) {
      this.emit(this.last, this.last, sample.t, "ended", 1, { count: this.taps });
      this.taps = 0;
    }
  }
};
var LongPressRecognizer = class extends BaseRecognizer {
  constructor(options = {}) {
    super({ priority: options.priority ?? 15, ...options });
    this.options = options;
  }
  kind = "longPress";
  timer;
  sample;
  onDown(sample, session) {
    super.onDown(sample, session);
    this.sample = sample;
    this.timer = setTimeout(() => {
      if (this.state === "possible" && this.sample) this.emit(this.last, this.last, this.sample.t + (this.options.duration ?? 400), "began", 1);
    }, this.options.duration ?? 400);
  }
  onMove(sample) {
    const previous = this.track(sample);
    if (Math.hypot(sample.x - this.origin.x, sample.y - this.origin.y) > (this.options.threshold ?? 10)) {
      this.clear();
      return "yield";
    }
    if (this.state === "began") {
      this.emit(this.last, previous, sample.t, "changed", 1);
      return "claim";
    }
    return "wait";
  }
  onUp(sample) {
    this.clear();
    if (this.state === "began" || this.state === "changed") this.emit(this.last, this.last, sample.t, "ended", 1);
    else this.state = "cancelled";
  }
  cancel() {
    this.clear();
    super.cancel();
  }
  clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = void 0;
  }
};
var PressRecognizer = class extends BaseRecognizer {
  kind = "press";
  constructor(options = {}) {
    super({ priority: -10, ...options });
  }
  onDown(sample, session) {
    super.onDown(sample, session);
    this.emit(this.origin, this.origin, sample.t, "began", 1);
  }
  onMove(sample) {
    const previous = this.track(sample);
    this.emit(this.last, previous, sample.t, "changed", 1);
    return "wait";
  }
  onUp(sample) {
    this.track(sample);
    this.emit(this.last, this.last, sample.t, "ended", 1);
  }
};
var PanRecognizer = class extends BaseRecognizer {
  constructor(options = {}) {
    super({ priority: options.priority ?? 10, preventsScroll: options.preventsScroll ?? true, ...options });
    this.options = options;
  }
  kind = "pan";
  locked;
  scrollGuard;
  onDown(sample, session) {
    super.onDown(sample, session);
    this.locked = void 0;
  }
  onMove(sample, session) {
    const previous = this.track(sample);
    const dx = sample.x - this.origin.x;
    const dy = sample.y - this.origin.y;
    const distance = Math.hypot(dx, dy);
    if (this.state === "possible") {
      const threshold = this.options.threshold ?? (sample.type === "mouse" ? 3 : 10);
      if (distance < threshold) return "wait";
      const dominant = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      const axis = this.options.axis ?? "any";
      if ((axis === "x" || axis === "y") && dominant !== axis) return "yield";
      this.locked = axis === "lock" ? dominant : axis === "any" ? void 0 : axis;
      const event = this.makeEvent(sample, previous, "began", session.pointers.size);
      if (this.scrollGuard && !this.scrollGuard(event)) return "yield";
      this.dispatch(event);
      return "claim";
    }
    this.emitConstrained(sample, previous, "changed", session.pointers.size);
    return "claim";
  }
  onUp(sample, session) {
    const previous = this.track(sample);
    if (this.state === "began" || this.state === "changed") this.emitConstrained(sample, previous, "ended", session.pointers.size);
    else this.state = "cancelled";
  }
  makeEvent(sample, previous, phase, pointers) {
    let point = this.last;
    if (this.locked === "x") point = { x: this.last.x, y: this.origin.y };
    if (this.locked === "y") point = { x: this.origin.x, y: this.last.y };
    const velocity = this.estimator.velocity(sample.t);
    if (this.locked === "x") velocity.y = 0;
    if (this.locked === "y") velocity.x = 0;
    const native = this.native;
    return { kind: this.kind, phase, time: sample.t, pointerType: this.pointerType, origin: this.origin, point, delta: { x: point.x - previous.x, y: point.y - previous.y }, offset: { x: point.x - this.origin.x, y: point.y - this.origin.y }, velocity, pointers, native, preventDefault: () => native.preventDefault() };
  }
  dispatch(event) {
    this.state = event.phase;
    for (const listener of this.listeners) listener(event);
  }
  emitConstrained(sample, previous, phase, pointers) {
    this.dispatch(this.makeEvent(sample, previous, phase, pointers));
  }
};
var SwipeRecognizer = class extends BaseRecognizer {
  constructor(options = {}) {
    super({ priority: options.priority ?? 11, ...options });
    this.options = options;
  }
  kind = "swipe";
  onMove(sample) {
    this.track(sample);
    return Math.hypot(sample.x - this.origin.x, sample.y - this.origin.y) >= (this.options.threshold ?? 10) ? "claim" : "wait";
  }
  onUp(sample) {
    this.track(sample);
    const velocity = this.estimator.velocity(sample.t);
    const distance = Math.hypot(sample.x - this.origin.x, sample.y - this.origin.y);
    if (Math.hypot(velocity.x, velocity.y) >= (this.options.minSpeed ?? 0.5) && distance >= (this.options.minDistance ?? 30)) this.emit(this.last, this.last, sample.t, "ended", 1);
    else this.state = "cancelled";
  }
};
var MultiRecognizer = class extends BaseRecognizer {
  initialSpan = 0;
  initialAngle = 0;
  lastScale = 1;
  lastRotation = 0;
  onDown(sample, session) {
    super.onDown(sample, session);
    const pair = latestPair(session.pointers);
    if (pair) {
      this.initialSpan = span(pair);
      this.initialAngle = angle(pair);
      this.origin = center(pair);
    }
  }
  pair(session) {
    return latestPair(session.pointers);
  }
};
var PinchRecognizer = class extends MultiRecognizer {
  kind = "pinch";
  constructor(options = {}) {
    super({ priority: options.priority ?? 30, preventsScroll: true, ...options });
    this.options = options;
  }
  options;
  onMove(sample, session) {
    this.track(sample);
    const pair = this.pair(session);
    if (!pair || !this.initialSpan) return "wait";
    const current = span(pair);
    const scale = current / this.initialSpan;
    if (this.state === "possible" && Math.abs(current - this.initialSpan) < (this.options.threshold ?? 5)) return "wait";
    const c = center(pair);
    this.emit(c, this.last, sample.t, this.state === "possible" ? "began" : "changed", 2, { scale, center: c });
    this.lastScale = scale;
    return "claim";
  }
  onUp(sample) {
    if (this.state === "began" || this.state === "changed") this.emit(this.last, this.last, sample.t, "ended", 1, { scale: this.lastScale });
  }
};
var RotateRecognizer = class extends MultiRecognizer {
  kind = "rotate";
  constructor(options = {}) {
    super({ priority: options.priority ?? 29, preventsScroll: true, ...options });
    this.options = options;
  }
  options;
  onMove(sample, session) {
    this.track(sample);
    const pair = this.pair(session);
    if (!pair) return "wait";
    const rotation = (angle(pair) - this.initialAngle) * 180 / Math.PI;
    if (this.state === "possible" && Math.abs(rotation) < (this.options.threshold ?? 5)) return "wait";
    const c = center(pair);
    this.emit(c, this.last, sample.t, this.state === "possible" ? "began" : "changed", 2, { rotation, center: c });
    this.lastRotation = rotation;
    return "claim";
  }
  onUp(sample) {
    if (this.state === "began" || this.state === "changed") this.emit(this.last, this.last, sample.t, "ended", 1, { rotation: this.lastRotation });
  }
};
var HoverRecognizer = class extends BaseRecognizer {
  kind = "hover";
  constructor(options = {}) {
    super(options);
  }
  onMove() {
    return "wait";
  }
  attach(element) {
    const enter = (native) => {
      if (native.pointerType === "touch") return;
      this.native = native;
      this.pointerType = native.pointerType;
      this.origin = this.last = { x: native.clientX, y: native.clientY };
      this.emit(this.last, this.last, native.timeStamp, "began", 1);
    };
    const leave = (native) => {
      if (native.pointerType === "touch") return;
      this.native = native;
      this.emit(this.last, this.last, native.timeStamp, "ended", 0);
    };
    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointerleave", leave);
    return () => {
      element.removeEventListener("pointerenter", enter);
      element.removeEventListener("pointerleave", leave);
    };
  }
};
var WheelRecognizer = class extends BaseRecognizer {
  kind = "wheel";
  timer;
  previousMagnitude = Infinity;
  active = false;
  constructor(options = {}) {
    super(options);
  }
  onMove() {
    return "wait";
  }
  attach(element) {
    const listener = (native) => {
      const factor = native.deltaMode === 1 ? 16 : native.deltaMode === 2 ? globalThis.innerHeight || 800 : 1;
      const point = { x: native.clientX, y: native.clientY };
      const magnitude = Math.hypot(native.deltaX, native.deltaY);
      const inertial = this.active && magnitude < this.previousMagnitude * 0.92;
      this.native = native;
      this.pointerType = "mouse";
      this.origin = this.active ? this.origin : point;
      this.last = point;
      this.emit(point, { x: point.x - native.deltaX * factor, y: point.y - native.deltaY * factor }, native.timeStamp, this.active ? "changed" : "began", 0, { inertial });
      this.active = true;
      this.previousMagnitude = magnitude;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.emit(this.last, this.last, native.timeStamp + 150, "ended", 0, { inertial });
        this.active = false;
        this.previousMagnitude = Infinity;
      }, 150);
    };
    element.addEventListener("wheel", listener, { passive: false });
    return () => {
      element.removeEventListener("wheel", listener);
      if (this.timer) clearTimeout(this.timer);
    };
  }
};
function latestPair(pointers) {
  const values = [...pointers.values()].map((history) => history.at(-1)).filter(Boolean);
  return values.length >= 2 ? [values[0], values[1]] : void 0;
}
function span([a, b]) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function angle([a, b]) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}
function center([a, b]) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
var tapRecognizer = (options) => new TapRecognizer(options);
var longPressRecognizer = (options) => new LongPressRecognizer(options);
var pressRecognizer = (options) => new PressRecognizer(options);
var panRecognizer = (options) => new PanRecognizer(options);
var swipeRecognizer = (options) => new SwipeRecognizer(options);
var pinchRecognizer = (options) => new PinchRecognizer(options);
var rotateRecognizer = (options) => new RotateRecognizer(options);
var hoverRecognizer = (options) => new HoverRecognizer(options);
var wheelRecognizer = (options) => new WheelRecognizer(options);

// src/gesture/arena.ts
var arenas = /* @__PURE__ */ new WeakMap();
var GestureArena = class {
  constructor(element, recognizers, options = {}) {
    this.element = element;
    this.recognizers = recognizers;
    arenas.set(element, this);
    for (const recognizer of recognizers) {
      if (recognizer.attach) this.extras.push(recognizer.attach(element));
      if (recognizer.kind === "longPress") this.extras.push(recognizer.subscribe((event) => {
        if (event.phase === "began" && !this.disposed && !this.winner) this.claim(recognizer);
      }));
    }
    this.session = createPointerSession({ element, ...options, onSample: (sample, pointers) => this.handleSample(sample, { pointers }), onEnd: (sample, cancelled) => this.handleEnd(sample, cancelled) });
  }
  session;
  winner;
  disposed = false;
  extras = [];
  settle(recognizer) {
    if (!this.recognizers.includes(recognizer)) throw new Error("GestureArena.settle: recognizer is not in this arena");
    this.claim(recognizer);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.session.dispose();
    this.extras.forEach((dispose) => dispose());
    this.cancel();
    if (arenas.get(this.element) === this) arenas.delete(this.element);
  }
  cancel(except) {
    for (const recognizer of this.recognizers) if (recognizer !== except && recognizer.state !== "cancelled" && recognizer.state !== "ended") recognizer.cancel();
    if (!except) this.winner = void 0;
  }
  handleSample(sample, session) {
    if (sample.predicted) return;
    const history = session.pointers.get(sample.id) ?? [];
    if (history.length === 1) {
      if (!this.winner) this.recognizers.forEach((recognizer) => recognizer.onDown(sample, session));
      return;
    }
    if (this.winner) {
      this.winner.onMove(sample, session);
      return;
    }
    const claims = [];
    for (const recognizer of this.recognizers) if (recognizer.state === "possible" || recognizer.state === "began" || recognizer.state === "changed") {
      const verdict = recognizer.onMove(sample, session);
      if (verdict === "claim") claims.push(recognizer);
      else if (verdict === "yield") recognizer.cancel();
    }
    if (claims.length) this.claim(claims.sort((a, b) => b.priority - a.priority)[0]);
  }
  handleEnd(sample, cancelled) {
    const context = { pointers: this.session.pointers };
    if (cancelled) {
      this.cancel();
      return;
    }
    if (this.winner) this.winner.onUp(sample, context);
    else {
      const possible = this.recognizers.filter((recognizer) => recognizer.state === "possible" || recognizer.state === "began" || recognizer.state === "changed").sort((a, b) => b.priority - a.priority);
      possible.forEach((recognizer) => recognizer.onUp(sample, context));
      const winner = possible.find((recognizer) => recognizer.state === "ended");
      if (winner) {
        this.winner = winner;
        this.cancel(winner);
      }
    }
    if (this.session.pointers.size <= 1) this.winner = void 0;
  }
  claim(recognizer) {
    this.winner = recognizer;
    this.cancel(recognizer);
    if (recognizer.preventsScroll) this.session.preventScroll(true);
    this.element.dispatchEvent(new CustomEvent("dhaakon-motion:arena", { bubbles: true, detail: { state: "claimed", kind: recognizer.kind, priority: recognizer.priority } }));
    if (!recognizer.propagate) {
      let parent = this.element.parentElement;
      while (parent) {
        arenas.get(parent)?.cancel();
        parent = parent.parentElement;
      }
    }
  }
};
function createGestureArena(element, recognizers, options) {
  return new GestureArena(element, recognizers, options);
}
function cooperateWithScroll(recognizer, scroller, options) {
  const pan = recognizer;
  pan.scrollGuard = (event) => {
    const node = scroller;
    const atTop = node.scrollTop <= 0;
    const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
    const down = event.offset.y > 0;
    const up = event.offset.y < 0;
    return (options.edge === "top" || options.edge === "both") && atTop && down || (options.edge === "bottom" || options.edge === "both") && atBottom && up;
  };
  return recognizer;
}

// src/gesture/keyboard.ts
function focusable(element) {
  return element.matches("a[href],button,input,select,textarea,[tabindex]");
}
function installDragKeyboard(element, value, options = {}) {
  const node = element;
  const min = options.min ?? -Infinity;
  const max = options.max ?? Infinity;
  const finiteRange = Number.isFinite(min) && Number.isFinite(max);
  const step = options.step ?? (finiteRange ? (max - min) * 0.01 : 10);
  const authored = /* @__PURE__ */ new Map();
  const setAttribute = (name, next) => {
    authored.set(name, element.getAttribute(name));
    element.setAttribute(name, next);
  };
  if (!focusable(element)) setAttribute("tabindex", "0");
  if (finiteRange) {
    setAttribute("role", "slider");
    setAttribute("aria-valuemin", String(min));
    setAttribute("aria-valuemax", String(max));
    setAttribute("aria-orientation", options.axis === "y" ? "vertical" : "horizontal");
  } else setAttribute("aria-roledescription", "draggable");
  if (options.label) setAttribute("aria-label", options.label);
  const updateAria = () => {
    element.setAttribute("aria-valuenow", String(Math.round(value.get() * 1e3) / 1e3));
  };
  updateAria();
  const unsubscribe = value.subscribe(updateAria);
  const write = (next) => {
    const clamped = Math.max(min, Math.min(max, next));
    value.set(clamped);
    options.onChange?.(clamped);
  };
  const onKey = (event) => {
    const multiplier = event.shiftKey ? 10 : 1;
    let next;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = value.get() + step * multiplier;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = value.get() - step * multiplier;
    if (event.key === "Home" && Number.isFinite(min)) next = min;
    if (event.key === "End" && Number.isFinite(max)) next = max;
    if (event.key === "Escape") {
      options.onCancel?.();
      event.preventDefault();
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      const grabbed = element.getAttribute("aria-grabbed") === "true";
      element.setAttribute("aria-grabbed", String(!grabbed));
      event.preventDefault();
      return;
    }
    if (next != null) {
      write(next);
      event.preventDefault();
    }
  };
  element.addEventListener("keydown", onKey);
  return () => {
    unsubscribe();
    element.removeEventListener("keydown", onKey);
    for (const [name, previous] of authored) {
      if (previous == null) element.removeAttribute(name);
      else element.setAttribute(name, previous);
    }
  };
}

// src/gesture/bind.ts
var import_motion = require("@dhaakon/motion");
function reduced() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function isMotionValue(value) {
  if (!value || typeof value !== "object") return false;
  const candidate = value;
  return typeof candidate.get === "function" && typeof candidate.set === "function" && typeof candidate.subscribe === "function" && typeof candidate.stop === "function" && typeof candidate.spring === "function" && typeof candidate.decay === "function";
}
function numericBounds(bounds, element, axis) {
  const resolved = typeof bounds === "function" ? bounds() : bounds;
  if (!resolved) return [-Infinity, Infinity];
  if (resolved instanceof Element) {
    const container = resolved.getBoundingClientRect();
    const item = element.getBoundingClientRect();
    return axis === "x" ? [container.left - item.left, container.right - item.right] : [container.top - item.top, container.bottom - item.bottom];
  }
  if ("min" in resolved || "max" in resolved) return [resolved.min ?? -Infinity, resolved.max ?? Infinity];
  return resolved[axis] ?? [-Infinity, Infinity];
}
function cueThresholds(options) {
  return (options.cues ?? []).flatMap((cue) => (Array.isArray(cue.at) ? cue.at : [cue.at]).map((at) => ({ at, name: cue.name })));
}
function drag(target, element, options = {}) {
  const scalarTarget = isMotionValue(target) ? target : void 0;
  const axesTarget = scalarTarget ? void 0 : target;
  const axis = options.axis ?? (scalarTarget ? "x" : "any");
  const pan = panRecognizer({ axis, threshold: options.threshold, propagate: options.propagate });
  const arena = new GestureArena(element, [pan], { listen: options.dragListener, capture: options.capture, touchAction: options.touchAction ?? (axis === "x" ? "pan-y" : axis === "y" ? "pan-x" : "none"), predict: options.predict });
  const isDragging = new import_motion.MotionValue(false);
  const values = scalarTarget ? { [axis === "y" ? "y" : "x"]: scalarTarget } : axesTarget;
  let start = { x: values.x?.get() ?? 0, y: values.y?.get() ?? 0 };
  let origin = start;
  let bounds = { x: [-Infinity, Infinity], y: [-Infinity, Infinity] };
  let pending = null;
  let removeFrame;
  let last = start;
  const flush = () => {
    if (!pending) return false;
    if (pending.x != null) values.x?.set(pending.x);
    if (pending.y != null) values.y?.set(pending.y);
    pending = null;
    return false;
  };
  const write = (next) => {
    pending = { ...pending, ...next };
    if (options.immediate) flush();
    else if (!removeFrame) removeFrame = import_motion.scheduler.add(() => {
      removeFrame = void 0;
      return flush();
    });
  };
  const crossCues = (previous, current) => {
    for (const cue of cueThresholds(options)) if (previous < cue.at && current >= cue.at || previous > cue.at && current <= cue.at) element.dispatchEvent(new CustomEvent("dhaakon-motion:cue", { detail: { ...cue, direction: current >= previous ? 1 : -1 } }));
  };
  const settleAxis = (key, velocity) => {
    const value = values[key];
    if (!value) return { target: 0, settled: Promise.resolve() };
    const [min, max] = bounds[key];
    const noMotion = reduced();
    const momentum = noMotion ? false : options.momentum ?? true;
    const projectedTarget = options.snap ? (0, import_motion.snapTo)(options.snap, value.get(), velocity, typeof momentum === "object" ? momentum.timeConstant : void 0) : Math.max(min, Math.min(max, value.get()));
    if (options.snap || value.get() < min || value.get() > max) {
      const target_ = Math.max(min, Math.min(max, projectedTarget));
      if (noMotion) {
        value.set(target_);
        return { target: target_, settled: Promise.resolve() };
      }
      const spring = value.spring(target_, options.snapTransition);
      return { target: target_, settled: spring.finished };
    }
    if (momentum) {
      const item = value.decay({ ...typeof momentum === "object" ? momentum : {}, velocity, min, max });
      return { target: item.target, settled: item.finished };
    }
    return { target: value.get(), settled: Promise.resolve() };
  };
  const unsubscribe = pan.subscribe((event) => {
    if (event.phase === "began") {
      values.x?.stop();
      values.y?.stop();
      start = { x: values.x?.get() ?? 0, y: values.y?.get() ?? 0 };
      origin = start;
      last = start;
      bounds = { x: numericBounds(options.bounds, element, "x"), y: numericBounds(options.bounds, element, "y") };
      isDragging.set(true);
      if (options.cursor) element.style.cursor = "grabbing";
      options.onStart?.(event);
    }
    if (event.phase === "began" || event.phase === "changed") {
      const next = {};
      if (values.x) next.x = (0, import_motion.clampWithRubberband)(start.x + event.offset.x, ...bounds.x, reduced() ? false : options.elastic ?? 0.55, Math.max(1, element.offsetWidth || 300));
      if (values.y) next.y = (0, import_motion.clampWithRubberband)(start.y + event.offset.y, ...bounds.y, reduced() ? false : options.elastic ?? 0.55, Math.max(1, element.offsetHeight || 300));
      if (next.x != null) crossCues(last.x, next.x);
      if (next.y != null) crossCues(last.y, next.y);
      last = { x: next.x ?? last.x, y: next.y ?? last.y };
      write(next);
      options.onMove?.(event);
    }
    if (event.phase === "ended" || event.phase === "cancelled") {
      flush();
      isDragging.set(false);
      if (options.cursor) element.style.cursor = "grab";
      if (event.phase === "cancelled") {
        values.x?.spring(origin.x, options.snapTransition);
        values.y?.spring(origin.y, options.snapTransition);
        return;
      }
      const key = values.y && !values.x ? "y" : "x";
      const outcome = settleAxis(key, event.velocity[key]);
      options.onEnd?.(event, outcome);
      if (values.x && values.y) settleAxis("y", event.velocity.y);
    }
  });
  if (options.cursor) element.style.cursor = "grab";
  const oneDimensional = scalarTarget ?? (axis === "y" ? axesTarget.y : axesTarget.x);
  const keyboardDispose = options.keyboard === false || !oneDimensional ? () => {
  } : installDragKeyboard(element, oneDimensional, { axis: axis === "y" ? "y" : "x", min: numericBounds(options.bounds, element, axis === "y" ? "y" : "x")[0], max: numericBounds(options.bounds, element, axis === "y" ? "y" : "x")[1], step: options.step, label: options.ariaLabel, onCancel: () => {
    oneDimensional.spring(axis === "y" ? origin.y : origin.x, options.snapTransition);
  } });
  return { isDragging, start(nativeEvent) {
    arena.session.start(nativeEvent);
  }, cancel() {
    arena.cancel();
    values.x?.spring(origin.x, options.snapTransition);
    values.y?.spring(origin.y, options.snapTransition);
  }, dispose() {
    unsubscribe();
    keyboardDispose();
    arena.dispose();
    removeFrame?.();
    if (options.cursor) element.style.cursor = "";
  } };
}
function transformGesture(element, options) {
  const scale = options.scale ?? new import_motion.MotionValue(1);
  const rotation = options.rotation ?? new import_motion.MotionValue(0);
  const x = options.x ?? new import_motion.MotionValue(0);
  const y = options.y ?? new import_motion.MotionValue(0);
  let initial;
  const session = createPointerSession({ element, touchAction: "none", onSample: (_sample, pointers) => {
    const pair = [...pointers.values()].map((history) => history.at(-1)).filter(Boolean);
    if (pair.length < 2) {
      initial = void 0;
      return;
    }
    const a = pair[0];
    const b = pair[1];
    const center2 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const span2 = Math.hypot(b.x - a.x, b.y - a.y);
    const angle2 = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    if (!initial) {
      initial = { span: span2, angle: angle2, center: center2, scale: scale.get(), rotation: rotation.get(), x: x.get(), y: y.get() };
      return;
    }
    const ratio = span2 / Math.max(1, initial.span);
    const nextScale = (0, import_motion.clampWithRubberband)(initial.scale * ratio, ...options.scaleBounds ?? [1, 4], options.elastic ?? 0.35, 2);
    scale.set(nextScale);
    rotation.set(initial.rotation + angle2 - initial.angle);
    x.set(initial.x + center2.x - initial.center.x + (1 - ratio) * (initial.center.x - element.getBoundingClientRect().left));
    y.set(initial.y + center2.y - initial.center.y + (1 - ratio) * (initial.center.y - element.getBoundingClientRect().top));
  }, onEnd: () => {
    if (session.pointers.size <= 2) initial = void 0;
  } });
  const onWheel = (event) => {
    event.preventDefault();
    const rect = element.getBoundingClientRect();
    const old = scale.get();
    const next = Math.max(options.scaleBounds?.[0] ?? 1, Math.min(options.scaleBounds?.[1] ?? 4, old * Math.exp(-event.deltaY * 2e-3)));
    const ratio = next / old;
    x.set(x.get() + (1 - ratio) * (event.clientX - rect.left));
    y.set(y.get() + (1 - ratio) * (event.clientY - rect.top));
    scale.set(next);
  };
  const onDouble = (event) => {
    if (options.doubleTapZoom === false) return;
    const target = Math.abs(scale.get() - 1) < 0.01 ? options.doubleTapZoom ?? 2 : 1;
    const rect = element.getBoundingClientRect();
    const ratio = target / scale.get();
    x.set(x.get() + (1 - ratio) * (event.clientX - rect.left));
    y.set(y.get() + (1 - ratio) * (event.clientY - rect.top));
    scale.spring(target);
  };
  element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("dblclick", onDouble);
  return { dispose() {
    session.dispose();
    element.removeEventListener("wheel", onWheel);
    element.removeEventListener("dblclick", onDouble);
  } };
}
function scrub(transport, element, options = {}) {
  let start = transport.time;
  let wasPlaying = false;
  const axis = options.axis ?? "x";
  const playhead = new import_motion.MotionValue(transport.time);
  const dragValue = new import_motion.MotionValue(0);
  const control = drag(dragValue, element, { axis, momentum: false, touchAction: axis === "x" ? "pan-y" : "pan-x", onStart: () => {
    start = transport.time;
    dragValue.set(0);
    wasPlaying = transport.state === "playing";
    transport.pause();
  }, onMove: (event) => {
    const delta = event.offset[axis];
    const ms = options.pixelsPerMs ? delta / options.pixelsPerMs : (0, import_motion.frameToMs)(delta / (options.pixelsPerFrame ?? 10), transport.frameRate);
    playhead.set(start + ms);
    transport.seek(playhead.get(), { cues: options.cues });
  }, onEnd: (event) => {
    const velocityMs = options.pixelsPerMs ? event.velocity[axis] / options.pixelsPerMs : (0, import_motion.frameToMs)(event.velocity[axis] / (options.pixelsPerFrame ?? 10), transport.frameRate);
    const momentum = reduced() ? false : options.momentum ?? true;
    const finish = () => {
      let target = playhead.get();
      if (options.snapToFrames) target = (0, import_motion.frameToMs)(Math.round(target / (0, import_motion.frameToMs)(1, transport.frameRate)), transport.frameRate);
      if (options.snapToMarkers) {
        const within = typeof options.snapToMarkers === "object" ? (0, import_motion.parseTime)(options.snapToMarkers.within, transport.frameRate) : Infinity;
        const marker = transport.root.markers.reduce((best, item) => !best || Math.abs(item.time - target) < Math.abs(best.time - target) ? item : best, void 0);
        if (marker && Math.abs(marker.time - target) <= within) target = marker.time;
      }
      transport.seek(target, { cues: options.cues });
      if (wasPlaying && options.resumeAfter) transport.play();
    };
    if (momentum) {
      const inertia = new import_motion.InertiaItem({ ...typeof momentum === "object" ? momentum : {}, from: playhead.get(), velocity: velocityMs, min: 0, max: transport.duration, onUpdate: (value) => {
        playhead.set(value);
        transport.seek(value, { cues: options.cues });
      }, autoplay: true });
      inertia.finished.then(finish);
    } else finish();
  } });
  return { dispose: control.dispose };
}
function press(element, options = {}) {
  const recognizer = pressRecognizer();
  const isPressed = new import_motion.MotionValue(false);
  const unsubscribe = recognizer.subscribe((event) => {
    const value = event.phase === "began" || event.phase === "changed";
    isPressed.set(value);
    options.onChange?.(value);
  });
  const arena = new GestureArena(element, [recognizer], { touchAction: "manipulation" });
  return { isPressed, dispose() {
    unsubscribe();
    arena.dispose();
  } };
}
function hover(element, options = {}) {
  const recognizer = hoverRecognizer();
  const isHovered = new import_motion.MotionValue(false);
  const unsubscribe = recognizer.subscribe((event) => {
    const value = event.phase === "began" || event.phase === "changed";
    isHovered.set(value);
    options.onChange?.(value);
  });
  const arena = new GestureArena(element, [recognizer], { touchAction: "inherit" });
  return { isHovered, dispose() {
    unsubscribe();
    arena.dispose();
  } };
}

// src/gesture/record.ts
var import_motion2 = require("@dhaakon/motion");
function record(element, options = {}) {
  const samples = [];
  const rect = element.getBoundingClientRect();
  let firstTime;
  const listeners = /* @__PURE__ */ new Map();
  const add = (name, kind) => {
    const listener = ((event) => {
      firstTime ??= event.timeStamp;
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      samples.push({ id: event.pointerId, type: event.pointerType || "mouse", kind, x: options.normalize ? (event.clientX - rect.left) / width : event.clientX, y: options.normalize ? (event.clientY - rect.top) / height : event.clientY, t: event.timeStamp - firstTime, ...event.pressure ? { pressure: event.pressure } : {} });
    });
    listeners.set(name, listener);
    element.addEventListener(name, listener);
  };
  add("pointerdown", "down");
  add("pointermove", "move");
  add("pointerup", "up");
  add("pointercancel", "cancel");
  return { stop() {
    for (const [name, listener] of listeners) element.removeEventListener(name, listener);
    return { $schema: "dhaakon-motion/gesture/1", ...options.frameRate ? { frameRate: options.frameRate } : {}, element: { width: rect.width, height: rect.height }, samples: samples.slice() };
  } };
}
function dispatchSample(sample, element, recording) {
  const rect = element.getBoundingClientRect();
  const normalized = recording.element && sample.x >= 0 && sample.x <= 1 && sample.y >= 0 && sample.y <= 1;
  const x = normalized ? rect.left + sample.x * rect.width : sample.x;
  const y = normalized ? rect.top + sample.y * rect.height : sample.y;
  const event = new PointerEvent(`pointer${sample.kind === "cancel" ? "cancel" : sample.kind}`, { bubbles: true, cancelable: true, pointerId: sample.id, pointerType: sample.type, clientX: x, clientY: y, pressure: sample.pressure ?? 0, button: 0, buttons: sample.kind === "up" || sample.kind === "cancel" ? 0 : 1 });
  Object.defineProperty(event, "timeStamp", { value: sample.t });
  element.dispatchEvent(event);
}
async function replay(recording, element, options = {}) {
  const speed = Math.max(1e-4, options.speed ?? 1);
  const from = options.from ?? -Infinity;
  const to = options.to ?? Infinity;
  const samples = recording.samples.filter((sample) => sample.t >= from && sample.t <= to);
  let previous = samples[0]?.t ?? 0;
  for (const sample of samples) {
    const delay = (sample.t - previous) / speed;
    if (options.driver) options.driver.advance(delay);
    else if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    dispatchSample(sample, element, recording);
    previous = sample.t;
  }
}
function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - a.x, point.y - a.y);
  const u = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (a.x + u * dx), point.y - (a.y + u * dy));
}
function rdp(points, tolerance) {
  if (points.length <= 2) return points;
  let max = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = distanceToSegment(points[i], points[0], points.at(-1));
    if (distance > max) {
      max = distance;
      index = i;
    }
  }
  if (max <= tolerance) return [points[0], points.at(-1)];
  const left = rdp(points.slice(0, index + 1), tolerance);
  const right = rdp(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}
function gestureToTrack(recording, options) {
  const pointerId = options.pointerId ?? recording.samples[0]?.id;
  const rate = (0, import_motion2.frameRate)(options.frameRate);
  const axis = options.axis ?? "x";
  const raw = recording.samples.filter((sample) => sample.id === pointerId && sample.kind !== "cancel").map(({ x, y, t }) => ({ x, y, t }));
  const simplified = rdp(raw, options.simplify ?? 0);
  const byFrame = /* @__PURE__ */ new Map();
  for (const point of simplified) byFrame.set((0, import_motion2.msToFrame)(point.t, rate), point);
  const keyframes = [...byFrame.entries()].sort(([a], [b]) => a - b).map(([frame, point]) => ({ at: (0, import_motion2.frameToMs)(frame, rate), value: axis === "both" ? { x: point.x, y: point.y } : axis === "x" ? point.x : point.y }));
  if (!keyframes.length) keyframes.push({ at: 0, value: axis === "both" ? { x: 0, y: 0 } : 0 });
  return new import_motion2.Track({ frameRate: rate, keyframes, apply: () => {
  } });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GestureArena,
  VelocityEstimator,
  cooperateWithScroll,
  createGestureArena,
  createPointerSession,
  drag,
  gestureToTrack,
  hover,
  hoverRecognizer,
  installDragKeyboard,
  longPressRecognizer,
  panRecognizer,
  pinchRecognizer,
  press,
  pressRecognizer,
  record,
  replay,
  rotateRecognizer,
  scrub,
  swipeRecognizer,
  tapRecognizer,
  transformGesture,
  wheelRecognizer
});
//# sourceMappingURL=gesture.cjs.map