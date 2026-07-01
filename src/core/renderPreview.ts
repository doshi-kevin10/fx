// Live math preview using KaTeX (fast, synchronous, self-contained).
// mhchem is loaded so chemical equations (\ce{...}) render too.
//
// Consumers must also load KaTeX's stylesheet once (we re-export its path;
// the React component and demo import `katex/dist/katex.min.css`).

import katex from 'katex';
import 'katex/dist/contrib/mhchem.mjs';

export interface RenderOptions {
  /** Display (block, centered) vs inline. Defaults to display. */
  displayMode?: boolean;
  /**
   * KaTeX throws on invalid LaTeX by default. In the UI we prefer to show the
   * raw source in red rather than crash, so the default here is `false`.
   * The build-time render check uses `throwOnError: true` separately.
   */
  throwOnError?: boolean;
}

/** Render LaTeX to an HTML string. Never throws unless `throwOnError` is set. */
export function renderToString(latex: string, opts: RenderOptions = {}): string {
  return katex.renderToString(latex, {
    displayMode: opts.displayMode ?? true,
    throwOnError: opts.throwOnError ?? false,
    strict: false,
    output: 'htmlAndMathml', // MathML included for screen readers / a11y
  });
}

/** Render LaTeX directly into a DOM element. */
export function renderInto(el: HTMLElement, latex: string, opts: RenderOptions = {}): void {
  katex.render(latex, el, {
    displayMode: opts.displayMode ?? true,
    throwOnError: opts.throwOnError ?? false,
    strict: false,
    output: 'htmlAndMathml',
  });
}

/** Extract the `<math>…</math>` (MathML) element from KaTeX's output. */
export function toMathML(latex: string): string {
  const html = renderToString(latex, { displayMode: true, throwOnError: false });
  const match = html.match(/<math[\s\S]*?<\/math>/);
  return match
    ? match[0]
    : `<math xmlns="http://www.w3.org/1998/Math/MathML"><mtext>${latex}</mtext></math>`;
}

/** Returns true if the LaTeX renders cleanly, false otherwise. */
export function isRenderable(latex: string): boolean {
  try {
    katex.renderToString(latex, { throwOnError: true, strict: false });
    return true;
  } catch {
    return false;
  }
}
