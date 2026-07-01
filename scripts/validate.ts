#!/usr/bin/env tsx
// Validate the corpus: schema + id uniqueness + KaTeX render (lib.mjs), then the
// relation gate (referenced keys exist, units parse, dimensions consistent).
// Exits non-zero on any error so CI gates PRs.

import { validateCorpus } from './lib.js';
import { validateRelations } from './relations.js';

const { formulas, errors: baseErrors, count } = validateCorpus();
const { errors: relErrors, dimChecks } = validateRelations(formulas);
const errors = [...baseErrors, ...relErrors];

if (errors.length) {
  console.error(`\n✗ Validation failed with ${errors.length} error(s):\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error(`\nChecked ${count} formula record(s).\n`);
  process.exit(1);
}

const verified = [...dimChecks.values()].filter((s) => s === 'consistent').length;
console.log(
  `✓ ${formulas.length} formulas valid (schema + unique ids + KaTeX render + relation gate).`
);
console.log(`  ${verified} dimensionally verified; ${formulas.length - verified} uncheckable (no relation).`);
