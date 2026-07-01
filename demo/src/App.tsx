import { useRef, useState } from 'react';
import { FormulaDock, FormulaFinder, type Formula, type Domain, type QuantityData } from '../../src/index.js';
import indexData from '../../dist/index.json';
import embeddingsData from '../../dist/embeddings.json';
import quantitiesData from '../../dist/quantities.json';

const index = indexData as Formula[];
const embeddings = embeddingsData as Record<string, number[]>;
const quantities = quantitiesData as QuantityData;

const DOMAINS: Domain[] = ['math', 'physics', 'astrophysics', 'chemistry'];

// A faux assignment editor so the floating dock is shown in its real context.
export function App() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [lastCopied, setLastCopied] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const toggle = (d: Domain) =>
    setDomains((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  // Insert the picked LaTeX at the cursor, wrapped as inline math.
  const insertLatex = (f: Formula) => {
    setLastCopied(f.name);
    const ta = areaRef.current;
    if (!ta) return;
    const snippet = `$${f.latex}$`;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    ta.setRangeText(snippet, start, end, 'end');
    ta.focus();
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #f7f8fc 0%, #eef1fb 100%)',
        padding: '3rem 1rem',
        fontFamily: 'system-ui, sans-serif',
        color: '#1f2430',
      }}
    >
      <main
        style={{
          maxWidth: 720,
          margin: '0 auto',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 10px 40px -12px rgba(60,70,110,0.18)',
          padding: '2.25rem 2.5rem',
        }}
      >
        <p style={{ margin: 0, fontSize: '.72rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#8a93a6' }}>
          Physics 201 · Problem Set 4
        </p>
        <h1 style={{ margin: '.25rem 0 1.25rem', fontSize: '1.6rem' }}>Rotational Dynamics</h1>

        <p style={{ lineHeight: 1.7, color: '#3b4252' }}>
          <strong>1.</strong> A solid disk spins about its central axis. Using the rotational kinetic
          energy formula, derive the energy stored in the disk at angular velocity ω.
        </p>

        <textarea
          ref={areaRef}
          defaultValue={
            'Answer: The rotational kinetic energy is given by\n\n$E_k = \\tfrac{1}{2} I \\omega^{2}$\n\nwhere I is the moment of inertia…\n\n(Place your cursor here and pick a formula from the dock →)'
          }
          spellCheck={false}
          style={{
            width: '100%',
            minHeight: 220,
            marginTop: '1rem',
            padding: '1rem',
            fontSize: '.95rem',
            lineHeight: 1.6,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            color: '#1f2430',
            background: '#fbfbfe',
            border: '1px solid #e7e9f3',
            borderRadius: 12,
            resize: 'vertical',
          }}
        />

        <div style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '.6rem', alignItems: 'center' }}>
          <span style={{ fontSize: '.8rem', color: '#8a93a6' }}>Filter dock to:</span>
          {DOMAINS.map((d) => (
            <label key={d} style={{ fontSize: '.82rem', display: 'flex', gap: '.3rem', alignItems: 'center' }}>
              <input type="checkbox" checked={domains.includes(d)} onChange={() => toggle(d)} />
              {d}
            </label>
          ))}
        </div>

        <p style={{ marginTop: '1.5rem', fontSize: '.82rem', color: '#8a93a6', lineHeight: 1.6 }}>
          The floating dock is pinned top-right. Press <kbd style={kbd}>⌘/Ctrl</kbd> + <kbd style={kbd}>K</kbd> to
          open it, type a concept (<em>“energy of a spinning object”</em>, <em>“PV=nRT”</em>, <em>“black hole radius”</em>),
          and click a result — the LaTeX is copied and inserted at your cursor.
          {lastCopied && <> Last inserted: <strong>{lastCopied}</strong>.</>}
        </p>
      </main>

      <section
        style={{
          maxWidth: 720,
          margin: '1.5rem auto 0',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 10px 40px -12px rgba(60,70,110,0.18)',
          padding: '1.75rem 2rem',
        }}
      >
        <h2 style={{ margin: '0 0 .25rem', fontSize: '1.2rem' }}>Find a formula</h2>
        <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '.9rem' }}>
          Search by name, or by the quantities you have. Every result is a card you can insert or
          copy in LaTeX, MathML, PNG, SVG, Unicode, or Word — and physics relations are
          dimensionally verified at build time.
        </p>
        <FormulaFinder
          index={index}
          embeddings={embeddings}
          quantities={quantities}
          onSelect={insertLatex}
        />
      </section>

      <FormulaDock
        index={index}
        embeddings={embeddings}
        quantities={quantities}
        domains={domains.length ? domains : undefined}
        onSelect={insertLatex}
        defaultOpen
        corner="top-right"
        storageKey="formulize:my-formulas"
        placeholder="Try “energy of a spinning object”…"
      />
    </div>
  );
}

const kbd: React.CSSProperties = {
  background: '#f0f1f8',
  border: '1px solid #e0e2ef',
  borderRadius: 5,
  padding: '.05rem .35rem',
  fontSize: '.78rem',
  fontFamily: 'ui-monospace, monospace',
};
