import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Opt-in for continuous visuals, not editors: leaving the viewport resets the demo. */
export function DemoViewport({
  children,
  label,
  height = 360,
}: {
  children: ReactNode;
  label: string;
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(true);
  const [enabled, setEnabled] = useState(
    () => !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const [reserved, setReserved] = useState(height);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const visibility = () => setVisible(!document.hidden);
    visibility();
    document.addEventListener('visibilitychange', visibility);
    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => {
              if (!entry.isIntersecting && node.clientHeight) setReserved(node.clientHeight);
              setNear(entry.isIntersecting);
            },
            { rootMargin: '160px 0px' },
          )
        : null;
    if (observer) observer.observe(node);
    else setNear(true);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const active = near && visible && enabled;
  return (
    <div className="demo-viewport" ref={host} style={{ minHeight: reserved }}>
      <div className="demo-runtime">
        <span>
          {active ? 'LIVE' : 'SUSPENDED'} / {label}
        </span>
        <button onClick={() => setEnabled((value) => !value)}>
          {enabled ? 'Suspend demo' : 'Start demo'}
        </button>
      </div>
      {active ? (
        children
      ) : (
        <div className="demo-placeholder">
          {enabled ? 'This visual starts near the viewport.' : 'Demo suspended. Start to play.'}
          <small>Visuals reset when suspended or out of view.</small>
        </div>
      )}
    </div>
  );
}
