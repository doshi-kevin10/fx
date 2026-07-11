// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCustomFormulas, type CustomFormulaStore } from './useCustomFormulas.js';
import type { Formula } from '../core/types.js';

const stored: Formula = {
  id: 'my-eq', name: 'My eq', aliases: [], domain: 'math', tags: ['custom'],
  latex: 'a=b', description: 'Your formula.', custom: true,
};

/** In-memory async store that mimics chrome.storage: promise load + a live change feed. */
function asyncStore(initial: Formula[]) {
  const listeners: ((f: Formula[]) => void)[] = [];
  const s = {
    data: [...initial] as Formula[],
    saves: 0,
    load: () => Promise.resolve([...s.data]),
    save: vi.fn((f: Formula[]) => { s.saves++; s.data = [...f]; }),
    subscribe(listener: (f: Formula[]) => void) {
      listeners.push(listener);
      return () => { listeners.splice(listeners.indexOf(listener), 1); };
    },
    /** Simulate ANOTHER tab writing the store. */
    emit(next: Formula[]) { s.data = [...next]; listeners.forEach((l) => l([...next])); },
  };
  return s satisfies CustomFormulaStore & Record<string, unknown>;
}

describe('useCustomFormulas with an async store', () => {
  it('hydrates from the store, and never wipes it with the empty initial state', async () => {
    const store = asyncStore([stored]);
    const { result } = renderHook(() => useCustomFormulas([], undefined, store));

    // Before hydration resolves, no save may have run (that would clobber the store).
    expect(store.saves).toBe(0);

    await waitFor(() => expect(result.current.custom).toHaveLength(1));
    expect(result.current.custom[0].id).toBe('my-eq');
    // The store still holds the loaded formula, not an empty overwrite.
    expect(store.data).toHaveLength(1);
  });

  it('persists an added formula through the store', async () => {
    const store = asyncStore([]);
    const { result } = renderHook(() => useCustomFormulas([], undefined, store));
    await waitFor(() => expect(result.current.custom).toEqual([]));

    act(() => { result.current.add({ name: 'Drag', latex: 'F=ma', domain: 'physics' }); });

    await waitFor(() => expect(store.data.some((f) => f.name === 'Drag')).toBe(true));
  });

  it('reflects another tab’s write live, without re-saving (no echo loop)', async () => {
    const store = asyncStore([]);
    const { result } = renderHook(() => useCustomFormulas([], undefined, store));
    await waitFor(() => expect(result.current.custom).toEqual([]));

    const savesBefore = store.saves;
    act(() => { store.emit([stored]); }); // another tab adds a formula

    await waitFor(() => expect(result.current.custom).toHaveLength(1));
    expect(result.current.custom[0].id).toBe('my-eq');
    // Applying a remote change must NOT write back — that would ping-pong forever.
    expect(store.saves).toBe(savesBefore);
  });
});
