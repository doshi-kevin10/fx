/** Insert inline-math LaTeX into a focused editable, or return false for clipboard fallback. */

export function insertLatex(latex: string, target: HTMLElement | null): boolean {
  if (!target) return false;

  const snippet = `$${latex}$`;

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    target.setRangeText(snippet, start, end, 'end');
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.focus();
    return true;
  }

  if (target.isContentEditable === true) {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
      target.append(document.createTextNode(snippet));
      target.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(snippet);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    target.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  return false;
}
