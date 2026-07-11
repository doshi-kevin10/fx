import { describe, it, expect } from 'vitest';
import { toSVG } from './exportImage.js';

describe('toSVG', () => {
  it('produces valid XML: the root <svg> has exactly one style attribute', () => {
    // MathJax emits its own style="vertical-align:…"; we must MERGE color into it.
    // A second style attribute is an XML parse error, so the <img> load fails with
    // "Failed to rasterize SVG" (and no PNG/clipboard image).
    const svg = toSVG('E_k = \\tfrac{1}{2} m v^2');
    const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? '';
    expect((root.match(/\sstyle="/g) ?? []).length).toBe(1);
    expect(root).toContain('color:#111827');
  });

  it('renders mhchem chemistry without duplicating attributes', () => {
    const svg = toSVG('\\ce{H2O}');
    const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? '';
    expect((root.match(/\sstyle="/g) ?? []).length).toBe(1);
  });
});
