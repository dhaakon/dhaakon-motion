import type { MotionValueShape } from '@dhaakon/motion';

const unit = /^(-?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i;
function color(value: string): number[] | undefined {
  const hex = value.trim().match(/^#([\da-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;
    if (expanded.length === 6 || expanded.length === 8)
      return [
        parseInt(expanded.slice(0, 2), 16),
        parseInt(expanded.slice(2, 4), 16),
        parseInt(expanded.slice(4, 6), 16),
        expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
      ];
  }
  const rgb = value
    .trim()
    .match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  return rgb
    ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] == null ? 1 : Number(rgb[4])]
    : undefined;
}

/** Reject accessors/prototypes/cycles rather than executing hidden authoring behavior. */
export function snapshotValue(
  value: MotionValueShape,
  depth = 0,
  ancestors = new Set<object>(),
  budget = { nodes: 4_000_000, characters: 16_000_000 },
): MotionValueShape {
  if (--budget.nodes < 0) throw new Error('Authored value node budget exceeded');
  if (depth > 16) throw new Error('Value nesting limit exceeded');
  if (typeof value === 'string' && (budget.characters -= value.length) < 0)
    throw new Error('Authored string budget exceeded');
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > 1e100)
      throw new Error('Value must be finite and bounded');
    return value;
  }
  if (typeof value === 'string' || typeof value === 'boolean' || value === undefined) return value;
  if (!value || typeof value !== 'object' || ancestors.has(value))
    throw new Error('Value must be an acyclic motion value');
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    throw new Error('Value must be a plain object');
  ancestors.add(value);
  if (Array.isArray(value) && value.length > Math.min(1024, budget.nodes))
    throw new Error('Value array resource limit exceeded');
  const out: Record<string, unknown> | unknown[] = Array.isArray(value)
    ? new Array(value.length)
    : {};
  if (Object.keys(value).length > 1024) throw new Error('Value property limit exceeded');
  for (const key of Object.keys(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key))
      throw new Error(`Reserved value key: ${key}`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor)) throw new Error('Value accessors are not supported');
    (out as Record<string, unknown>)[key] = snapshotValue(
      descriptor.value,
      depth + 1,
      ancestors,
      budget,
    );
  }
  ancestors.delete(value);
  return Object.freeze(out) as MotionValueShape;
}

export interface ShapePlan {
  readonly width: number;
  flatten(value: MotionValueShape): number[];
  materialize(values: Float64Array, offset: number): MotionValueShape;
}

/** Compile shape/parsers once. Mismatched shapes remain on the compatibility Track path. */
export function compileShape(first: MotionValueShape): ShapePlan {
  if (typeof first === 'number')
    return {
      width: 1,
      flatten(value) {
        if (typeof value !== 'number') throw new Error('Changing value shape');
        return [value];
      },
      materialize(values, offset) {
        return values[offset];
      },
    };
  if (typeof first === 'string') {
    if (color(first))
      return {
        width: 4,
        flatten(value) {
          const result = typeof value === 'string' ? color(value) : undefined;
          if (!result) throw new Error('Changing color shape');
          return result;
        },
        materialize(values, offset) {
          return `rgba(${Math.round(values[offset])}, ${Math.round(values[offset + 1])}, ${Math.round(values[offset + 2])}, ${Number(values[offset + 3].toFixed(3))})`;
        },
      };
    const parsed = first.match(unit);
    if (parsed)
      return {
        width: 1,
        flatten(value) {
          const result = typeof value === 'string' ? value.match(unit) : null;
          if (!result || result[2] !== parsed[2]) throw new Error('Changing CSS unit');
          return [Number(result[1])];
        },
        materialize(values, offset) {
          return `${Number(values[offset].toFixed(5))}${parsed[2]}`;
        },
      };
    throw new Error('Discrete strings use host interpolation');
  }
  if (typeof first === 'boolean' || first === undefined)
    throw new Error('Discrete/optional values use host interpolation');
  const array = Array.isArray(first);
  const keys = Object.keys(first);
  if (array && (keys.length !== first.length || keys.some((key, i) => key !== String(i))))
    throw new Error('Sparse/custom-property arrays use host interpolation');
  if (!keys.length) throw new Error('Empty values use host interpolation');
  const parts = keys.map((key) => compileShape((first as Record<string, MotionValueShape>)[key]));
  return {
    width: parts.reduce((sum, part) => sum + part.width, 0),
    flatten(value) {
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) !== array ||
        Object.keys(value).length !== keys.length ||
        (Array.isArray(value) && value.length !== keys.length) ||
        keys.some((key) => !Object.hasOwn(value, key))
      )
        throw new Error('Changing compound shape');
      return parts.flatMap((part, i) =>
        part.flatten((value as Record<string, MotionValueShape>)[keys[i]]),
      );
    },
    materialize(values, offset) {
      const result: Record<string, MotionValueShape> | MotionValueShape[] = array ? [] : {};
      for (let i = 0; i < keys.length; i++) {
        (result as Record<string, MotionValueShape>)[keys[i]] = parts[i].materialize(
          values,
          offset,
        );
        offset += parts[i].width;
      }
      return result as MotionValueShape;
    },
  };
}
