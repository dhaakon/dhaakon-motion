export type FrameTask = (time: number) => boolean | void;
export interface FrameDriver { request(callback: (time: number) => void): unknown; cancel(id: unknown): void; now(): number; }

const now = () => globalThis.performance?.now?.() ?? Date.now();
const driver: FrameDriver = {
  request: typeof globalThis.requestAnimationFrame === 'function'
    ? (callback) => globalThis.requestAnimationFrame(callback)
    : (callback) => globalThis.setTimeout(() => callback(now()), 16),
  cancel: typeof globalThis.cancelAnimationFrame === 'function'
    ? (id) => globalThis.cancelAnimationFrame(id as number)
    : (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
  now,
};

export class FrameScheduler {
  private tasks = new Set<FrameTask>();
  private frame: unknown = null;
  /** Failed tasks remain registered for the next frame; remove one here to opt out of retries. */
  onError: (error: unknown, task: FrameTask) => void = (error) => { console.error(error); };
  constructor(private driver: FrameDriver = globalThisDriver) {}
  get size() { return this.tasks.size; }
  now() { return this.driver.now(); }
  add(task: FrameTask) { this.tasks.add(task); this.wake(); return () => this.delete(task); }
  delete(task: FrameTask) { this.tasks.delete(task); if (!this.tasks.size && this.frame != null) { this.driver.cancel(this.frame); this.frame = null; } }
  flush(time = this.now()) {
    for (const task of [...this.tasks]) {
      if (!this.tasks.has(task)) continue;
      try {
        if (task(time) === false) this.tasks.delete(task);
      } catch (error) {
        try { this.onError(error, task); } catch (reportError) {
          // Diagnostics must not interrupt other tasks, even if the host's logger throws.
          try { console.error(reportError); } catch { /* No safe reporting sink remains. */ }
        }
      }
    }
  }
  clear() { this.tasks.clear(); if (this.frame != null) this.driver.cancel(this.frame); this.frame = null; }
  /** Swap the underlying time/frame source (used by tests). Cancels any pending frame and re-wakes on the new driver if tasks are active. */
  setDriver(driver: FrameDriver) {
    if (this.frame != null) this.driver.cancel(this.frame);
    this.frame = null;
    this.driver = driver;
    if (this.tasks.size) this.wake();
  }
  private wake() { if (this.frame == null) this.frame = this.driver.request(this.tick); }
  private tick = (time: number) => {
    this.frame = null;
    try { this.flush(time); } finally { if (this.tasks.size) this.wake(); }
  };
}

const globalThisDriver = driver;
export const scheduler = new FrameScheduler(globalThisDriver);
