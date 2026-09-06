import { useId, useRef, useState } from 'react';
import { Badge, Button, Card, CardBody, tokens } from '@dhaakon/ui';
import { createCssMotionTokens, type CssPlaybackResult } from '@dhaakon/motion/css';
import { CssMotionConfig, MotionConfig, cssMotion, useReducedMotion } from '@dhaakon/motion/react';
import './css-ui.css';

const uiMotion = createCssMotionTokens(tokens.motion);
const variants = {
  closed: { opacity: 0, transform: 'translateY(8px)' },
  open: { opacity: 1, transform: 'translateY(0px)' },
};

function DisclosureStudy({ slow }: { slow: boolean }) {
  const instance = useId();
  const panelId = `css-ui-panel-${instance}`;
  const inputId = `css-ui-name-${instance}`;
  const [expanded, setExpanded] = useState(false);
  const [present, setPresent] = useState(false);
  const [backend, setBackend] = useState('instant');
  const [reason, setReason] = useState('Initial state');
  const [status, setStatus] = useState('settled');
  const [completions, setCompletions] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const token = expanded ? 'surface.enter' : 'surface.exit';
  const duration = (uiMotion[token].duration ?? 0) * (slow ? 4 : 1);
  const change = (next: boolean) => {
    // Interaction semantics belong to the UI, not the animation backend.
    if (!next && panel.current?.contains(document.activeElement)) trigger.current?.focus();
    if (next) setPresent(true);
    setExpanded(next);
  };
  const complete = (result: CssPlaybackResult) => {
    setBackend(result.backend);
    setReason(result.reason ?? 'Native effect released; final CSS retained');
    setStatus('settled');
    setCompletions((value) => value + 1);
    if (!expanded) setPresent(false);
  };
  const namedTokens = slow
    ? Object.fromEntries(
        Object.entries(uiMotion).map(([name, value]) => [
          name,
          { ...value, duration: (value.duration ?? 0) * 4 },
        ]),
      )
    : uiMotion;
  return (
    <CssMotionConfig tokens={namedTokens}>
      <div
        className="css-ui-study"
        data-testid="css-ui-study"
        data-expanded={expanded}
        data-phase={expanded ? 'open' : present ? 'closing' : 'closed'}
        data-backend={backend}
        data-status={status}
        data-reduced={reduced}
      >
        <div className="css-ui-workbench">
          <div className="css-ui-kicker">
            <span>01 / INTERACTION, NOT A RENDER LOOP</span>
            <Badge tone="accent">DHAAKON UI</Badge>
          </div>
          <Card className="css-ui-card">
            <CardBody>
              <p className="css-ui-overline">RESEARCH WORKSPACE / LOCAL DEMO</p>
              <h2>Session details.</h2>
              <p>
                The component owns its state. CSS owns its appearance. The browser owns the
                animation clock.
              </p>
              <Button
                ref={trigger}
                data-testid="css-ui-trigger"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => change(!expanded)}
                variant="outline"
              >
                {expanded ? 'Hide session details' : 'Show session details'}{' '}
                <span aria-hidden="true">{expanded ? '−' : '+'}</span>
              </Button>
              <cssMotion.div
                ref={panel}
                id={panelId}
                role="region"
                aria-label="Session details"
                aria-hidden={!expanded}
                inert={!expanded}
                hidden={!present}
                className="css-ui-panel"
                data-testid="css-ui-panel"
                initial={false}
                animate={expanded ? 'open' : 'closed'}
                variants={variants}
                transition={token}
                onMotionStart={(playback) => {
                  setBackend(playback.backend);
                  setStatus(playback.backend === 'waapi' ? 'animating' : 'settled');
                  setReason(
                    playback.backend === 'waapi'
                      ? 'Browser-owned playback · no application frame callback'
                      : 'Applying the final CSS state',
                  );
                }}
                onMotionComplete={complete}
              >
                <div className="css-ui-panel-heading">
                  <span>EXPERIMENT / 042</span>
                  <Badge>Draft</Badge>
                </div>
                <label htmlFor={inputId}>Session name</label>
                <input id={inputId} defaultValue="Compositor study" />
                <p>
                  Content stays mounted to preserve your input. Closing immediately removes it from
                  keyboard interaction; the exit finishes before it becomes hidden.
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => change(false)}
                  data-testid="css-ui-close-inside"
                >
                  Close from inside ↗
                </Button>
              </cssMotion.div>
            </CardBody>
          </Card>
          <p className="css-ui-hint">
            Try Enter or Space on the trigger. Toggle quickly to interrupt. Close while focus is
            inside the panel.
          </p>
        </div>
        <aside className="css-ui-inspector" aria-label="Motion execution inspector">
          <p className="css-ui-overline">02 / EXECUTION RECEIPT</p>
          <h3>CSS is the contract.</h3>
          <dl>
            <div>
              <dt>Authored state</dt>
              <dd>{expanded ? 'open' : 'closed'}</dd>
            </div>
            <div>
              <dt>Transition token</dt>
              <dd data-testid="css-ui-token">{token}</dd>
            </div>
            <div>
              <dt>Resolved duration</dt>
              <dd data-testid="css-ui-duration">{reduced ? 0 : duration} ms</dd>
            </div>
            <div>
              <dt>Evaluator</dt>
              <dd data-testid="css-ui-backend">
                {backend === 'waapi' ? 'Browser / Web Animations' : 'Immediate CSS'}
              </dd>
            </div>
            <div>
              <dt>Lifecycle</dt>
              <dd>{status}</dd>
            </div>
            <div>
              <dt>Completed transitions</dt>
              <dd>{completions}</dd>
            </div>
          </dl>
          <p role="status" className="css-ui-reason">
            {reason}
          </p>
          <pre>{`opacity: ${expanded ? 1 : 0};\ntransform: translateY(${expanded ? 0 : 8}px);\neasing: ${tokens.motion.ease};`}</pre>
          <p>
            No Wasm download. No matrix compiler. No per-frame React state updates. Browser-native
            does not imply every CSS property is GPU accelerated.
          </p>
        </aside>
      </div>
    </CssMotionConfig>
  );
}

export function CssUiLab() {
  const [reduce, setReduce] = useState(false);
  const [slow, setSlow] = useState(false);
  const [mounted, setMounted] = useState(true);
  return (
    <div className="css-ui-lab">
      <div className="css-ui-controls">
        <label>
          <input
            type="checkbox"
            checked={reduce}
            onChange={(event) => setReduce(event.target.checked)}
            data-testid="css-ui-reduce"
          />{' '}
          Force reduced motion
        </label>
        <label>
          <input
            type="checkbox"
            checked={slow}
            onChange={(event) => setSlow(event.target.checked)}
            data-testid="css-ui-slow"
          />{' '}
          Inspect at ¼ speed
        </label>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setMounted(!mounted)}
          data-testid="css-ui-mount"
        >
          {mounted ? 'Unmount the study' : 'Mount the study'}
        </Button>
      </div>
      <MotionConfig reducedMotion={reduce ? 'always' : 'user'}>
        {mounted ? (
          <DisclosureStudy slow={slow} />
        ) : (
          <div className="css-ui-empty">
            Study unmounted. Its native animations and motion ownership have been released.
          </div>
        )}
      </MotionConfig>
    </div>
  );
}
