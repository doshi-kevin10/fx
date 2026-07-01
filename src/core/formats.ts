// The "insert anywhere" format matrix. One interface, two reliability tiers.
// Heavy renderers (MathJax for png/svg, the OMML converter for Word) are
// lazy-imported so the keyword preview stays tiny. Nothing here throws to the
// caller: every path resolves to a FormatResult or a clean fallback.

import type { Formula } from './types.js';
import { toMathML } from './renderPreview.js';

export type FormatKind = 'latex' | 'mathml' | 'unicode' | 'svg' | 'png' | 'word';
export type FormatTier = 'guaranteed' | 'best-effort';

export interface FormatResult {
  kind: FormatKind;
  tier: FormatTier;
  mime: string;
  /** Present for text-based formats (also used as the clipboard fallback text). */
  text?: string;
  /** Present for binary/file formats (png, docx). */
  blob?: Blob;
  /** Suggested download filename. */
  filename?: string;
  /** True when the representation is lossy (unicode). Surface this in the UI. */
  approximate?: boolean;
  /** Human note, e.g. why a best-effort path fell back. */
  note?: string;
}

/** Named config (overridable) — no magic numbers. */
export const FORMAT_CONFIG = {
  pngScale: 2, // device-pixel multiplier for exported PNG
} as const;

export interface FormatOptions {
  pngScale?: number;
}

export const GUARANTEED_KINDS: FormatKind[] = ['latex', 'mathml', 'unicode', 'svg', 'png'];
export const BEST_EFFORT_KINDS: FormatKind[] = ['word'];

export { toMathML };

// --- Best-effort Unicode linearization (explicitly approximate) ---
const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ',
};
const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '(': '₍', ')': '₎',
};
const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ',
  mu: 'μ', nu: 'ν', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', omega: 'ω',
  Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', Phi: 'Φ', Psi: 'Ψ', hbar: 'ℏ', infty: '∞',
  times: '×', cdot: '·', pm: '±', mp: '∓', leq: '≤', geq: '≥', neq: '≠', approx: '≈',
  rightarrow: '→', Rightarrow: '⇒', partial: '∂', nabla: '∇', int: '∫', sum: '∑', sqrt: '√',
};
function mapScript(body: string, table: Record<string, string>): string | null {
  const out = [...body].map((ch) => table[ch]);
  return out.every((c) => c !== undefined) ? out.join('') : null;
}
/** Best-effort, lossy LaTeX→Unicode. Always flagged approximate in the UI. */
export function toUnicode(latex: string): string {
  let s = latex;
  s = s.replace(/\\(tfrac|dfrac|frac)\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($2)/($3)');
  s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');
  s = s.replace(/\\(vec|hat|bar|tilde)\s*\{([^{}]*)\}/g, '$2');
  s = s.replace(/\\[a-zA-Z]+/g, (m) => {
    const name = m.slice(1);
    return SYMBOLS[name] ?? m;
  });
  s = s.replace(/\^\{([^{}]*)\}|\^(\S)/g, (_m, braced, single) => {
    const body = braced ?? single;
    return mapScript(body, SUPERSCRIPTS) ?? `^${body}`;
  });
  s = s.replace(/_\{([^{}]*)\}|_(\S)/g, (_m, braced, single) => {
    const body = braced ?? single;
    return mapScript(body, SUBSCRIPTS) ?? `_${body}`;
  });
  s = s.replace(/[{}]/g, '').replace(/\\[,;!> ]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

/** Produce one representation of a formula. Never throws; falls back cleanly. */
export async function getFormat(
  formula: Formula,
  kind: FormatKind,
  opts: FormatOptions = {}
): Promise<FormatResult> {
  switch (kind) {
    case 'latex':
      return { kind, tier: 'guaranteed', mime: 'text/plain', text: formula.latex };

    case 'mathml':
      return { kind, tier: 'guaranteed', mime: 'application/mathml+xml', text: toMathML(formula.latex) };

    case 'unicode':
      return {
        kind,
        tier: 'guaranteed',
        mime: 'text/plain',
        text: toUnicode(formula.latex),
        approximate: true,
      };

    case 'svg': {
      const { toSVG } = await import('./exportImage.js');
      return {
        kind,
        tier: 'guaranteed',
        mime: 'image/svg+xml',
        text: toSVG(formula.latex),
        filename: `${formula.id}.svg`,
      };
    }

    case 'png': {
      const { toPNG } = await import('./exportImage.js');
      const blob = await toPNG(formula.latex, { scale: opts.pngScale ?? FORMAT_CONFIG.pngScale });
      return { kind, tier: 'guaranteed', mime: 'image/png', blob, filename: `${formula.id}.png` };
    }

    case 'word': {
      const { getWord } = await import('./omml.js');
      return getWord(formula);
    }
  }
}

// --- Clipboard + download, feature-detected with fallbacks ---

export interface CopyOutcome {
  ok: boolean;
  /** When copy failed/unsupported, text the UI should show for manual copy. */
  fallbackText?: string;
  note?: string;
}

/** Copy a FormatResult to the clipboard, degrading to selectable text on failure. */
export async function copyResult(result: FormatResult): Promise<CopyOutcome> {
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;

  // Binary (PNG): needs ClipboardItem.
  if (result.blob) {
    if (typeof ClipboardItem !== 'undefined' && clipboard?.write) {
      try {
        await clipboard.write([new ClipboardItem({ [result.blob.type]: result.blob })]);
        return { ok: true };
      } catch {
        return { ok: false, note: 'Clipboard image copy blocked — use Download instead.' };
      }
    }
    return { ok: false, note: 'Image clipboard unsupported — use Download instead.' };
  }

  // Text formats.
  const text = result.text ?? '';
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return { ok: true };
    } catch {
      return { ok: false, fallbackText: text, note: 'Clipboard blocked — copy the text below.' };
    }
  }
  return { ok: false, fallbackText: text, note: 'Clipboard unavailable — copy the text below.' };
}

/** Trigger a download for a FormatResult (works for text and binary). */
export function downloadResult(result: FormatResult): void {
  const blob = result.blob ?? new Blob([result.text ?? ''], { type: result.mime });
  const ext = result.kind === 'mathml' ? 'mml' : result.kind === 'unicode' ? 'txt' : result.kind === 'latex' ? 'tex' : result.kind;
  const filename = result.filename ?? `formula.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
