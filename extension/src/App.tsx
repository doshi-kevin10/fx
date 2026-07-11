import { FormulaDock } from '../../src/react/FormulaDock.js';
import type { Formula, QuantityData } from '../../src/core/types.js';
import indexData from '../../dist/index.json';
import quantitiesData from '../../dist/quantities.json';
import { getLastEditable } from './focus-tracker.js';
import { insertLatex } from './insert.js';

const index = indexData as Formula[];
const quantities = quantitiesData as QuantityData;

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
        storageKey="formulyze:extension:custom"
        placeholder="Try “kinetic energy”…"
      />
    </div>
  );
}
