// Shared helpers for the build/validate scripts (run via tsx).
// Pure Node, no network (the KaTeX render check runs locally).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import katex from 'katex';
import 'katex/dist/contrib/mhchem.mjs'; // registers \ce for chemistry equations
import type { DimCheckStatus } from '../src/core/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..');
export const DATA_DIR = join(ROOT, 'data', 'formulas');
export const SCHEMA_PATH = join(ROOT, 'schema', 'formula.schema.json');
export const DIST_DIR = join(ROOT, 'dist');

export interface RawVariable {
  key?: string;
  symbol?: string;
  meaning?: string;
  unit?: string;
}
export interface RawFormula {
  id: string;
  name?: string;
  aliases?: string[];
  domain?: string;
  subdomain?: string;
  tags?: string[];
  latex: string;
  description?: string;
  variables?: RawVariable[];
  source?: string;
  relation?: string;
}

export interface IndexRecord {
  id: string;
  name?: string;
  aliases: string[];
  domain?: string;
  subdomain?: string;
  tags: string[];
  latex: string;
  description?: string;
  variables: RawVariable[];
  source?: string;
  relation?: string;
  dimCheck?: DimCheckStatus;
}

export interface FormulaFileRecord {
  formula: RawFormula;
  file: string;
  docIndex: number;
}

/** Recursively collect every *.yaml / *.yml file under a directory. */
function collectYamlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...collectYamlFiles(full));
    else if (/\.ya?ml$/i.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Load every formula from data/formulas/**. A YAML file may contain a single
 * formula (object), a list, or multiple `---`-separated documents.
 */
export function loadFormulas(): FormulaFileRecord[] {
  const records: FormulaFileRecord[] = [];
  for (const file of collectYamlFiles(DATA_DIR).sort()) {
    const raw = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file);
    const docs = yaml.loadAll(raw) as unknown[];
    docs.forEach((doc, docIndex) => {
      if (doc == null) return;
      const items = (Array.isArray(doc) ? doc : [doc]) as RawFormula[];
      for (const formula of items) {
        if (formula == null) continue;
        records.push({ formula, file: rel, docIndex });
      }
    });
  }
  return records;
}

/** Build an Ajv validator from the JSON schema. */
export function makeValidator(): ValidateFunction {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

/** Render-check a formula's LaTeX with KaTeX (mhchem loaded, throwOnError). */
export function renderCheck(latex: string): { ok: true } | { ok: false; error: string } {
  try {
    katex.renderToString(latex, { throwOnError: true, displayMode: true, strict: false });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Validate the corpus: schema conformance, id uniqueness, render check. */
export function validateCorpus(): { formulas: RawFormula[]; errors: string[]; count: number } {
  const validate = makeValidator();
  const records = loadFormulas();
  const errors: string[] = [];
  const seenIds = new Map<string, string>();

  for (const { formula, file } of records) {
    const label = formula?.id ? `"${formula.id}"` : `(no id) in ${file}`;

    if (!validate(formula)) {
      for (const e of validate.errors ?? []) {
        errors.push(`Schema error in ${file} ${label}: ${e.instancePath || '/'} ${e.message}`);
      }
      continue;
    }

    if (seenIds.has(formula.id)) {
      errors.push(`Duplicate id "${formula.id}" in ${file} (already defined in ${seenIds.get(formula.id)})`);
    } else {
      seenIds.set(formula.id, file);
    }

    const r = renderCheck(formula.latex);
    if (!r.ok) errors.push(`LaTeX render failed for "${formula.id}" in ${file}: ${r.error}`);
  }

  const formulas = records
    .map((r) => r.formula)
    .filter((f): f is RawFormula => Boolean(f) && typeof f.id === 'string')
    .sort((a, b) => a.id.localeCompare(b.id));

  return { formulas, errors, count: records.length };
}

/** The lean record shape shipped in dist/index.json. */
export function toIndexRecord(f: RawFormula): IndexRecord {
  return {
    id: f.id,
    name: f.name,
    aliases: f.aliases ?? [],
    domain: f.domain,
    subdomain: f.subdomain,
    tags: f.tags ?? [],
    latex: f.latex,
    description: f.description?.trim(),
    variables: f.variables ?? [],
    source: f.source,
    ...(f.relation ? { relation: f.relation } : {}),
  };
}

/** The text surface embedded for semantic search. */
export function semanticSurface(f: RawFormula): string {
  const parts = [f.name ?? ''];
  if (f.aliases?.length) parts.push(f.aliases.join('. '));
  if (f.description) parts.push(f.description.trim());
  return parts.join('. ').replace(/\s+/g, ' ').trim();
}
