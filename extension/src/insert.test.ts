// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { insertLatex } from './insert.js';

describe('insertLatex', () => {
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    textarea = document.createElement('textarea');
    textarea.value = 'Hello world';
    document.body.appendChild(textarea);
  });

  it('inserts wrapped LaTeX at the cursor in a textarea', () => {
    textarea.selectionStart = 5;
    textarea.selectionEnd = 5;

    expect(insertLatex('E=mc^2', textarea)).toBe(true);
    expect(textarea.value).toBe('Hello$E=mc^2$ world');
  });

  it('replaces the current selection', () => {
    textarea.value = 'prefix suffix';
    textarea.selectionStart = 7;
    textarea.selectionEnd = 13;

    expect(insertLatex('x^2', textarea)).toBe(true);
    expect(textarea.value).toBe('prefix $x^2$');
  });

  it('returns false when there is no target', () => {
    expect(insertLatex('a', null)).toBe(false);
  });

  it('returns false for non-editable elements', () => {
    const span = document.createElement('span');
    document.body.appendChild(span);
    expect(insertLatex('a', span)).toBe(false);
  });
});
