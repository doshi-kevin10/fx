// Framework-agnostic hybrid search engine.
//
//   keyword layer  — Fuse.js over name/aliases/tags, synchronous, instant.
//   semantic layer — cosine similarity of a query embedding against precomputed
//                     formula vectors. Optional: disabled unless both
//                     `embeddings` and `embedQuery` are supplied.
//   fusion         — normalized weighted sum, with an exact name/alias
//                     short-circuit that always wins.
//
// Progressive enhancement: `searchKeyword` is synchronous and works before any
// model loads; `search` is async and folds in semantic results when available.

import Fuse, { type IFuseOptions } from 'fuse.js';
import type {
  Formula,
  SearchResult,
  SearchOptions,
  SearchEngine,
  SearchEngineOptions,
  Weights,
} from './types.js';

const DEFAULT_WEIGHTS: Weights = { keyword: 0.55, semantic: 0.45 };
const DEFAULT_LIMIT = 8;

const FUSE_OPTIONS: IFuseOptions<Formula> = {
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.4, // fairly permissive; fusion + exact short-circuit keep quality
  minMatchCharLength: 1,
  keys: [
    { name: 'name', weight: 0.5 },
    { name: 'aliases', weight: 0.35 },
    { name: 'tags', weight: 0.15 },
  ],
};

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Cosine similarity. Vectors are pre-normalized, so this is effectively a dot product. */
function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function createSearchEngine(opts: SearchEngineOptions): SearchEngine {
  const index = opts.index;
  const embeddings = opts.embeddings;
  const embedQuery = opts.embedQuery;
  const weights: Weights = { ...DEFAULT_WEIGHTS, ...opts.weights };

  const semanticAvailable = Boolean(embeddings && embedQuery);

  const fuse = new Fuse(index, FUSE_OPTIONS);
  const byId = new Map(index.map((f) => [f.id, f]));

  // Precompute lowercased exact-match keys (name + aliases) -> id.
  const exactKeys = new Map<string, string>();
  for (const f of index) {
    exactKeys.set(f.name.trim().toLowerCase(), f.id);
    for (const a of f.aliases ?? []) exactKeys.set(a.trim().toLowerCase(), f.id);
  }

  function domainAllowed(f: Formula, domains?: SearchOptions['domains']): boolean {
    return !domains || domains.length === 0 || domains.includes(f.domain);
  }

  /** Keyword-only scores keyed by id (already in [0,1], higher is better). */
  function keywordScores(query: string): Map<string, number> {
    const scores = new Map<string, number>();
    for (const r of fuse.search(query)) {
      // Fuse score: 0 = perfect, 1 = worst. Invert to a [0,1] relevance.
      scores.set(r.item.id, clamp01(1 - (r.score ?? 1)));
    }
    return scores;
  }

  function assemble(
    query: string,
    kw: Map<string, number>,
    sem: Map<string, number> | null,
    options?: SearchOptions
  ): SearchResult[] {
    const useSemantic = sem !== null;
    // Renormalize weights so keyword-only mode uses the full weight budget.
    const wK = useSemantic ? weights.keyword : 1;
    const wS = useSemantic ? weights.semantic : 0;
    const wSum = wK + wS || 1;

    const exactId = exactKeys.get(query.trim().toLowerCase());

    // Candidate ids: union of keyword hits and (if semantic) all embedded formulas.
    const ids = new Set<string>(kw.keys());
    if (sem) for (const id of sem.keys()) ids.add(id);
    if (exactId) ids.add(exactId);

    const results: SearchResult[] = [];
    for (const id of ids) {
      const formula = byId.get(id);
      if (!formula || !domainAllowed(formula, options?.domains)) continue;

      const keywordScore = kw.get(id) ?? 0;
      const semanticScore = sem?.get(id) ?? 0;
      const exact = id === exactId;
      const fused = (wK * keywordScore + wS * semanticScore) / wSum;

      results.push({
        formula,
        // Exact matches are pinned at the top with a full score.
        score: exact ? 1 : fused,
        keywordScore,
        semanticScore,
        exact,
      });
    }

    results.sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      return b.score - a.score;
    });

    return results.slice(0, options?.limit ?? DEFAULT_LIMIT);
  }

  function searchKeyword(query: string, options?: SearchOptions): SearchResult[] {
    const q = query.trim();
    if (!q) return [];
    return assemble(q, keywordScores(q), null, options);
  }

  async function search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];

    const kw = keywordScores(q);

    if (!semanticAvailable) return assemble(q, kw, null, options);

    let sem: Map<string, number> | null = null;
    try {
      const qvec = await embedQuery!(q);
      sem = new Map<string, number>();
      for (const [id, vec] of Object.entries(embeddings!)) {
        sem.set(id, clamp01(cosine(qvec, vec)));
      }
    } catch {
      // Embedding failed (model not ready / worker error) — degrade to keyword.
      sem = null;
    }

    return assemble(q, kw, sem, options);
  }

  return {
    search,
    searchKeyword,
    get semanticAvailable() {
      return semanticAvailable;
    },
  };
}
