import { useEffect, useRef, useState } from 'react';
import {
  MotionValue,
  Transport,
  captureScene,
  loadSheet,
  saveSheet,
  validateSheet,
} from '@dhaakon/motion';
import { control } from '../components/Demo';

const productionSheet = `{
  "$schema": "dhaakon-motion/cue-sheet/1",
  "name": "VP Stage / Scene 12",
  "frameRate": 24,
  "markers": [{ "name": "top", "at": "0f" }, { "name": "take", "at": "36f" }],
  "cues": [{ "name": "tally", "at": "36f", "payload": { "signal": "CAM_2_RED" } }],
  "regions": [{ "name": "program", "from": "36f", "to": "96f" }],
  "items": [{
    "type": "timeline", "name": "graphics", "at": "12f",
    "items": [
      { "type": "tween", "name": "lower-third", "target": "x", "from": 0, "to": 220, "delay": "6f", "duration": "24f", "easing": "dhaakon" },
      { "type": "track", "name": "exposure", "target": "exposure", "keyframes": [{ "at": "0f", "value": 0.7 }, { "at": "48f", "value": 1.25 }] }
    ]
  }]
}`;

function SerializableShowLab() {
  const [source, setSource] = useState(productionSheet);
  const [report, setReport] = useState('');
  const [error, setError] = useState('');
  const [x, setX] = useState(0);
  const [exposure, setExposure] = useState(0.7);
  const transportRef = useRef<Transport | null>(null);
  const load = () => {
    try {
      const parsed = JSON.parse(source);
      const valid = validateSheet(parsed);
      if (!valid.ok) throw new Error(valid.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
      const timeline = loadSheet(valid.sheet, {
        targets: { x: setX, exposure: setExposure },
        cues: { tally: () => {} },
      });
      const scene = { x: new MotionValue(x), exposure: new MotionValue(exposure) };
      const captured = captureScene(scene);
      const roundtrip = saveSheet(timeline);
      setReport(
        `${timeline.toAscii({ width: 27 })}\n\nSCENE STATE\n${JSON.stringify(captured, null, 2)}\n\nROUND-TRIP: ${roundtrip.items.length} root item(s)`,
      );
      setError('');
      const t = new Transport({ root: timeline, frameRate: 24, loop: true });
      transportRef.current?.dispose();
      transportRef.current = t;
      t.play();
    } catch (err) {
      setError((err as Error).message);
    }
  };
  useEffect(() => {
    load();
    return () => transportRef.current?.dispose();
  }, []);
  return (
    <div className="lab lab-sheet">
      <textarea
        aria-label="Cue sheet JSON"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        spellCheck={false}
      />
      <div className="sheet-audit">
        <div className="scene-card" style={{ filter: `brightness(${exposure})` }}>
          <i style={{ transform: `translateX(${Math.min(130, x * 0.6)}px)` }}>SCENE 12</i>
        </div>
        <pre className={error ? 'error' : ''}>{error || report}</pre>
        <div className="lab-controls">
          {control('Validate · load · round-trip', load, true)}
          {control('Export JSON', () => navigator.clipboard?.writeText(source))}
        </div>
      </div>
    </div>
  );
}

export { SerializableShowLab };
export const exampleCode = `const result = validateSheet(JSON.parse(source));
if (!result.ok) return showErrors(result.errors);

const timeline = loadSheet(result.sheet, {
  targets: { camera, exposure, lowerThird },
  cues: { tally: sendTally, take: routeSwitcher },
  createItem: (item) => item.type === 'audio' ? makeClip(item) : undefined
});

const state = captureScene(targets);
applyScene(savedStates.program, targets, { transition: { duration: '12f' } });
const portableJSON = JSON.stringify(saveSheet(timeline));`;
