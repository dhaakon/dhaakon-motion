import React, { StrictMode, Suspense, useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import {
  MotionValue, Timeline, Transport as CoreTransport,
  type MotionValueShape, type RenderContext,
} from '@dhaakon/motion';
import { Transport, useTransport } from '@dhaakon/motion/react';
import { createTestScheduler } from '@dhaakon/motion/testing';
import {
  compileTracks, createCompiledPlayer, createJsEvaluator,
  type CompiledPlayer, type NumericEvaluator, type WasmRuntime,
} from '@dhaakon/motion/compiled';

/**
 * Test-only runtime injection for ownership accounting, not a Wasm implementation.
 * Evaluators retain their truthful JS backend label; real Wasm/ABI parity is tested
 * separately. Creating this factory performs no runtime or evaluator acquisition.
 */
function countedRuntimeFactory() {
  const activeEvaluators = new Set<NumericEvaluator>();
  const activeRuntimes = new Set<WasmRuntime>();
  const evaluatorCountsAtRuntimeDisposal: number[] = [];
  let evaluatorCreates = 0;
  let evaluatorDisposals = 0;
  let runtimeDisposals = 0;
  const createRuntime = vi.fn((): WasmRuntime => {
    const owned = new Set<NumericEvaluator>();
    let disposed = false;
    const runtime: WasmRuntime = {
      backend: 'wasm', // Interface-only mock: its numeric work is actually JS.
      abiVersion: 1,
      createEvaluator(plan) {
        if (disposed) throw new Error('Mock runtime is disposed');
        const evaluator = createJsEvaluator(plan);
        const tracked: NumericEvaluator = {
          backend: evaluator.backend,
          length: evaluator.length,
          sample: (ms) => evaluator.sample(ms),
          dispose() {
            if (!owned.delete(tracked)) return;
            evaluator.dispose();
            activeEvaluators.delete(tracked);
            evaluatorDisposals++;
          },
        };
        owned.add(tracked);
        activeEvaluators.add(tracked);
        evaluatorCreates++;
        return tracked;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        evaluatorCountsAtRuntimeDisposal.push(owned.size);
        for (const evaluator of owned) evaluator.dispose();
        activeRuntimes.delete(runtime);
        runtimeDisposals++;
      },
    };
    activeRuntimes.add(runtime);
    return runtime;
  });
  return {
    createRuntime,
    activeEvaluators,
    activeRuntimes,
    evaluatorCountsAtRuntimeDisposal,
    get evaluatorCreates() { return evaluatorCreates; },
    get evaluatorDisposals() { return evaluatorDisposals; },
    get runtimeDisposals() { return runtimeDisposals; },
  };
}

function numericPlan() {
  return compileTracks([{
    id: 'x',
    keyframes: [{ at: 0, value: 0 }, { at: 1000, value: 100 }],
    easing: 'linear',
  }]);
}

test('StrictMode effect ownership releases every compiled player and counted evaluator', () => {
  const { driver, scheduler } = createTestScheduler();
  const plan = numericPlan();
  const counted = countedRuntimeFactory();
  const activePlayers = new Set<CompiledPlayer>();
  // Historical references are test probes, not active engine ownership or a GC claim.
  const setups: Array<{ player: CompiledPlayer; transport: CoreTransport }> = [];
  const lifecycle: string[] = [];
  const value = new MotionValue<number>(0);
  const binding = vi.fn((next: MotionValueShape, context?: RenderContext) => {
    expect(context?.transport).toBe(setups.at(-1)!.transport);
    value.set(next as number);
  });

  function EffectOwnedPlayer() {
    const transport = useTransport();
    useEffect(() => {
      const runtime = counted.createRuntime();
      const player = createCompiledPlayer(plan, {
        backend: 'wasm', runtime, bindings: { x: binding },
      });
      transport.root.add(player);
      activePlayers.add(player);
      setups.push({ player, transport });
      lifecycle.push('setup');
      transport.play();
      return () => {
        transport.pause();
        transport.root.remove(player);
        try {
          player.dispose();
        } finally {
          runtime.dispose();
          activePlayers.delete(player);
          lifecycle.push('cleanup');
        }
      };
    }, [transport]);
    return null;
  }

  const view = render(
    <StrictMode>
      <Transport scheduler={scheduler} frameRate={24} respectReducedMotion={false}>
        <EffectOwnedPlayer />
      </Transport>
    </StrictMode>,
  );
  expect(lifecycle).toEqual(['setup', 'cleanup', 'setup']);
  expect(counted.createRuntime).toHaveBeenCalledTimes(2);
  expect(counted.evaluatorCreates).toBe(2);
  expect(counted.evaluatorDisposals).toBe(1);
  expect(counted.runtimeDisposals).toBe(1);
  expect(activePlayers.size).toBe(1);
  expect(counted.activeEvaluators.size).toBe(1);
  expect(counted.activeRuntimes.size).toBe(1);
  expect(scheduler.size).toBe(1);

  const [first, current] = setups;
  expect(current.transport).toBe(first.transport);
  expect(current.transport).toBeInstanceOf(CoreTransport);
  expect(current.transport.root).toBeInstanceOf(Timeline);
  expect(current.transport.root.rootTransport).toBe(current.transport);
  expect(current.transport.root.items.map(({ item }) => item)).toEqual([current.player]);
  expect(current.transport.root.items[0].item).toBe(current.player);
  expect(current.player).not.toBe(first.player);
  expect(() => first.player.sampleAt(0)).toThrow(/disposed/);
  expect(current.player.diagnostics.engine).toBe('js'); // This is a counted JS test double.
  expect(binding).not.toHaveBeenCalled();

  act(() => { driver.advance(500); });
  expect(binding).toHaveBeenCalledTimes(1);
  expect(binding.mock.calls[0][0]).toBe(50);
  expect(binding.mock.calls[0][1]?.transport).toBe(current.transport);
  expect(binding.mock.calls[0][1]?.frame?.frame).toBe(12);
  expect(value.get()).toBe(50);
  expect(current.player.get('x')).toBe(50);

  act(() => { current.transport.seek(750); });
  expect(binding).toHaveBeenCalledTimes(2);
  expect(binding.mock.calls[1][0]).toBe(75);
  expect(binding.mock.calls[1][1]?.transport).toBe(current.transport);
  expect(current.transport.root.items[0].item).toBe(current.player);
  expect(value.get()).toBe(75);

  view.unmount();
  expect(lifecycle).toEqual(['setup', 'cleanup', 'setup', 'cleanup']);
  expect(current.transport.root.items).toHaveLength(0);
  expect(activePlayers.size).toBe(0);
  expect(counted.activeEvaluators.size).toBe(0);
  expect(counted.activeRuntimes.size).toBe(0);
  expect(counted.evaluatorDisposals).toBe(2);
  expect(counted.runtimeDisposals).toBe(2);
  // Player disposal, not the runtime's fallback cleanup, released both evaluators.
  expect(counted.evaluatorCountsAtRuntimeDisposal).toEqual([0, 0]);
  expect(scheduler.size).toBe(0);
  expect(() => current.player.sampleAt(0)).toThrow(/disposed/);
  expect(current.player.get('x')).toBeUndefined();
  act(() => { driver.advance(1000); });
  expect(binding).toHaveBeenCalledTimes(2);
  first.player.dispose();
  current.player.dispose();
  expect(counted.evaluatorDisposals).toBe(2);
});

test('abandoned Suspense rendering never acquires an effect-owned runtime or evaluator', async () => {
  const { scheduler } = createTestScheduler();
  const plan = numericPlan();
  const counted = countedRuntimeFactory();
  let renderAttempts = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });

  function SuspendedOwner(): React.ReactNode {
    const transport = useTransport();
    useEffect(() => {
      const runtime = counted.createRuntime();
      const player = createCompiledPlayer(plan, { backend: 'wasm', runtime });
      transport.root.add(player);
      transport.play();
      return () => {
        transport.pause();
        transport.root.remove(player);
        try { player.dispose(); } finally { runtime.dispose(); }
      };
    }, [transport]);
    renderAttempts++;
    throw pending;
  }

  const view = render(
    <StrictMode>
      <Suspense fallback={<p>Waiting for scene</p>}>
        <Transport scheduler={scheduler} respectReducedMotion={false}>
          <SuspendedOwner />
        </Transport>
      </Suspense>
    </StrictMode>,
  );
  expect(view.getByText('Waiting for scene')).toBeTruthy();
  expect(renderAttempts).toBeGreaterThan(0); // The suspended render really ran.
  expect(counted.createRuntime).not.toHaveBeenCalled();
  expect(counted.evaluatorCreates).toBe(0);
  expect(scheduler.size).toBe(0);

  view.rerender(<StrictMode><p>Scene abandoned</p></StrictMode>);
  await act(async () => { release(); await pending; });
  expect(view.getByText('Scene abandoned')).toBeTruthy();
  view.unmount();
  expect(counted.createRuntime).not.toHaveBeenCalled();
  expect(counted.evaluatorCreates).toBe(0);
  expect(counted.evaluatorDisposals).toBe(0);
  expect(counted.runtimeDisposals).toBe(0);
  expect(counted.activeEvaluators.size).toBe(0);
  expect(counted.activeRuntimes.size).toBe(0);
  expect(scheduler.size).toBe(0);
});
