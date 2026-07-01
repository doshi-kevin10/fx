import { describe, it, expect } from 'vitest';
import { buildQuantities } from './build-quantities.js';
import { unitSignature } from '../src/core/units.js';

const ENERGY = unitSignature('J')!;
const VELOCITY = unitSignature('m/s')!;

const corpus = [
  { id: 'kinetic-energy', variables: [
    { meaning: 'kinetic energy', unit: 'J' },
    { meaning: 'mass', unit: 'kg' },
    { meaning: 'speed', unit: 'm/s' },
  ]},
  { id: 'momentum', variables: [
    { meaning: 'momentum', unit: 'kg m/s' },
    { meaning: 'mass', unit: 'kg' },
    { meaning: 'velocity', unit: 'm/s' },
  ]},
  { id: 'combustion', variables: [] }, // chemistry-like: no dimensioned vars
];

describe('buildQuantities (derived, not hardcoded)', () => {
  it('groups variables by base-dimension signature', () => {
    const { vocabulary } = buildQuantities(corpus);
    const energy = vocabulary.find((q) => q.id === ENERGY);
    expect(energy).toBeTruthy();
    expect(energy!.formulaIds).toContain('kinetic-energy');
    expect(energy!.labels).toContain('kinetic energy');
  });

  it('emits a fingerprint per formula and omits formulas with no quantities', () => {
    const { fingerprints } = buildQuantities(corpus);
    expect(fingerprints['kinetic-energy']).toContain(VELOCITY);
    expect('combustion' in fingerprints).toBe(false); // graceful absence
  });

  it('REGRESSION: adding a formula with a new dimensioned unit adds a new quantity, zero code change', () => {
    const before = buildQuantities(corpus).vocabulary.map((q) => q.id);
    const withPressure = [
      ...corpus,
      { id: 'pressure-def', variables: [{ meaning: 'pressure', unit: 'Pa' }] },
    ];
    const after = buildQuantities(withPressure).vocabulary;
    const pressureSig = unitSignature('Pa')!;
    expect(before).not.toContain(pressureSig);
    const added = after.find((q) => q.id === pressureSig);
    expect(added).toBeTruthy();
    expect(added!.labels).toContain('pressure');
    expect(added!.formulaIds).toEqual(['pressure-def']);
  });

  it('is deterministic (sorted vocabulary, labels, formulaIds)', () => {
    const v = buildQuantities(corpus).vocabulary;
    expect(v.map((q) => q.id)).toEqual([...v.map((q) => q.id)].sort());
    for (const q of v) {
      expect(q.labels).toEqual([...q.labels].sort());
      expect(q.formulaIds).toEqual([...q.formulaIds].sort());
    }
  });
});
