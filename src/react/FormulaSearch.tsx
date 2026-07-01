// The <FormulaSearch> component: a thin shell over useFormulaSearch + the core
// render/export modules. Input + keyboard nav + results list + selected panel
// with copy/download actions.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Domain, Formula, SearchResult, Weights } from '../core/types.js';
import { useFormulaSearch } from './useFormulaSearch.js';
import { Tex } from './Tex.js';

export interface FormulaSearchProps {
  index: Formula[];
  embeddings?: Record<string, number[]>;
  /** Fired when the user picks a result (click or Enter). */
  onSelect?: (formula: Formula) => void;
  domains?: Domain[];
  mode?: 'popover' | 'inline';
  enableSemantic?: boolean;
  enableImageExport?: boolean;
  placeholder?: string;
  weights?: Partial<Weights>;
  limit?: number;
  className?: string;
  /** Autofocus the input on mount. */
  autoFocus?: boolean;
}

export function FormulaSearch({
  index,
  embeddings,
  onSelect,
  domains,
  mode = 'inline',
  enableSemantic = true,
  enableImageExport = true,
  placeholder = 'Search a formula…',
  weights,
  limit = 8,
  className,
  autoFocus,
}: FormulaSearchProps) {
  const { query, setQuery, results, modelStatus } = useFormulaSearch({
    index,
    embeddings,
    enableSemantic,
    weights,
    domains,
    limit,
  });

  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<Formula | null>(null);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  // Keep the active index in range as results change.
  useEffect(() => {
    setActive((a) => (results.length === 0 ? 0 : Math.min(a, results.length - 1)));
  }, [results]);

  const choose = useCallback(
    (r: SearchResult) => {
      setSelected(r.formula);
      onSelect?.(r.formula);
    },
    [onSelect]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (results.length === 0) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActive((a) => (a + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActive((a) => (a - 1 + results.length) % results.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (results[active]) choose(results[active]);
          break;
        case 'Escape':
          e.preventDefault();
          setQuery('');
          break;
      }
    },
    [results, active, choose, setQuery]
  );

  // Scroll the active option into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div className={['fz-root', `fz-${mode}`, className].filter(Boolean).join(' ')}>
      <div className="fz-search">
        <input
          className="fz-input"
          type="text"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results.length ? `${listId}-opt-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {modelStatus === 'loading' && (
          <span className="fz-model-hint" title="Loading semantic search model">
            loading smarter search…
          </span>
        )}

        {results.length > 0 && (
          <ul className="fz-results" id={listId} role="listbox" ref={listRef}>
            {results.map((r, i) => (
              <li
                key={r.formula.id}
                id={`${listId}-opt-${i}`}
                data-idx={i}
                role="option"
                aria-selected={i === active}
                className={['fz-result', i === active ? 'fz-active' : ''].filter(Boolean).join(' ')}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus in the input
                  choose(r);
                }}
              >
                <div className="fz-result-head">
                  <span className="fz-result-name">{r.formula.name}</span>
                  <span className="fz-badge">{r.formula.domain}</span>
                  {r.exact && <span className="fz-badge fz-badge-exact">exact</span>}
                </div>
                <Tex latex={r.formula.latex} className="fz-result-math" />
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected && (
        <SelectedPanel formula={selected} enableImageExport={enableImageExport} />
      )}
    </div>
  );
}

function SelectedPanel({
  formula,
  enableImageExport,
}: {
  formula: Formula;
  enableImageExport: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const flash = useCallback((msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus((s) => (s === msg ? null : s)), 1500);
  }, []);

  const copyLatex = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formula.latex);
      flash('LaTeX copied');
    } catch {
      flash('Copy failed');
    }
  }, [formula.latex, flash]);

  // Export helpers are imported lazily so MathJax stays out of the main bundle.
  const download = useCallback(
    async (kind: 'svg' | 'png' | 'clipboard') => {
      const mod = await import('../core/exportImage.js');
      try {
        if (kind === 'svg') mod.downloadSVG(formula.latex, `${formula.id}.svg`);
        else if (kind === 'png') await mod.downloadPNG(formula.latex, `${formula.id}.png`);
        else {
          const ok = await mod.copyPNGToClipboard(formula.latex);
          flash(ok ? 'Image copied' : 'Clipboard unsupported');
        }
      } catch {
        flash('Export failed');
      }
    },
    [formula.id, formula.latex, flash]
  );

  return (
    <div className="fz-panel">
      <div className="fz-panel-head">
        <h3 className="fz-panel-title">{formula.name}</h3>
        {formula.subdomain && <span className="fz-badge">{formula.subdomain}</span>}
      </div>

      <div className="fz-panel-render">
        <Tex latex={formula.latex} display className="fz-panel-math" />
      </div>

      {formula.description && <p className="fz-panel-desc">{formula.description}</p>}

      <pre className="fz-latex"><code>{formula.latex}</code></pre>

      <div className="fz-actions">
        <button className="fz-btn fz-btn-primary" onClick={copyLatex}>
          Copy LaTeX
        </button>
        {enableImageExport && (
          <>
            <button className="fz-btn" onClick={() => download('png')}>Download PNG</button>
            <button className="fz-btn" onClick={() => download('svg')}>Download SVG</button>
            <button className="fz-btn" onClick={() => download('clipboard')}>Copy image</button>
          </>
        )}
        {status && <span className="fz-status" role="status">{status}</span>}
      </div>

      {formula.variables && formula.variables.length > 0 && (
        <table className="fz-vars">
          <tbody>
            {formula.variables.map((v, i) => (
              <tr key={i}>
                <td className="fz-var-sym"><Tex latex={v.symbol} /></td>
                <td className="fz-var-mean">{v.meaning}</td>
                <td className="fz-var-unit">{v.unit ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {formula.source && (
        <a className="fz-source" href={formula.source} target="_blank" rel="noreferrer noopener">
          source
        </a>
      )}
    </div>
  );
}
