// Unit-aware calculator over a formula's machine `relation`. Solve for ANY one
// unknown: direct evaluation when the target is isolated on a side, else numeric
// root-finding on the residual. Works in SI magnitudes internally (math.js
// normalizes every unit to SI via Unit.value), so results are unit-correct.
//
// math.js is imported here on purpose: this module is only ever lazy-imported by
// the calculator UI, so it stays in its own chunk and never bloats the base bundle.

import { create, all, type MathJsInstance } from 'mathjs';

const math: MathJsInstance = create(all, {});

// Reserved math constants an author may use in a relation as non-variables.
const CONSTANTS = new Set(['pi', 'e', 'tau']);

export interface CalcVariable {
  key: string;
  unit?: string;
}

export interface SolveInput {
  relation: string;
  variables: CalcVariable[];
  /** Known values, keyed by variable key, expressed in that variable's unit. */
  known: Record<string, number>;
  /** The variable to solve for. */
  target: string;
}

export interface SolveResult {
  ok: boolean;
  value?: number;
  unit?: string;
  method?: 'direct' | 'numeric';
  error?: string;
}

function sides(relation: string): [string, string] | null {
  const idx = relation.indexOf('=');
  return idx < 0 ? null : [relation.slice(0, idx).trim(), relation.slice(idx + 1).trim()];
}

/** SI magnitude of `value` given in `unit` (math.js normalizes to SI base). */
function toSI(value: number, unit?: string): number {
  if (!unit) return value;
  const q = math.evaluate(`${value} ${unit}`) as { value?: number };
  return typeof q.value === 'number' ? q.value : value;
}

/** SI magnitude of one `unit` — the factor to convert SI back to display units. */
function unitFactor(unit?: string): number {
  return unit ? toSI(1, unit) : 1;
}

function symbolsIn(expr: string): string[] {
  const found = new Set<string>();
  const fns = new Set<string>();
  try {
    math.parse(expr).traverse((raw) => {
      const n = raw as unknown as { isSymbolNode?: boolean; isFunctionNode?: boolean; name?: string; fn?: { name?: string } };
      if (n.isFunctionNode && n.fn?.name) fns.add(n.fn.name);
      if (n.isSymbolNode && n.name) found.add(n.name);
    });
  } catch {
    /* ignore parse errors here; validated at build time */
  }
  return [...found].filter((s) => !fns.has(s));
}

function bisect(f: (x: number) => number, a: number, b: number): number {
  let lo = Math.min(a, b);
  let hi = Math.max(a, b);
  let flo = f(lo);
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (!Number.isFinite(fm)) return mid;
    if (Math.abs(fm) < 1e-12 || hi - lo < 1e-14 * Math.max(1, Math.abs(mid))) return mid;
    if (flo * fm < 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

/** Scan an ordered list for the first sign change and bisect it. */
function scanList(f: (x: number) => number, xs: number[]): number | null {
  const pts = xs.map((x) => ({ x, y: f(x) })).filter((p) => Number.isFinite(p.y));
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i].y === 0) return pts[i].x;
    if (pts[i].y * pts[i + 1].y < 0) return bisect(f, pts[i].x, pts[i + 1].x);
  }
  const last = pts[pts.length - 1];
  return last && last.y === 0 ? last.x : null;
}

/** Find a root of f, preferring the positive root (physical quantities). */
function solveScan(f: (x: number) => number): number | null {
  const pos = [0];
  const neg = [0];
  for (let k = -15; k <= 15; k++) {
    pos.push(10 ** k);
    neg.push(-(10 ** k));
  }
  neg.sort((a, b) => a - b); // ascending (…-1000, -100, …, 0)
  const positive = scanList(f, pos);
  return positive !== null ? positive : scanList(f, neg);
}

/** Solve a relation for one unknown, unit-aware. Never throws. */
export function solve(input: SolveInput): SolveResult {
  const { relation, target } = input;
  const split = sides(relation);
  if (!split) return { ok: false, error: 'Formula has no solvable relation.' };
  const [lhs, rhs] = split;

  const unitOf = new Map(input.variables.map((v) => [v.key, v.unit]));
  if (!unitOf.has(target)) return { ok: false, error: `“${target}” is not a variable of this formula.` };

  // Every referenced symbol except the target and math constants must be known.
  const referenced = new Set(symbolsIn(relation));
  const missing = [...referenced].filter((s) => s !== target && !CONSTANTS.has(s) && !(s in input.known));
  if (missing.length) return { ok: false, error: `Enter a value for: ${missing.join(', ')}.` };

  // Build the SI-magnitude scope for the known variables.
  const scope: Record<string, number> = {};
  for (const [key, value] of Object.entries(input.known)) {
    if (key === target) continue;
    if (!Number.isFinite(value)) return { ok: false, error: `“${key}” is not a number.` };
    scope[key] = toSI(value, unitOf.get(key));
  }

  const evalSide = (expr: string, x?: number): number => {
    const s = x === undefined ? scope : { ...scope, [target]: x };
    const out = math.evaluate(expr, s);
    return typeof out === 'number' ? out : Number(out);
  };

  const factor = unitFactor(unitOf.get(target));
  const toDisplay = (si: number): SolveResult => ({
    ok: true,
    value: si / factor,
    unit: unitOf.get(target),
    method: lhs === target || rhs === target ? 'direct' : 'numeric',
  });

  try {
    // Direct: the target is isolated on one side.
    if (lhs === target) return toDisplay(evalSide(rhs));
    if (rhs === target) return toDisplay(evalSide(lhs));

    // Numeric: root of residual(x) = lhs(x) - rhs(x), x in SI magnitude.
    const residual = (xSI: number) => evalSide(lhs, xSI) - evalSide(rhs, xSI);
    const rootSI = solveScan(residual);
    if (rootSI === null) {
      return { ok: false, error: 'Could not solve numerically for that variable — try solving for a different one.' };
    }
    return { ok: true, value: rootSI / factor, unit: unitOf.get(target), method: 'numeric' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Calculation failed.' };
  }
}

/** Format a numeric result compactly (6 significant figures, trimmed). */
export function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e6 || abs < 1e-4) return value.toExponential(4).replace(/\.?0+e/, 'e');
  return String(Number(value.toPrecision(6)));
}
