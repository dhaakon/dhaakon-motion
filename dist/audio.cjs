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

// src/audio.ts
var audio_exports = {};
__export(audio_exports, {
  AudioClip: () => AudioClip,
  audioClock: () => audioClock,
  audioOutput: () => audioOutput,
  paramTrack: () => paramTrack,
  renderAudio: () => renderAudio
});
module.exports = __toCommonJS(audio_exports);
var import_motion = require("@dhaakon/motion");
function audioClock(context) {
  return { now: () => context.currentTime * 1e3 };
}
var AudioClip = class {
  kind = "audio";
  name;
  context;
  buffer;
  destination;
  offset;
  gain;
  loop;
  explicitDuration;
  constructor(options) {
    this.context = options.context;
    this.buffer = options.buffer;
    this.destination = options.destination;
    this.offset = options.offset ?? 0;
    this.gain = options.gain ?? 1;
    this.loop = options.loop ?? false;
    this.explicitDuration = options.duration;
    this.name = options.name;
  }
  get totalDuration() {
    return this.explicitDuration ?? Math.max(0, this.buffer.duration * 1e3 - this.offset);
  }
  /** No-op: `AudioClip` has no per-frame value. Scheduling is owned by `audioOutput`/`renderAudio`, which read absolute clip positions directly. */
  sampleAt() {
  }
};
function collectAudioClips(timeline, offset, out) {
  for (const entry of timeline.items) {
    const start = offset + entry.start;
    const end = offset + entry.end;
    if (entry.item instanceof AudioClip) out.push({ clip: entry.item, start, end });
    else if (entry.item instanceof import_motion.Timeline) collectAudioClips(entry.item, start, out);
  }
  return out;
}
function audioOutput(context, options = {}) {
  const driftThreshold = options.driftThreshold ?? 25;
  const active = /* @__PURE__ */ new Map();
  let clips = [];
  let owner;
  const stopVoice = (clip) => {
    const voice = active.get(clip);
    if (!voice) return;
    try {
      voice.source.stop();
    } catch {
    }
    voice.source.disconnect();
    voice.gain.disconnect();
    active.delete(clip);
  };
  const stopAll = () => {
    for (const clip of [...active.keys()]) stopVoice(clip);
  };
  const startVoice = (placed, info) => {
    const source = context.createBufferSource();
    source.buffer = placed.clip.buffer;
    source.loop = placed.clip.loop;
    source.playbackRate.value = Math.max(0, Math.abs(info.rate));
    const gainNode = context.createGain();
    gainNode.gain.value = placed.clip.gain;
    source.connect(gainNode);
    gainNode.connect(placed.clip.destination ?? context.destination);
    const offsetIntoClip = Math.max(0, (info.time - placed.start) / 1e3 + placed.clip.offset / 1e3);
    source.start(context.currentTime, offsetIntoClip);
    active.set(placed.clip, { source, gain: gainNode, startedAtContextTime: context.currentTime, startedAtTransportTime: info.time });
  };
  return {
    name: options.name ?? "audio",
    supportsOffline: false,
    onAttach(transport) {
      owner = transport;
      clips = collectAudioClips(transport.root, 0, []);
    },
    onStateChange(state) {
      if (state !== "playing") stopAll();
    },
    // No onSeek handler: Transport fires onTick (with the new time) before onSeek, so
    // stopping here would undo whatever the tick's drift check just correctly started.
    // A seek already reads as a large drift on the next tick and restarts naturally.
    onRateChange() {
      stopAll();
    },
    onTick(info) {
      if (owner?.state !== "playing" || info.rate <= 0) {
        stopAll();
        return;
      }
      for (const placed of clips) {
        const shouldPlay = info.time >= placed.start && info.time < placed.end;
        if (!shouldPlay) {
          stopVoice(placed.clip);
          continue;
        }
        const voice = active.get(placed.clip);
        if (!voice) {
          startVoice(placed, info);
          continue;
        }
        const expectedContextTime = voice.startedAtContextTime + (info.time - voice.startedAtTransportTime) / 1e3 / info.rate;
        const driftMs = Math.abs(context.currentTime - expectedContextTime) * 1e3;
        if (driftMs > driftThreshold) {
          stopVoice(placed.clip);
          startVoice(placed, info);
        }
      }
    },
    onDetach() {
      stopAll();
      owner = void 0;
    },
    async unlock() {
      if (context.state === "suspended") await context.resume();
    }
  };
}
function paramTrack(param, keyframes, options) {
  const { context, ...rest } = options;
  return new import_motion.Track({ ...rest, keyframes, apply: (value) => {
    param.linearRampToValueAtTime(value, context.currentTime + 1 / 60);
  } });
}
async function renderAudio(source, context, options = {}) {
  const root = source instanceof import_motion.Transport ? source.root : source;
  const clips = collectAudioClips(root, 0, []);
  const from = options.from ?? 0;
  const to = options.to ?? Infinity;
  for (const placed of clips) {
    if (placed.end <= from || placed.start >= to) continue;
    const bufferSource = context.createBufferSource();
    bufferSource.buffer = placed.clip.buffer;
    bufferSource.loop = placed.clip.loop;
    const gainNode = context.createGain();
    gainNode.gain.value = placed.clip.gain;
    bufferSource.connect(gainNode);
    gainNode.connect(placed.clip.destination ?? context.destination);
    const startAt = Math.max(0, (placed.start - from) / 1e3);
    bufferSource.start(startAt, placed.clip.offset / 1e3);
  }
  return context.startRendering();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AudioClip,
  audioClock,
  audioOutput,
  paramTrack,
  renderAudio
});
//# sourceMappingURL=audio.cjs.map