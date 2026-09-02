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
  const attach = () => {
    if (listenerTarget) return;
    listenerTarget = capture ? element : document;
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
  function onDown(event) {
    if (disposed || !options.secondaryButtons && event.pointerType === "mouse" && event.button !== 0) return;
    attach();
    push(event);
    if (capture) {
      try {
        element.setPointerCapture?.(event.pointerId);
      } catch {
      }
    }
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
  element.addEventListener("pointerdown", onDown, listenerOptions);
  return {
    pointers,
    preventScroll,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAll();
      element.removeEventListener("pointerdown", onDown, listenerOptions);
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
  velocity(now2 = this.samples.at(-1)?.t ?? 0) {
    const latest = this.samples.at(-1);
    if (!latest || now2 - latest.t > 60) return { x: 0, y: 0 };
    const previous = this.samples.at(-2);
    if (!previous || latest.t - previous.t > 60) return { x: 0, y: 0 };
    this.trim(now2);
    if (this.samples.length < 2) return { x: 0, y: 0 };
    let weightSum = 0;
    let timeMean = 0;
    let xMean = 0;
    let yMean = 0;
    for (const sample of this.samples) {
      const weight = Math.exp(-(now2 - sample.t) / 40);
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
      const weight = Math.exp(-(now2 - sample.t) / 40);
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
  trim(now2) {
    while (this.samples.length && now2 - this.samples[0].t > this.window) this.samples.shift();
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
  options;
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
  options;
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
  options;
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
  options;
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
    for (const recognizer of recognizers) if (recognizer.attach) this.extras.push(recognizer.attach(element));
    this.session = createPointerSession({ element, ...options, onSample: (sample, pointers) => this.handleSample(sample, { pointers }), onEnd: (sample, cancelled) => this.handleEnd(sample, cancelled) });
  }
  element;
  recognizers;
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
  /** Swap the underlying time/frame source (used by tests). Cancels any pending frame and re-wakes on the new driver if tasks are active. */
  setDriver(driver2) {
    if (this.frame != null) this.driver.cancel(this.frame);
    this.frame = null;
    this.driver = driver2;
    if (this.tasks.size) this.wake();
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
function framesToTimecode(frame, rate) {
  const fpsRounded = Math.round(rate.fps);
  if (!rate.dropFrame) {
    const framesPart2 = (frame % fpsRounded + fpsRounded) % fpsRounded;
    const totalSeconds2 = Math.floor(frame / fpsRounded);
    const secondsPart2 = (totalSeconds2 % 60 + 60) % 60;
    const totalMinutes2 = Math.floor(totalSeconds2 / 60);
    const minutesPart2 = (totalMinutes2 % 60 + 60) % 60;
    const hoursPart2 = Math.floor(totalMinutes2 / 60);
    return { hours: hoursPart2, minutes: minutesPart2, seconds: secondsPart2, frames: framesPart2, dropFrame: false };
  }
  const df = dropCount(fpsRounded);
  const framesPer24Hours = fpsRounded * 3600 * 24;
  const framesPer10Minutes = Math.round(rate.fps * 60 * 10);
  const framesPerMinute = fpsRounded * 60 - df;
  let f = (frame % framesPer24Hours + framesPer24Hours) % framesPer24Hours;
  const tenMinuteBlocks = Math.floor(f / framesPer10Minutes);
  const remainder = f % framesPer10Minutes;
  f += remainder > df ? df * 9 * tenMinuteBlocks + df * Math.floor((remainder - df) / framesPerMinute) : df * 9 * tenMinuteBlocks;
  const framesPart = f % fpsRounded;
  const totalSeconds = Math.floor(f / fpsRounded);
  const secondsPart = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutesPart = totalMinutes % 60;
  const hoursPart = Math.floor(totalMinutes / 60);
  return { hours: hoursPart, minutes: minutesPart, seconds: secondsPart, frames: framesPart, dropFrame: true };
}
function msToTimecode(ms, rate) {
  return framesToTimecode(msToFrame(ms, rate), rate);
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
var FRAME_EPSILON = 1e-6;
function frameToMs(frame, rate) {
  return frame * 1e3 * rate.den / rate.num;
}
function msToFrame(ms, rate) {
  return Math.floor(ms * rate.num / (1e3 * rate.den) + FRAME_EPSILON);
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

// src/track.ts
var Track = class {
  kind = "track";
  name;
  resolvedKeyframes = [];
  authoredKeyframes;
  segments = [];
  apply;
  repeat;
  repeatDelay;
  repeatDelayInput;
  direction;
  explicitRateInput;
  inheritedRateInput;
  defaultEasing;
  constructor(options) {
    if (!options.apply && !options.target) throw new Error("Track needs either `apply` or `target`.");
    this.name = options.name;
    this.apply = options.apply ?? ((value) => options.target.set(value));
    this.repeat = options.repeat ?? 0;
    this.repeatDelayInput = options.repeatDelay ?? 0;
    this.repeatDelay = 0;
    this.direction = options.direction ?? "normal";
    this.explicitRateInput = options.frameRate;
    this.defaultEasing = options.easing;
    this.authoredKeyframes = options.keyframes.map((key) => ({ ...key }));
    if (!options.keyframes.length) throw new Error("Track needs at least one keyframe.");
    this.resolveTiming();
  }
  get keyframes() {
    return this.resolvedKeyframes;
  }
  get frameRate() {
    const authored = [...this.authoredKeyframes.map((keyframe) => keyframe.at), this.repeatDelayInput];
    const provisional = authored.some((input) => typeof input === "string" && input.includes(";")) ? "29.97df" : 60;
    return frameRate(this.explicitRateInput ?? this.inheritedRateInput ?? provisional);
  }
  bindFrameRate(rate) {
    this.inheritedRateInput = rate;
    this.resolveTiming();
  }
  resolveTiming() {
    const rate = this.frameRate;
    const resolved = this.authoredKeyframes.map((key) => ({ at: parseTime(key.at, rate), value: key.value, easing: key.easing })).sort((a, b) => a.at - b.at);
    this.resolvedKeyframes = resolved.map(({ at, value }) => ({ at, value }));
    this.repeatDelay = Math.max(0, parseTime(this.repeatDelayInput, rate));
    this.segments = [];
    for (let i = 1; i < resolved.length; i += 1) {
      this.segments.push({ from: resolved[i - 1].at, to: resolved[i].at, ease: resolveEasing(resolved[i].easing ?? this.defaultEasing) });
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
    const span2 = segment.to - segment.from;
    const t = span2 <= 0 ? 1 : (ms - segment.from) / span2;
    return interpolate(from.value, to.value, segment.ease(Math.max(0, Math.min(1, t))));
  }
  sampleAt(localMs, ctx) {
    const spec = { duration: this.duration, delay: 0, repeat: this.repeat, repeatDelay: this.repeatDelay, direction: this.direction, reversed: false };
    const { cycleTime } = sampleCycle(spec, localMs);
    this.apply(this.valueAt(cycleTime), ctx);
  }
};

// src/physics.ts
function springConstants(options, distance = 1) {
  const mass = Math.max(1e-4, options.mass ?? 1);
  const bounce = Math.max(0, Math.min(1, options.bounce ?? 0));
  const duration = options.duration == null ? void 0 : Math.max(1, parseTime(options.duration, frameRate(options.frameRate ?? 60)));
  const stiffness = duration == null ? Math.max(1e-4, options.stiffness ?? 170) : stiffnessFor(duration, bounce, mass);
  const damping = options.damping ?? (duration == null ? 26 : 2 * (1 - bounce * 0.82) * Math.sqrt(stiffness * mass));
  return { mass, stiffness, damping: Math.max(0, damping), distance };
}
function scalarSpring(from, to, velocityMs, milliseconds, options) {
  const t = Math.max(0, milliseconds) / 1e3;
  const v0 = velocityMs * 1e3;
  const y0 = from - to;
  const { mass, stiffness, damping } = springConstants(options, Math.abs(y0));
  const omega0 = Math.sqrt(stiffness / mass);
  const alpha = damping / (2 * mass);
  let y;
  let velocity;
  if (alpha < omega0 - 1e-7) {
    const wd = Math.sqrt(omega0 * omega0 - alpha * alpha);
    const b = (v0 + alpha * y0) / wd;
    const cos = Math.cos(wd * t);
    const sin = Math.sin(wd * t);
    const decay = Math.exp(-alpha * t);
    y = decay * (y0 * cos + b * sin);
    velocity = decay * ((-alpha * y0 + b * wd) * cos + (-alpha * b - y0 * wd) * sin);
  } else if (alpha > omega0 + 1e-7) {
    const root = Math.sqrt(alpha * alpha - omega0 * omega0);
    const r1 = -alpha + root;
    const r2 = -alpha - root;
    const a = (v0 - r2 * y0) / (r1 - r2);
    const b = y0 - a;
    y = a * Math.exp(r1 * t) + b * Math.exp(r2 * t);
    velocity = a * r1 * Math.exp(r1 * t) + b * r2 * Math.exp(r2 * t);
  } else {
    const b = v0 + alpha * y0;
    const decay = Math.exp(-alpha * t);
    y = (y0 + b * t) * decay;
    velocity = (b - alpha * (y0 + b * t)) * decay;
  }
  return { value: to + y, velocity: velocity / 1e3 };
}
function numericVelocity(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function mapSpring(from, to, velocity, time, options) {
  if (typeof from === "number" && typeof to === "number") return scalarSpring(from, to, numericVelocity(velocity), time, options);
  if (Array.isArray(from) && Array.isArray(to)) {
    const states = from.map((item, index) => mapSpring(item, to[index] ?? item, Array.isArray(velocity) ? velocity[index] : 0, time, options));
    return { value: states.map((state) => state.value), velocity: states.map((state) => state.velocity) };
  }
  if (from && to && typeof from === "object" && typeof to === "object") {
    const values = {};
    const velocities = {};
    const v = velocity && typeof velocity === "object" ? velocity : {};
    for (const key of /* @__PURE__ */ new Set([...Object.keys(from), ...Object.keys(to)])) {
      const a = from[key];
      const b = to[key];
      if (a == null || b == null) {
        values[key] = b ?? a;
        velocities[key] = 0;
        continue;
      }
      const state = mapSpring(a, b, v[key], time, options);
      values[key] = state.value;
      velocities[key] = state.velocity;
    }
    return { value: values, velocity: velocities };
  }
  return { value: time <= 0 ? from : to, velocity: 0 };
}
function maxMagnitude(value) {
  if (typeof value === "number") return Math.abs(value);
  if (Array.isArray(value)) return Math.max(0, ...value.map(maxMagnitude));
  if (value && typeof value === "object") return Math.max(0, ...Object.values(value).map(maxMagnitude));
  return 0;
}
function difference(a, b) {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b);
  if (Array.isArray(a) && Array.isArray(b)) return Math.max(0, ...a.map((v, i) => difference(v, b[i])));
  if (a && b && typeof a === "object" && typeof b === "object") return Math.max(0, ...Object.keys(a).map((key) => difference(a[key], b[key])));
  return Object.is(a, b) ? 0 : Infinity;
}
var PhysicsItem = class {
  constructor(apply, scheduler_) {
    this.apply = apply;
    this.frameLoop = scheduler_ ?? scheduler;
    this.finished = new Promise((resolve) => {
      this.resolveFinished = resolve;
    });
  }
  apply;
  name;
  frameLoop;
  startedAt = 0;
  removeFrame;
  resolveFinished;
  finished;
  elapsed = 0;
  isAnimating = false;
  play() {
    if (this.isAnimating) return this;
    this.isAnimating = true;
    this.startedAt = this.frameLoop.now() - this.elapsed;
    this.removeFrame = this.frameLoop.add(this.advance);
    return this;
  }
  pause() {
    this.removeFrame?.();
    this.isAnimating = false;
    return this;
  }
  cancel() {
    this.removeFrame?.();
    this.isAnimating = false;
    this.resolveFinished(this);
    return this;
  }
  seekTime(milliseconds) {
    this.elapsed = Math.max(0, Math.min(this.totalDuration, milliseconds));
    this.sampleAt(this.elapsed);
    if (this.isAnimating) this.startedAt = this.frameLoop.now() - this.elapsed;
    return this;
  }
  advance = (time) => {
    this.elapsed = Math.min(this.totalDuration, Math.max(0, time - this.startedAt));
    this.sampleAt(this.elapsed);
    if (this.elapsed < this.totalDuration) return true;
    this.isAnimating = false;
    this.resolveFinished(this);
    return false;
  };
};
var SpringItem = class extends PhysicsItem {
  kind = "spring";
  from;
  to;
  initialVelocity;
  options;
  totalDuration;
  value;
  velocity;
  constructor(options) {
    super(options.onUpdate, options.scheduler);
    this.name = options.name;
    this.from = options.from;
    this.to = options.to;
    this.initialVelocity = options.velocity ?? 0;
    this.options = options;
    this.value = this.from;
    this.velocity = this.initialVelocity;
    this.totalDuration = springDuration({ ...options, from: this.from, to: this.to, velocity: this.initialVelocity });
    if (options.autoplay) queueMicrotask(() => this.play());
  }
  sampleAt(milliseconds) {
    const time = Math.max(0, Math.min(this.totalDuration, milliseconds));
    const state = mapSpring(this.from, this.to, this.initialVelocity, time, this.options);
    if (time >= this.totalDuration) {
      this.value = this.to;
      this.velocity = 0;
    } else {
      this.value = state.value;
      this.velocity = state.velocity;
    }
    this.apply?.(this.value, this.velocity, time);
    return this.value;
  }
};
var InertiaItem = class extends PhysicsItem {
  kind = "inertia";
  from;
  initialVelocity;
  options;
  totalDuration;
  target;
  value;
  velocity;
  boundary;
  crossingTime = 0;
  settle;
  constructor(options) {
    super(options.onUpdate, options.scheduler);
    this.name = options.name;
    this.from = options.from;
    this.initialVelocity = options.velocity ?? 0;
    this.options = options;
    this.value = this.from;
    this.velocity = this.initialVelocity;
    const tau = Math.max(1, options.timeConstant ?? 325);
    const power = options.power ?? 0.8;
    if (typeof this.from === "number") {
      const projected = projectFling(this.from, numericVelocity(this.initialVelocity) * power, tau);
      const modified = options.modifyTarget?.(projected) ?? projected;
      this.target = modified;
      const bound = modified < (options.min ?? -Infinity) ? options.min : modified > (options.max ?? Infinity) ? options.max : void 0;
      if (bound != null && options.bounce !== false) {
        this.boundary = bound;
        const distance = bound - this.from;
        const full = numericVelocity(this.initialVelocity) * power * tau;
        const ratio = full === 0 ? 1 : Math.max(0, Math.min(0.999999, distance / full));
        this.crossingTime = Math.max(0, -tau * Math.log(1 - ratio));
        const crossingVelocity = numericVelocity(this.initialVelocity) * power * Math.exp(-this.crossingTime / tau);
        this.settle = new SpringItem({ from: bound, to: bound, velocity: crossingVelocity, ...typeof options.bounce === "object" ? options.bounce : {}, scheduler: options.scheduler });
      }
    } else this.target = this.from;
    const rest = Math.max(1e-5, options.restDelta ?? 0.01);
    const v = Math.abs(numericVelocity(this.initialVelocity) * power);
    const decayDuration = v <= rest ? 0 : Math.max(0, tau * Math.log(v / rest));
    this.totalDuration = this.settle ? this.crossingTime + this.settle.totalDuration : decayDuration;
    if (options.autoplay) queueMicrotask(() => this.play());
  }
  sampleAt(milliseconds) {
    const time = Math.max(0, Math.min(this.totalDuration, milliseconds));
    if (typeof this.from !== "number") {
      this.apply?.(this.value, this.velocity, time);
      return this.value;
    }
    if (this.settle && this.boundary != null && time >= this.crossingTime) {
      this.value = this.settle.sampleAt(time - this.crossingTime);
      this.velocity = this.settle.velocity;
    } else {
      const tau = Math.max(1, this.options.timeConstant ?? 325);
      const v0 = numericVelocity(this.initialVelocity) * (this.options.power ?? 0.8);
      this.value = this.from + v0 * tau * (1 - Math.exp(-time / tau));
      this.velocity = v0 * Math.exp(-time / tau);
      if (!this.settle && time >= this.totalDuration) {
        this.value = this.target;
        this.velocity = 0;
      }
    }
    this.apply?.(this.value, this.velocity, time);
    return this.value;
  }
};
function springDuration(options = {}) {
  const from = options.from ?? 0;
  const to = options.to ?? 1;
  const restDelta = options.restDelta ?? 0.01;
  const restSpeed = options.restSpeed ?? 0.01;
  let previous = 0;
  for (let time = 0; time <= 2e4; time += 4) {
    const state = mapSpring(from, to, options.velocity ?? 0, time, options);
    if (difference(state.value, to) <= restDelta && maxMagnitude(state.velocity) <= restSpeed) {
      let low = previous;
      let high = time;
      for (let i = 0; i < 12; i += 1) {
        const mid = (low + high) / 2;
        const sample = mapSpring(from, to, options.velocity ?? 0, mid, options);
        if (difference(sample.value, to) <= restDelta && maxMagnitude(sample.velocity) <= restSpeed) high = mid;
        else low = mid;
      }
      return high;
    }
    previous = time;
  }
  return 2e4;
}
function stiffnessFor(duration, bounce = 0, mass = 1) {
  const seconds = Math.max(1e-3, duration / 1e3);
  const dampingRatio = Math.max(0.08, 1 - Math.max(0, Math.min(1, bounce)) * 0.82);
  return mass * (Math.log(100) / (dampingRatio * seconds)) ** 2;
}
function rubberband(value, min, max, coefficient = 0.55, dimension = 300) {
  if (value >= min && value <= max) return value;
  const boundary = value < min ? min : max;
  const distance = Math.abs(value - boundary);
  const resisted = (1 - 1 / (distance * coefficient / Math.max(1, dimension) + 1)) * Math.max(1, dimension);
  return boundary + Math.sign(value - boundary) * resisted;
}
function clampWithRubberband(value, min, max, coefficient = 0.55, dimension = 300) {
  return coefficient === false ? Math.max(min, Math.min(max, value)) : rubberband(value, min, max, coefficient, dimension);
}
function projectFling(value, velocity, timeConstant = 325) {
  return value + velocity * timeConstant;
}
function snapTo(points, value, velocity, timeConstant = 325) {
  const projected = projectFling(value, velocity, timeConstant);
  if (typeof points === "function") return points(projected);
  if (!Array.isArray(points)) {
    const offset = points.offset ?? 0;
    return Math.round((projected - offset) / points.step) * points.step + offset;
  }
  return points.reduce((nearest, point) => Math.abs(point - projected) < Math.abs(nearest - projected) ? point : nearest, points[0] ?? value);
}

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
  kind = "tween";
  name;
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
  durationInput = 300;
  delayInput = 0;
  repeatDelayInput = 0;
  explicitRateInput;
  inheritedRateInput;
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
    const timingKeys = /* @__PURE__ */ new Set(["duration", "delay", "repeatDelay", "frameRate"]);
    for (const [key, value] of Object.entries(options)) if (value !== void 0 && !timingKeys.has(key)) this[key] = value;
    if (options.duration !== void 0) this.durationInput = options.duration;
    if (options.delay !== void 0) this.delayInput = options.delay;
    if (options.repeatDelay !== void 0) this.repeatDelayInput = options.repeatDelay;
    if (options.frameRate !== void 0) this.explicitRateInput = options.frameRate;
    this.resolveTiming();
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
    if (this.repeat === Infinity) {
      const cycleDuration = Math.max(1, this.duration + this.repeatDelay);
      const iteration = Math.floor(active / cycleDuration);
      const cycleTime = Math.min(this.duration, Math.max(0, active - iteration * cycleDuration));
      this.elapsed = this.delay + iteration * cycleDuration + Math.max(0, this.duration - cycleTime);
    } else this.elapsed = this.delay + Math.max(0, this.activeDuration - active);
    if (this.isAnimating) this.startedAt = this.frameLoop.now() - this.elapsed;
    this.sampleAt(this.elapsed);
    return this;
  }
  seek(progress) {
    const seekDuration = this.repeat === Infinity ? this.duration : this.activeDuration;
    return this.seekTime(this.delay + Math.max(0, Math.min(1, progress)) * seekDuration);
  }
  seekTime(milliseconds) {
    if (!Number.isFinite(milliseconds)) return this;
    this.elapsed = Math.max(0, Math.min(this.totalDuration, milliseconds));
    this.sampleAt(this.elapsed);
    if (this.isAnimating) this.startedAt = this.frameLoop.now() - this.elapsed;
    return this;
  }
  setDuration(duration, rate) {
    this.durationInput = duration;
    if (rate !== void 0) this.explicitRateInput = rate;
    this.resolveTiming();
    return this;
  }
  /** Effective timebase for authored frame/SMPTE fields. A standalone `;` timecode provisionally implies 29.97df until attached. */
  get frameRate() {
    const authored = [this.durationInput, this.delayInput, this.repeatDelayInput];
    const provisional = authored.some((input) => typeof input === "string" && input.includes(";")) ? "29.97df" : 60;
    return frameRate(this.explicitRateInput ?? this.inheritedRateInput ?? provisional);
  }
  /** Called by Timeline/Transport attachment. An explicit `frameRate` option is never overwritten. */
  bindFrameRate(rate) {
    this.inheritedRateInput = rate;
    this.resolveTiming();
  }
  /** The frame index the tween's active time falls in, at `rate` (default 60 fps). Floor-based: matches which frame is on screen. */
  frameAt(rate = 60) {
    return msToFrame(Math.max(0, this.elapsed - this.delay), frameRate(rate));
  }
  /** The SMPTE timecode for the tween's active time, at `rate`. */
  timecodeAt(rate) {
    return msToTimecode(Math.max(0, this.elapsed - this.delay), frameRate(rate));
  }
  getCurrentFrame(fps = 60) {
    return this.frameAt(fps);
  }
  /** Analytic/numerically differentiated velocity of the current tween value, in units per millisecond. */
  instantaneousVelocity() {
    if (this.duration <= 0) return 0;
    const epsilon = 1e-4;
    const before = this.easing(Math.max(0, this.progress - epsilon));
    const after = this.easing(Math.min(1, this.progress + epsilon));
    const span2 = Math.min(1, this.progress + epsilon) - Math.max(0, this.progress - epsilon);
    const slope = span2 > 0 ? (after - before) / span2 : 0;
    return scaleVelocity(velocityBetween(this.from, this.toValue, this.duration), slope);
  }
  /**
   * A two-keyframe `Track` equivalent to this tween's `from`/`to`/`duration`/`easing`/`repeat`/`repeatDelay`/`direction`.
   * Its `apply` forwards sampled values to this tween's own `onUpdate` (progress is not recomputed — read `value` from the callback).
   */
  toTrack() {
    return new Track({
      name: this.name,
      keyframes: [{ at: this.delay, value: this.from }, { at: this.delay + this.duration, value: this.toValue, easing: this.easing }],
      repeat: this.repeat,
      repeatDelay: this.repeatDelay,
      direction: this.direction,
      apply: (value) => {
        this.value = value;
        this.onUpdate?.(value, this.progress, this);
      }
    });
  }
  get activeDuration() {
    return this.repeat === Infinity ? Infinity : this.duration * (this.repeat + 1) + this.repeatDelay * this.repeat;
  }
  get totalDuration() {
    return this.delay + this.activeDuration;
  }
  sampleAt(milliseconds, _ctx) {
    const { progress } = sampleCycle(
      { duration: this.duration, delay: this.delay, repeat: this.repeat, repeatDelay: this.repeatDelay, direction: this.direction, reversed: this.isReversed },
      milliseconds
    );
    this.progress = progress;
    this.value = interpolate(this.from, this.toValue, this.easing(this.progress));
    if (this.node && this.properties && typeof this.value === "object" && !Array.isArray(this.value)) {
      for (const [key, value] of Object.entries(this.value)) this.node.style.setProperty(key, `${value}${this.properties[key]?.unit ?? ""}`);
    }
    this.onUpdate?.(this.value, this.progress, this);
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
  resolveTiming() {
    const rate = this.frameRate;
    this.duration = Math.max(0, parseTime(this.durationInput, rate));
    this.delay = Math.max(0, parseTime(this.delayInput, rate));
    this.repeatDelay = Math.max(0, parseTime(this.repeatDelayInput, rate));
  }
  newFinishedPromise() {
    return new Promise((resolve) => {
      this.resolveFinished = resolve;
    });
  }
};
var MotionValue = class {
  constructor(current) {
    this.current = current;
    this.previous = current;
    this.updatedAtValue = scheduler.now();
    this.previousAt = this.updatedAtValue;
  }
  current;
  listeners = /* @__PURE__ */ new Set();
  animation;
  previous;
  previousAt;
  explicitVelocity;
  updatedAtValue;
  get() {
    return this.current;
  }
  get updatedAt() {
    return this.updatedAtValue;
  }
  get velocity() {
    if (this.explicitVelocity !== void 0) return this.explicitVelocity;
    const elapsed = this.updatedAt - this.previousAt;
    if (elapsed <= 0 || elapsed > 50) return 0;
    return velocityBetween(this.previous, this.current, elapsed);
  }
  set(value, time = scheduler.now()) {
    const changed = !Object.is(value, this.current);
    this.previous = this.current;
    this.previousAt = this.updatedAt;
    this.current = value;
    this.updatedAtValue = time;
    this.explicitVelocity = void 0;
    if (changed) for (const listener of this.listeners) listener();
  }
  setWithVelocity(value, velocity, time = scheduler.now()) {
    const changed = !Object.is(value, this.current);
    this.previous = this.current;
    this.previousAt = this.updatedAt;
    this.current = value;
    this.updatedAtValue = time;
    this.explicitVelocity = velocity;
    if (changed) for (const listener of this.listeners) listener();
  }
  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  animate(to, options = {}) {
    this.stop();
    const tween = new Tween({ ...options, from: this.current, to, onUpdate: (value, _progress, active) => this.setWithVelocity(value, active.instantaneousVelocity(), active.elapsed) }).play();
    this.animation = tween;
    return tween;
  }
  spring(to, options = {}) {
    this.stop();
    const item = new SpringItem({ ...options, from: this.current, to, velocity: options.velocity ?? this.velocity, onUpdate: (value, velocity, time) => this.setWithVelocity(value, velocity, time), autoplay: true });
    this.animation = item;
    return item;
  }
  decay(options = {}) {
    this.stop();
    const item = new InertiaItem({ ...options, from: this.current, velocity: options.velocity ?? this.velocity, onUpdate: (value, velocity, time) => this.setWithVelocity(value, velocity, time), autoplay: true });
    this.animation = item;
    return item;
  }
  stop() {
    this.animation?.cancel();
    this.animation = void 0;
  }
};
function velocityBetween(from, to, milliseconds) {
  if (typeof from === "number" && typeof to === "number") return (to - from) / milliseconds;
  if (Array.isArray(from) && Array.isArray(to)) return from.map((value, index) => velocityBetween(value, to[index] ?? value, milliseconds));
  if (from && to && typeof from === "object" && typeof to === "object") {
    const output = {};
    for (const key of /* @__PURE__ */ new Set([...Object.keys(from), ...Object.keys(to)])) {
      const a = from[key];
      const b = to[key];
      output[key] = a == null || b == null ? 0 : velocityBetween(a, b, milliseconds);
    }
    return output;
  }
  return 0;
}
function scaleVelocity(value, scale) {
  if (typeof value === "number") return value * scale;
  if (Array.isArray(value)) return value.map((entry) => scaleVelocity(entry, scale));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, scaleVelocity(entry, scale)]));
  return 0;
}

// src/gesture/bind.ts
function reduced() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  const axis = options.axis ?? (target instanceof MotionValue ? "x" : "any");
  const pan = panRecognizer({ axis, threshold: options.threshold, propagate: options.propagate });
  const arena = new GestureArena(element, [pan], { capture: options.capture, touchAction: options.touchAction ?? (axis === "x" ? "pan-y" : axis === "y" ? "pan-x" : "none"), predict: options.predict });
  const isDragging = new MotionValue(false);
  const values = target instanceof MotionValue ? { [axis === "y" ? "y" : "x"]: target } : target;
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
    else if (!removeFrame) removeFrame = scheduler.add(() => {
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
    const projectedTarget = options.snap ? snapTo(options.snap, value.get(), velocity, typeof momentum === "object" ? momentum.timeConstant : void 0) : Math.max(min, Math.min(max, value.get()));
    if (options.snap || value.get() < min || value.get() > max) {
      const target_ = Math.max(min, Math.min(max, projectedTarget));
      if (noMotion) {
        value.set(target_);
        return { target: target_, settled: Promise.resolve() };
      }
      const spring2 = value.spring(target_, options.snapTransition);
      return { target: target_, settled: spring2.finished };
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
      if (values.x) next.x = clampWithRubberband(start.x + event.offset.x, ...bounds.x, reduced() ? false : options.elastic ?? 0.55, Math.max(1, element.offsetWidth || 300));
      if (values.y) next.y = clampWithRubberband(start.y + event.offset.y, ...bounds.y, reduced() ? false : options.elastic ?? 0.55, Math.max(1, element.offsetHeight || 300));
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
  const oneDimensional = target instanceof MotionValue ? target : axis === "y" ? target.y : target.x;
  const keyboardDispose = options.keyboard === false || !oneDimensional ? () => {
  } : installDragKeyboard(element, oneDimensional, { axis: axis === "y" ? "y" : "x", min: numericBounds(options.bounds, element, axis === "y" ? "y" : "x")[0], max: numericBounds(options.bounds, element, axis === "y" ? "y" : "x")[1], step: options.step, label: options.ariaLabel, onCancel: () => {
    oneDimensional.spring(axis === "y" ? origin.y : origin.x, options.snapTransition);
  } });
  return { isDragging, start(nativeEvent) {
    const clone = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: nativeEvent.pointerId, pointerType: nativeEvent.pointerType, clientX: nativeEvent.clientX, clientY: nativeEvent.clientY, button: nativeEvent.button, buttons: nativeEvent.buttons, pressure: nativeEvent.pressure, isPrimary: nativeEvent.isPrimary });
    element.dispatchEvent(clone);
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
  const scale = options.scale ?? new MotionValue(1);
  const rotation = options.rotation ?? new MotionValue(0);
  const x = options.x ?? new MotionValue(0);
  const y = options.y ?? new MotionValue(0);
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
    const nextScale = clampWithRubberband(initial.scale * ratio, ...options.scaleBounds ?? [1, 4], options.elastic ?? 0.35, 2);
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
  const playhead = new MotionValue(transport.time);
  const dragValue = new MotionValue(0);
  const control = drag(dragValue, element, { axis, momentum: false, touchAction: axis === "x" ? "pan-y" : "pan-x", onStart: () => {
    start = transport.time;
    dragValue.set(0);
    wasPlaying = transport.state === "playing";
    transport.pause();
  }, onMove: (event) => {
    const delta = event.offset[axis];
    const ms = options.pixelsPerMs ? delta / options.pixelsPerMs : frameToMs(delta / (options.pixelsPerFrame ?? 10), transport.frameRate);
    playhead.set(start + ms);
    transport.seek(playhead.get(), { cues: options.cues });
  }, onEnd: (event) => {
    const velocityMs = options.pixelsPerMs ? event.velocity[axis] / options.pixelsPerMs : frameToMs(event.velocity[axis] / (options.pixelsPerFrame ?? 10), transport.frameRate);
    const momentum = reduced() ? false : options.momentum ?? true;
    const finish = () => {
      let target = playhead.get();
      if (options.snapToFrames) target = frameToMs(Math.round(target / frameToMs(1, transport.frameRate)), transport.frameRate);
      if (options.snapToMarkers) {
        const within = typeof options.snapToMarkers === "object" ? parseTime(options.snapToMarkers.within, transport.frameRate) : Infinity;
        const marker = transport.root.markers.reduce((best, item) => !best || Math.abs(item.time - target) < Math.abs(best.time - target) ? item : best, void 0);
        if (marker && Math.abs(marker.time - target) <= within) target = marker.time;
      }
      transport.seek(target, { cues: options.cues });
      if (wasPlaying && options.resumeAfter) transport.play();
    };
    if (momentum) {
      const inertia = new InertiaItem({ ...typeof momentum === "object" ? momentum : {}, from: playhead.get(), velocity: velocityMs, min: 0, max: transport.duration, onUpdate: (value) => {
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
  const isPressed = new MotionValue(false);
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
  const isHovered = new MotionValue(false);
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
  const rate = frameRate(options.frameRate);
  const axis = options.axis ?? "x";
  const raw = recording.samples.filter((sample) => sample.id === pointerId && sample.kind !== "cancel").map(({ x, y, t }) => ({ x, y, t }));
  const simplified = rdp(raw, options.simplify ?? 0);
  const byFrame = /* @__PURE__ */ new Map();
  for (const point of simplified) byFrame.set(msToFrame(point.t, rate), point);
  const keyframes = [...byFrame.entries()].sort(([a], [b]) => a - b).map(([frame, point]) => ({ at: frameToMs(frame, rate), value: axis === "both" ? { x: point.x, y: point.y } : axis === "x" ? point.x : point.y }));
  if (!keyframes.length) keyframes.push({ at: 0, value: axis === "both" ? { x: 0, y: 0 } : 0 });
  return new Track({ frameRate: rate, keyframes, apply: () => {
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