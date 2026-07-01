// "I have these quantities…" input for quantity search. Autocompletes against
// the build-derived vocabulary (quantities.json) — never a hardcoded list.
// Presentational + controlled; the parent owns have/want and runs the search.

import { useMemo, useRef, useState } from 'react';
import type { QuantityIndex } from '../core/quantitySearch.js';
import type { QuantityVocabularyEntry } from '../core/types.js';

export interface QuantityChipsProps {
  quantityIndex: QuantityIndex;
  have: string[];
  onChangeHave: (ids: string[]) => void;
  want?: string;
  onChangeWant?: (id: string | undefined) => void;
  /** Max autocomplete suggestions shown. */
  suggestionLimit?: number;
}

/** A short, human label for a quantity signature (shortest of its labels). */
function labelFor(index: QuantityIndex, id: string): string {
  const entry = index.vocabulary.find((q) => q.id === id);
  if (!entry || entry.labels.length === 0) return id;
  return [...entry.labels].sort((a, b) => a.length - b.length)[0];
}

export function QuantityChips({
  quantityIndex,
  have,
  onChangeHave,
  want,
  onChangeWant,
  suggestionLimit = 6,
}: QuantityChipsProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo<QuantityVocabularyEntry[]>(
    () => (query.trim() ? quantityIndex.suggest(query, suggestionLimit) : []),
    [query, quantityIndex, suggestionLimit]
  );

  const add = (id: string) => {
    if (!have.includes(id)) onChangeHave([...have, id]);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };
  const remove = (id: string) => onChangeHave(have.filter((x) => x !== id));

  return (
    <div className="fzq">
      <div className="fzq-field">
        <span className="fzq-lead">I have</span>
        <div className="fzq-chips">
          {have.map((id) => (
            <span key={id} className="fzq-chip">
              {labelFor(quantityIndex, id)}
              <button className="fzq-chip-x" aria-label={`Remove ${labelFor(quantityIndex, id)}`} onClick={() => remove(id)}>×</button>
            </span>
          ))}
          <div className="fzq-input-wrap">
            <input
              ref={inputRef}
              className="fzq-input"
              value={query}
              placeholder={have.length ? 'add another…' : 'e.g. mass, velocity…'}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && suggestions[0]) { e.preventDefault(); add(suggestions[0].id); }
                if (e.key === 'Backspace' && !query && have.length) remove(have[have.length - 1]);
              }}
            />
            {open && suggestions.length > 0 && (
              <ul className="fzq-suggest" role="listbox">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button className="fzq-suggest-item" onMouseDown={(e) => { e.preventDefault(); add(s.id); }}>
                      <span className="fzq-suggest-label">{[...s.labels].sort((a, b) => a.length - b.length)[0]}</span>
                      <span className="fzq-suggest-count">{s.formulaIds.length}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {onChangeWant && (
        <div className="fzq-field">
          <span className="fzq-lead">I want</span>
          <select
            className="fzq-want"
            value={want ?? ''}
            onChange={(e) => onChangeWant(e.target.value || undefined)}
          >
            <option value="">(anything)</option>
            {quantityIndex.vocabulary.map((q) => (
              <option key={q.id} value={q.id}>{labelFor(quantityIndex, q.id)}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
