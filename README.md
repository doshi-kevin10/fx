# Formulize

**Type a concept, get the LaTeX and a downloadable image — instantly, offline, free.**

Formulize is a local-first, open-source React component (plus a framework-agnostic
TypeScript core) that turns a plain-language query — *"kinetic energy"*, *"energy of a
spinning object"*, *"PV=nRT"*, *"black hole radius"* — into correct **LaTeX** and a
rendered image, across **math, physics, astrophysics, and chemistry**.

- 🔎 **Concept name → formula.** Not formula→docs, not image→LaTeX, not build-it-yourself.
- ⚡ **Instant, hybrid search.** Fuse.js keyword matching (synchronous) fused with on-device
  semantic search (transformers.js + all-MiniLM-L6-v2). Keyword results appear on the first
  keystroke; semantic recall upgrades them silently once the model warms up.
- 💸 **$0, offline, private.** No API keys, no server. After first load the model is cached in
  IndexedDB and everything runs on-device.
- ✅ **Accurate by construction.** Every formula is render-checked by KaTeX at build time — CI
  refuses to merge anything that doesn't render.
- 🧩 **Embeddable.** Drop `<FormulaSearch>` into any React app, or use the core engine anywhere.

## Install

```bash
npm install formulize
```

`react` / `react-dom` are peer dependencies. `katex`, `mathjax-full`, `fuse.js`, and
`@huggingface/transformers` are runtime dependencies your bundler will code-split.

## Usage — React component

```tsx
import { FormulaSearch } from 'formulize';
import index from 'formulize/dist/index.json';       // the curated formula database
import 'katex/dist/katex.min.css';                    // math styles
import 'formulize/styles.css';                         // component styles

export function Example() {
  return (
    <FormulaSearch
      index={index}
      onSelect={(f) => console.log(f.latex)}
      domains={['physics', 'math']}   // optional filter
      mode="inline"                    // or "popover"
    />
  );
}
```

To enable **semantic search**, also pass precomputed embeddings:

```tsx
import embeddings from './embeddings.json'; // built via `formulize` build (see below)
<FormulaSearch index={index} embeddings={embeddings} />
```

Keyword search works immediately with no embeddings; semantic is pure progressive enhancement.

### Props

| Prop | Type | Default | Notes |
|---|---|---|---|
| `index` | `Formula[]` | — | The formula database (required). |
| `embeddings` | `Record<string, number[]>` | — | Enables semantic search when present. |
| `onSelect` | `(f: Formula) => void` | — | Fired on pick (click or Enter). |
| `domains` | `Domain[]` | all | Filter to `math` / `physics` / `astrophysics` / `chemistry`. |
| `mode` | `'inline' \| 'popover'` | `'inline'` | Popover floats results over content. |
| `enableSemantic` | `boolean` | `true` | Set `false` for a lighter keyword-only build. |
| `enableImageExport` | `boolean` | `true` | Show Download PNG/SVG + Copy image. |
| `weights` | `{ keyword; semantic }` | `{0.55, 0.45}` | Fusion weights. |
| `limit` | `number` | `8` | Max results. |

## Usage — framework-agnostic core

```ts
import { createSearchEngine, renderToString, toPNG } from 'formulize/core';

const engine = createSearchEngine({ index, embeddings, embedQuery });
const results = await engine.search('energy of a spinning object'); // fused
const instant = engine.searchKeyword('KE');                          // synchronous

const html = renderToString(results[0].formula.latex);   // KaTeX preview
const png = await toPNG(results[0].formula.latex);        // MathJax → PNG Blob
```

`createSearchEngine` works keyword-only if `embeddings`/`embedQuery` are omitted, which is
what powers the "works before the model loads" behavior for free. Use `createEmbedder()` to
spin up the Web Worker that backs `embedQuery` in the browser.

## Adding formulas

The source of truth is **one YAML entry per formula** under `data/formulas/<domain>/`.
Adding one is a no-code pull request — see [CONTRIBUTING.md](./CONTRIBUTING.md). CI
render-checks every formula, so nothing broken can merge.

## Building the database

```bash
npm run validate     # schema + unique id + KaTeX render check (fast, no model)
npm run build:data   # + embeds each formula → dist/index.json, dist/embeddings.json
npm run build        # build:data + the ESM library (dist/lib)
npm test             # unit + component tests
npm run dev          # run the local demo
```

## How it works

```
query ─▶ <FormulaSearch> ─▶ SearchEngine ─┬─ Fuse.js keyword  (instant, sync)
                                          └─ query embedding → cosine vs. precomputed vectors
                                             (transformers.js in a Web Worker)
                              ▼ fusion + exact-match short-circuit
                    KaTeX preview  ·  MathJax SVG/PNG export (on demand)
```

A Node build pipeline compiles the YAML into `index.json` + `embeddings.json`. There is no
runtime backend. See [`Formula Search — Engineering Design Doc`](#) for the full design.

## License

MIT. All dependencies are MIT / Apache-2.0 / BSD.
