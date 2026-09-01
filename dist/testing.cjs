"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/testing.ts
var testing_exports = {};
__export(testing_exports, {
  ManualDriver: () => ManualDriver,
  createTestScheduler: () => createTestScheduler,
  installFrameDriver: () => installFrameDriver,
  recordValues: () => recordValues
});
module.exports = __toCommonJS(testing_exports);

// src/scheduler.ts
var now = () => globalThis.performance?.now?.() ?? Date.now();
var driver = {
  request: typeof globalThis.requestAnimationFrame === "function" ? (callback) => globalThis.requestAnimationFrame(callback) : (callback) => globalThis.setTimeout(() => callback(now()), 16),
  cancel: typeof globalThis.cancelAnimationFrame === "function" ? (id) => globalThis.cancelAnimationFrame(id) : (id) => globalThis.clearTimeout(id),
  now
};
var FrameScheduler = class {
  constructor(driver2 = globalThisDriver) {
    this.driver = driver2;
  }
  driver;
  tasks = /* @__PURE__ */ new Set();
  frame = null;
  get size() {
    return this.tasks.size;
  }
  now() {
    return this.driver.now();
  }
  add(task) {
    this.tasks.add(task);
    this.wake();
    return () => this.delete(task);
  }
  delete(task) {
    this.tasks.delete(task);
    if (!this.tasks.size && this.frame != null) {
      this.driver.cancel(this.frame);
      this.frame = null;
    }
  }
  flush(time = this.now()) {
    for (const task of [...this.tasks]) if (task(time) === false) this.tasks.delete(task);
  }
  clear() {
    this.tasks.clear();
    if (this.frame != null) this.driver.cancel(this.frame);
    this.frame = null;
  }
  /** Swap the underlying time/frame source (used by tests). Cancels any pending frame and re-wakes on the new driver if tasks are active. */
  setDriver(driver2) {
    if (this.frame != null) this.driver.cancel(this.frame);
    this.frame = null;
    this.driver = driver2;
    if (this.tasks.size) this.wake();
  }
  wake() {
    if (this.frame == null) this.frame = this.driver.request(this.tick);
  }
  tick = (time) => {
    this.frame = null;
    this.flush(time);
    if (this.tasks.size) this.wake();
  };
};
var globalThisDriver = driver;
var scheduler = new FrameScheduler(globalThisDriver);

// src/testing.ts
var ManualDriver = class {
  time = 0;
  requests = 0;
  callback = null;
  now = () => this.time;
  request = (callback) => {
    this.callback = callback;
    this.requests += 1;
    return this.requests;
  };
  cancel = () => {
    this.callback = null;
  };
  /** Jump to an absolute time and run the pending frame callback once, if any is queued. */
  step(time) {
    this.time = time;
    const callback = this.callback;
    this.callback = null;
    callback?.(time);
  }
  /** Advance by a relative delta and run the pending frame callback once, if any is queued. */
  advance(delta) {
    this.step(this.time + delta);
  }
};
function createTestScheduler() {
  const driver2 = new ManualDriver();
  return { driver: driver2, scheduler: new FrameScheduler(driver2) };
}
function installFrameDriver(driver2 = new ManualDriver()) {
  const restore = installOnScheduler(scheduler, driver2);
  return { driver: driver2, restore };
}
function installOnScheduler(target, driver2) {
  const previous = target.driver;
  target.setDriver(driver2);
  return () => target.setDriver(previous);
}
function recordValues(tween) {
  const values = [];
  const previous = tween.onUpdate;
  tween.onUpdate = (value, progress, instance) => {
    values.push(value);
    previous?.(value, progress, instance);
  };
  return values;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ManualDriver,
  createTestScheduler,
  installFrameDriver,
  recordValues
});
//# sourceMappingURL=testing.cjs.map