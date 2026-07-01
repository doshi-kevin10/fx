// Unified finder: two entry points (by name, by quantity) feeding ONE result
// surface (ResultCard) and ONE selection callback. The result-rendering path is
// never forked — both modes produce SearchResult[] rendered identically.

import { useMemo, useState } from 'react';
import type { Domain, Formula, QuantityData, SearchResult, Weights } from '../core/types.js';
import { createQuantityIndex, type QuantityWeights } from '../core/quantitySearch.js';
import { useFormulaSearch } from './useFormulaSearch.js';
import { QuantityChips } from './QuantityChips.js';
import { ResultCard } from './ResultCard.js';

export interface FormulaFinderProps {
  index: Formula[];
  embeddings?: Record<string, number[]>;
  quantities: QuantityData;
  onSelect?: (formula: Formula) => void;
  domains?: Domain[];
  enableSemantic?: boolean;
  enableImageExport?: boolean;
  weights?: Partial<Weights>;
  quantityWeights?: Partial<QuantityWeights>;
  limit?: number;
  className?: string;
}

type Mode = 'name' | 'quantity';

export function FormulaFinder({
  index,
  embeddings,
  quantities,
  onSelect,
  domains,
  enableSemantic = true,
  enableImageExport = true,
  weights,
  quantityWeights,
  limit = 8,
  className,
}: FormulaFinderProps) {
  const [mode, setMode] = useState<Mode>('name');

  // Entry point 1 — by name (keyword + semantic).
  const { query, setQuery, results: nameResults, modelStatus } = useFormulaSearch({
    index,
    embeddings,
    enableSemantic,
    weights,
    domains,
    limit,
  });

  // Entry point 2 — by quantity.
  const quantityIndex = useMemo(
    () => createQuantityIndex({ index, quantities, weights: quantityWeights }),
    [index, quantities, quantityWeights]
  );
  const [have, setHave] = useState<string[]>([]);
  const [want, setWant] = useState<string | undefined>(undefined);
  const quantityResults = useMemo<SearchResult[]>(
    () => quantityIndex.search(have, want, { limit }),
    [quantityIndex, have, want, limit]
  );

  const results = mode === 'name' ? nameResults : quantityResults;
  const activeQuery = mode === 'name' ? query.trim() !== '' : have.length > 0 || want != null;

  return (
    <div className={['fzf', className].filter(Boolean).join(' ')}>
      <div className="fzf-modes" role="tablist" aria-label="Search mode">
        <button role="tab" aria-selected={mode === 'name'} className={`fzf-mode ${mode === 'name' ? 'fzf-mode-on' : ''}`} onClick={() => setMode('name')}>
          By name
        </button>
        <button role="tab" aria-selected={mode === 'quantity'} className={`fzf-mode ${mode === 'quantity' ? 'fzf-mode-on' : ''}`} onClick={() => setMode('quantity')}>
          By quantity
        </button>
      </div>

      {mode === 'name' ? (
        <div className="fzf-name">
          <input
            className="fzf-input"
            type="text"
            role="combobox"
            aria-expanded={nameResults.length > 0}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search a formula by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {modelStatus === 'loading' && <span className="fzf-hint">loading smarter search…</span>}
        </div>
      ) : (
        <QuantityChips
          quantityIndex={quantityIndex}
          have={have}
          onChangeHave={setHave}
          want={want}
          onChangeWant={setWant}
        />
      )}

      <div className="fzf-results">
        {results.map((r) => (
          <ResultCard
            key={r.formula.id}
            formula={r.formula}
            onSelect={onSelect}
            enableImageExport={enableImageExport}
          />
        ))}
        {activeQuery && results.length === 0 && (
          <p className="fzf-empty">
            {mode === 'name'
              ? 'No formula matches that name yet.'
              : 'No formula uses those quantities together. Try removing one.'}
          </p>
        )}
        {!activeQuery && (
          <p className="fzf-empty">
            {mode === 'name'
              ? 'Type a concept — “kinetic energy”, “PV=nRT”, “energy of a spinning object”.'
              : 'Add the quantities you have — e.g. mass and velocity — to find matching formulas.'}
          </p>
        )}
      </div>
    </div>
  );
}
