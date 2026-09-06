import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AdvancedCueSheetShowcase } from '../../docs/src/AdvancedCueSheetLab';
import { CUE_VIDEO } from '../../docs/src/advancedCueSheet';
import { installFrameDriver, type ManualDriver } from '@dhaakon/motion/testing';

type EditableSheet = {
  items: Array<{
    items?: Array<{ target?: string; keyframes?: Array<{ value: Record<string, number> }> }>;
  }>;
};
function editorSheet() {
  return JSON.parse(
    (screen.getByLabelText('Editable source') as HTMLTextAreaElement).value,
  ) as EditableSheet;
}
async function ready() {
  await waitFor(() =>
    expect(screen.getByText(/VALID \/ 5 GROUPS \/ 23 TARGETS \/ 576F/)).toBeTruthy(),
  );
}
function pause() {
  const button = screen.queryByRole('button', { name: 'Pause both' });
  if (button) fireEvent.click(button);
}
let restoreDriver: () => void;
let frameDriver: ManualDriver;
beforeEach(() => {
  const installed = installFrameDriver();
  restoreDriver = installed.restore;
  frameDriver = installed.driver;
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  restoreDriver();
  vi.restoreAllMocks();
});

describe('advanced JSON cue sheet demo', () => {
  test('renders five acts with an accessible SVG and an offline 1080p comparison', async () => {
    render(<AdvancedCueSheetShowcase />);
    await ready();
    expect(
      screen.getByRole('img', { name: /Ink \/ Signal animated Dhaakon identity/ }),
    ).toBeTruthy();
    const comparison = screen.getByRole('group', {
      name: 'Live tween and offline render comparison',
    });
    const video = within(comparison).getByLabelText(
      'Offline-rendered Ink / Signal MP4',
    ) as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe(CUE_VIDEO);
    expect(video.muted).toBe(true);
    expect(
      within(screen.getByRole('navigation', { name: 'Composition acts' })).getAllByRole('button'),
    ).toHaveLength(5);
    pause();
    fireEvent.click(screen.getByRole('button', { name: 'Seek to LOCK' }));
    expect(screen.getByTestId('advanced-cue-reveal').getAttribute('width')).toBe('650');
    expect(screen.getByTestId('advanced-cue-type').getAttribute('opacity')).toBe('1');
    expect(
      screen
        .getByRole('slider', { name: 'Scrub Ink / Signal cue sheet' })
        .getAttribute('aria-valuetext'),
    ).toBe('Frame 168 of 575; 00:00:07:00');
    fireEvent.input(screen.getByRole('slider'), { target: { value: '396' } });
    expect(
      screen
        .getByTestId('advanced-cue-stage')
        .querySelector('[data-control="shards"]')
        ?.getAttribute('opacity'),
    ).toBe('1');
    expect(screen.getByTestId('advanced-cue-ink').getAttribute('opacity')).toBe('0');
  });
  test('preserves the last good take when edited JSON or renderer values are invalid', async () => {
    render(<AdvancedCueSheetShowcase />);
    await ready();
    pause();
    fireEvent.click(screen.getByRole('button', { name: 'Seek to LOCK' }));
    const edited = editorSheet();
    const scene = edited.items
      .flatMap((item) => item.items ?? [])
      .find((item) => item.target === 'scene');
    delete scene!.keyframes![0].value.scale;
    fireEvent.change(screen.getByLabelText('Editable source'), {
      target: { value: JSON.stringify(edited) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validate + load' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Target "scene".*"scale"/);
    expect(screen.getByTestId('advanced-cue-reveal').getAttribute('width')).toBe('650');
    fireEvent.change(screen.getByLabelText('Editable source'), { target: { value: '{ invalid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validate + load' }));
    expect(screen.getByText('INVALID / LAST GOOD TAKE PRESERVED')).toBeTruthy();
    expect(screen.getByTestId('advanced-cue-reveal').getAttribute('width')).toBe('650');
  });
  test('resets removed tracks and labels an edited take as different from the MP4', async () => {
    render(<AdvancedCueSheetShowcase />);
    await ready();
    pause();
    fireEvent.click(screen.getByRole('button', { name: 'Seek to LOCK' }));
    const edited = editorSheet();
    for (const group of edited.items)
      group.items = group.items?.filter((item) => item.target !== 'ink');
    fireEvent.change(screen.getByLabelText('Editable source'), {
      target: { value: JSON.stringify(edited) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validate + load' }));
    expect(screen.getByText(/22 TARGETS/)).toBeTruthy();
    expect(screen.getByTestId('advanced-cue-ink').getAttribute('opacity')).toBe('0');
    expect(screen.getByText('CUSTOM LIVE / OFFLINE BASELINE')).toBeTruthy();
  });
  test('supports solo, mute, exploded breakdown, inspection, and restoring the composite', async () => {
    render(<AdvancedCueSheetShowcase />);
    await ready();
    pause();
    fireEvent.click(screen.getByRole('button', { name: 'Seek to LOCK' }));
    const stage = screen.getByTestId('advanced-cue-stage');
    fireEvent.click(screen.getByRole('button', { name: 'Solo ink' }));
    expect(stage.querySelector('[data-layer="trace"]')?.getAttribute('display')).toBe('none');
    expect(stage.querySelector('[data-layer="ink"]')?.getAttribute('display')).toBe('inline');
    fireEvent.click(screen.getByRole('button', { name: 'Mute ink' }));
    expect(stage.querySelector('[data-layer="ink"]')?.getAttribute('display')).toBe('none');
    fireEvent.click(screen.getByRole('button', { name: 'Exploded view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Inspect shards' }));
    expect(screen.getByLabelText('Selected target values').textContent).toContain('explode');
    fireEvent.click(screen.getByRole('button', { name: 'Restore layers' }));
    expect(stage.querySelector('[data-layer="trace"]')?.getAttribute('display')).toBe('inline');
    expect(stage.querySelector('[data-layer="ink"]')?.getAttribute('transform')).toBe(
      'translate(0 0)',
    );
  });
  test('only updates decoded telemetry on presented-frame callbacks and cancels them on teardown', async () => {
    let callback: VideoFrameRequestCallback | undefined;
    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
      configurable: true,
      value: (fn: VideoFrameRequestCallback) => {
        callback = fn;
        return 7;
      },
    });
    const cancel = vi.fn();
    Object.defineProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback', {
      configurable: true,
      value: cancel,
    });
    const view = render(<AdvancedCueSheetShowcase />);
    await ready();
    pause();
    const video = screen.getByLabelText('Offline-rendered Ink / Signal MP4') as HTMLVideoElement;
    Object.defineProperties(video, {
      readyState: { configurable: true, value: 2 },
      duration: { configurable: true, value: 24 },
    });
    fireEvent.loadedMetadata(video);
    fireEvent.click(screen.getByRole('button', { name: 'Seek to LOCK' }));
    expect(video.currentTime).toBeCloseTo(168.25 / 24);
    expect(screen.getByLabelText('Offline MP4 frame').textContent).toBe('—');
    expect(screen.getByLabelText('Frame sync delta').textContent).toBe('WAIT');
    act(() => callback?.(0, { mediaTime: 20 / 24 } as VideoFrameCallbackMetadata));
    expect(screen.getByLabelText('Offline MP4 frame').textContent).toBe('020');
    expect(screen.getByLabelText('Frame sync delta').textContent).toContain('-148F');
    act(() => callback?.(0, { mediaTime: 168 / 24 } as VideoFrameCallbackMetadata));
    expect(screen.getByLabelText('Offline MP4 frame').textContent).toBe('168');
    expect(screen.getByLabelText('Frame sync delta').textContent).toBe('+0F');
    view.unmount();
    expect(cancel).toHaveBeenCalledWith(7);
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback');
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback');
  });
  test('suspends the shared clock when the document becomes hidden', async () => {
    render(<AdvancedCueSheetShowcase />);
    await ready();
    act(() => frameDriver.advance(1000));
    const svg = screen.getByTestId('advanced-cue-stage').querySelector('svg')!;
    expect(svg.dataset.frame).toBe('24');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    act(() => frameDriver.advance(1000));
    expect(svg.dataset.frame).toBe('24');
    expect(screen.getByRole('button', { name: 'Play both' })).toBeTruthy();
  });
  test('uses a fresh nonplaying transport in render-only mode and removes its API on unmount', () => {
    window.history.replaceState({}, '', '/svg-cue-sheet?render=1');
    const view = render(<AdvancedCueSheetShowcase />);
    try {
      expect(window.__dhaakonCueRender?.frames).toBe(576);
      expect(screen.queryByLabelText('Offline-rendered Ink / Signal MP4')).toBeNull();
      act(() => window.__dhaakonCueRender?.seek(396));
      expect(screen.getByRole('img').getAttribute('data-frame')).toBe('396');
      act(() => frameDriver.advance(1000));
      expect(screen.getByRole('img').getAttribute('data-frame')).toBe('396');
      expect(() => window.__dhaakonCueRender?.seek(576)).toThrow(/encoded range/);
    } finally {
      view.unmount();
      window.history.replaceState({}, '', '/');
    }
    expect(window.__dhaakonCueRender).toBeUndefined();
  });
  test('rejects duplicate renderer writers without destroying the current composition', async () => {
    render(<AdvancedCueSheetShowcase />);
    await ready();
    pause();
    fireEvent.click(screen.getByRole('button', { name: 'Seek to LOCK' }));
    const edited = editorSheet();
    edited.items[0].items!.push(edited.items[0].items![0]);
    fireEvent.change(screen.getByLabelText('Editable source'), {
      target: { value: JSON.stringify(edited) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validate + load' }));
    expect(screen.getByRole('alert').textContent).toContain('exactly one writer');
    expect(screen.getByTestId('advanced-cue-ink').getAttribute('opacity')).toBe('1');
  });
});
