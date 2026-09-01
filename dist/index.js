const frame = typeof globalThis.requestAnimationFrame === 'function'
  ? globalThis.requestAnimationFrame.bind(globalThis)
  : (fn) => globalThis.setTimeout(() => fn(Date.now()), 1000 / 60);
const cancel = typeof globalThis.cancelAnimationFrame === 'function'
  ? globalThis.cancelAnimationFrame.bind(globalThis) : globalThis.clearTimeout;

export const Easing = {
  linear: (t) => t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInCubic: (t) => t * t * t,
  easeInOutCubic: (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

export class Line {
  constructor(start, end) {
    if (!Array.isArray(start) || !Array.isArray(end) || start.length !== end.length) throw new Error('Uneven amount of lines');
    this.start = start.slice(); this.end = end.slice();
  }
  value(t) { return this.start.map((v, i) => v + (this.end[i] - v) * t); }
}

export class Tween {
  constructor(options = {}) { this._raf = null; this._started = 0; this._elapsed = 0; this.isAnimating = false; this.isPaused = false; this.isReversed = false; this._setOptions(options); }
  _setOptions(o) { Object.assign(this, { duration: 300, delay: 0, easing: Easing.linear, curve: [0, 1], onBegin: null, onUpdate: null, onEnd: null, node: null, properties: null }, o); return this; }
  to(options) { this.stop(); this._setOptions(options); return this; }
  play(options) {
    if (options) this._setOptions(options);
    if (this.isAnimating) return this;
    this.isAnimating = true; this.isPaused = false;
    if (!this._elapsed) this._elapsed = this.isReversed ? this.duration : 0;
    if (this.onBegin && this._elapsed === (this.isReversed ? this.duration : 0)) this.onBegin.call(this);
    this._started = Date.now() - this._elapsed;
    const tick = (now) => {
      if (!this.isAnimating) return;
      const elapsed = Math.max(0, Math.min(this.duration, now - this._started - this.delay));
      this._elapsed = elapsed;
      const raw = this.duration ? elapsed / this.duration : 1;
      const t = this.isReversed ? 1 - raw : raw;
      const value = this._value(this.easing(Math.max(0, Math.min(1, t))));
      if (this.onUpdate) this.onUpdate.call(this, value);
      if (elapsed >= this.duration + this.delay) { this.isAnimating = false; this._elapsed = this.isReversed ? 0 : this.duration; if (this.onEnd) this.onEnd.call(this); return; }
      this._raf = frame(tick);
    };
    this._raf = frame(tick); return this;
  }
  _value(t) {
    if (this.properties) { const out = {}; for (const [key, p] of Object.entries(this.properties)) out[key] = p.start + (p.end - p.start) * t; return out; }
    if (this.curve instanceof Line) return this.curve.value(t);
    return this.curve[0] + (this.curve[1] - this.curve[0]) * t;
  }
  pause() { if (this.isAnimating) { this.isAnimating = false; this.isPaused = true; cancel(this._raf); } return this; }
  stop() { this.isAnimating = false; this.isPaused = false; this._elapsed = 0; cancel(this._raf); return this; }
  reverse() { this.isReversed = !this.isReversed; return this; }
}

export class Timeline extends Tween {
  constructor(options = {}) { super(options); this.tweens = []; this.looping = false; }
  addTween(tween) { this.tweens.push(tween); this.duration = this.tweens.reduce((sum, t) => sum + (t.delay || 0) + (t.duration || 0), 0); return this; }
  addTweens(tweens) { tweens.forEach((t) => this.addTween(t)); return this; }
  loop(value = true) { this.looping = value; return this; }
  play() { let offset = 0; const run = () => { if (!this.tweens.length) return this; let i = 0; const next = () => { const t = this.tweens[i++]; if (!t) { if (this.looping) { i = 0; next(); } else if (this.onEnd) this.onEnd.call(this); return; } setTimeout(() => { t.onEnd = next; t.play(); }, t.delay || 0); }; next(); return this; }; return run(); }
}

export default { Tween, Timeline, Line, Easing };
