// Compact unit-aware calculator for a formula with a machine `relation`.
// Enter the values you know; mark one variable as the unknown; it solves for it
// (directly or numerically) with correct units. math.js is lazy-imported the
// first time a calculator opens, so the base bundle stays lean.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Formula } from '../core/types.js';
import type { SolveResult, SolveInput } from '../core/calculator.js';
import { Tex } from './Tex.js';

type SolveFn = (input: SolveInput) => SolveResult;
type FormatFn = (value: number) => string;

export interface CalculatorPanelProps {
  formula: Formula;
  className?: string;
}

/** The subject key of a relation (LHS if it's a single symbol), else first var. */
function defaultTarget(formula: Formula): string {
  const keys = (formula.variables ?? []).filter((v) => v.key).map((v) => v.key!);
  const lhs = formula.relation?.split('=')[0]?.trim();
  return lhs && keys.includes(lhs) ? lhs : keys[0] ?? '';
}

export function CalculatorPanel({ formula, className }: CalculatorPanelProps) {
  const variables = useMemo(
    () => (formula.variables ?? []).filter((v) => v.key),
    [formula]
  );

  const [target, setTarget] = useState(() => defaultTarget(formula));
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SolveResult | null>(null);

  const solveRef = useRef<{ solve: SolveFn; formatValue: FormatFn } | null>(null);
  const [ready, setReady] = useState(false);

  // Reset when the formula changes.
  useEffect(() => {
    setTarget(defaultTarget(formula));
    setValues({});
    setResult(null);
  }, [formula]);

  // Lazy-load the calculator engine (math.js) on first open.
  useEffect(() => {
    let alive = true;
    void import('../core/calculator.js').then((mod) => {
      if (!alive) return;
      solveRef.current = { solve: mod.solve, formatValue: mod.formatValue };
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Recompute whenever inputs or target change.
  useEffect(() => {
    if (!ready || !solveRef.current || !formula.relation) return;
    const known: Record<string, number> = {};
    for (const v of variables) {
      if (v.key === target) continue;
      const raw = values[v.key!];
      if (raw !== undefined && raw.trim() !== '') known[v.key!] = Number(raw);
    }
    setResult(
      solveRef.current.solve({
        relation: formula.relation,
        variables: variables.map((v) => ({ key: v.key!, unit: v.unit })),
        known,
        target,
      })
    );
  }, [ready, values, target, variables, formula.relation]);

  const fmt = solveRef.current?.formatValue ?? ((n: number) => String(n));

  return (
    <div className={['fzk', className].filter(Boolean).join(' ')}>
      <div className="fzk-rows">
        {variables.map((v) => {
          const isTarget = v.key === target;
          return (
            <div key={v.key} className={`fzk-row ${isTarget ? 'fzk-row-target' : ''}`}>
              <button
                className="fzk-sym"
                title={isTarget ? 'Solving for this' : `Solve for ${v.meaning ?? v.key}`}
                onClick={() => setTarget(v.key!)}
                aria-pressed={isTarget}
              >
                <Tex latex={v.symbol} />
              </button>
              {isTarget ? (
                <span className="fzk-out" aria-live="polite">
                  {result?.ok && result.value !== undefined ? (
                    <>
                      <span className="fzk-out-val">{fmt(result.value)}</span>
                      {v.unit && <span className="fzk-out-unit">{v.unit}</span>}
                    </>
                  ) : (
                    <span className="fzk-out-empty">= ?</span>
                  )}
                </span>
              ) : (
                <span className="fzk-in-wrap">
                  <input
                    className="fzk-in"
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    value={values[v.key!] ?? ''}
                    onChange={(e) => setValues((s) => ({ ...s, [v.key!]: e.target.value }))}
                  />
                  {v.unit && <span className="fzk-in-unit">{v.unit}</span>}
                </span>
              )}
              <span className="fzk-mean">{v.meaning}</span>
            </div>
          );
        })}
      </div>
      {result && !result.ok && <div className="fzk-msg">{result.error}</div>}
      {result?.ok && result.method === 'numeric' && (
        <div className="fzk-note">solved numerically</div>
      )}
      {!ready && <div className="fzk-msg">loading calculator…</div>}
    </div>
  );
}
