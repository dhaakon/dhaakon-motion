import React, { useEffect } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from '../../docs/src/App';
import { navigate } from '../../docs/src/router';
import { DemoViewport } from '../../docs/src/components/DemoViewport';

const log = vi.hoisted(() => [] as string[]);
vi.mock('../../docs/src/routes', () => ({ routes: [
  { path: '/', title: 'Overview', label: 'Overview', group: 'Start', description: 'Static overview', source: 'src/index.ts', test: 'tests/dist', component: () => <p>Home page</p> },
  { path: '/transport', title: 'Transport', label: 'Transport', group: 'Features', description: 'Time controls', source: 'src/transport.ts', test: 'tests/core/transport.test.ts', component: () => {
    useEffect(() => { log.push('mounted'); return () => { log.push('disposed'); }; }, []);
    return <p>Transport page</p>;
  } },
] }));

beforeEach(() => {
  log.length = 0;
  window.history.replaceState({}, '', '/');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('navigation mounts only the selected page and disposes it when leaving', () => {
  render(<App version="test"/>);
  expect(log).toEqual([]);
  fireEvent.click(screen.getByRole('link', { name: 'Transport ↗' }));
  expect(screen.getByText('Transport page')).toBeTruthy();
  expect(document.title).toBe('Transport — Dhaakon Motion');
  expect(log).toEqual(['mounted']);
  act(() => navigate('/'));
  expect(screen.queryByText('Transport page')).toBeNull();
  expect(log).toEqual(['mounted', 'disposed']);
});

test('legacy links canonicalize, and unknown routes offer recovery', () => {
  window.history.replaceState({}, '', '/#transport');
  render(<App version="test"/>);
  expect(window.location.pathname).toBe('/transport');
  expect(window.location.hash).toBe('');
  act(() => navigate('/missing'));
  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('off the timeline');
  expect(log.at(-1)).toBe('disposed');
});

test('viewport suspension cancels the visual owner and disconnects its observer', () => {
  let intersect!: (entries: Array<{ isIntersecting: boolean }>) => void;
  const disconnect = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof intersect) { intersect = callback; }
    observe() {}
    disconnect = disconnect;
  });
  function Visual() {
    useEffect(() => { log.push('mounted'); return () => { log.push('disposed'); }; }, []);
    return <canvas data-testid="visual"/>;
  }
  const view = render(<DemoViewport label="test"><Visual/></DemoViewport>);
  expect(log).toEqual([]);
  act(() => intersect([{ isIntersecting: true }]));
  expect(log).toEqual(['mounted']);
  fireEvent.click(screen.getByRole('button', { name: 'Suspend demo' }));
  expect(log).toEqual(['mounted', 'disposed']);
  fireEvent.click(screen.getByRole('button', { name: 'Start demo' }));
  act(() => intersect([{ isIntersecting: false }]));
  expect(log).toEqual(['mounted', 'disposed', 'mounted', 'disposed']);
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});

test('continuous visuals require explicit start under reduced motion', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const view = render(<DemoViewport label="reduced"><canvas data-testid="visual"/></DemoViewport>);
  expect(view.queryByTestId('visual')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Start demo' }));
  expect(view.getByTestId('visual')).toBeTruthy();
});
