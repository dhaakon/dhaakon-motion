import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@dhaakon/ui';

export const control = (label: string, action: () => void, accent = false) => (
  <Button variant={accent ? 'accent' : 'outline'} size="sm" onClick={action}>
    {label}
  </Button>
);

export function Code({ children }: { children: string }) {
  const [status, setStatus] = useState('COPY');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      if (!mounted.current) return;
      setStatus('COPIED');
    } catch {
      if (mounted.current) setStatus('SELECT TEXT TO COPY');
    }
    if (!mounted.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('COPY'), 1800);
  };
  return (
    <div className="code">
      <button onClick={copy} aria-live="polite">
        {status}
      </button>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function Demo({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <article className="demo">
      <header>
        <span>INTERACTIVE EXAMPLE</span>
        <h2>{title}</h2>
        <p>{note}</p>
      </header>
      <div className="demo-body">{children}</div>
    </article>
  );
}

export function Example({
  title,
  description,
  code,
  children,
}: {
  title: string;
  description: string;
  code?: string;
  children: ReactNode;
}) {
  return (
    <article className="feature-example">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <div className="feature-live">{children}</div>
      {code && (
        <details className="show-code">
          <summary>
            Source pattern <span>TypeScript ↘</span>
          </summary>
          <Code>{code}</Code>
        </details>
      )}
    </article>
  );
}
