export interface VelocityEstimatorOptions { window?: number; maxSamples?: number; axes?: 1 | 2 }
interface Sample { x: number; y: number; t: number }

/** Windowed, exponentially weighted least-squares pointer velocity in px/ms. */
export class VelocityEstimator {
  readonly window: number; readonly maxSamples: number; readonly axes: 1 | 2;
  private samples: Sample[] = [];
  constructor(options: VelocityEstimatorOptions = {}) {
    this.window = options.window ?? 100; this.maxSamples = options.maxSamples ?? 20; this.axes = options.axes ?? 2;
  }
  push(x: number, y: number, t: number) {
    if (!Number.isFinite(t)) return;
    const last = this.samples.at(-1);
    if (last && t < last.t) return;
    this.samples.push({ x, y: this.axes === 1 ? 0 : y, t });
    if (this.samples.length > this.maxSamples) this.samples.splice(0, this.samples.length - this.maxSamples);
    this.trim(t); return this;
  }
  velocity(now = this.samples.at(-1)?.t ?? 0): { x: number; y: number } {
    const latest = this.samples.at(-1);
    if (!latest || now - latest.t > 60) return { x: 0, y: 0 };
    this.trim(now);
    if (this.samples.length < 2) return { x: 0, y: 0 };
    let weightSum = 0; let timeMean = 0; let xMean = 0; let yMean = 0;
    for (const sample of this.samples) {
      const weight = Math.exp(-(now - sample.t) / 40);
      weightSum += weight; timeMean += sample.t * weight; xMean += sample.x * weight; yMean += sample.y * weight;
    }
    timeMean /= weightSum; xMean /= weightSum; yMean /= weightSum;
    let denominator = 0; let xNumerator = 0; let yNumerator = 0;
    for (const sample of this.samples) {
      const weight = Math.exp(-(now - sample.t) / 40); const dt = sample.t - timeMean;
      denominator += weight * dt * dt; xNumerator += weight * dt * (sample.x - xMean); yNumerator += weight * dt * (sample.y - yMean);
    }
    if (denominator < 1e-9) return { x: 0, y: 0 };
    return { x: xNumerator / denominator, y: this.axes === 1 ? 0 : yNumerator / denominator };
  }
  reset() { this.samples.length = 0; }
  private trim(now: number) { while (this.samples.length && now - this.samples[0].t > this.window) this.samples.shift(); }
}

