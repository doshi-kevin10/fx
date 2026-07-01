// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { getFormat, copyResult, toUnicode } from './formats.js';
import { setOmmlConverter, DOCX_MIME } from './omml.js';
import type { Formula } from './types.js';

const f: Formula = {
  id: 'rotational-kinetic-energy',
  name: 'Rotational Kinetic Energy',
  aliases: [],
  domain: 'physics',
  tags: [],
  latex: 'E_k = \\tfrac{1}{2} I \\omega^{2}',
};

afterEach(() => vi.restoreAllMocks());

describe('guaranteed formats', () => {
  it('latex returns the raw string', async () => {
    expect((await getFormat(f, 'latex')).text).toBe(f.latex);
  });
  it('mathml returns a <math> element', async () => {
    const r = await getFormat(f, 'mathml');
    expect(r.text).toMatch(/<math/);
    expect(r.tier).toBe('guaranteed');
  });
  it('unicode is produced and flagged approximate', async () => {
    const r = await getFormat(f, 'unicode');
    expect(r.approximate).toBe(true);
    expect(r.text).not.toMatch(/\\tfrac/); // commands linearized, not left raw
    expect(r.text).toContain('ω');
  });
  it('svg returns self-contained SVG markup', async () => {
    const r = await getFormat(f, 'svg');
    expect(r.text).toMatch(/<svg/);
    expect(r.filename).toBe('rotational-kinetic-energy.svg');
  });
});

describe('toUnicode linearization', () => {
  it('handles fractions, powers, and greek', () => {
    expect(toUnicode('E = m c^2')).toContain('c²');
    expect(toUnicode('\\omega')).toBe('ω');
    expect(toUnicode('\\tfrac{1}{2}')).toBe('(1)/(2)');
  });
});

describe('clipboard with fallback', () => {
  it('succeeds when writeText resolves', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const out = await copyResult({ kind: 'latex', tier: 'guaranteed', mime: 'text/plain', text: f.latex });
    expect(out.ok).toBe(true);
  });
  it('degrades to selectable fallback text when clipboard is denied', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const out = await copyResult({ kind: 'latex', tier: 'guaranteed', mime: 'text/plain', text: f.latex });
    expect(out.ok).toBe(false);
    expect(out.fallbackText).toBe(f.latex);
  });
  it('never throws when clipboard is entirely absent', async () => {
    Object.assign(navigator, { clipboard: undefined });
    const out = await copyResult({ kind: 'mathml', tier: 'guaranteed', mime: 'application/mathml+xml', text: '<math/>' });
    expect(out.ok).toBe(false);
    expect(out.fallbackText).toBe('<math/>');
  });
});

describe('Word / OMML (best-effort, isolated)', () => {
  it('produces an editable .docx via the injected converter', async () => {
    setOmmlConverter({ toOmml: () => '<m:oMath xmlns:m="x"><m:r><m:t>E</m:t></m:r></m:oMath>' });
    const r = await getFormat(f, 'word');
    expect(r.tier).toBe('best-effort');
    expect(r.mime).toBe(DOCX_MIME);
    expect(r.blob).toBeInstanceOf(Blob);
    expect(r.blob!.size).toBeGreaterThan(0);
    expect(r.note).toBeUndefined();
  });
  it('falls back to a valid .docx (with a note) when conversion throws', async () => {
    setOmmlConverter({ toOmml: () => { throw new Error('converter unavailable'); } });
    const r = await getFormat(f, 'word');
    expect(r.blob).toBeInstanceOf(Blob);
    expect(r.blob!.size).toBeGreaterThan(0);
    expect(r.note).toMatch(/unavailable/i);
  });
});
