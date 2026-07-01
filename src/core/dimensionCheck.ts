// Data-driven dimensional consistency check via math.js. Given a relation and
// the declared units of its variables, evaluates both sides with each variable
// set to a magnitude-1 quantity of its unit and compares base dimensions.
// Numeric factors (½, 2π) don't affect dimensions, so they're ignored naturally.
//
// Build-time + test only (imports units.ts → math.js). Results are baked into
// index.json; the runtime never re-runs this.

import { math, parseUnit, signatureOf } from './units.js';

export interface DimResult {
  status: 'consistent' | 'inconsistent' | 'uncheckable';
  detail?: string;
}

/** Split a relation on its single top-level '=' into [lhs, rhs], or null. */
function sides(relation: string): [string, string] | null {
  const idx = relation.indexOf('=');
  if (idx < 0) return null;
  return [relation.slice(0, idx).trim(), relation.slice(idx + 1).trim()];
}

// The math.js literal constants an author might legitimately use in a relation
// as non-variables. These are reserved: don't name a variable key after them.
export const MATH_CONSTANTS = new Set(['pi', 'e', 'tau']);

/** All symbol names referenced by a relation (excludes function-call names). */
export function relationSymbols(relation: string): string[] {
  const syms = new Set<string>();
  const fns = new Set<string>();
  for (const part of sides(relation) ?? [relation]) {
    let node;
    try {
      node = math.parse(part);
    } catch {
      continue;
    }
    node.traverse((raw) => {
      const n = raw as unknown as {
        isSymbolNode?: boolean;
        isFunctionNode?: boolean;
        name?: string;
        fn?: { name?: string };
      };
      if (n.isFunctionNode && n.fn?.name) fns.add(n.fn.name);
      if (n.isSymbolNode && n.name) syms.add(n.name);
    });
  }
  return [...syms].filter((s) => !fns.has(s));
}

/**
 * Check dimensional consistency of `relation` given each variable's unit.
 * Returns 'uncheckable' when there's no relation or a referenced variable lacks
 * a parseable unit — a state, not a failure.
 */
export function dimensionCheck(
  relation: string | undefined,
  varUnits: Record<string, string | undefined>
): DimResult {
  if (!relation || !relation.includes('=')) {
    return { status: 'uncheckable', detail: 'no relation' };
  }
  const split = sides(relation);
  if (!split) return { status: 'uncheckable', detail: 'no equality' };
  const [lhs, rhs] = split;

  const scope: Record<string, unknown> = {};
  for (const sym of relationSymbols(relation)) {
    const unit = varUnits[sym];
    if (!unit) {
      // A bare math constant (pi, e, tau) is fine — let math.js supply it.
      if (MATH_CONSTANTS.has(sym)) continue;
      return { status: 'uncheckable', detail: `no unit for “${sym}”` };
    }
    const parsed = parseUnit(unit);
    if (parsed === null) return { status: 'uncheckable', detail: `unit “${unit}” not parseable` };
    scope[sym] = parsed; // magnitude-1 quantity of this unit
  }

  try {
    const left = math.evaluate(lhs, { ...scope });
    const right = math.evaluate(rhs, { ...scope });
    const ls = signatureOf(left);
    const rs = signatureOf(right);
    return ls === rs
      ? { status: 'consistent' }
      : { status: 'inconsistent', detail: `LHS is [${ls}] but RHS is [${rs}]` };
  } catch (err) {
    // A throw here (e.g. adding incompatible units) is itself an inconsistency.
    return { status: 'inconsistent', detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Convenience: build a { key → unit } map from a formula's variables. */
export function unitMapFromVariables(
  variables: ReadonlyArray<{ key?: string; unit?: string }> | undefined
): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = {};
  for (const v of variables ?? []) {
    if (v.key) map[v.key] = v.unit;
  }
  return map;
}
