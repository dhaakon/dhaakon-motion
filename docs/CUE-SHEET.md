# Ink / Signal — director’s cut

The `/svg-cue-sheet` study is a 24-second, 24 fps, five-act SVG composition.
Its offline master is 1920 × 1080, H.264 High, silent, frames **0–575** inclusive.
The legacy ten-second master remains available at its old media URL.

## Ownership

| File                          | Responsibility                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `src/advancedCueSheet.ts`     | Five acts, authored keyframes, 23 target definitions, lane metadata, exported JSON         |
| `src/cue-sheet/CueScene.tsx`  | Original SVG artwork and reusable render passes; no animation clock                        |
| `src/cue-sheet/geometry.ts`   | Seeded particles, clipped fragment partition, analytic ribbons and contour morphs          |
| `src/cue-sheet/renderer.ts`   | Cached imperative SVG writers shared by live and offline rendering                         |
| `src/cue-sheet/videoSync.ts`  | Presented-frame telemetry; never equates a seek request with decode confirmation           |
| `src/AdvancedCueSheetLab.tsx` | Transport ownership, editor, visibility, layer inspection, comparison, render-only adapter |
| `scripts/render-cue.mjs`      | Exact-frame PNG capture and GStreamer encoding; emits checksummed media metadata           |
| `scripts/verify-cue.mjs`      | Decoded-frame image comparisons, live seeks, layer controls, mobile overflow               |

Paths above are relative to `docs/`. Nothing is eagerly imported by the route shell.

Each renderer target has one full-show writer. The authoring helper expands partial
keyframes to complete numeric JSON objects. It does not generate random runtime
values. All geometry is derived from sampled controls, not elapsed wall time.
The editor preserves the last good take and imposes adapter-specific limits:
350 kB, eight nesting levels, 160 items, 200 keys per track, 1–1440 frames at 24 fps,
finite control ranges, and one writer per supported target. These limits do not
fix or supersede the general validation backlog in `AUDIT.md`.

## Render and verify

Prerequisites: Node 24, Chrome (`CHROME_PATH` may override its executable), and
GStreamer with `pngdec`, `videoconvert`, `x264enc`, `h264parse`, and `mp4mux`.

```sh
npm run docs:render-cue              # build, serve privately, render, encode
npm run docs:verify-cue              # rebuild with new media, verify in Chrome
npm run check:all                    # includes decoded-frame comparison checks
```

`node docs/scripts/render-cue.mjs --preview` captures eleven key frames from an
existing docs build without encoding or replacing the master. `DOCS_URL` can
target an explicit dev/deployed server. Default commands launch their own
loopback-only server; no sibling repository or already-running Vite is required.

The render-only URL uses a **fresh, nonplaying OfflineTransport**. Its adapter
samples an exact integer frame, serializes the same SVG, rasterizes it at 1080p,
and returns PNG pixels. It does not screen-record live playback. The render-only
API is registered only with `?render=1` and removed on unmount.

PNG frames and hashes are retained in a unique ignored `exports/cue-master-*`
directory. Only the current MP4 and `ink-signal-v2.json` are copied into public
media. Encoding uses quality 18, 24-frame keyframe intervals, I420, and BT.709.
The manifest records exact frame count, dimensions, JSON source hash, and MP4 hash.

## Comparison semantics

Live playback is snapped to authored 24 fps. Browser performance can still drop
presentations. During forward playback, the independently decoded video is
periodically re-aligned; this is not a hardware genlock or a guaranteed zero-drift
clock. Reverse playback frame-chases the MP4 with seeks. Paused scrubbing selects
the requested encoded frame and waits for the decoder.

The live SVG rasterizes at its responsive pane size; the movie is captured at
1080p and then scaled by the video element. Fine lines and SVG filters can look
different at those resolutions even at the same authored frame. Image checks
compare fresh SVG rasterizations at the master's resolution, not differently
sized screenshots of the two panes.

Only `requestVideoFrameCallback` updates the decoded frame counter. `currentTime`
is used to request alignment, never to claim a frame was presented. Unknown
decode state stays `WAIT`; a pending seek retains the previous decoded frame
and nonzero delta. Unsupported browsers retain unknown telemetry.

The verification script checks 12 representative decoded frames against fresh
SVG rasterizations, reporting mean absolute RGB error, RMSE, and foreground error.
H.264 is lossy: these are bounded image comparisons, **not pixel identity**.
Reports and desktop/mobile screenshots go in ignored `test-results/`.

Solo/mute, exploded view, and edited JSON intentionally alter only the live pane.
The UI marks these as differing from the original MP4. The lane key diamonds
describe the shipped score; the editor can change that score. Camera and finish
are global modifiers, while other solo buttons isolate a drawable pass.

The field and refraction are explicitly **SVG filters**, not custom GPU shaders.
Logo depth is layered vector extrusion; section reveals clip the original compound
wordmark rather than inventing separate font glyphs. Contours morph by recomputing
corresponding path points. There is no temporal motion blur or audio soundtrack.
