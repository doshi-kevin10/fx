// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  getLastEditable,
  isEditable,
  isInsideOwnUI,
  startFocusTracker,
  _resetFocusTrackerForTests,
  _setLastEditableForTests,
} from './focus-tracker.js';

describe('focus-tracker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    _resetFocusTrackerForTests();
  });

  it('recognizes text inputs and textareas', () => {
    const input = document.createElement('input');
    input.type = 'text';
    const textarea = document.createElement('textarea');
    const button = document.createElement('button');

    expect(isEditable(input)).toBe(true);
    expect(isEditable(textarea)).toBe(true);
    expect(isEditable(button)).toBe(false);
  });

  it('tracks focusin on editable elements', () => {
    startFocusTracker();

    const a = document.createElement('textarea');
    const b = document.createElement('input');
    b.type = 'text';
    document.body.append(a, b);

    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(getLastEditable()).toBe(a);

    b.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(getLastEditable()).toBe(b);
  });

  it('ignores removed elements', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    _setLastEditableForTests(textarea);
    textarea.remove();

    expect(getLastEditable()).toBeNull();
  });

  it('never tracks inputs inside the dock UI', () => {
    startFocusTracker();

    const pageField = document.createElement('textarea');
    const host = document.createElement('div');
    host.id = 'formulyze-ext-host';
    const dockInput = document.createElement('input');
    dockInput.type = 'text';
    host.appendChild(dockInput);
    document.body.append(pageField, host);

    pageField.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(getLastEditable()).toBe(pageField);

    // Focusing the dock's own search must NOT overwrite the page target.
    dockInput.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(isInsideOwnUI(dockInput)).toBe(true);
    expect(isEditable(dockInput)).toBe(false);
    expect(getLastEditable()).toBe(pageField);
  });
});
