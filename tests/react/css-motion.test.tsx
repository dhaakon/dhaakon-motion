import React, { StrictMode, createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Card, tokens } from '@dhaakon/ui';
import { createCssAnimator, createCssMotionTokens } from '@dhaakon/motion/css';
import {
  CssMotionConfig,
  MotionConfig,
  createCssMotionComponent,
  cssMotion,
} from '@dhaakon/motion/react';
import { CssUiLab } from '../../docs/src/labs/CssUiLab';

// Controlled native-animation stand-in: tests ownership and publication, not browser interpolation.
class NativeAnimation {
  resolve!: () => void;
  reject!: (reason: Error) => void;
  finished = new Promise<void>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
  cancel = vi.fn(() => this.reject(new Error('cancelled')));
}
let native: NativeAnimation[];
let animate: ReturnType<typeof vi.fn>;
const originalAnimate = Element.prototype.animate;
beforeEach(() => {
  native = [];
  animate = vi.fn(() => {
    const next = new NativeAnimation();
    native.push(next);
    return next;
  });
  Element.prototype.animate = animate as unknown as Element['animate'];
});
afterEach(() => {
  if (originalAnimate) Element.prototype.animate = originalAnimate;
  else delete (Element.prototype as Partial<Element>).animate;
  vi.restoreAllMocks();
});
const flush = async () => {
  await act(async () => {});
};

test('initial=false applies final CSS without claiming reduced motion', async () => {
  const complete = vi.fn();
  render(
    <MotionConfig reducedMotion="never">
      <cssMotion.div initial={false} animate={{ opacity: 1 }} onMotionComplete={complete} />
    </MotionConfig>,
  );
  await flush();
  expect(animate).not.toHaveBeenCalled();
  expect(complete).toHaveBeenCalledWith({
    status: 'finished',
    backend: 'instant',
    reason: 'immediate',
  });
});

test('tokens are derived from the actual dhaakon-ui exports, with CSS seconds accepted', () => {
  const result = createCssMotionTokens(tokens.motion);
  expect(result['surface.enter']).toEqual({ duration: 360, easing: tokens.motion.ease });
  expect(result['surface.exit'].duration).toBe(120);
  expect(createCssMotionTokens({ ...tokens.motion, duration: '.2s' }).feedback.duration).toBe(200);
  expect(() => createCssMotionTokens({ ...tokens.motion, duration: 'var(--duration)' })).toThrow();
  expect(Object.isFrozen(result.feedback)).toBe(true);
});

test('native animator preserves CSS strings and releases its effect after final publication', async () => {
  const element = document.createElement('div');
  document.body.append(element);
  element.style.opacity = '0.25';
  const animator = createCssAnimator(element);
  const playback = animator.animate(
    { opacity: 1, transform: 'translateX(calc(100% - 12px))', '--signal': '#fff' },
    { duration: 360 },
  );
  expect(animate).toHaveBeenCalledTimes(1);
  expect(animate.mock.calls[0][0][1].transform).toBe('translateX(calc(100% - 12px))');
  expect(animate.mock.calls[0][0][1]['--signal']).toBe('#fff');
  native[0].resolve();
  expect(await playback.finished).toEqual({ status: 'finished', backend: 'waapi' });
  expect(element.style.opacity).toBe('1');
  expect(native[0].cancel).toHaveBeenCalledOnce();
  animator.dispose();
  expect(element.style.opacity).toBe('0.25');
  expect(element.style.transform).toBe('');
  element.remove();
});

test('retarget starts from the current computed frame, not the previous target', async () => {
  const element = document.createElement('div');
  element.style.opacity = '0';
  const animator = createCssAnimator(element);
  const first = animator.animate({ opacity: 1 });
  const realComputed = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((node) => {
    const computed = realComputed(node);
    return {
      getPropertyValue: (property: string) =>
        property === 'opacity' ? '0.42' : computed.getPropertyValue(property),
    } as CSSStyleDeclaration;
  });
  const second = animator.animate({ opacity: 0 });
  expect(animate.mock.calls[1][0][0].opacity).toBe('0.42');
  expect(await first.finished).toEqual({ status: 'cancelled', backend: 'waapi' });
  native[0].resolve();
  native[1].resolve();
  await second.finished;
  expect(element.style.opacity).toBe('0');
  animator.dispose();
});

test('invalid requests do not disturb a good take; property ownership is exclusive', async () => {
  const element = document.createElement('div');
  const animator = createCssAnimator(element);
  const playback = animator.animate({ opacity: 1 });
  expect(() => createCssAnimator(element)).toThrow(/already/);
  expect(() => animator.animate({ opacity: NaN })).toThrow();
  expect(() => animator.animate({ opacity: 0 }, { duration: -1 })).toThrow();
  expect(() => animator.animate({ opacity: 0 }, { easing: 'var(--ease)' })).toThrow();
  expect(() => animator.animate({ transition: 'all 1s' })).toThrow();
  expect(() => animator.animate({ all: 'initial' })).toThrow();
  expect(native[0].cancel).not.toHaveBeenCalled();
  animator.dispose();
  expect((await playback.finished).status).toBe('cancelled');
  expect(() => animator.animate({ opacity: 0 })).toThrow(/disposed/);
  createCssAnimator(element).dispose();
});

test('omitted properties are restored; missing or rejected WAAPI applies honest immediate CSS', async () => {
  const element = document.createElement('div');
  element.style.color = 'red';
  const animator = createCssAnimator(element);
  animator.set({ color: 'blue', opacity: 0 });
  animator.set({ opacity: 1 });
  expect(element.style.color).toBe('red');
  delete (Element.prototype as Partial<Element>).animate;
  const missing = animator.animate({ opacity: 0 });
  expect((await missing.finished).reason).toMatch(/unavailable/);
  expect(element.style.opacity).toBe('0');
  Element.prototype.animate = (() => {
    throw new Error('not supported');
  }) as Element['animate'];
  const rejected = animator.animate({ opacity: 1 });
  expect(rejected.backend).toBe('instant');
  expect((await rejected.finished).reason).toMatch(/rejected/);
  animator.dispose();
});

test('reduced motion settles an interrupted animation immediately and suppresses delay', async () => {
  const element = document.createElement('div');
  const animator = createCssAnimator(element);
  const first = animator.animate({ opacity: 0 });
  const reduced = animator.animate({ opacity: 1 }, { reducedMotion: true, delay: 1000 });
  expect((await first.finished).status).toBe('cancelled');
  expect((await reduced.finished).reason).toBe('reduced-motion');
  expect(animate).toHaveBeenCalledTimes(1);
  expect(element.style.opacity).toBe('1');
  animator.dispose();
});

test('StrictMode owns one live animation and uses shared tokens; no animation prop reaches DOM', async () => {
  const ref = createRef<HTMLElement>();
  const complete = vi.fn();
  const view = render(
    <StrictMode>
      <CssMotionConfig tokens={createCssMotionTokens(tokens.motion)}>
        <cssMotion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition="surface.enter"
          onMotionComplete={complete}
          data-testid="surface"
        />
      </CssMotionConfig>
    </StrictMode>,
  );
  expect(animate).toHaveBeenCalledTimes(2);
  expect(native[0].cancel).toHaveBeenCalledOnce();
  expect(animate.mock.calls[1][1].duration).toBe(360);
  expect(ref.current).toBe(screen.getByTestId('surface'));
  expect(ref.current?.hasAttribute('animate')).toBe(false);
  await act(async () => {
    native[1].resolve();
  });
  expect(complete).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(ref.current).toBeNull();
  expect(native[1].cancel).toHaveBeenCalledOnce();
});

test('rapid variant reversal invalidates stale completion; callback replacement does not restart', async () => {
  const variants = { open: { opacity: 1 }, closed: { opacity: 0 } };
  const oldComplete = vi.fn(),
    latest = vi.fn();
  const view = render(
    <cssMotion.div
      initial="closed"
      variants={variants}
      animate="open"
      onMotionComplete={oldComplete}
    />,
  );
  view.rerender(
    <cssMotion.div
      initial="closed"
      variants={variants}
      animate="closed"
      onMotionComplete={latest}
    />,
  );
  expect(animate).toHaveBeenCalledTimes(2);
  await act(async () => {
    native[0].resolve();
    native[1].resolve();
  });
  expect(oldComplete).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledOnce();
  view.rerender(
    <cssMotion.div
      initial="closed"
      variants={variants}
      animate="closed"
      onMotionComplete={() => {}}
    />,
  );
  expect(animate).toHaveBeenCalledTimes(2);
});

test('existing MotionConfig reduced-motion policy also governs cssMotion and forwarded UI components', async () => {
  const MotionCard = createCssMotionComponent(Card);
  const ref = createRef<HTMLElement>();
  const view = render(
    <MotionConfig reducedMotion="always">
      <MotionCard ref={ref} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        Content
      </MotionCard>
    </MotionConfig>,
  );
  await flush();
  expect(animate).not.toHaveBeenCalled();
  expect(ref.current?.style.opacity).toBe('1');
  expect(ref.current?.textContent).toBe('Content');
  view.unmount();
});

test('disclosure exits with immediate aria/inert semantics, restores focus and retains input', async () => {
  const view = render(<CssUiLab />);
  await flush();
  const trigger = screen.getByTestId('css-ui-trigger');
  const panel = screen.getByTestId('css-ui-panel');
  expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
  expect(panel.hidden).toBe(true);
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(panel.hidden).toBe(false);
  expect(panel.hasAttribute('inert')).toBe(false);
  await act(async () => {
    native.at(-1)!.resolve();
  });
  const input = screen.getByLabelText('Session name') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'Retained session' } });
  input.focus();
  fireEvent.click(screen.getByTestId('css-ui-close-inside'));
  expect(document.activeElement).toBe(trigger);
  expect(panel.getAttribute('aria-hidden')).toBe('true');
  expect(panel.hasAttribute('inert')).toBe(true);
  expect(panel.hidden).toBe(false);
  await act(async () => {
    native.at(-1)!.resolve();
  });
  expect(panel.hidden).toBe(true);
  fireEvent.click(trigger);
  expect(input.value).toBe('Retained session');
  const current = native.at(-1)!;
  view.unmount();
  expect(current.cancel).toHaveBeenCalledOnce();
});

test('disclosure IDs are instance-safe and forced reduced motion does not hide essential content', async () => {
  const view = render(
    <>
      <CssUiLab />
      <CssUiLab />
    </>,
  );
  await flush();
  const panels = screen.getAllByTestId('css-ui-panel');
  expect(panels[0].id).not.toBe(panels[1].id);
  fireEvent.click(screen.getAllByTestId('css-ui-reduce')[0]);
  fireEvent.click(screen.getAllByTestId('css-ui-trigger')[0]);
  await flush();
  expect(panels[0].hidden).toBe(false);
  expect(panels[0].style.opacity).toBe('1');
  expect(native).toHaveLength(0);
  view.unmount();
});
