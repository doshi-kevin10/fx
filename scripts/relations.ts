// Build-time relation gate + dimension-status computation, shared by validate
// and build-index. Imports the TS core, so these scripts run via `tsx`.

import { dimensionCheck, relationSymbols, unitMapFromVariables, MATH_CONSTANTS } from '../src/core/dimensionCheck.js';
import { parseUnit } from '../src/core/units.js';
import type { DimCheckStatus } from '../src/core/types.js';

interface RawVariable {
  key?: string;
  symbol?: string;
  meaning?: string;
  unit?: string;
}
interface RawFormula {
  id: string;
  relation?: string;
  variables?: RawVariable[];
}

export interface RelationResult {
  errors: string[];
  dimCheck: DimCheckStatus;
}

/** Gate one formula's relation; returns build errors + the baked dim status. */
export function checkRelation(formula: RawFormula): RelationResult {
  const errors: string[] = [];
  const relation = formula.relation;
  if (!relation) return { errors, dimCheck: 'uncheckable' };

  const keys = new Set<string>();
  for (const v of formula.variables ?? []) if (v.key) keys.add(v.key);

  // 1. Every symbol the relation references must be a declared variable key
  //    (or a reserved math constant like pi/e/tau).
  for (const sym of relationSymbols(relation)) {
    if (!keys.has(sym) && !MATH_CONSTANTS.has(sym)) {
      errors.push(`relation references "${sym}" which is not a variables[].key`);
    }
  }

  // 2. Every variable unit on a relation-bearing formula must parse in math.js.
  for (const v of formula.variables ?? []) {
    if (v.unit != null && v.unit !== '' && parseUnit(v.unit) === null) {
      errors.push(`unit "${v.unit}" (variable "${v.key ?? v.symbol ?? '?'}") is not parseable by math.js`);
    }
  }

  if (errors.length) return { errors, dimCheck: 'uncheckable' };

  // 3. Dimensional consistency — inconsistent is a build failure.
  const res = dimensionCheck(relation, unitMapFromVariables(formula.variables));
  if (res.status === 'inconsistent') {
    errors.push(`relation is dimensionally inconsistent (${res.detail})`);
    return { errors, dimCheck: 'uncheckable' };
  }
  return { errors, dimCheck: res.status === 'consistent' ? 'consistent' : 'uncheckable' };
}

/** Run the gate across the corpus; collect errors and per-id dim statuses. */
export function validateRelations(
  formulas: RawFormula[]
): { errors: string[]; dimChecks: Map<string, DimCheckStatus> } {
  const errors: string[] = [];
  const dimChecks = new Map<string, DimCheckStatus>();
  for (const f of formulas) {
    const { errors: e, dimCheck } = checkRelation(f);
    for (const msg of e) errors.push(`"${f.id}": ${msg}`);
    dimChecks.set(f.id, dimCheck);
  }
  return { errors, dimChecks };
}
