import { createPointerSession, type PointerSample, type PointerSession, type SessionOptions } from './pointer';
import type { GestureEvent, Recognizer, RecognizerSession } from './recognizers';

const arenas = new WeakMap<Element, GestureArena>();

export class GestureArena {
  readonly session: PointerSession;
  private winner?: Recognizer; private disposed = false; private extras: Array<() => void> = [];
  constructor(readonly element: Element, readonly recognizers: Recognizer[], options: Omit<Partial<SessionOptions>, 'element' | 'onSample' | 'onEnd'> = {}) {
    arenas.set(element, this);
    for (const recognizer of recognizers) if (recognizer.attach) this.extras.push(recognizer.attach(element));
    this.session = createPointerSession({ element, ...options, onSample: (sample, pointers) => this.handleSample(sample, { pointers }), onEnd: (sample, cancelled) => this.handleEnd(sample, cancelled) });
  }
  settle(recognizer: Recognizer) { if (!this.recognizers.includes(recognizer)) throw new Error('GestureArena.settle: recognizer is not in this arena'); this.claim(recognizer); }
  dispose() { if (this.disposed) return; this.disposed = true; this.session.dispose(); this.extras.forEach((dispose) => dispose()); this.cancel(); if (arenas.get(this.element) === this) arenas.delete(this.element); }
  cancel(except?: Recognizer) { for (const recognizer of this.recognizers) if (recognizer !== except && recognizer.state !== 'cancelled' && recognizer.state !== 'ended') recognizer.cancel(); if (!except) this.winner = undefined; }
  private handleSample(sample: PointerSample, session: RecognizerSession) {
    if (sample.predicted) return;
    const history = session.pointers.get(sample.id) ?? [];
    if (history.length === 1) { if (!this.winner) this.recognizers.forEach((recognizer) => recognizer.onDown(sample, session)); return; }
    if (this.winner) { this.winner.onMove(sample, session); return; }
    const claims: Recognizer[] = [];
    for (const recognizer of this.recognizers) if (recognizer.state === 'possible' || recognizer.state === 'began' || recognizer.state === 'changed') {
      const verdict = recognizer.onMove(sample, session); if (verdict === 'claim') claims.push(recognizer); else if (verdict === 'yield') recognizer.cancel();
    }
    if (claims.length) this.claim(claims.sort((a, b) => b.priority - a.priority)[0]);
  }
  private handleEnd(sample: PointerSample, cancelled: boolean) {
    const context = { pointers: this.session.pointers };
    if (cancelled) { this.cancel(); return; }
    if (this.winner) this.winner.onUp(sample, context);
    else {
      const possible = this.recognizers.filter((recognizer) => recognizer.state === 'possible' || recognizer.state === 'began' || recognizer.state === 'changed').sort((a, b) => b.priority - a.priority);
      possible.forEach((recognizer) => recognizer.onUp(sample, context));
      const winner = possible.find((recognizer) => recognizer.state === 'ended'); if (winner) { this.winner = winner; this.cancel(winner); }
    }
    if (this.session.pointers.size <= 1) this.winner = undefined;
  }
  private claim(recognizer: Recognizer) {
    this.winner = recognizer; this.cancel(recognizer); if (recognizer.preventsScroll) this.session.preventScroll(true);
    if (!recognizer.propagate) { let parent = this.element.parentElement; while (parent) { arenas.get(parent)?.cancel(); parent = parent.parentElement; } }
  }
}

export function createGestureArena(element: Element, recognizers: Recognizer[], options?: Omit<Partial<SessionOptions>, 'element' | 'onSample' | 'onEnd'>) { return new GestureArena(element, recognizers, options); }

export function cooperateWithScroll(recognizer: Recognizer<'pan'>, scroller: Element, options: { edge: 'top' | 'bottom' | 'both' }) {
  const pan = recognizer as Recognizer<'pan'> & { scrollGuard?: (event: GestureEvent<'pan'>) => boolean };
  pan.scrollGuard = (event) => {
    const node = scroller as HTMLElement; const atTop = node.scrollTop <= 0; const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
    const down = event.offset.y > 0; const up = event.offset.y < 0;
    return ((options.edge === 'top' || options.edge === 'both') && atTop && down) || ((options.edge === 'bottom' || options.edge === 'both') && atBottom && up);
  };
  return recognizer;
}
