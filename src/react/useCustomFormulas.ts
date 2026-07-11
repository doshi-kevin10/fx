// Manages user-added formulas: session state by default, with opt-in
// persistence. `storageKey` gives localStorage persistence; a host that needs
// a different backend (e.g. the extension's chrome.storage, which — unlike
// page localStorage — is shared across every site) passes its own `store`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Formula } from '../core/types.js';
import { validateCustomFormula, type CustomFormulaInput, type ValidationResult } from '../core/customFormulas.js';

/** Pluggable persistence. `load` may be async (chrome.storage) or sync (localStorage). */
export interface CustomFormulaStore {
  load(): Formula[] | Promise<Formula[]>;
  save(formulas: Formula[]): void;
  /**
   * Optional live change feed: call `listener` when ANOTHER context (another
   * tab/window) writes the store, so every open tab stays in sync without a
   * reload. Returns an unsubscribe fn.
   */
  subscribe?(listener: (formulas: Formula[]) => void): () => void;
}

function load(storageKey?: string): Formula[] {
  if (!storageKey || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Formula[]) : [];
  } catch {
    return [];
  }
}

function save(storageKey: string, formulas: Formula[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(formulas));
  } catch {
    /* quota / disabled storage — stay in-memory */
  }
}

export interface UseCustomFormulas {
  /** User-added formulas, newest first. */
  custom: Formula[];
  /** Custom formulas prepended to the base index (what search runs over). */
  merged: Formula[];
  /** Validate + add. Returns the validation result (with `.message` on failure). */
  add: (input: CustomFormulaInput) => ValidationResult;
  /** Remove a custom formula by id. */
  remove: (id: string) => void;
}

/** Default store: localStorage keyed by `storageKey` (no-op when absent). */
function localStore(storageKey?: string): CustomFormulaStore {
  return {
    load: () => load(storageKey),
    save: (formulas) => {
      if (storageKey) save(storageKey, formulas);
    },
    // The `storage` DOM event fires in OTHER tabs of the same origin (never the
    // writer), so cross-tab sync comes free — no echo guard needed on this path.
    subscribe:
      storageKey && typeof window !== 'undefined'
        ? (listener) => {
            const handler = (e: StorageEvent) => {
              if (e.key !== storageKey) return;
              try {
                const parsed = e.newValue ? JSON.parse(e.newValue) : [];
                if (Array.isArray(parsed)) listener(parsed as Formula[]);
              } catch {
                /* ignore malformed cross-tab payloads */
              }
            };
            window.addEventListener('storage', handler);
            return () => window.removeEventListener('storage', handler);
          }
        : undefined,
  };
}

export function useCustomFormulas(
  baseIndex: Formula[],
  storageKey?: string,
  store?: CustomFormulaStore
): UseCustomFormulas {
  const backing = useMemo(() => store ?? localStore(storageKey), [store, storageKey]);
  const [custom, setCustom] = useState<Formula[]>([]);
  const hydrated = useRef(false);
  // Serialized snapshot of what's persisted. Lets the save effect tell a real
  // local edit apart from a value that just arrived FROM the store (hydration
  // or another tab's write) — the latter must not be written back, or two tabs
  // would ping-pong writes forever.
  const lastPersisted = useRef<string | null>(null);

  // Load once, then stay live: reconcile whenever another tab writes the store.
  useEffect(() => {
    let alive = true;
    hydrated.current = false;
    const accept = (formulas: Formula[]) => {
      lastPersisted.current = JSON.stringify(formulas);
      setCustom(formulas);
    };
    void Promise.resolve(backing.load()).then((loaded) => {
      if (!alive) return;
      accept(loaded);
      hydrated.current = true;
    });
    const unsubscribe = backing.subscribe?.((formulas) => {
      if (alive) accept(formulas);
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [backing]);

  // Persist only genuine local edits: skip the empty pre-hydration state and
  // skip values that came from the store (already equal to lastPersisted).
  useEffect(() => {
    if (!hydrated.current) return;
    const serialized = JSON.stringify(custom);
    if (serialized === lastPersisted.current) return;
    lastPersisted.current = serialized;
    backing.save(custom);
  }, [custom, backing]);

  // Custom first so a user's own formula wins ties and leads exact matches.
  const merged = useMemo(() => [...custom, ...baseIndex], [custom, baseIndex]);

  const add = useCallback(
    (input: CustomFormulaInput): ValidationResult => {
      const result = validateCustomFormula(input, merged);
      if (result.ok && result.formula) {
        const toAdd = result.formula;
        setCustom((c) => [toAdd, ...c]);
      }
      return result;
    },
    [merged]
  );

  const remove = useCallback((id: string) => {
    setCustom((c) => c.filter((f) => f.id !== id));
  }, []);

  return { custom, merged, add, remove };
}
