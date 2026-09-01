export type MotionPrimitive = number | string;
export type MotionValueShape = MotionPrimitive | MotionPrimitive[] | { [key: string]: MotionValueShape };

const unit = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i;

function parseColor(value: string): [number, number, number, number] | null {
  const hex = value.trim().match(/^#([\da-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    if (expanded.length === 6 || expanded.length === 8) return [
      parseInt(expanded.slice(0, 2), 16), parseInt(expanded.slice(2, 4), 16), parseInt(expanded.slice(4, 6), 16),
      expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    ];
  }
  const rgb = value.trim().match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] == null ? 1 : Number(rgb[4])] : null;
}

export const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

export function interpolate<T extends MotionValueShape>(from: T, to: T, progress: number): T {
  if (typeof from === 'number' && typeof to === 'number') return mix(from, to, progress) as T;
  if (typeof from === 'string' && typeof to === 'string') {
    const fromColor = parseColor(from); const toColor = parseColor(to);
    if (fromColor && toColor) {
      const [r, g, b, a] = fromColor.map((v, i) => mix(v, toColor[i], progress));
      return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(3))})` as T;
    }
    const a = from.match(unit); const b = to.match(unit);
    if (a && b && a[2] === b[2]) return `${Number(mix(Number(a[1]), Number(b[1]), progress).toFixed(5))}${a[2]}` as T;
    return (progress < 1 ? from : to) as T;
  }
  if (Array.isArray(from) && Array.isArray(to)) return from.map((value, index) => interpolate(value, to[index] ?? value, progress)) as T;
  if (from && to && typeof from === 'object' && typeof to === 'object') {
    const output: Record<string, MotionValueShape> = {};
    for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
      const a = (from as Record<string, MotionValueShape>)[key]; const b = (to as Record<string, MotionValueShape>)[key];
      output[key] = a == null ? b : b == null ? a : interpolate(a, b, progress);
    }
    return output as T;
  }
  return (progress < 1 ? from : to) as T;
}
