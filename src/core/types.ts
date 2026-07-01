// Shared, framework-agnostic types for the Formulize core.

export type Domain = 'math' | 'physics' | 'astrophysics' | 'chemistry';

export interface Variable {
  /** Stable ASCII identifier used in `Formula.relation` (machine key). Optional. */
  key?: string;
  /** LaTeX for display. */
  symbol: string;
  meaning: string;
  /** Human/unit string; when present on a relation-bearing formula, must parse in math.js. */
  unit?: string;
}

/** Result of the build-time dimensional consistency check, baked into the index. */
export type DimCheckStatus = 'consistent' | 'uncheckable';

export interface Formula {
  id: string;
  name: string;
  aliases: string[];
  domain: Domain;
  subdomain?: string;
  tags: string[];
  latex: string;
  description?: string;
  variables?: Variable[];
  source?: string;
  /** Machine-readable ASCII infix relation (math.js-parseable) over variable keys. Optional. */
  relation?: string;
  /** Build-time dimensional check result. Absent/`uncheckable` when no verifiable relation. */
  dimCheck?: DimCheckStatus;
  /** True for formulas the user added at runtime (not part of the curated DB). */
  custom?: boolean;
}

export interface SearchResult {
  formula: Formula;
  /** Fused final score in [0, 1]. */
  score: number;
  /** Per-layer diagnostics, useful for debugging/tuning. */
  keywordScore: number;
  semanticScore: number;
  /** True when an exact name/alias match short-circuited to the top. */
  exact: boolean;
}

export interface SearchOptions {
  domains?: Domain[];
  limit?: number;
}

export interface Weights {
  keyword: number;
  semantic: number;
}

/** Injected, worker-backed query embedder. Returns a normalized vector. */
export type EmbedQuery = (query: string) => Promise<number[]>;

export interface SearchEngineOptions {
  index: Formula[];
  /** Precomputed formula embeddings keyed by id. Semantic disabled if absent. */
  embeddings?: Record<string, number[]>;
  /** Query embedder. Semantic disabled if absent. */
  embedQuery?: EmbedQuery;
  weights?: Partial<Weights>;
}

// ---- Quantity search (Feature 2) ----

/** One derived quantity: a base-dimension signature + the labels/formulas it covers. */
export interface QuantityVocabularyEntry {
  /** Dimension signature, e.g. "LENGTH^2 MASS TIME^-2". Stable id. */
  id: string;
  /** Distinct human meanings seen with this dimension (searchable aliases). */
  labels: string[];
  /** Ids of formulas that involve this quantity. */
  formulaIds: string[];
}

/** The build-derived quantity index shipped as dist/quantities.json. */
export interface QuantityData {
  vocabulary: QuantityVocabularyEntry[];
  /** formulaId → its set of quantity signatures (its "quantity fingerprint"). */
  fingerprints: Record<string, string[]>;
}

export interface SearchEngine {
  /** Full hybrid search (keyword + semantic when available). */
  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
  /** Synchronous keyword-only search — instant, works before any model loads. */
  searchKeyword(query: string, opts?: SearchOptions): SearchResult[];
  /** True once both embeddings and an embedder are available. */
  readonly semanticAvailable: boolean;
}
