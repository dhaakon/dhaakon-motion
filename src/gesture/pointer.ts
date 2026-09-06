export type PointerType = 'mouse' | 'touch' | 'pen';
export interface PointerSample { id: number; type: PointerType; x: number; y: number; t: number; pressure: number; buttons: number; isPrimary: boolean; predicted?: boolean; native?: PointerEvent }
export interface SessionOptions {
  element: Element;
  /** Attach the element's own pointerdown listener. Disable for handle-only controls. */
  listen?: boolean;
  capture?: boolean;
  touchAction?: 'auto' | 'none' | 'pan-x' | 'pan-y' | 'manipulation' | 'inherit';
  passive?: boolean;
  predict?: boolean;
  coalesce?: boolean;
  secondaryButtons?: boolean;
  onSample(sample: PointerSample, pointers: ReadonlyMap<number, PointerSample[]>): void;
  onEnd(sample: PointerSample, cancelled: boolean): void;
}

export interface PointerSession {
  dispose(): void;
  pointers: ReadonlyMap<number, PointerSample[]>;
  preventScroll(active: boolean): void;
  /** Adopt a pointer that began on another element, such as a drag handle. */
  start(event: PointerEvent): void;
}

function normalize(event: PointerEvent, predicted = false): PointerSample {
  const type = event.pointerType === 'touch' || event.pointerType === 'pen' ? event.pointerType : 'mouse';
  return { id: event.pointerId, type, x: event.clientX, y: event.clientY, t: event.timeStamp, pressure: event.pressure ?? 0, buttons: event.buttons, isPrimary: event.isPrimary, predicted, native: event };
}

export function createPointerSession(options: SessionOptions): PointerSession {
  const element = options.element;
  const pointers = new Map<number, PointerSample[]>();
  const capture = options.capture ?? true; const coalesce = options.coalesce ?? true; const predict = options.predict ?? true;
  const styled = element as HTMLElement; const previousTouchAction = styled.style?.touchAction; const previousSelect = styled.style?.webkitUserSelect;
  if (styled.style && options.touchAction !== 'inherit') styled.style.touchAction = options.touchAction ?? 'none';
  let listenerTarget: EventTarget | null = null; let scrollPrevented = false; let disposed = false;
  const listenerOptions: AddEventListenerOptions = { passive: options.passive ?? true };
  const touchBlocker = (event: Event) => event.preventDefault();
  const preventScroll = (active: boolean) => {
    if (active === scrollPrevented) return; scrollPrevented = active;
    if (active) { document.addEventListener('touchmove', touchBlocker, { passive: false }); if (styled.style) styled.style.webkitUserSelect = 'none'; }
    else { document.removeEventListener('touchmove', touchBlocker); if (styled.style) styled.style.webkitUserSelect = previousSelect ?? ''; }
  };
  const push = (event: PointerEvent, predicted = false) => {
    const sample = normalize(event, predicted);
    if (!predicted) {
      const history = pointers.get(sample.id) ?? []; history.push(sample);
      if (history.length > 32) history.splice(0, history.length - 32); pointers.set(sample.id, history);
    }
    options.onSample(sample, pointers); return sample;
  };
  const attach = (external = false) => {
    // An externally-started pointer continues to dispatch through its original
    // target when pointer capture isn't available (or is emulated in tests).
    // Listen at the document in that case so a separate handle remains usable.
    if (listenerTarget) return; listenerTarget = external || !capture ? document : element;
    listenerTarget.addEventListener('pointermove', onMove as EventListener, listenerOptions);
    listenerTarget.addEventListener('pointerup', onUp as EventListener, listenerOptions);
    listenerTarget.addEventListener('pointercancel', onCancel as EventListener, listenerOptions);
    element.addEventListener('lostpointercapture', onLost as EventListener, listenerOptions);
    globalThis.addEventListener?.('blur', onBlur);
    document.addEventListener?.('visibilitychange', onVisibility);
  };
  const detach = () => {
    if (!listenerTarget) return;
    listenerTarget.removeEventListener('pointermove', onMove as EventListener, listenerOptions);
    listenerTarget.removeEventListener('pointerup', onUp as EventListener, listenerOptions);
    listenerTarget.removeEventListener('pointercancel', onCancel as EventListener, listenerOptions);
    element.removeEventListener('lostpointercapture', onLost as EventListener, listenerOptions);
    globalThis.removeEventListener?.('blur', onBlur);
    document.removeEventListener?.('visibilitychange', onVisibility);
    listenerTarget = null;
  };
  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (!pointers.has(event.pointerId)) return;
    const sample = push(event); options.onEnd(sample, cancelled); pointers.delete(event.pointerId);
    if (capture && element.hasPointerCapture?.(event.pointerId)) { try { element.releasePointerCapture(event.pointerId); } catch {} }
    if (!pointers.size) { detach(); preventScroll(false); }
  };
  function begin(event: PointerEvent, external = false) {
    if (disposed || pointers.has(event.pointerId) || (!options.secondaryButtons && event.pointerType === 'mouse' && event.button !== 0)) return;
    attach(external); push(event);
    if (capture) { try { element.setPointerCapture?.(event.pointerId); } catch {} }
  }
  function onDown(event: PointerEvent) { begin(event); }
  function onMove(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    const actual = coalesce && event.getCoalescedEvents ? event.getCoalescedEvents() : [];
    if (actual.length) actual.forEach((sample) => push(sample)); else push(event);
    if (predict && event.getPredictedEvents) event.getPredictedEvents().forEach((sample) => push(sample, true));
  }
  function onUp(event: PointerEvent) { finish(event, false); }
  function onCancel(event: PointerEvent) { finish(event, true); }
  function onLost(event: PointerEvent) { finish(event, true); }
  function cancelAll() {
    for (const [id, history] of [...pointers]) {
      const last = history.at(-1)!; options.onEnd(last, true); pointers.delete(id);
    }
    detach(); preventScroll(false);
  }
  function onBlur() { cancelAll(); }
  function onVisibility() { if (document.visibilityState === 'hidden') cancelAll(); }
  if (options.listen !== false) element.addEventListener('pointerdown', onDown as EventListener, listenerOptions);
  return {
    pointers,
    preventScroll,
    start(event) { begin(event, true); },
    dispose() {
      if (disposed) return; disposed = true; cancelAll();
      if (options.listen !== false) element.removeEventListener('pointerdown', onDown as EventListener, listenerOptions);
      if (styled.style && options.touchAction !== 'inherit') styled.style.touchAction = previousTouchAction ?? '';
      if (styled.style) styled.style.webkitUserSelect = previousSelect ?? '';
    },
  };
}
