import { useSyncExternalStore } from 'react';

export const legacyRoutes: Record<string, string> = {
  top: '/',
  profile: '/',
  why: '/',
  playground: '/tweens',
  react: '/react',
  compositions: '/timelines',
  three: '/three',
  transport: '/transport',
  gestures: '/gestures',
  api: '/api',
  'json-svg-cue-sheet': '/svg-cue-sheet',
};

export function resolveLocation(pathname: string, hash = '') {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path !== '/') return path;
  try {
    return legacyRoutes[decodeURIComponent(hash.slice(1))] ?? path;
  } catch {
    return path;
  }
}

export function navigate(href: string, replace = false) {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return;
  window.history[replace ? 'replaceState' : 'pushState'](
    {},
    '',
    url.pathname + url.search + url.hash,
  );
  window.dispatchEvent(new Event('motion:navigate'));
}

function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener);
  window.addEventListener('hashchange', listener);
  window.addEventListener('motion:navigate', listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener('hashchange', listener);
    window.removeEventListener('motion:navigate', listener);
  };
}

export function usePath() {
  return useSyncExternalStore(
    subscribe,
    () => resolveLocation(window.location.pathname, window.location.hash),
    () => '/',
  );
}
