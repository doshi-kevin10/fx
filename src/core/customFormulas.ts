// Helpers for user-added formulas: stable id generation, name-collision checks
// (a custom formula may not reuse an existing name or alias), and KaTeX render
// validation. Framework-agnostic; the React layer wires these to UI + storage.

import type { Domain, Formula } from './types.js';
import { isRenderable } from './renderPreview.js';

const norm = (s: string) => s.trim().toLowerCase();

export function slugify(name: string): string {
  const s = norm(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s || 'formula';
}

/** A slug not already present in `taken`, disambiguated with -2, -3, … */
export function makeUniqueId(name: string, taken: Set<string>): string {
  const base = slugify(name);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/** All names + aliases (normalized) currently in use, for collision detection. */
export function takenNames(formulas: Formula[]): Set<string> {
  const set = new Set<string>();
  for (const f of formulas) {
    set.add(norm(f.name));
    for (const a of f.aliases ?? []) set.add(norm(a));
  }
  return set;
}

export interface CustomFormulaInput {
  name: string;
  latex: string;
  domain?: Domain;
}

export type ValidationError = 'empty-name' | 'empty-latex' | 'duplicate-name' | 'render-failed';

export interface ValidationResult {
  ok: boolean;
  error?: ValidationError;
  /** Human-readable, ready to show in the UI. */
  message?: string;
  formula?: Formula;
}

/**
 * Validate a user-entered formula against the existing set. On success returns
 * a ready-to-store `Formula` (with a unique id and `custom: true`).
 */
export function validateCustomFormula(
  input: CustomFormulaInput,
  existing: Formula[]
): ValidationResult {
  const name = input.name.trim();
  const latex = input.latex.trim();

  if (!name) return { ok: false, error: 'empty-name', message: 'Give your formula a name.' };
  if (!latex) return { ok: false, error: 'empty-latex', message: 'Enter the LaTeX.' };

  if (takenNames(existing).has(norm(name))) {
    return {
      ok: false,
      error: 'duplicate-name',
      message: `“${name}” is already taken — choose a different name.`,
    };
  }
  if (!isRenderable(latex)) {
    return {
      ok: false,
      error: 'render-failed',
      message: 'That LaTeX doesn’t render — check the syntax.',
    };
  }

  const takenIds = new Set(existing.map((f) => f.id));
  const formula: Formula = {
    id: makeUniqueId(name, takenIds),
    name,
    aliases: [],
    domain: input.domain ?? 'math',
    tags: ['custom'],
    latex,
    description: 'Your formula.',
    custom: true,
  };
  return { ok: true, formula };
}
