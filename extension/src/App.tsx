import { FormulaDock } from '../../src/react/FormulaDock.js';
import type { Formula, QuantityData } from '../../src/core/types.js';
import indexData from '../../dist/index.json';
import quantitiesData from '../../dist/quantities.json';
import { getLastEditable } from './focus-tracker.js';
import { insertLatex } from './insert.js';
import { chromeStore } from './customStore.js';

const index = indexData as Formula[];
const quantities = quantitiesData as QuantityData;

// Extension-wide store (shared across every site), created once for a stable identity.
const customStore = chromeStore('formulyze:extension:custom');

export function App() {
  const handleSelect = (formula: Formula) => {
    insertLatex(formula.latex, getLastEditable());
  };

  return (
    <div style={{ pointerEvents: 'auto' }}>
      <FormulaDock
        index={index}
        quantities={quantities}
        onSelect={handleSelect}
        corner="top-right"
        hotkey="alt+shift+f"
        enableSemantic={false}
        enableImageExport={true}
        customStore={customStore}
        placeholder="Try “kinetic energy”…"
      />
    </div>
  );
}
