// Headless search hook. Owns the engine, the (optional) embedder lifecycle,
// and progressive enhancement: keyword results appear synchronously on every
// keystroke; semantic results silently upgrade them once the model is warm.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSearchEngine } from '../core/searchEngine.js';
import { createEmbedder, type Embedder } from '../core/embedder.js';
import type { Domain, Formula, SearchResult, Weights } from '../core/types.js';

export type ModelStatus = 'disabled' | 'idle' | 'loading' | 'ready' | 'error';

export interface UseFormulaSearchOptions {
  index: Formula[];
  embeddings?: Record<string, number[]>;
  enableSemantic?: boolean;
  weights?: Partial<Weights>;
  domains?: Domain[];
  limit?: number;
  /** Debounce (ms) for the async semantic pass. Keyword is never debounced. */
  debounceMs?: number;
}

export interface UseFormulaSearch {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  modelStatus: ModelStatus;
  modelProgress: number | null;
  semanticReady: boolean;
}

export function useFormulaSearch(opts: UseFormulaSearchOptions): UseFormulaSearch {
  const {
    index,
    embeddings,
    enableSemantic = true,
    weights,
    domains,
    limit = 8,
    debounceMs = 120,
  } = opts;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [modelStatus, setModelStatus] = useState<ModelStatus>(
    enableSemantic && embeddings ? 'idle' : 'disabled'
  );
  const [modelProgress, setModelProgress] = useState<number | null>(null);

  const semanticWanted = enableSemantic && Boolean(embeddings);

  // Lazily-created embedder, kept in a ref so it survives re-renders.
  const embedderRef = useRef<Embedder | null>(null);

  // Create the embedder once (if semantic is wanted). We start it eagerly so the
  // model warms in the background while the user is still typing keyword queries.
  useEffect(() => {
    if (!semanticWanted || embedderRef.current) return;
    setModelStatus('loading');
    const embedder = createEmbedder({
      onProgress: (_status, progress) => {
        if (typeof progress === 'number') setModelProgress(progress);
      },
      onReady: () => {
        setModelProgress(100);
        setModelStatus('ready');
      },
    });
    embedder.ready().catch(() => setModelStatus('error'));
    embedderRef.current = embedder;
    return () => {
      embedder.dispose();
      embedderRef.current = null;
    };
  }, [semanticWanted]);

  const engine = useMemo(
    () =>
      createSearchEngine({
        index,
        embeddings: semanticWanted ? embeddings : undefined,
        embedQuery: semanticWanted ? (q) => embedderRef.current!.embed(q) : undefined,
        weights,
      }),
    // Re-create only when the data or config identity changes.
    [index, embeddings, semanticWanted, weights]
  );

  const searchOpts = useMemo(() => ({ domains, limit }), [domains, limit]);

  // Monotonic token so a slow async result never overwrites a newer query.
  const tokenRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (q: string) => {
      const token = ++tokenRef.current;
      const trimmed = q.trim();

      // 1. Instant, synchronous keyword pass — no debounce, no await.
      const instant = trimmed ? engine.searchKeyword(trimmed, searchOpts) : [];
      setResults(instant);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!trimmed || !engine.semanticAvailable) return;

      // 2. Debounced async fused pass — upgrades results if still current.
      debounceRef.current = setTimeout(() => {
        engine
          .search(trimmed, searchOpts)
          .then((fused) => {
            if (token === tokenRef.current) setResults(fused);
          })
          .catch(() => {
            /* keep the instant keyword results on failure */
          });
      }, debounceMs);
    },
    [engine, searchOpts, debounceMs]
  );

  useEffect(() => {
    runSearch(query);
  }, [query, runSearch]);

  // When the model finishes loading, re-run the current query to upgrade it.
  useEffect(() => {
    if (modelStatus === 'ready' && query.trim()) runSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelStatus]);

  useEffect(() => () => void (debounceRef.current && clearTimeout(debounceRef.current)), []);

  return {
    query,
    setQuery,
    results,
    modelStatus,
    modelProgress,
    semanticReady: modelStatus === 'ready',
  };
}
