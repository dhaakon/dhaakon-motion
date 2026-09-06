import { useEffect, useRef } from 'react';
import { Button } from '@dhaakon/ui';
import type { Tween } from '@dhaakon/motion';
import { useMotionValue } from '@dhaakon/motion/react';

function CanvasSignalExample() {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const signal = useMotionValue<number>(0);
  const animation = useRef<Tween<number> | null>(null);
  const size = useRef({ width: 1, height: 1, ratio: 1 });
  const measure = () => {
    const node = canvas.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    size.current = { width: rect.width, height: rect.height, ratio };
    node.width = Math.max(1, Math.round(rect.width * ratio));
    node.height = Math.max(1, Math.round(rect.height * ratio));
    draw();
  };
  const draw = () => {
    const node = canvas.current;
    if (!node) return;
    const { width, height, ratio } = size.current;
    const ctx = node.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const progress = signal.get();
    node.dataset.signal = progress.toFixed(3);
    node.setAttribute('aria-label', `Animated signal at ${Math.round(progress * 100)} percent`);
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(240,238,232,.14)';
    ctx.lineWidth = 1;
    for (let x = 24; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 28; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const y =
        height / 2 +
        Math.sin((x / width) * Math.PI * 5 + progress * Math.PI * 2) *
          (18 + progress * 34) *
          Math.sin((x / width) * Math.PI);
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = '#ff5a1f';
    ctx.lineWidth = 2;
    ctx.stroke();
    const x = 22 + progress * (width - 44);
    const y =
      height / 2 +
      Math.sin((x / width) * Math.PI * 5 + progress * Math.PI * 2) *
        (18 + progress * 34) *
        Math.sin((x / width) * Math.PI);
    ctx.fillStyle = '#d9ff43';
    ctx.fillRect(x - 5, y - 5, 10, 10);
    ctx.fillStyle = '#f0eee8';
    ctx.font = '10px IBM Plex Mono';
    ctx.fillText(`${Math.round(progress * 100)}% SIGNAL`, 16, 22);
  };
  const play = () => {
    animation.current?.cancel();
    signal.set(0);
    animation.current = signal.animate(1, {
      duration: 2400,
      easing: 'linear',
      repeat: Infinity,
      yoyo: true,
    });
  };
  useEffect(() => {
    const unsubscribe = signal.subscribe(draw);
    const resize = new ResizeObserver(measure);
    if (canvas.current) resize.observe(canvas.current);
    measure();
    play();
    return () => {
      unsubscribe();
      resize.disconnect();
      animation.current?.cancel();
    };
  }, [signal]);
  return (
    <div className="canvas-example">
      <canvas ref={canvas} role="img" />
      <Button variant="outline" size="sm" onClick={play}>
        Restart signal ↻
      </Button>
    </div>
  );
}

const canvasReactCode = `import { useEffect, useRef } from 'react';
import { useMotionValue } from '@dhaakon/motion/react';

function SignalCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const signal = useMotionValue(0);

  useEffect(() => signal.subscribe(() => {
    drawSignal(canvas.current!, signal.get());
  }), [signal]);

  useEffect(() => {
    const tween = signal.animate(1, {
      duration: 2400,
      easing: 'linear',
      repeat: Infinity,
      yoyo: true
    });
    return () => tween.cancel();
  }, [signal]);

  return <canvas ref={canvas} />;
}`;

export { CanvasSignalExample, canvasReactCode };
