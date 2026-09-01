import { test, expect } from 'vitest';
import { interpolate, Line } from '@dhaakon/motion';

test('interpolates numbers, unit strings, colors, and nested objects', () => {
  expect(interpolate(10, 20, 0.25)).toBe(12.5);
  expect(interpolate('10px', '20px', 0.5)).toBe('15px');
  expect(interpolate('#000000', '#ffffff', 0.5)).toBe('rgba(128, 128, 128, 1)');
  expect(interpolate({ x: 0, scale: 1 }, { x: 100, scale: 2 }, 0.5)).toEqual({ x: 50, scale: 1.5 });
});

test('Line interpolates paired numeric arrays', () => {
  expect(new Line([0, 10], [10, 30]).value(0.5)).toEqual([5, 20]);
});
