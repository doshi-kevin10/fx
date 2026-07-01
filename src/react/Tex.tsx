// Renders a LaTeX string with KaTeX. Memoized on (latex, displayMode).
// Requires `katex/dist/katex.min.css` to be loaded by the host app.
// (Named `Tex`, not `Math`, to avoid shadowing the global `Math` object.)

import { useMemo } from 'react';
import { renderToString } from '../core/renderPreview.js';

export interface TexProps {
  latex: string;
  display?: boolean;
  className?: string;
}

export function Tex({ latex, display = false, className }: TexProps) {
  const html = useMemo(
    () => renderToString(latex, { displayMode: display, throwOnError: false }),
    [latex, display]
  );
  return (
    <span
      className={className}
      // KaTeX output is trusted (curated LaTeX, trust:false => no raw HTML passthrough).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
