import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
for (const format of ['js', 'cjs']) {
  const read = (entry) => format === 'js' ? import(`../../dist/${entry}.js`) : Promise.resolve(require(`../../dist/${entry}.cjs`));
  const [core, audio, three, testing, gesture, midi, react, devtools] = await Promise.all(['index', 'audio', 'three', 'testing', 'gesture', 'midi', 'react', 'devtools'].map(read));

  test(`${format}: every public entry loads and shares root Track identity`, () => {
    assert.equal(typeof react.motion.div, 'object'); // forwardRef component
    assert.equal(typeof devtools.mountInspector, 'function');
    assert.equal(midi.midiOutput({ send() {} }).supportsOffline, false);
    const object = { position: { set() {} }, rotation: { set() {} }, scale: { set() {}, setScalar() {} } };
    const track = three.objectTrack(object, [{ at: 0, value: { scale: 1 } }, { at: 100, value: { scale: 2 } }]);
    assert.ok(track instanceof core.Track);
    assert.equal(core.saveSheet(new core.Timeline().add(track)).items[0].keyframes.length, 2);
    const recorded = gesture.gestureToTrack({ $schema: 'dhaakon-motion/gesture/1', samples: [] }, { frameRate: 24 });
    assert.ok(recorded instanceof core.Track);
  });

  test(`${format}: testing adapter controls the root scheduler`, () => {
    const driver = new testing.ManualDriver();
    const { restore } = testing.installFrameDriver(driver);
    const tween = new core.Tween({ from: 0, to: 1, duration: 100, easing: 'linear' });
    try { tween.play(); driver.step(50); assert.equal(tween.value, .5); }
    finally { tween.cancel(); restore(); }
  });

  test(`${format}: audio adapter recognizes nested root timelines and transports`, async () => {
    const context = new testing.FakeAudioContext();
    const clip = new audio.AudioClip({ context, buffer: testing.fakeAudioBuffer(1) });
    const root = new core.Timeline().add(new core.Timeline().add(clip, 0), 0);
    const transport = new core.Transport({ root });
    try {
      transport.attach(audio.audioOutput(context));
      transport.play().seek(100);
      assert.equal(context.sources.length, 1);
      transport.pause();
      const offline = new testing.FakeOfflineAudioContext();
      await audio.renderAudio(transport, offline);
      assert.equal(offline.sources.length, 1);
    } finally { transport.dispose(); }
  });
}
