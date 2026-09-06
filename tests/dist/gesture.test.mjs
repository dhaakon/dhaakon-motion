import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import { MotionValue } from '../../dist/index.js';
import { drag } from '../../dist/gesture.js';

const require = createRequire(import.meta.url);
const { MotionValue: CjsMotionValue } = require('../../dist/index.cjs');
const { drag: cjsDrag } = require('../../dist/gesture.cjs');

function installDom(window) {
  const globals = { window, document: window.document, Element: window.Element, HTMLElement: window.HTMLElement, Event: window.Event, CustomEvent: window.CustomEvent };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  return () => {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  };
}

function pointer(element, type, x, buttons) {
  const event = new element.ownerDocument.defaultView.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: 1 }, pointerType: { value: 'touch' }, clientX: { value: x }, clientY: { value: 0 },
    button: { value: 0 }, buttons: { value: buttons }, isPrimary: { value: true }, pressure: { value: buttons ? 0.5 : 0 },
  });
  element.dispatchEvent(event);
}

function verifyCrossEntryDrag(MotionValueConstructor, bindDrag) {
  const dom = new JSDOM('<!doctype html><div id="draggable"></div>');
  const restoreDom = installDom(dom.window);
  const element = document.querySelector('#draggable');
  const value = new MotionValueConstructor(4);
  const controls = bindDrag(value, element, { immediate: true, momentum: false, keyboard: false });

  try {
    assert.ok(controls.isDragging instanceof MotionValueConstructor, 'gesture-owned values use the root entry constructor');
    pointer(element, 'pointerdown', 10, 1);
    pointer(element, 'pointermove', 40, 1);
    assert.equal(value.get(), 34);
    assert.equal(controls.isDragging.get(), true);
    pointer(element, 'pointerup', 40, 0);
    assert.equal(controls.isDragging.get(), false);
  } finally {
    controls.dispose();
    value.stop();
    restoreDom();
    dom.window.close();
  }
}

test('ESM gesture drag accepts and updates a MotionValue from the root entry', () => {
  verifyCrossEntryDrag(MotionValue, drag);
});

test('CommonJS gesture drag accepts and updates a MotionValue from the root entry', () => {
  verifyCrossEntryDrag(CjsMotionValue, cjsDrag);
});
