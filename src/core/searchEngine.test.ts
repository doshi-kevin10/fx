import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSearchEngine } from './searchEngine.js';
import type { Formula } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));
const index: Formula[] = JSON.parse(
  readFileSync(join(here, '..', '..', 'dist', 'index.json'), 'utf8')
);

const engine = createSearchEngine({ index });

function topId(q: string): string | undefined {
  return engine.searchKeyword(q)[0]?.formula.id;
}

describe('keyword search on the real index', () => {
  it('finds kinetic energy by full name', () => {
    expect(topId('kinetic energy')).toBe('kinetic-energy');
  });

  it('resolves the "KE" abbreviation via aliases', () => {
    expect(engine.searchKeyword('KE').map((r) => r.formula.id)).toContain('kinetic-energy');
  });

  it('resolves "PV=nRT" to the ideal gas law', () => {
    expect(topId('PV=nRT')).toBe('ideal-gas-law');
  });

  it('resolves "rotational KE" to rotational kinetic energy', () => {
    expect(topId('rotational KE')).toBe('rotational-kinetic-energy');
  });

  it('exact alias match is flagged and pinned to the top', () => {
    const [first] = engine.searchKeyword('F=ma');
    expect(first.formula.id).toBe('newtons-second-law');
    expect(first.exact).toBe(true);
    expect(first.score).toBe(1);
  });

  it('tolerates typos (fuzzy)', () => {
    expect(engine.searchKeyword('pythagoras').map((r) => r.formula.id)).toContain(
      'pythagorean-theorem'
    );
  });

  it('respects the domain filter', () => {
    const res = engine.searchKeyword('energy', { domains: ['math'] });
    expect(res.every((r) => r.formula.domain === 'math')).toBe(true);
  });

  it('returns nothing for an empty query', () => {
    expect(engine.searchKeyword('  ')).toEqual([]);
  });

  it('caps results at the requested limit', () => {
    expect(engine.searchKeyword('energy', { limit: 3 }).length).toBeLessThanOrEqual(3);
  });
});

describe('fusion ranking (synthetic)', () => {
  const mini: Formula[] = [
    { id: 'a', name: 'Alpha', aliases: ['spinning body energy'], domain: 'physics', tags: [], latex: 'a' },
    { id: 'b', name: 'Beta', aliases: [], domain: 'physics', tags: [], latex: 'b' },
  ];
  // Fake embeddings: query "xyz" (unit vector [1,0]) is close to b, far from a.
  const embeddings = { a: [0, 1], b: [1, 0] };
  const embedQuery = async () => [1, 0];

  it('semantic layer surfaces a formula with no keyword overlap', async () => {
    const eng = createSearchEngine({ index: mini, embeddings, embedQuery });
    expect(eng.semanticAvailable).toBe(true);
    const res = await eng.search('xyz'); // no keyword hit anywhere
    expect(res[0].formula.id).toBe('b');
    expect(res[0].semanticScore).toBeGreaterThan(res[0].keywordScore);
  });

  it('exact match beats a stronger semantic match', async () => {
    const eng = createSearchEngine({ index: mini, embeddings, embedQuery });
    const res = await eng.search('Alpha'); // exact name match on a
    expect(res[0].formula.id).toBe('a');
    expect(res[0].exact).toBe(true);
  });

  it('degrades to keyword-only when embedding throws', async () => {
    const eng = createSearchEngine({
      index: mini,
      embeddings,
      embedQuery: async () => {
        throw new Error('model not ready');
      },
    });
    const res = await eng.search('Alpha');
    expect(res[0].formula.id).toBe('a');
  });
});
