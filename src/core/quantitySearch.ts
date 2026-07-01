// Search by the physical quantities you *have* (and optionally the one you
// *want*), ranking formulas by how well their quantity fingerprint matches.
// Pure arithmetic over the build-derived quantities.json — no math.js, no unit
// parsing at runtime. Emits the same SearchResult shape as text search.

import type {
  Formula,
  QuantityData,
  QuantityVocabularyEntry,
  SearchResult,
} from './types.js';

export interface QuantityWeights {
  /** Reward per user-supplied quantity the formula uses. */
  overlap: number;
  /** Bonus when the formula contains the desired `want` quantity. */
  want: number;
  /** Penalty per quantity the formula needs that the user did not supply. */
  missing: number;
}

export const DEFAULT_QUANTITY_WEIGHTS: QuantityWeights = {
  overlap: 1,
  want: 0.75,
  missing: 0.5,
};

export interface QuantitySearchOptions {
  limit?: number;
}

export interface QuantityIndex {
  /** All quantities, for building the UI vocabulary. */
  readonly vocabulary: QuantityVocabularyEntry[];
  /** Autocomplete: quantities whose labels match `query` (substring, ranked). */
  suggest(query: string, limit?: number): QuantityVocabularyEntry[];
  /** Rank formulas by the quantities the user has (+ optional wanted quantity). */
  search(have: string[], want?: string, opts?: QuantitySearchOptions): SearchResult[];
}

const DEFAULT_LIMIT = 8;

export function createQuantityIndex(opts: {
  index: Formula[];
  quantities: QuantityData;
  weights?: Partial<QuantityWeights>;
}): QuantityIndex {
  const weights: QuantityWeights = { ...DEFAULT_QUANTITY_WEIGHTS, ...opts.weights };
  const byId = new Map(opts.index.map((f) => [f.id, f]));
  const fingerprints = opts.quantities.fingerprints;
  const vocabulary = opts.quantities.vocabulary;

  function suggest(query: string, limit = 10): QuantityVocabularyEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return vocabulary.slice(0, limit);
    const scored: Array<{ entry: QuantityVocabularyEntry; rank: number }> = [];
    for (const entry of vocabulary) {
      let best = Infinity;
      for (const label of entry.labels) {
        const idx = label.indexOf(q);
        if (idx === 0) best = Math.min(best, 0); // prefix match ranks highest
        else if (idx > 0) best = Math.min(best, 1); // substring match
      }
      if (best < Infinity) scored.push({ entry, rank: best });
    }
    scored.sort(
      (a, b) => a.rank - b.rank || a.entry.labels[0].localeCompare(b.entry.labels[0])
    );
    return scored.slice(0, limit).map((s) => s.entry);
  }

  function search(have: string[], want?: string, options?: QuantitySearchOptions): SearchResult[] {
    const haveSet = new Set(have);
    if (haveSet.size === 0 && !want) return [];

    const raw: Array<{ formula: Formula; score: number }> = [];
    for (const [id, fp] of Object.entries(fingerprints)) {
      const formula = byId.get(id);
      if (!formula) continue;

      const fpSet = new Set(fp);
      let matched = 0;
      for (const sig of haveSet) if (fpSet.has(sig)) matched++;
      const wantMatch = want != null && fpSet.has(want);

      // Require some relevance: at least one supplied quantity or the wanted one.
      if (matched === 0 && !wantMatch) continue;

      const missing = fp.length - matched; // quantities the user didn't supply
      const score =
        weights.overlap * matched +
        (wantMatch ? weights.want : 0) -
        weights.missing * missing;

      raw.push({ formula, score });
    }

    if (raw.length === 0) return [];
    const max = Math.max(...raw.map((r) => r.score), 0) || 1;

    return raw
      .map((r) => ({
        formula: r.formula,
        score: r.score > 0 ? r.score / max : 0,
        keywordScore: 0,
        semanticScore: 0,
        exact: false,
      }))
      .sort((a, b) => b.score - a.score || a.formula.id.localeCompare(b.formula.id))
      .slice(0, options?.limit ?? DEFAULT_LIMIT);
  }

  return { vocabulary, suggest, search };
}
