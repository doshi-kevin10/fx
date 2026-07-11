// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { FormulaDock } from './FormulaDock.js';
import type { Formula, QuantityData } from '../core/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const index: Formula[] = JSON.parse(
  readFileSync(join(here, '..', '..', 'dist', 'index.json'), 'utf8')
);
const quantities: QuantityData = JSON.parse(
  readFileSync(join(here, '..', '..', 'dist', 'quantities.json'), 'utf8')
);

let writeText: ReturnType<typeof vi.fn>;
beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});
afterEach(cleanup);

describe('<FormulaDock> (keyword-only, jsdom)', () => {
  it('starts collapsed as a pill and expands on a tap (pointer down/up, no drag)', () => {
    render(<FormulaDock index={index} enableSemantic={false} />);
    const pill = screen.getByLabelText(/Open formula search/);
    expect(pill).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.pointerDown(pill, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(pill, { clientX: 10, clientY: 10 });
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('dragging the pill snaps it to the nearest corner and persists', () => {
    const onCornerChange = vi.fn();
    // jsdom window is 1024x768; a drag ending near top-left should snap top-left.
    render(<FormulaDock index={index} enableSemantic={false} corner="top-right" onCornerChange={onCornerChange} />);
    const pill = screen.getByLabelText(/Open formula search/);
    fireEvent.pointerDown(pill, { clientX: 900, clientY: 40 });
    fireEvent.pointerMove(pill, { clientX: 50, clientY: 40 }); // move past the drag threshold
    fireEvent.pointerUp(pill, { clientX: 50, clientY: 40 });   // release top-left
    expect(onCornerChange).toHaveBeenCalledWith('top-left');
    expect(screen.queryByRole('combobox')).toBeNull(); // a drag must NOT open the dock
  });

  it('single-click on a result copies its LaTeX and shows the preview', async () => {
    let picked: Formula | null = null;
    render(
      <FormulaDock index={index} enableSemantic={false} defaultOpen onSelect={(f) => (picked = f)} />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rotational KE' } });

    const row = await screen.findByText('Rotational Kinetic Energy');
    fireEvent.mouseDown(row);

    await waitFor(() => expect(picked).not.toBeNull());
    expect(picked!.id).toBe('rotational-kinetic-energy');
    // Single-click copies LaTeX (via the format matrix) — async.
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(picked!.latex));
    // Preview footer with the compact copy matrix appears.
    expect(screen.getByTitle('Copy LaTeX')).toBeTruthy();
    expect(screen.getByText('TeX')).toBeTruthy();
  });

  it('adds a custom formula and makes it searchable with a star marker', async () => {
    render(<FormulaDock index={index} enableSemantic={false} defaultOpen />);
    fireEvent.click(screen.getByText('+ New'));

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Drag Force' } });
    fireEvent.change(screen.getByLabelText('LaTeX'), { target: { value: 'F_d = \\tfrac12 \\rho v^2 C_d A' } });

    const save = screen.getByText('Save formula');
    expect((save as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(save);

    // Back on search; the new formula is findable and flagged as the user's.
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'My Drag Force' } });
    await waitFor(() => expect(document.querySelector('.fzd-list .fzd-row-name .fzd-star')).toBeTruthy());
  });

  it('blocks saving a formula whose name duplicates a built-in', () => {
    render(<FormulaDock index={index} enableSemantic={false} defaultOpen />);
    fireEvent.click(screen.getByText('+ New'));

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kinetic Energy' } });
    fireEvent.change(screen.getByLabelText('LaTeX'), { target: { value: 'x = 1' } });

    expect(screen.getByText('That name is already taken.')).toBeTruthy();
    expect((screen.getByText('Save formula') as HTMLButtonElement).disabled).toBe(true);
  });

  it('exposes By-quantity mode when quantities are provided, finding formulas by quantity', async () => {
    render(<FormulaDock index={index} quantities={quantities} enableSemantic={false} defaultOpen />);
    // Mode toggle appears only with a quantities index.
    fireEvent.click(screen.getByRole('tab', { name: 'Quantity' }));
    // Add "mass" then "velocity" via the quantity autocomplete.
    const input = screen.getByPlaceholderText(/mass, velocity/i);
    fireEvent.change(input, { target: { value: 'mass' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'velocity' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Kinetic energy surfaces from the quantities alone.
    await screen.findByText('Kinetic Energy');
  });

  it('does not show mode toggle without a quantities index', () => {
    render(<FormulaDock index={index} enableSemantic={false} defaultOpen />);
    expect(screen.queryByRole('tab', { name: 'Quantity' })).toBeNull();
  });

  it('offers a quick-add when a search has no match', async () => {
    render(<FormulaDock index={index} enableSemantic={false} defaultOpen />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzxq nonsense' } });
    const cta = await screen.findByText(/Add .* as your own/);
    fireEvent.mouseDown(cta);
    // Jumps into the add form with the query prefilled as the name.
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('zzxq nonsense');
  });
});
