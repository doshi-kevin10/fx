# Security

## Reporting a vulnerability

Please open a private security advisory on GitHub
(**Security → Advisories → Report a vulnerability**) at
<https://github.com/doshi-kevin10/fx/security/advisories>, or open a regular
issue for non-sensitive reports. We aim to respond within a few days.

## Security model

Formulyze is **local-first and privacy-preserving by design**:

- **No server, no backend.** All search, rendering, calculation, and export run
  entirely in the browser.
- **No accounts, no telemetry, no analytics.** Nothing about your queries or
  usage is collected or transmitted.
- **No copyleft dependencies.** As of `0.1.1` the published package depends only
  on MIT/Apache-2.0 software (`katex`, `fuse.js`, `mathjax-full`,
  `@huggingface/transformers`; `fflate` for the optional Word fallback).
  (`0.1.0` transitively pulled an LGPL package and is deprecated — use `0.1.1+`.)
- **The only outbound network request** is the one-time download of the semantic
  search model (`Xenova/all-MiniLM-L6-v2`) from the Hugging Face CDN, and it
  happens **lazily** — only if a consumer enables semantic search. It is then
  cached in the browser (IndexedDB) and works offline thereafter. Keyword search,
  live preview, and LaTeX/MathML/Unicode copy require no network at all.
- **Editable Word (OMML) export ships no converter by default** and carries no
  LGPL code; it is opt-in via `setOmmlConverter(...)`.

## About third-party dependency scanner alerts

Automated scanners (e.g. Socket) flag heuristic patterns in the **transitive
dependency trees** of the reputable libraries Formulyze builds on — KaTeX,
MathJax, and Hugging Face Transformers. None originate from Formulyze's own code,
and none are exploitable in a browser context. For transparency:

| Scanner alert | Where it actually comes from | Why it is benign here |
|---|---|---|
| **Network access** | `@huggingface/transformers` (`fetch`) | The intended, documented model download from the Hugging Face CDN. Lazy + cached; only if semantic search is used. |
| **Uses eval / Obfuscated code** | `@emnapi/runtime` (← transformers → onnxruntime WASM glue) | Minified WASM bindings for on-device inference; a `new Function` used for environment capability detection. Not attacker-controlled. |
| **Shell access** (`child_process`) | `commander` (← **katex** CLI, and mathjax's speech-rule-engine) | Belongs to those libraries' command-line tooling; it is tree-shaken out and **never bundled or executed in the browser**. |
| **Deprecated** | `boolean` (← transformers → onnxruntime-**node** → global-agent) | Part of the **Node** inference path only. The browser uses onnxruntime-**web**, so this code never runs. |
| **URL strings** | XML namespace URIs + Wikipedia citation links | Required to emit MathML/SVG/OOXML, plus source attributions in `index.json`. Formulyze never fetches these URLs. |

These reflect the JavaScript ecosystem's dependency graph, not a defect in
Formulyze. Reaching "zero alerts" is not possible without dropping KaTeX (which
alone pulls `commander`). If you require a minimal dependency surface, semantic
search (`@huggingface/transformers`) and image export (`mathjax-full`) are the
only heavy deps and can be omitted at the cost of those two features.
