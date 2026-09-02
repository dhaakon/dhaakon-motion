import React, { StrictMode } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { motion, useDragControls } from '@dhaakon/motion/react';
import { installFrameDriver, installPointerEvents, ManualDriver, pointer } from '@dhaakon/motion/testing';

let restorePointers = () => {}; let restoreFrame = () => {}; let driver: ManualDriver;
beforeEach(() => { restorePointers = installPointerEvents(); driver = new ManualDriver(); restoreFrame = installFrameDriver(driver).restore; });
afterEach(() => { restorePointers(); restoreFrame(); });

test('motion drag writes transforms without a React render per frame', () => {
  let renders = 0;
  function Example() { renders += 1; return <motion.div data-testid="card" drag="x" dragMomentum={false}/>; }
  const view = render(<Example/>); const card = view.getByTestId('card'); const stream = pointer(card);
  act(() => { stream.down(0, 0, 0); stream.move(50, 0, 20); driver.step(20); });
  expect(card.style.transform).toContain('translateX(50px)'); expect(renders).toBe(1);
});

test('whileTap animates in and returns from the interrupted visual value', () => {
  const view = render(<motion.button data-testid="button" initial={{ scale: 1 }} animate={{ scale: 1 }} whileTap={{ scale: .8 }} transition={{ duration: 100 }}/>); const button = view.getByTestId('button'); const stream = pointer(button);
  act(() => { stream.down(0, 0, 0); driver.step(50); }); expect(button.style.transform).toContain('scale(');
  const pressed = button.style.transform;
  act(() => { stream.up(0, 0, 50); driver.step(150); });
  expect(pressed).not.toBe('scale(1)'); expect(button.style.transform).toContain('scale(1)');
});

test('tap callback fires without a delayed click path', () => {
  const phases: string[] = []; const view = render(<motion.button data-testid="button" onTap={(event) => phases.push(event.phase)}/>); const button = view.getByTestId('button'); const stream = pointer(button);
  act(() => { stream.down(0, 0, 0); stream.up(2, 0, 20); }); expect(phases).toEqual(['ended']);
});

test('useDragControls starts a drag from a separate handle and cleans up in StrictMode', () => {
  function Example() { const controls = useDragControls(); return <><button data-testid="handle" onPointerDown={(event) => controls.start(event.nativeEvent)}>HANDLE</button><motion.div data-testid="card" drag="x" dragMomentum={false} dragControls={controls}/></>; }
  const view = render(<StrictMode><Example/></StrictMode>); const handle = view.getByTestId('handle'); const card = view.getByTestId('card');
  act(() => { fireEvent.pointerDown(handle, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0, buttons: 1 }); const move = new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: 30, clientY: 0, buttons: 1 }); Object.defineProperty(move, 'timeStamp', { value: 20 }); card.dispatchEvent(move); driver.step(20); });
  expect(card.style.transform).toContain('translateX(30px)'); view.unmount();
});
