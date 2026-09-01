import { Track, type Keyframe, type TrackOptions } from './track';

export type MotionStyle = Record<string, number | string>;

const transformKeys = new Set(['x', 'y', 'z', 'scale', 'scaleX', 'scaleY', 'rotate', 'rotateX', 'rotateY', 'skewX', 'skewY']);
const unitless = new Set(['opacity', 'zIndex', 'fontWeight', 'lineHeight', 'scale', 'scaleX', 'scaleY', 'flexGrow', 'flexShrink']);

/** Write a `MotionStyle` value onto a DOM node: transform keys (`x`, `rotate`, `scale`, ...) collapse into one `transform`, everything else is a CSS custom/standard property. */
export function writeStyle(node: HTMLElement, values: MotionStyle) {
  const transforms: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (transformKeys.has(key)) {
      const unit = key.startsWith('rotate') || key.startsWith('skew') ? 'deg' : key.startsWith('scale') ? '' : 'px';
      const name = key === 'x' ? 'translateX' : key === 'y' ? 'translateY' : key === 'z' ? 'translateZ' : key;
      transforms.push(`${name}(${typeof value === 'number' ? `${value}${unit}` : value})`);
    } else {
      const cssKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      node.style.setProperty(cssKey, typeof value === 'number' && !unitless.has(key) ? `${value}px` : String(value));
    }
  }
  if (transforms.length) node.style.transform = transforms.join(' ');
}

/** Read a `MotionStyle`-shaped starting point off a node's computed style (transform keys read as their identity value: 0, or 1 for scale). */
export function readStyle(node: HTMLElement, target: MotionStyle): MotionStyle {
  const computed = getComputedStyle(node);
  const values: MotionStyle = {};
  for (const key of Object.keys(target)) {
    if (transformKeys.has(key)) { values[key] = key.startsWith('scale') ? 1 : 0; continue; }
    const css = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    const value = computed.getPropertyValue(css);
    values[key] = Number.isNaN(Number(value)) || value.trim() === '' ? value : Number(value);
  }
  return values;
}

/** A `Track` whose `apply` writes `MotionStyle` keyframes onto a DOM node, for plain (non-React) code. */
export function styleTrack(node: HTMLElement, keyframes: Keyframe<MotionStyle>[], options: Omit<TrackOptions<MotionStyle>, 'keyframes' | 'apply' | 'target'> = {}): Track<MotionStyle> {
  return new Track<MotionStyle>({ ...options, keyframes, apply: (value) => writeStyle(node, value) });
}
