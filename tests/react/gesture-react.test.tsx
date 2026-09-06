import React, { StrictMode } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { motion, useDragControls } from '@dhaakon/motion/react';
import { installFrameDriver, installPointerEvents, ManualDriver, pointer } from '@dhaakon/motion/testing';
import { EditorLab, GestureGallery, Reorder } from '../../docs/src/GestureLabs';
import { MultiOutputLab } from '../../docs/src/ProductionLabs';

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

test('drag translation survives whileTap and whileDrag transitions through release', () => {
  const view = render(<motion.div data-testid="card" initial={{ scale: 1 }} animate={{ scale: 1 }} whileTap={{ scale: .95 }} whileDrag={{ scale: 1.1 }} transition={{ duration: 100 }} drag="x" dragMomentum={false}/>);
  const card = view.getByTestId('card'); const stream = pointer(card);
  act(() => { stream.down(0, 0, 0); stream.move(50, 0, 20); driver.step(20); });
  expect(card.style.transform).toContain('translateX(50px)');
  act(() => { driver.step(60); });
  expect(card.style.transform).toContain('translateX(50px)');
  act(() => { stream.up(50, 0, 60); driver.step(160); });
  expect(card.style.transform).toContain('translateX(50px)');
});

test('an axis-locked drag preserves perpendicular whileDrag transforms', () => {
  const view = render(<motion.div data-testid="card" initial={{ y: 0 }} animate={{ y: 0 }} whileDrag={{ y: -12 }} transition={{ duration: 100 }} drag="x" dragMomentum={false}/>);
  const card = view.getByTestId('card'); const stream = pointer(card);
  act(() => { stream.down(0, 0, 0); stream.move(40, 0, 20); driver.step(120); });
  expect(card.style.transform).toContain('translateX(40px)');
  expect(card.style.transform).toContain('translateY(-12px)');
});

test('whileTap does not override whileDrag after later pointer moves', () => {
  const view = render(<motion.div data-testid="card" initial={{ scale: 1 }} animate={{ scale: 1 }} whileTap={{ scale: .9 }} whileDrag={{ scale: 1.1 }} transition={{ duration: 100 }} drag="x" dragMomentum={false}/>);
  const card = view.getByTestId('card'); const stream = pointer(card);
  act(() => { stream.down(0, 0, 0); stream.move(20, 0, 20); driver.step(120); });
  expect(card.style.transform).toContain('scale(1.1)');
  act(() => { stream.move(40, 0, 140); driver.step(240); });
  expect(card.style.transform).toContain('scale(1.1)');
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

test('useDragControls follows a separate handle pointer stream with the element listener disabled', () => {
  function Example() { const controls = useDragControls(); return <><button data-testid="handle" onPointerDown={(event) => controls.start(event.nativeEvent)}>HANDLE</button><motion.div data-testid="card" drag="x" dragListener={false} dragMomentum={false} dragControls={controls}/></>; }
  const view = render(<StrictMode><Example/></StrictMode>); const handle = view.getByTestId('handle'); const card = view.getByTestId('card');
  const dispatch = (target: Element, type: string, x: number, time: number, buttons: number) => { const event = new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: x, clientY: 0, buttons }); Object.defineProperty(event, 'timeStamp', { value: time }); target.dispatchEvent(event); };
  act(() => { dispatch(card, 'pointerdown', 0, 0, 1); dispatch(card, 'pointermove', 15, 10, 1); driver.step(10); });
  expect(card.style.transform).not.toContain('translateX(15px)');
  act(() => { fireEvent.pointerDown(handle, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0, buttons: 1 }); dispatch(handle, 'pointermove', 30, 20, 1); driver.step(20); dispatch(handle, 'pointerup', 30, 25, 0); });
  expect(card.style.transform).toContain('translateX(30px)'); view.unmount();
});

test('the handle reorder demo changes its list order by drag and keyboard', () => {
  const view = render(<Reorder/>);
  const order = () => view.getAllByRole('listitem').map((row) => row.textContent?.replace('⠿', ''));
  expect(order()).toEqual(['CAMERA', 'GRAPHICS', 'AUDIO']);

  const first = view.getAllByRole('listitem')[0]; Object.defineProperty(first, 'offsetHeight', { value: 29 });
  const handle = view.getByRole('button', { name: 'Move CAMERA, position 1 of 3' }); const stream = pointer(handle);
  act(() => { stream.down(0, 0, 0); stream.move(0, 36, 20); driver.step(20); stream.up(0, 36, 30); });
  expect(order()).toEqual(['GRAPHICS', 'CAMERA', 'AUDIO']);

  act(() => { fireEvent.keyDown(view.getByRole('button', { name: 'Move CAMERA, position 2 of 3' }), { key: 'ArrowUp' }); });
  expect(order()).toEqual(['CAMERA', 'GRAPHICS', 'AUDIO']);
});

test('the reorder binding reads the latest index after a keyboard rerender', () => {
  const view = render(<Reorder/>);
  act(() => { fireEvent.keyDown(view.getByRole('button', { name: 'Move CAMERA, position 1 of 3' }), { key: 'ArrowDown' }); });
  expect(view.getAllByRole('listitem').map((row) => row.textContent?.replace('⠿', ''))).toEqual(['GRAPHICS', 'CAMERA', 'AUDIO']);

  const first = view.getAllByRole('listitem')[0]; Object.defineProperty(first, 'offsetHeight', { value: 29 });
  const handle = view.getByRole('button', { name: 'Move GRAPHICS, position 1 of 3' }); const stream = pointer(handle);
  act(() => { stream.down(0, 0, 0); stream.move(0, 36, 20); driver.step(20); stream.up(0, 36, 30); });
  expect(view.getAllByRole('listitem').map((row) => row.textContent?.replace('⠿', ''))).toEqual(['CAMERA', 'GRAPHICS', 'AUDIO']);
});

test('the fader demo keeps its displayed and accessible levels in sync with pointer movement', () => {
  const view = render(<GestureGallery/>);
  const slider = view.getByRole('slider', { name: 'Intensity level' });
  const fader = slider.closest('.bound-fader');
  expect(slider.getAttribute('aria-valuenow')).toBe('62');
  expect(fader?.textContent).toContain('062 / 100');

  const stream = pointer(slider);
  act(() => { stream.down(0, 0, 0); stream.move(0, 24, 20); });
  expect(slider.getAttribute('aria-valuenow')).toBe('42');
  expect(fader?.textContent).toContain('042 / 100');

  act(() => { fireEvent.keyDown(slider, { key: 'ArrowUp' }); });
  expect(slider.getAttribute('aria-valuenow')).toBe('47');
  expect(fader?.textContent).toContain('047 / 100');
});

test('the pull-to-refresh demo reports its threshold and springs back after release', async () => {
  const view = render(<GestureGallery/>);
  const pull = view.getByText(/PULL TO REFRESH/);
  const stream = pointer(pull);
  act(() => { stream.down(0, 0, 0); stream.move(0, 60, 20); driver.step(20); });
  expect(pull.textContent).toContain('RELEASE TO REFRESH');
  expect(pull.style.transform).toContain('translateY(60px)');

  await act(async () => { stream.up(0, 60, 32); await Promise.resolve(); driver.step(2000); });
  expect(pull.textContent).toContain('PULL TO REFRESH');
  expect(pull.style.transform).toContain('translateY(0px)');
});

test('the carousel demo handles horizontal wheel paging but leaves vertical scrolling alone', () => {
  const view = render(<GestureGallery/>);
  const rail = view.getByRole('slider', { name: 'Carousel position' });
  const horizontal = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 90, deltaY: 0 });
  act(() => { rail.dispatchEvent(horizontal); });
  expect(horizontal.defaultPrevented).toBe(true);
  expect(rail.style.transform).toBe('translateX(-90px)');
  expect(rail.getAttribute('aria-valuenow')).toBe('-90');

  const vertical = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 0, deltaY: 90 });
  act(() => { rail.dispatchEvent(vertical); });
  expect(vertical.defaultPrevented).toBe(false);
  expect(rail.style.transform).toBe('translateX(-90px)');
});

test('timeline editor keyboard movement uses the same ten-pixel grid as pointer snapping', () => {
  const view = render(<EditorLab/>);
  const marker = view.getByRole('slider', { name: 'CAMERA marker' });
  expect(marker.getAttribute('aria-valuenow')).toBe('18');
  act(() => { fireEvent.keyDown(marker, { key: 'ArrowRight' }); });
  expect(marker.getAttribute('aria-valuenow')).toBe('28');
});

test('the swipe demo uses projected velocity when deciding dismissal', () => {
  const view = render(<GestureGallery/>);
  const row = view.getByRole('slider', { name: 'Dismiss item' });
  const stream = pointer(row);
  act(() => { stream.down(0, 0, 0); stream.move(-24, 0, 12); stream.up(-24, 0, 16); });
  expect(view.getByText('RELEASED')).toBeTruthy();
});

test('the multi-output control label reflects whether every output is playing', () => {
  const view = render(<MultiOutputLab/>);
  const pause = view.getByRole('button', { name: 'Pause every output' });
  act(() => { fireEvent.click(pause); });
  const play = view.getByRole('button', { name: 'Play every output' });
  act(() => { fireEvent.click(play); });
  expect(view.getByRole('button', { name: 'Pause every output' })).toBeTruthy();
});
