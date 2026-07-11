import { useEffect, useState } from 'react';
import { FormulaDock, type Corner } from '../../src/react/FormulaDock.js';
import type { Formula, QuantityData } from '../../src/core/types.js';
import indexData from '../../dist/index.json';
import quantitiesData from '../../dist/quantities.json';
import { getLastEditable } from './focus-tracker.js';
import { insertLatex } from './insert.js';
import { chromeStore, loadPref, savePref } from './customStore.js';
import { renderPngViaOffscreen } from './renderPng.js';

const index = indexData as Formula[];
const quantities = quantitiesData as QuantityData;

// Extension-wide store (shared across every site), created once for a stable identity.
const customStore = chromeStore('formulyze:extension:custom');
const CORNER_KEY = 'formulyze:corner';

export function App() {
  const [corner, setCorner] = useState<Corner>('top-right');

  // Restore the dock's last corner (chrome.storage — shared across all sites).
  useEffect(() => {
    void loadPref<Corner>(CORNER_KEY, 'top-right').then(setCorner);
  }, []);

  const handleSelect = (formula: Formula) => {
    insertLatex(formula.latex, getLastEditable());
  };

  const handleCornerChange = (next: Corner) => {
    setCorner(next);
    savePref(CORNER_KEY, next);
  };

  return (
    <div style={{ pointerEvents: 'auto' }}>
      <FormulaDock
        index={index}
        quantities={quantities}
        onSelect={handleSelect}
        corner={corner}
        onCornerChange={handleCornerChange}
        hotkey="alt+shift+f"
        enableSemantic={false}
        enableImageExport={true}
        renderPng={renderPngViaOffscreen}
        customStore={customStore}
        placeholder="Try “kinetic energy”…"
      />
    </div>
  );
}
