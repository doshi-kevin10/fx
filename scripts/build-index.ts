#!/usr/bin/env tsx
// Build pipeline: validate + relation gate, then emit
//   dist/index.json       (search/display records + baked dimCheck)
//   dist/embeddings.json  (semantic vectors; skip with --no-embeddings)
//   dist/quantities.json  (derived quantity vocabulary + fingerprints)
// Deterministic: records sorted by id.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST_DIR, validateCorpus, toIndexRecord, semanticSurface } from './lib.js';
import { validateRelations } from './relations.js';
import { buildQuantities } from './build-quantities.js';

const args = new Set(process.argv.slice(2));
const withEmbeddings = !args.has('--no-embeddings');

// 1-3. Validate + relation gate.
const { formulas, errors: baseErrors, count } = validateCorpus();
const { errors: relErrors, dimChecks } = validateRelations(formulas);
const errors = [...baseErrors, ...relErrors];
if (errors.length) {
  console.error(`\n✗ Build aborted — ${errors.length} validation error(s):\n`);
  for (const e of errors) console.error(`  • ${e}`);
  process.exit(1);
}
const verified = [...dimChecks.values()].filter((s) => s === 'consistent').length;
console.log(`✓ ${formulas.length} formulas validated (of ${count}); ${verified} dimensionally verified.`);

mkdirSync(DIST_DIR, { recursive: true });

// Index: attach dimCheck only when 'consistent' (absent ⇒ uncheckable) to stay lean.
const index = formulas.map((f) => {
  const record = toIndexRecord(f);
  if (dimChecks.get(f.id) === 'consistent') record.dimCheck = 'consistent';
  return record;
});
writeFileSync(join(DIST_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`✓ Wrote dist/index.json (${index.length} records).`);

// Quantity vocabulary + fingerprints, derived purely from corpus units.
const quantities = buildQuantities(formulas);
writeFileSync(join(DIST_DIR, 'quantities.json'), JSON.stringify(quantities, null, 2) + '\n');
console.log(
  `✓ Wrote dist/quantities.json (${quantities.vocabulary.length} quantities from corpus units).`
);

// Embeddings for semantic search.
if (withEmbeddings) {
  console.log('… Loading embedding model (Xenova/all-MiniLM-L6-v2)…');
  const { pipeline } = await import('@huggingface/transformers');
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  const embeddings: Record<string, number[]> = {};
  for (const f of formulas) {
    const output = await extractor(semanticSurface(f), { pooling: 'mean', normalize: true });
    embeddings[f.id] = Array.from(output.data as Float32Array, (v) => Math.round(v * 1e6) / 1e6);
  }
  writeFileSync(join(DIST_DIR, 'embeddings.json'), JSON.stringify(embeddings) + '\n');
  console.log(`✓ Wrote dist/embeddings.json (${Object.keys(embeddings).length} vectors).`);
} else {
  console.log('· Skipped embeddings (--no-embeddings).');
}

console.log('✓ Build complete.');
