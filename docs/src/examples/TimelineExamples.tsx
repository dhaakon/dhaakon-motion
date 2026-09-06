import { useEffect, useRef } from 'react';
import { Button } from '@dhaakon/ui';
import { Timeline, Tween } from '@dhaakon/motion';
import { Demo } from '../components/Demo';

function TimelinePlayground() {
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const timeline = useRef<Timeline | null>(null);
  const play = () => {
    timeline.current?.stop();
    const next = new Timeline();
    refs.current.forEach((node, index) => {
      if (!node) return;
      next.add(
        new Tween({
          from: { x: -28, opacity: 0 },
          to: { x: 0, opacity: 1 },
          duration: 520,
          easing: 'dhaakon',
          onUpdate: ({ x, opacity }) => {
            node.style.transform = `translateX(${x}px)`;
            node.style.opacity = String(opacity);
          },
        }),
        index === 0 ? 0 : index * 90,
      );
    });
    timeline.current = next.play();
  };
  useEffect(() => {
    play();
    return () => {
      timeline.current?.stop();
    };
  }, []);
  return (
    <Demo
      title="Timeline composition"
      note="Labels, absolute offsets, and < / > alignment compose without nesting timers."
    >
      <div className="timeline-stack">
        {['Direction', 'Editorial rhythm', 'Interaction'].map((label, i) => (
          <div
            key={label}
            ref={(node) => {
              refs.current[i] = node;
            }}
            className="timeline-row"
          >
            <b>0{i + 1}</b>
            <span>{label}</span>
            <small>+{i * 90}ms</small>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={play}>
        Replay sequence ↻
      </Button>
    </Demo>
  );
}

function CueSequenceExample() {
  const refs = useRef<Array<HTMLDivElement | null>>([]);
  const timeline = useRef<Timeline | null>(null);
  const clock = useRef<HTMLElement | null>(null);
  const play = () => {
    timeline.current?.stop();
    const next = new Timeline({
      onUpdate: (time) => {
        if (clock.current)
          clock.current.textContent = `${String(Math.floor(time / 1000)).padStart(2, '0')}:${String(Math.floor((time % 1000) / 10)).padStart(2, '0')}`;
      },
    }).label('take');
    refs.current.forEach((node, index) => {
      if (!node) return;
      next.add(
        new Tween({
          from: { x: -80, opacity: 0, scale: 0.94 },
          to: { x: 0, opacity: 1, scale: 1 },
          duration: 620,
          easing: 'dhaakon',
          onUpdate: ({ x, opacity, scale }) => {
            node.style.transform = `translateX(${x}px) scale(${scale})`;
            node.style.opacity = String(opacity);
          },
        }),
        `take+=${index * 110}`,
      );
    });
    timeline.current = next.play();
  };
  useEffect(() => {
    play();
    return () => {
      timeline.current?.stop();
    };
  }, []);
  return (
    <div className="cue-example">
      <div className="cue-head">
        <span>PROGRAM / A</span>
        <strong ref={clock}>00:00</strong>
      </div>
      <div className="cue-stack">
        {[
          ['01', 'OPEN', 'Standby playback'],
          ['02', 'KEY', 'Bring lower third'],
          ['03', 'TAKE', 'Camera two + tally'],
          ['04', 'ROLL', 'Record ISO feeds'],
        ].map(([number, cue, detail], index) => (
          <div
            className="cue-row"
            key={cue}
            ref={(node) => {
              refs.current[index] = node;
            }}
          >
            <small>{number}</small>
            <b>{cue}</b>
            <span>{detail}</span>
            <i />
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={play}>
        Run cue stack ↻
      </Button>
    </div>
  );
}

const cueReactCode = `import { Timeline, Tween } from '@dhaakon/motion';
import { useEffect, useRef } from 'react';

function CueStack() {
  const rows = useRef<Array<HTMLDivElement | null>>([]);
  const sequence = useRef<Timeline | null>(null);

  const play = () => {
    sequence.current?.stop();
    const next = new Timeline().label('take');

    rows.current.forEach((node, index) => {
      next.add(new Tween({
        from: { x: -80, opacity: 0, scale: 0.94 },
        to: { x: 0, opacity: 1, scale: 1 },
        duration: 620,
        onUpdate: ({ x, opacity, scale }) => {
          node!.style.transform =
            \`translateX(\${x}px) scale(\${scale})\`;
          node!.style.opacity = String(opacity);
        }
      }), \`take+=\${index * 110}\`);
    });

    sequence.current = next.play();
  };

  useEffect(() => { play(); return () => sequence.current?.stop(); }, []);
  return <CueRows refs={rows} onReplay={play} />;
}`;

const timelineCode = `const sequence = new Timeline()
  .label('entrance')
  .add(titleTween, 'entrance')
  .add(bodyTween, 'entrance+=80')
  .add(actionTween, 'entrance+=160');

sequence.play();`;

export { TimelinePlayground, CueSequenceExample, cueReactCode, timelineCode };
