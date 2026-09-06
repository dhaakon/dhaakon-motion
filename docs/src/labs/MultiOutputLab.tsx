import { useEffect, useRef, useState } from 'react';
import { MotionValue, Timeline, Transport, Tween, drawOutput, signalOutput } from '@dhaakon/motion';
import { control } from '../components/Demo';

type BusState = { x: number; rotate: number; energy: number; gain: number; dmx: number };

function MultiOutputLab() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const domRef = useRef<HTMLDivElement | null>(null);
  const cubeRef = useRef<HTMLDivElement | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const valueRef = useRef<MotionValue<BusState> | null>(null);
  const [status, setStatus] = useState({
    tc: '00:00:00:00',
    gain: 0,
    dmx: 0,
    packet: '—',
    draws: 0,
  });
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    const value = (valueRef.current ??= new MotionValue<BusState>({
      x: 0,
      rotate: 0,
      energy: 0.1,
      gain: 0,
      dmx: 0,
    }));
    const timeline = new Timeline({ frameRate: 24, name: 'unified-output-bus' })
      .add(
        new Tween<BusState>({
          name: 'all-properties',
          from: value.get(),
          to: { x: 210, rotate: 330, energy: 1, gain: 0.86, dmx: 255 },
          duration: '72f',
          repeat: Infinity,
          repeatDelay: '6f',
          yoyo: true,
          easing: 'dhaakon',
          onUpdate: (v) => value.set(v),
        }),
        0,
      )
      .cue('OSC TAKE', '24f', () => {}, {
        payload: { signal: { address: '/switcher/take', value: 1 } },
      })
      .cue('MIDI NOTE', '48f', () => {}, { payload: { signal: { midi: [144, 60, 127] } } });
    const transport = new Transport({ root: timeline, frameRate: 24, snap: true });
    transportRef.current = transport;
    let draws = 0;
    const dom = drawOutput(
      () => {
        const v = value.get();
        if (domRef.current) domRef.current.style.transform = `translateX(${v.x}px)`;
      },
      { name: 'DOM writer' },
    );
    const three = drawOutput(
      () => {
        const v = value.get();
        if (cubeRef.current)
          cubeRef.current.style.transform = `rotateX(${v.rotate * 0.65}deg) rotateY(${v.rotate}deg) scale(${0.72 + v.energy * 0.28})`;
      },
      { name: 'CSS 3D renderer' },
    );
    const canvas = drawOutput(
      (info) => {
        const node = canvasRef.current;
        const ctx = node?.getContext('2d');
        if (!node || !ctx) return;
        const v = value.get();
        ctx.clearRect(0, 0, node.width, node.height);
        ctx.strokeStyle = '#d9ff43';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x <= node.width; x += 3) {
          const y = node.height / 2 + Math.sin(x * 0.055 + info.time * 0.01) * v.energy * 32;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        draws += 1;
      },
      { name: 'Canvas draw' },
    );
    const signal = signalOutput(
      (payload) => setStatus((s) => ({ ...s, packet: JSON.stringify(payload) })),
      { name: 'OSC/MIDI/DMX' },
    );
    const detachers = [dom, three, canvas, signal].map((output) => transport.attach(output));
    const off = transport.subscribe((info) => {
      const v = value.get();
      setStatus((s) => ({ ...s, tc: info.timecode, gain: v.gain, dmx: Math.round(v.dmx), draws }));
    });
    transport.play();
    return () => {
      off();
      detachers.forEach((detach) => detach());
      transport.dispose();
    };
  }, []);
  return (
    <div className="lab lab-bus">
      <div className="bus-stage">
        <div className="bus-dom">
          <small>DOM</small>
          <div ref={domRef}>LOWER / THIRD</div>
        </div>
        <div className="bus-three">
          <small>CSS 3D</small>
          <div className="cube-scene">
            <div ref={cubeRef} className="css-cube">
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
        <div className="bus-canvas">
          <small>CANVAS</small>
          <canvas ref={canvasRef} width={320} height={110} />
        </div>
      </div>
      <div className="bus-meter">
        <span>
          AUDIO GAIN (SIM)
          <i style={{ width: `${status.gain * 100}%` }} />
        </span>
        <span>
          DMX (SIM)
          <i style={{ width: `${status.dmx / 2.55}%` }} />
        </span>
      </div>
      <div className="packet">
        <b>{status.tc}</b>
        <code>{status.packet}</code>
        <small>{status.draws} synchronized draws</small>
      </div>
      <div className="lab-controls">
        {control(
          playing ? 'Pause every output' : 'Play every output',
          () => {
            const transport = transportRef.current;
            if (!transport) return;
            transport.toggle();
            setPlaying(transport.state === 'playing');
          },
          true,
        )}
        {control('Seek 48f', () => transportRef.current?.seek('48f'))}
      </div>
    </div>
  );
}

export { MultiOutputLab };
export const exampleCode = `const transport = new Transport({ root: show, frameRate: 24 });
transport.attach(drawOutput(() => writeDOM(values.get())));
transport.attach(threeOutput({ renderer, scene, camera, composer }));
transport.attach(drawOutput(() => drawCanvas(ctx, values.get())));
transport.attach(audioOutput(audioContext));
transport.attach(midiOutput(midiPort));
transport.attach(signalOutput((packet) => osc.send(packet)));

// Every writer samples first; each renderer draws once, on one transport tick.
transport.play();`;
