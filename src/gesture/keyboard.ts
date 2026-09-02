import { MotionValue } from '../core';

export interface KeyboardOptions {
  axis?: 'x' | 'y'; min?: number; max?: number; step?: number; label?: string; reducedMotion?: boolean;
  onCancel?(): void; onChange?(value: number): void;
}

function focusable(element: Element) { return element.matches('a[href],button,input,select,textarea,[tabindex]'); }

/** Automatic keyboard and ARIA semantics for a one-dimensional draggable value. */
export function installDragKeyboard(element: Element, value: MotionValue<number>, options: KeyboardOptions = {}) {
  const node = element as HTMLElement; const min = options.min ?? -Infinity; const max = options.max ?? Infinity;
  const finiteRange = Number.isFinite(min) && Number.isFinite(max); const step = options.step ?? (finiteRange ? (max - min) * .01 : 10);
  const authored = new Map<string, string | null>();
  const setAttribute = (name: string, next: string) => { authored.set(name, element.getAttribute(name)); element.setAttribute(name, next); };
  if (!focusable(element)) setAttribute('tabindex', '0');
  if (finiteRange) {
    setAttribute('role', 'slider'); setAttribute('aria-valuemin', String(min)); setAttribute('aria-valuemax', String(max)); setAttribute('aria-orientation', options.axis === 'y' ? 'vertical' : 'horizontal');
  } else setAttribute('aria-roledescription', 'draggable');
  if (options.label) setAttribute('aria-label', options.label);
  const updateAria = () => { element.setAttribute('aria-valuenow', String(Math.round(value.get() * 1000) / 1000)); };
  updateAria(); const unsubscribe = value.subscribe(updateAria);
  const write = (next: number) => { const clamped = Math.max(min, Math.min(max, next)); value.set(clamped); options.onChange?.(clamped); };
  const onKey = (event: KeyboardEvent) => {
    const multiplier = event.shiftKey ? 10 : 1; let next: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = value.get() + step * multiplier;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = value.get() - step * multiplier;
    if (event.key === 'Home' && Number.isFinite(min)) next = min;
    if (event.key === 'End' && Number.isFinite(max)) next = max;
    if (event.key === 'Escape') { options.onCancel?.(); event.preventDefault(); return; }
    if (event.key === ' ' || event.key === 'Enter') { const grabbed = element.getAttribute('aria-grabbed') === 'true'; element.setAttribute('aria-grabbed', String(!grabbed)); event.preventDefault(); return; }
    if (next != null) { write(next); event.preventDefault(); }
  };
  element.addEventListener('keydown', onKey as EventListener);
  return () => { unsubscribe(); element.removeEventListener('keydown', onKey as EventListener); for (const [name, previous] of authored) { if (previous == null) element.removeAttribute(name); else element.setAttribute(name, previous); } };
}

