// Unit parsing + dimension-signature derivation, backed entirely by math.js.
// There are NO hardcoded unit→dimension tables here: every dimension comes from
// math.js reducing a unit string to its base-dimension exponent vector.
//
// This module (and dimensionCheck.ts) is imported only by build scripts and
// tests — never by the shipped runtime — so math.js stays out of the bundle.

import { create, all, type MathJsInstance } from 'mathjs';

export const math: MathJsInstance = create(all, {});

// math.js exposes the ordered base-dimension names and, on each Unit instance,
// a parallel exponent array. Neither is in the published TS types, so narrow here.
interface UnitLike {
  dimensions: number[];
}
const BASE_DIMENSIONS: string[] = (math as unknown as { Unit: { BASE_DIMENSIONS: string[] } }).Unit
  .BASE_DIMENSIONS;

// math.js models angle as a base dimension, but in SI the radian/steradian are
// dimensionless derived units. For physical dimensional analysis we treat them
// as dimensionless so e.g. rotational KE (½·I·ω²) reduces to energy, not
// energy·angle². This is a documented modeling choice, not a unit lookup table.
const NON_PHYSICAL_DIMENSIONS = new Set(['ANGLE', 'SOLID_ANGLE']);

/** Canonical string for the dimensionless signature. */
export const DIMENSIONLESS = 'DIMENSIONLESS';

/** Parse a unit string to a math.js Unit of magnitude 1, or null if unparseable. */
export function parseUnit(unit: string): unknown | null {
  const trimmed = unit.trim();
  if (!trimmed) return null;
  try {
    // math.unit('m/s') yields a *valueless* unit, which can't be added; scale by
    // 1 so the result is a genuine magnitude-1 quantity usable in arithmetic.
    return math.multiply(1, math.unit(trimmed));
  } catch {
    try {
      const evaluated = math.evaluate(trimmed);
      return math.typeOf(evaluated) === 'Unit' ? evaluated : null;
    } catch {
      return null;
    }
  }
}

/** Stable dimension signature for a parsed value (Unit or plain number). */
export function signatureOf(value: unknown): string {
  if (value == null) return DIMENSIONLESS;
  if (math.typeOf(value) !== 'Unit') return DIMENSIONLESS; // numbers, fractions → dimensionless
  const dims = (value as UnitLike).dimensions ?? [];
  const parts: string[] = [];
  for (let i = 0; i < BASE_DIMENSIONS.length; i++) {
    const name = BASE_DIMENSIONS[i];
    const exp = dims[i];
    if (exp && !NON_PHYSICAL_DIMENSIONS.has(name)) {
      parts.push(exp === 1 ? name : `${name}^${exp}`);
    }
  }
  parts.sort();
  return parts.length ? parts.join(' ') : DIMENSIONLESS;
}

/** Dimension signature of a unit string, or null if it doesn't parse. */
export function unitSignature(unit: string): string | null {
  const parsed = parseUnit(unit);
  return parsed === null ? null : signatureOf(parsed);
}
