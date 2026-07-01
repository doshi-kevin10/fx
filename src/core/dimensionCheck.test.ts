import { describe, it, expect } from 'vitest';
import { dimensionCheck, relationSymbols } from './dimensionCheck.js';
import { unitSignature } from './units.js';

describe('unitSignature (data-driven via math.js)', () => {
  it('groups equivalent units by base dimension', () => {
    // Energy: J and kg·m²/s² must produce the same signature.
    expect(unitSignature('J')).toBe(unitSignature('kg m^2/s^2'));
  });
  it('distinguishes different dimensions', () => {
    expect(unitSignature('m/s')).not.toBe(unitSignature('J'));
  });
  it('returns null for unparseable units', () => {
    expect(unitSignature('\\Omega')).toBeNull();
    expect(unitSignature('bogusunit')).toBeNull();
  });
  it('treats radians as dimensionless (rad/s → time^-1)', () => {
    expect(unitSignature('rad/s')).toBe(unitSignature('1/s'));
  });
});

describe('relationSymbols', () => {
  it('extracts variables, excluding numeric factors and constants', () => {
    expect(relationSymbols('E_k = 1/2 * m * v^2').sort()).toEqual(['E_k', 'm', 'v']);
  });
});

describe('dimensionCheck', () => {
  it('confirms a consistent relation', () => {
    expect(dimensionCheck('E_k = 1/2 * m * v^2', { E_k: 'J', m: 'kg', v: 'm/s' }).status).toBe('consistent');
  });
  it('confirms rotational KE', () => {
    expect(dimensionCheck('E_k = 1/2 * I * omega^2', { E_k: 'J', I: 'kg m^2', omega: 'rad/s' }).status).toBe('consistent');
  });
  it('confirms the ideal gas law across the equals sign', () => {
    expect(
      dimensionCheck('P * V = n * R * T', { P: 'Pa', V: 'm^3', n: 'mol', R: 'J/(mol K)', T: 'K' }).status
    ).toBe('consistent');
  });
  it('confirms addition of like dimensions (v = u + a t)', () => {
    expect(dimensionCheck('v = u + a * t', { v: 'm/s', u: 'm/s', a: 'm/s^2', t: 's' }).status).toBe('consistent');
  });
  it('flags a wrong exponent as inconsistent (must fail CI)', () => {
    const r = dimensionCheck('E_k = 1/2 * I * omega^3', { E_k: 'J', I: 'kg m^2', omega: 'rad/s' });
    expect(r.status).toBe('inconsistent');
  });
  it('flags adding incompatible dimensions as inconsistent', () => {
    expect(dimensionCheck('x = a + b', { x: 'm', a: 'm', b: 's' }).status).toBe('inconsistent');
  });
  it('is uncheckable with no relation', () => {
    expect(dimensionCheck(undefined, {}).status).toBe('uncheckable');
  });
  it('is uncheckable when a referenced variable has no unit', () => {
    expect(dimensionCheck('a = b * c', { a: 'm', b: 'm' }).status).toBe('uncheckable');
  });
});
