// The self-verifying, insert-anywhere result card. Shared by both search entry
// points. Renders KaTeX (behind an error boundary so one bad formula can't blank
// the list), the dimensional badge (only when verified), a variable glossary,
// and the format/copy matrix (guaranteed + best-effort tiers, honestly labeled).

import { Component, useCallback, useState, type ReactNode } from 'react';
import type { Formula } from '../core/types.js';
import {
  getFormat,
  copyResult,
  downloadResult,
  type FormatKind,
} from '../core/formats.js';
import { Tex } from './Tex.js';

class TexBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface ResultCardProps {
  formula: Formula;
  enableImageExport?: boolean;
  pngScale?: number;
  /** When provided, the title becomes a button that selects this formula. */
  onSelect?: (formula: Formula) => void;
  className?: string;
}

const COPY_KINDS: { kind: FormatKind; label: string; approx?: boolean }[] = [
  { kind: 'latex', label: 'LaTeX' },
  { kind: 'mathml', label: 'MathML' },
  { kind: 'unicode', label: 'Unicode', approx: true },
];

export function ResultCard({ formula, enableImageExport = true, pngScale, onSelect, className }: ResultCardProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    setFallback(null);
  }, []);

  const doCopy = useCallback(
    async (kind: FormatKind) => {
      try {
        const result = await getFormat(formula, kind, { pngScale });
        const outcome = await copyResult(result);
        if (outcome.ok) {
          flash(`Copied ${kind}${result.approximate ? ' (approx.)' : ''} ✓`);
        } else {
          setStatus(outcome.note ?? 'Copy unavailable');
          setFallback(outcome.fallbackText ?? null);
        }
      } catch {
        flash('Could not produce that format');
      }
    },
    [formula, pngScale, flash]
  );

  const doDownload = useCallback(
    async (kind: FormatKind) => {
      try {
        const result = await getFormat(formula, kind, { pngScale });
        downloadResult(result);
        flash(`Downloaded ${result.filename ?? kind}${result.note ? ` — ${result.note}` : ''}`);
      } catch {
        flash('Could not export that format');
      }
    },
    [formula, pngScale, flash]
  );

  const verified = formula.dimCheck === 'consistent';

  return (
    <div className={['fzc-card', className].filter(Boolean).join(' ')}>
      <div className="fzc-head">
        {onSelect ? (
          <button className="fzc-name fzc-name-btn" onClick={() => onSelect(formula)} title="Insert this formula">
            {formula.name}
          </button>
        ) : (
          <h3 className="fzc-name">{formula.name}</h3>
        )}
        {verified && (
          <span className="fzc-badge fzc-badge-verified" title="Both sides of the relation reduce to the same physical dimension (checked at build time).">
            ✓ dimensionally verified
          </span>
        )}
        {formula.custom && <span className="fzc-badge">★ yours</span>}
      </div>

      <div className="fzc-render">
        <TexBoundary fallback={<code className="fzc-render-fallback">{formula.latex}</code>}>
          <Tex latex={formula.latex} display />
        </TexBoundary>
      </div>

      {formula.description && <p className="fzc-desc">{formula.description}</p>}

      {formula.variables && formula.variables.length > 0 && (
        <table className="fzc-vars">
          <tbody>
            {formula.variables.map((v, i) => (
              <tr key={i}>
                <td className="fzc-var-sym">
                  <TexBoundary fallback={<code>{v.symbol}</code>}>
                    <Tex latex={v.symbol} />
                  </TexBoundary>
                </td>
                <td className="fzc-var-mean">{v.meaning}</td>
                <td className="fzc-var-unit">{v.unit ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="fzc-formats">
        <div className="fzc-format-row">
          <span className="fzc-format-label">Copy</span>
          {COPY_KINDS.map(({ kind, label, approx }) => (
            <button key={kind} className="fzc-fmt" onClick={() => doCopy(kind)} title={approx ? 'Approximate linearization' : `Copy ${label}`}>
              {label}
              {approx && <span className="fzc-approx">~</span>}
            </button>
          ))}
        </div>
        {enableImageExport && (
          <div className="fzc-format-row">
            <span className="fzc-format-label">Download</span>
            <button className="fzc-fmt" onClick={() => doDownload('png')}>PNG</button>
            <button className="fzc-fmt" onClick={() => doDownload('svg')}>SVG</button>
            <button className="fzc-fmt" onClick={() => doCopy('png')} title="Copy image to clipboard">Copy image</button>
            <button className="fzc-fmt fzc-fmt-effort" onClick={() => doDownload('word')} title="Best-effort: editable Word equation, with a text fallback">
              Word .docx<span className="fzc-effort">*</span>
            </button>
          </div>
        )}
      </div>

      {status && (
        <div className="fzc-status" role="status">
          {status}
          {fallback != null && (
            <textarea className="fzc-fallback" readOnly value={fallback} onFocus={(e) => e.currentTarget.select()} />
          )}
        </div>
      )}

      {formula.source && (
        <a className="fzc-source" href={formula.source} target="_blank" rel="noreferrer noopener">source</a>
      )}
    </div>
  );
}
