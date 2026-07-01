// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { FormulaSearch } from './FormulaSearch.js';
import type { Formula } from '../core/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const index: Formula[] = JSON.parse(
  readFileSync(join(here, '..', '..', 'dist', 'index.json'), 'utf8')
);

afterEach(cleanup);

// Keyword-only: no embeddings/Worker needed, so this runs headless in jsdom.
function renderSearch(onSelect?: (f: Formula) => void) {
  return render(<FormulaSearch index={index} enableSemantic={false} onSelect={onSelect} />);
}

describe('<FormulaSearch> (keyword-only, jsdom)', () => {
  it('renders results with KaTeX markup as the user types', async () => {
    renderSearch();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'kinetic energy' } });

    const option = await screen.findByText('Kinetic Energy');
    expect(option).toBeTruthy();
    // KaTeX produced real math markup in the result row.
    expect(document.querySelector('.fz-result .katex')).toBeTruthy();
  });

  it('selects a result with keyboard nav (Enter) and shows the panel', async () => {
    let picked: Formula | null = null;
    renderSearch((f) => (picked = f));
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'F=ma' } });

    await screen.findByText("Newton's Second Law");
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(picked).not.toBeNull());
    expect(picked!.id).toBe('newtons-second-law');
    // Selected panel with the primary Copy LaTeX action.
    expect(screen.getByText('Copy LaTeX')).toBeTruthy();
    // The raw LaTeX source is shown in the code block (scope to it — KaTeX also
    // embeds the TeX in a MathML <annotation>, which would match a loose query).
    const code = document.querySelector('.fz-latex code');
    expect(code?.textContent).toBe(index.find((f) => f.id === 'newtons-second-law')!.latex);
  });

  it('clears the query on Escape', async () => {
    renderSearch();
    const input = screen.getByRole('combobox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'energy' } });
    await screen.findByRole('listbox');
    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(input.value).toBe(''));
  });
});
