/** A seek request is not evidence that a frame has been decoded/presented. */
export function videoSyncReport(expected: number, decoded: number | null, seeking: boolean) {
  return {
    frame: decoded === null ? '—' : String(decoded).padStart(3, '0'),
    delta:
      decoded === null
        ? 'WAIT'
        : `${decoded - expected >= 0 ? '+' : ''}${decoded - expected}F${seeking ? ' / SEEK' : ''}`,
  };
}
export function videoFrame(time: number, fps: number, frames: number) {
  return Math.max(0, Math.min(frames - 1, Math.floor(time * fps + 1e-5)));
}
