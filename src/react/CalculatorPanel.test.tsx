// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { CalculatorPanel } from './CalculatorPanel.js';
import type { Formula } from '../core/types.js';

const KE: Formula = {
  id: 'kinetic-energy',
  name: 'Kinetic Energy',
  aliases: [],
  domain: 'physics',
  tags: [],
  latex: 'E_k = \\tfrac12 m v^2',
  relation: 'E_k = 1/2 * m * v^2',
  variables: [
    { key: 'E_k', symbol: 'E_k', meaning: 'kinetic energy', unit: 'J' },
    { key: 'm', symbol: 'm', meaning: 'mass', unit: 'kg' },
    { key: 'v', symbol: 'v', meaning: 'speed', unit: 'm/s' },
  ],
};

afterEach(cleanup);

describe('<CalculatorPanel>', () => {
  it('computes the subject from the other values, unit-aware', async () => {
    render(<CalculatorPanel formula={KE} />);
    // math.js loads lazily; inputs appear once ready.
    const mass = await screen.findByPlaceholderText('0', {}, { timeout: 3000 }).catch(() => null);
    // Fill mass and speed (the two non-target inputs). Target defaults to E_k.
    const inputs = await waitFor(() => {
      const els = document.querySelectorAll<HTMLInputElement>('.fzk-in');
      expect(els.length).toBe(2);
      return els;
    });
    void mass;
    fireEvent.change(inputs[0], { target: { value: '2' } }); // m
    fireEvent.change(inputs[1], { target: { value: '3' } }); // v
    await waitFor(() => {
      expect(document.querySelector('.fzk-out-val')?.textContent).toBe('9');
    });
    expect(document.querySelector('.fzk-out-unit')?.textContent).toBe('J');
  });
});
