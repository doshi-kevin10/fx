// Manages user-added formulas: session state by default, with opt-in
// localStorage persistence when `storageKey` is provided (keeping the library
// free of localStorage assumptions unless the host asks for them).

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Formula } from '../core/types.js';
import { validateCustomFormula, type CustomFormulaInput, type ValidationResult } from '../core/customFormulas.js';

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

export function useCustomFormulas(baseIndex: Formula[], storageKey?: string): UseCustomFormulas {
  const [custom, setCustom] = useState<Formula[]>(() => load(storageKey));

  useEffect(() => {
    if (storageKey) save(storageKey, custom);
  }, [custom, storageKey]);

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
