import { describe, it, expect } from 'vitest';
import { validateCustomFormula, makeUniqueId, slugify, takenNames } from './customFormulas.js';
import type { Formula } from './types.js';

const existing: Formula[] = [
  { id: 'kinetic-energy', name: 'Kinetic Energy', aliases: ['KE'], domain: 'physics', tags: [], latex: 'E_k = \\tfrac12 m v^2' },
];

describe('slugify / makeUniqueId', () => {
  it('kebab-cases names', () => {
    expect(slugify('My Drag Equation!')).toBe('my-drag-equation');
  });
  it('falls back for empty/symbol-only names', () => {
    expect(slugify('!!!')).toBe('formula');
  });
  it('disambiguates collisions', () => {
    expect(makeUniqueId('Kinetic Energy', new Set(['kinetic-energy']))).toBe('kinetic-energy-2');
  });
});

describe('validateCustomFormula', () => {
  it('accepts a valid new formula and marks it custom', () => {
    const r = validateCustomFormula({ name: 'Drag Force', latex: 'F_d = \\tfrac12 \\rho v^2 C_d A' }, existing);
    expect(r.ok).toBe(true);
    expect(r.formula?.custom).toBe(true);
    expect(r.formula?.id).toBe('drag-force');
  });

  it('rejects a name that collides with an existing name (case-insensitive)', () => {
    const r = validateCustomFormula({ name: 'kinetic ENERGY', latex: 'x' }, existing);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('duplicate-name');
  });

  it('rejects a name that collides with an existing alias', () => {
    const r = validateCustomFormula({ name: 'KE', latex: 'x = 1' }, existing);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('duplicate-name');
  });

  it('rejects LaTeX that does not render', () => {
    const r = validateCustomFormula({ name: 'Broken', latex: '\\frac{1}{2' }, existing);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('render-failed');
  });

  it('rejects empty name and empty latex', () => {
    expect(validateCustomFormula({ name: '  ', latex: 'x' }, existing).error).toBe('empty-name');
    expect(validateCustomFormula({ name: 'x', latex: '  ' }, existing).error).toBe('empty-latex');
  });
});

describe('takenNames', () => {
  it('includes names and aliases, normalized', () => {
    const s = takenNames(existing);
    expect(s.has('kinetic energy')).toBe(true);
    expect(s.has('ke')).toBe(true);
  });
});
