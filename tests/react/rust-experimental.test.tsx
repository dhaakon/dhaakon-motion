import React, { StrictMode, type ReactNode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { WasmRuntime } from '@dhaakon/motion/compiled';

const doubles = vi.hoisted(() => ({ load: vi.fn(), verify: vi.fn() }));
vi.mock('../../docs/src/labs/rust/runtime', () => ({
  loadExperimentalRuntime: doubles.load,
}));
vi.mock('../../docs/src/labs/rust/verification', () => ({ verifyScore: doubles.verify }));
vi.mock('../../docs/src/components/DemoViewport', () => ({
  DemoViewport: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('../../docs/src/labs/rust/ScoreLab', () => ({
  ScoreLab: ({ runtime }: { runtime: WasmRuntime | null }) => (
    <div data-testid="ownership-score" data-runtime={runtime ? 'provided' : 'absent'} />
  ),
}));
vi.mock('../../docs/src/labs/rust/BatchLab', () => ({
  BatchLab: ({ runtime }: { runtime: WasmRuntime | null }) => (
    <div data-testid="ownership-batch" data-runtime={runtime ? 'provided' : 'absent'} />
  ),
}));
vi.mock('../../docs/src/labs/rust/score', () => ({
  createScoreInputs: () => [
    {
      id: 'opacity',
      keyframes: [
        { at: 0, value: 0 },
        { at: 1000, value: 1 },
      ],
    },
  ],
  SCORE_FPS: 60,
  SCORE_FRAMES: 720,
}));

import RustExperimentalPage from '../../docs/src/pages/RustExperimentalPage';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

// Opaque ownership instrumentation only. It never evaluates numeric state and
// cannot serve as evidence of actual Wasm execution; the Chrome verifier does.
function ownedRuntime(): WasmRuntime {
  return {
    backend: 'wasm',
    abiVersion: 1,
    createEvaluator: vi.fn(() => {
      throw new Error('Ownership double does not evaluate');
    }),
    dispose: vi.fn(),
  };
}

beforeEach(() => {
  doubles.load.mockReset();
  doubles.verify.mockReset();
});

test('StrictMode starts with JS, acquires only on explicit input and disposes its runtime', async () => {
  const pending = deferred<WasmRuntime>();
  doubles.load.mockReturnValue(pending.promise);
  const runtime = ownedRuntime();
  const view = render(
    <StrictMode>
      <RustExperimentalPage />
    </StrictMode>,
  );
  expect(doubles.load).not.toHaveBeenCalled();
  expect(screen.getByTestId('rust-runtime').dataset.status).toBe('idle');
  expect(screen.getByTestId('ownership-score').dataset.runtime).toBe('absent');
  expect(screen.getByTestId('ownership-batch').dataset.runtime).toBe('absent');
  fireEvent.click(screen.getByTestId('rust-load'));
  fireEvent.click(screen.getByTestId('rust-load'));
  expect(doubles.load).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('rust-runtime').dataset.status).toBe('loading');
  await act(async () => {
    pending.resolve(runtime);
  });
  expect(screen.getByTestId('rust-runtime').dataset.status).toBe('ready');
  expect(screen.getByTestId('ownership-score').dataset.runtime).toBe('provided');
  expect(screen.getByTestId('ownership-batch').dataset.runtime).toBe('provided');
  expect(runtime.dispose).not.toHaveBeenCalled();
  view.unmount();
  expect(runtime.dispose).toHaveBeenCalledTimes(1);
});

test('a runtime resolving after route teardown is disposed without publishing to React', async () => {
  const pending = deferred<WasmRuntime>();
  const runtime = ownedRuntime();
  doubles.load.mockReturnValue(pending.promise);
  const view = render(<RustExperimentalPage />);
  fireEvent.click(screen.getByTestId('rust-load'));
  view.unmount();
  await act(async () => {
    pending.resolve(runtime);
  });
  expect(runtime.dispose).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('rust-runtime')).toBeNull();
});

test('failed loading leaves JS available and an explicit retry can acquire a runtime', async () => {
  const failed = deferred<WasmRuntime>();
  const retried = deferred<WasmRuntime>();
  const runtime = ownedRuntime();
  doubles.load.mockReturnValueOnce(failed.promise).mockReturnValueOnce(retried.promise);
  const view = render(<RustExperimentalPage />);
  fireEvent.click(screen.getByTestId('rust-load'));
  await act(async () => {
    failed.reject(new Error('Binary unavailable'));
  });
  expect(screen.getByTestId('rust-runtime').dataset.status).toBe('error');
  expect(screen.getByRole('alert').textContent).toContain('Binary unavailable');
  expect(screen.getByTestId('ownership-score').dataset.runtime).toBe('absent');
  expect(screen.getByTestId('ownership-batch').dataset.runtime).toBe('absent');
  fireEvent.click(screen.getByTestId('rust-load'));
  await act(async () => {
    retried.resolve(runtime);
  });
  expect(doubles.load).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('rust-runtime').dataset.status).toBe('ready');
  expect(screen.queryByRole('alert')).toBeNull();
  view.unmount();
  expect(runtime.dispose).toHaveBeenCalledTimes(1);
});

test('route teardown aborts an in-flight verification before disposing its owned runtime', async () => {
  const runtime = ownedRuntime();
  doubles.load.mockResolvedValue(runtime);
  let signal!: AbortSignal;
  const stop = vi.fn();
  doubles.verify.mockImplementation((_plan, _runtime, _frames, _fps, nextSignal) => {
    signal = nextSignal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener(
        'abort',
        () => {
          stop();
          expect(runtime.dispose).not.toHaveBeenCalled();
          reject(signal.reason);
        },
        { once: true },
      );
    });
  });
  const view = render(<RustExperimentalPage />);
  await act(async () => {
    fireEvent.click(screen.getByTestId('rust-load'));
  });
  fireEvent.click(screen.getByTestId('rust-verify'));
  expect(doubles.verify).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('rust-verification').dataset.status).toBe('running');
  await act(async () => {
    view.unmount();
  });
  expect(signal.aborted).toBe(true);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(runtime.dispose).toHaveBeenCalledTimes(1);
});

test('page shows completed comparison counts and numerical failures without claiming a match', async () => {
  const runtime = ownedRuntime();
  doubles.load.mockResolvedValue(runtime);
  doubles.verify.mockResolvedValue({
    comparisons: 2160,
    samples: 2160,
    maxError: 0.1,
    maxScaledError: 0.1,
    passed: false,
  });
  const view = render(<RustExperimentalPage />);
  await act(async () => {
    fireEvent.click(screen.getByTestId('rust-load'));
  });
  await act(async () => {
    fireEvent.click(screen.getByTestId('rust-verify'));
  });
  const result = screen.getByTestId('rust-verification');
  expect(result.dataset.status).toBe('failed');
  expect(result.dataset.comparisons).toBe('2160');
  expect(result.dataset.maxError).toBe('0.1');
  expect(result.textContent).toContain('CHECK FAILED');
  view.unmount();
  expect(runtime.dispose).toHaveBeenCalledTimes(1);
});
