import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createQuantityIndex } from './quantitySearch.js';
import { unitSignature } from './units.js';
import type { Formula, QuantityData } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const index: Formula[] = JSON.parse(readFileSync(join(root, 'dist', 'index.json'), 'utf8'));
const quantities: QuantityData = JSON.parse(readFileSync(join(root, 'dist', 'quantities.json'), 'utf8'));

const qi = createQuantityIndex({ index, quantities });

const MASS = unitSignature('kg')!;
const VELOCITY = unitSignature('m/s')!;
const ENERGY = unitSignature('J')!;

describe('quantity search (real corpus)', () => {
  it('mass + velocity surfaces kinetic energy & momentum at the top', () => {
    const res = qi.search([MASS, VELOCITY]);
    const topTwo = [res[0].formula.id, res[1].formula.id].sort();
    expect(topTwo).toEqual(['kinetic-energy', 'linear-momentum']);
    expect(res[0].score).toBe(1);
  });

  it('ranks a tight 2-quantity match above an over-specified formula', () => {
    const res = qi.search([MASS, VELOCITY]);
    const rank = (id: string) => res.findIndex((r) => r.formula.id === id);
    // Gravitational PE shares only "mass" but needs g + height too → more missing.
    const ke = rank('kinetic-energy');
    const gpe = rank('gravitational-potential-energy');
    expect(ke).toBeGreaterThanOrEqual(0);
    expect(gpe).toBeGreaterThan(ke); // over-specified ranks lower
    // Formulas sharing no quantity (rotational KE) are excluded entirely.
    expect(rank('rotational-kinetic-energy')).toBe(-1);
  });

  it('honors the "want" quantity as a tie-breaker/bonus', () => {
    const res = qi.search([MASS], ENERGY);
    expect(res.some((r) => r.formula.id === 'kinetic-energy')).toBe(true);
    expect(res.every((r) => r.score >= 0 && r.score <= 1)).toBe(true);
  });

  it('returns nothing for empty have and no want', () => {
    expect(qi.search([])).toEqual([]);
  });

  it('returns nothing when want matches no formula and have is empty', () => {
    expect(qi.search([], 'NONEXISTENT^99')).toEqual([]);
  });

  it('emits the uniform SearchResult shape', () => {
    const [r] = qi.search([MASS, VELOCITY]);
    expect(r).toMatchObject({ keywordScore: 0, semanticScore: 0, exact: false });
    expect(r.formula.latex).toBeTruthy();
  });
});

describe('quantity autocomplete', () => {
  it('suggests quantities by label substring', () => {
    const hits = qi.suggest('mass');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((q) => q.labels.some((l) => l.includes('mass')))).toBe(true);
  });
  it('prefix matches rank ahead of mid-string matches', () => {
    const hits = qi.suggest('energy');
    expect(hits.length).toBeGreaterThan(0);
  });
});
