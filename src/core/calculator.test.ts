import { describe, it, expect } from 'vitest';
import { solve, formatValue } from './calculator.js';

const KE = {
  relation: 'E_k = 1/2 * m * v^2',
  variables: [
    { key: 'E_k', unit: 'J' },
    { key: 'm', unit: 'kg' },
    { key: 'v', unit: 'm/s' },
  ],
};

describe('calculator.solve', () => {
  it('forward-evaluates the subject (E_k from m, v)', () => {
    const r = solve({ ...KE, known: { m: 2, v: 3 }, target: 'E_k' });
    expect(r.ok).toBe(true);
    expect(r.value).toBeCloseTo(9, 6); // ½·2·3² = 9 J
    expect(r.unit).toBe('J');
    expect(r.method).toBe('direct');
  });

  it('solves backwards for a non-isolated unknown (v from E_k, m)', () => {
    const r = solve({ ...KE, known: { E_k: 50, m: 4 }, target: 'v' });
    expect(r.ok).toBe(true);
    expect(r.value).toBeCloseTo(5, 4); // v = √(2·50/4) = 5 m/s
    expect(r.method).toBe('numeric');
  });

  it('is unit-aware across non-SI prefixes', () => {
    // v in km/s: 3 km/s = 3000 m/s → E_k = ½·2·3000² = 9e6 J
    const r = solve({
      relation: 'E_k = 1/2 * m * v^2',
      variables: [{ key: 'E_k', unit: 'J' }, { key: 'm', unit: 'kg' }, { key: 'v', unit: 'km/s' }],
      known: { m: 2, v: 3 },
      target: 'E_k',
    });
    expect(r.value).toBeCloseTo(9e6, 0);
  });

  it('solves a multi-term relation (ideal gas: T from P,V,n,R)', () => {
    const r = solve({
      relation: 'P * V = n * R * T',
      variables: [
        { key: 'P', unit: 'Pa' }, { key: 'V', unit: 'm^3' }, { key: 'n', unit: 'mol' },
        { key: 'R', unit: 'J/(mol K)' }, { key: 'T', unit: 'K' },
      ],
      known: { P: 101325, V: 0.0224, n: 1, R: 8.314 },
      target: 'T',
    });
    expect(r.ok).toBe(true);
    expect(r.value).toBeCloseTo(273.2, 0); // ~STP
  });

  it('handles a linear relation with addition (v = u + a t, solve t)', () => {
    const r = solve({
      relation: 'v = u + a * t',
      variables: [{ key: 'v', unit: 'm/s' }, { key: 'u', unit: 'm/s' }, { key: 'a', unit: 'm/s^2' }, { key: 't', unit: 's' }],
      known: { v: 20, u: 5, a: 3 },
      target: 't',
    });
    expect(r.value).toBeCloseTo(5, 4); // (20-5)/3
  });

  it('reports missing inputs instead of throwing', () => {
    const r = solve({ ...KE, known: { m: 2 }, target: 'E_k' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Enter a value/);
  });
});

describe('formatValue', () => {
  it('trims and uses scientific notation sensibly', () => {
    expect(formatValue(9)).toBe('9');
    expect(formatValue(273.15)).toBe('273.15');
    expect(formatValue(9_000_000)).toMatch(/e/);
    expect(formatValue(0)).toBe('0');
  });
});
