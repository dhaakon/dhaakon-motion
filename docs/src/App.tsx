import {
  Component,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from 'react';
import { Badge } from '@dhaakon/ui';
import { MotionConfig } from '@dhaakon/motion/react';
import { routes } from './routes';
import { navigate, usePath } from './router';

class PageErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="route-message" role="alert">
        <h2>This demo could not load.</h2>
        <p>Your browser may not support this renderer, or the site may have updated.</p>
        <button onClick={() => window.location.reload()}>Reload this page</button>
        <a href="/">Return to overview</a>
      </div>
    ) : (
      this.props.children
    );
  }
}

export function App({ version }: { version: string }) {
  const path = usePath();
  const route = routes.find((item) => item.path === path);
  const [menuOpen, setMenuOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    document.title = (route?.label ?? 'Page not found') + ' — Dhaakon Motion';
    setMenuOpen(false);
    // Canonicalize legacy section bookmarks without adding a history entry.
    if (window.location.pathname === '/' && path !== '/')
      navigate(path + window.location.search, true);
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (!first.current) heading.current?.focus({ preventScroll: true });
    first.current = false;
  }, [path, route]);
  const follow = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = (event.target as Element).closest?.('a');
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self'))
      return;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return;
    if (url.pathname === window.location.pathname && url.hash) return;
    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
  };
  const Page = route?.component;
  const groups = [...new Set(routes.map((item) => item.group))];
  return (
    <MotionConfig transition={{ duration: 360, easing: 'dhaakon' }}>
      <div className="docs-app" onClick={follow}>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <header className="site-head">
          <a className="wordmark" href="/">
            <i>◇</i> DHAAKON / MOTION
          </a>
          <span className="head-caption">THE FEATURE ATLAS</span>
          <Badge tone="accent">v{version}</Badge>
          <button
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="feature-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Close' : 'Explore'} ☰
          </button>
        </header>
        <div className="docs-layout">
          <aside id="feature-navigation" className={menuOpen ? 'docs-nav is-open' : 'docs-nav'}>
            <nav aria-label="Features">
              {groups.map((group) => (
                <div className="nav-group" key={group}>
                  <h2>{group}</h2>
                  {routes
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <a
                        key={item.path}
                        href={item.path}
                        aria-current={path === item.path ? 'page' : undefined}
                      >
                        {item.label}
                        <span>↗</span>
                      </a>
                    ))}
                </div>
              ))}
            </nav>
            <p>
              One feature at a time.
              <br />
              Only this page is mounted.
            </p>
          </aside>
          <main id="content" className="docs-content">
            <header className="page-heading">
              <p className="eyebrow">
                [ {route?.group ?? '404'} / {route?.label ?? 'NOT FOUND'} ]
              </p>
              <h1 ref={heading} tabIndex={-1}>
                {route?.title ?? 'This page is off the timeline.'}
              </h1>
              <p className="page-description">
                {route?.description ??
                  'Choose a feature from the navigation or return to the overview.'}
              </p>
              {route && (
                <details className="page-source">
                  <summary>Implementation & tests</summary>
                  <code>{route.source}</code>
                  <code>{route.test}</code>
                </details>
              )}
            </header>
            <PageErrorBoundary key={path}>
              <Suspense
                fallback={
                  <div className="route-message" role="status">
                    Loading this feature…
                  </div>
                }
              >
                {Page ? <Page /> : <a href="/">Return to overview ↗</a>}
              </Suspense>
            </PageErrorBoundary>
            <footer>
              <span>◇ DHAAKON MOTION</span>
              <span>MIT · TYPESCRIPT · REACT</span>
              <a href="http://dhaakon-ubuntu:21724/dhaakon-ubuntu/dhaakon-motion">SOURCE ↗</a>
            </footer>
          </main>
        </div>
      </div>
    </MotionConfig>
  );
}
