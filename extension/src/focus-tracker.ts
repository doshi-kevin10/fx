/** Track the most recently focused editable element for smart LaTeX insert. */

const HOST_ID = 'formulyze-ext-host';

let lastEditable: HTMLElement | null = null;

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'url',
  'email',
  'tel',
  'password',
  'number',
]);

/** True when the element belongs to our own dock UI (so we never insert into it). */
export function isInsideOwnUI(el: Element | null): boolean {
  return !!el && typeof el.closest === 'function' && el.closest(`#${HOST_ID}`) !== null;
}

export function isEditable(el: Element | null): el is HTMLElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (isInsideOwnUI(el)) return false;

  if (el instanceof HTMLInputElement) {
    return !el.disabled && !el.readOnly && TEXT_INPUT_TYPES.has(el.type || 'text');
  }

  if (el instanceof HTMLTextAreaElement) {
    return !el.disabled && !el.readOnly;
  }

  return el.isContentEditable === true;
}

export function startFocusTracker(): void {
  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      // Ignore focus moving into our own dock; keep the page's field remembered.
      if (isInsideOwnUI(target)) return;
      if (isEditable(target)) lastEditable = target;
    },
    true,
  );
}

/** Return the best insert target: last focused page editable, else current activeElement. */
export function getLastEditable(): HTMLElement | null {
  if (
    lastEditable &&
    document.contains(lastEditable) &&
    isEditable(lastEditable)
  ) {
    return lastEditable;
  }

  const active = document.activeElement;
  if (isEditable(active)) return active;

  return null;
}

/** @internal test helper */
export function _resetFocusTrackerForTests(): void {
  lastEditable = null;
}

/** @internal test helper */
export function _setLastEditableForTests(el: HTMLElement | null): void {
  lastEditable = el;
}
