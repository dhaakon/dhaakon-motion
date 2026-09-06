/** Analytic, seeded geometry: no randomness, elapsed wall time, or prior frame. */
export const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const seed = (index: number) => ((index * 1664525 + 1013904223) >>> 0) / 4294967296;
export const SHARDS = Array.from({ length: 48 }, (_, index) => {
  const column = index % 8;
  const row = Math.floor(index / 8);
  const x = column * 69.72;
  const y = row * 43.72;
  // Stagger the internal vertical boundaries without losing partition coverage.
  const top = row % 2 ? 14 : 0;
  const bottom = row % 2 ? 0 : 14;
  const leftTop = column === 0 ? -20 : x + top;
  const leftBottom = column === 0 ? -20 : x + bottom;
  const rightTop = column === 7 ? 580 : x + 69.72 + top;
  const rightBottom = column === 7 ? 580 : x + 69.72 + bottom;
  return {
    x: x + 35,
    y: y + 22,
    path: `M${leftTop} ${y}H${rightTop}L${rightBottom} ${y + 43.72}H${leftBottom}Z`,
    sign: index % 2 ? 1 : -1,
  };
});
export function contourPath(index: number, morph: number, rotation: number, spread: number) {
  const points: string[] = [];
  for (let step = 0; step <= 96; step++) {
    const angle = (step / 96) * Math.PI * 2;
    const radius =
      (122 + index * 7 + Math.sin(angle * 5 + rotation / 40) * morph * (18 + index)) * spread;
    const x = 480 + Math.cos(angle + (rotation / 180) * Math.PI) * radius * 1.6;
    const y = 270 + Math.sin(angle + (rotation / 180) * Math.PI) * radius * 0.82;
    points.push(`${step ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join('') + 'Z';
}
export function ribbonPath(index: number, phase: number, amplitude: number, twist: number) {
  const points: string[] = [];
  for (let step = 0; step <= 64; step++) {
    const x = -80 + step * 17.5;
    const envelope = Math.sin((step / 64) * Math.PI);
    const y =
      270 +
      (index - 9) * 6 +
      Math.sin(step / 11 + phase + index * 0.13) * amplitude * 125 * envelope +
      Math.cos(step / 17 + twist) * (index - 9) * 10;
    points.push(`${step ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join('');
}
