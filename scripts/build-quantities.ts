#!/usr/bin/env tsx
// Derive the searchable "quantity" vocabulary from the corpus itself: every
// variable unit is reduced (via math.js) to a base-dimension signature; those
// signatures ARE the quantities, and the human `meaning`s that appear with each
// become its labels. Adding a formula with a new dimensioned variable makes a
// new quantity appear automatically — zero code change.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { unitSignature } from '../src/core/units.js';
import type { QuantityData } from '../src/core/types.js';

interface RawVariable {
  meaning?: string;
  unit?: string;
}
interface RawFormula {
  id: string;
  variables?: RawVariable[];
}

export function buildQuantities(formulas: RawFormula[]): QuantityData {
  const labels = new Map<string, Set<string>>();
  const formulaIds = new Map<string, Set<string>>();
  const fingerprints: Record<string, string[]> = {};

  for (const f of [...formulas].sort((a, b) => a.id.localeCompare(b.id))) {
    const sigs = new Set<string>();
    for (const v of f.variables ?? []) {
      if (!v.unit) continue;
      const sig = unitSignature(v.unit);
      if (sig === null) continue; // unparseable → gracefully absent
      sigs.add(sig);
      if (!labels.has(sig)) labels.set(sig, new Set());
      if (!formulaIds.has(sig)) formulaIds.set(sig, new Set());
      if (v.meaning) labels.get(sig)!.add(v.meaning.trim().toLowerCase());
      formulaIds.get(sig)!.add(f.id);
    }
    // Only record a fingerprint for formulas that actually have quantities.
    if (sigs.size) fingerprints[f.id] = [...sigs].sort();
  }

  const vocabulary = [...labels.keys()]
    .sort()
    .map((id) => ({
      id,
      labels: [...labels.get(id)!].sort(),
      formulaIds: [...formulaIds.get(id)!].sort(),
    }));

  return { vocabulary, fingerprints };
}

// --- CLI: standalone `tsx scripts/build-quantities.ts` ---
import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { loadFormulas, DIST_DIR } = await import('./lib.js');
  const formulas = loadFormulas().map((r) => r.formula);
  const data = buildQuantities(formulas);
  writeFileSync(join(DIST_DIR, 'quantities.json'), JSON.stringify(data, null, 2) + '\n');
  console.log(`✓ Wrote dist/quantities.json (${data.vocabulary.length} quantities).`);
}
