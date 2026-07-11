// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { FormulaDock } from './FormulaDock.js';
import type { Formula } from '../core/types.js';

// Rasterizing needs a real canvas (absent in jsdom), so stub the PNG path — the
// dock only needs a Blob back to render its draggable image.
vi.mock('../core/exportImage.js', () => ({
  toPNG: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
  toSVG: vi.fn(() => '<svg/>'),
}));

const formula: Formula = {
  id: 'kinetic-energy', name: 'Kinetic energy', aliases: [], domain: 'physics',
  tags: [], latex: 'E_k = \\tfrac12 m v^2', description: '', dimCheck: 'consistent',
};

let write: ReturnType<typeof vi.fn>;
beforeEach(() => {
  write = vi.fn().mockResolvedValue(undefined);
  // ClipboardItem + clipboard.write back the "click to copy" path.
  Object.assign(navigator, { clipboard: { write, writeText: vi.fn().mockResolvedValue(undefined) } });
  (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = class { constructor(public items: unknown) {} };
});
afterEach(cleanup);

async function openWithSelection() {
  render(<FormulaDock index={[formula]} defaultOpen hotkey={null} enableImageExport />);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'kinetic' } });
  fireEvent.mouseDown(await screen.findByText('Kinetic energy'));
  // The draggable image appears once the (mocked) PNG resolves.
  return (await screen.findByAltText('Kinetic energy')) as HTMLImageElement;
}

describe('<FormulaDock> drag image', () => {
  it('drag payload carries an inline <img> (HTML) and the LaTeX fallback', async () => {
    const img = await openWithSelection();
    const setData = vi.fn();
    fireEvent.dragStart(img, { dataTransfer: { setData } });

    const types = setData.mock.calls.map((c) => c[0]);
    expect(types).toContain('text/html');
    expect(types).toContain('text/plain');
    const html = setData.mock.calls.find((c) => c[0] === 'text/html')?.[1] as string;
    expect(html).toContain('<img');
    const plain = setData.mock.calls.find((c) => c[0] === 'text/plain')?.[1] as string;
    expect(plain).toBe(formula.latex);
  });

  it('clicking the image copies a PNG to the clipboard (the paste path)', async () => {
    const img = await openWithSelection();
    fireEvent.click(img);
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  });
});
