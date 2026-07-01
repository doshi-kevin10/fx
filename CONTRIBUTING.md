# Contributing to Formulize

Adding a formula requires **no code** — just one YAML entry and a pull request.
CI render-checks every formula, so nothing that fails to render can be merged.

## Add a formula in 3 steps

1. **Pick a domain** and open (or create) a YAML file under
   `data/formulas/<domain>/`, where `<domain>` is one of:
   `math`, `physics`, `astrophysics`, `chemistry`.

2. **Add your formula.** A YAML file may hold a single formula, a **list** of
   formulas, or several `---`-separated documents — whichever is convenient. To
   add one formula to an existing themed file, append a list item:

   ```yaml
   - id: rotational-kinetic-energy          # unique, kebab-case, stable
     name: Rotational Kinetic Energy         # canonical display name
     aliases:                                # searchable alternates — invest here!
       - rotational KE
       - energy of a spinning object
     domain: physics                         # math | physics | astrophysics | chemistry
     subdomain: mechanics                    # free-form grouping (optional)
     tags: [energy, rotation, moment of inertia]
     latex: "E_k = \\tfrac{1}{2} I \\omega^{2}"   # MUST render in KaTeX (mhchem loaded)
     description: >                          # 1-2 sentences; feeds semantic search
       Kinetic energy of a rigid body rotating about a fixed axis.
     variables:                              # optional glossary
       - { symbol: "E_k", meaning: rotational kinetic energy, unit: J }
       - { symbol: "I",   meaning: moment of inertia, unit: "kg·m^2" }
       - { symbol: "\\omega", meaning: angular velocity, unit: "rad/s" }
     source: https://en.wikipedia.org/wiki/Rotational_energy   # optional citation
     contributor: your-github-handle          # optional
   ```

3. **Check it locally, then open a PR:**

   ```bash
   npm install
   npm run validate      # schema + unique id + KaTeX render check (fast, no model)
   ```

## Rules the build enforces (see `schema/formula.schema.json`)

- `id` is **unique across the whole repo** and matches `^[a-z0-9]+(-[a-z0-9]+)*$`.
- `name`, `domain`, and `latex` are **required**; `domain` is one of the four allowed values.
- **`latex` must render in KaTeX** with `throwOnError` — this is the accuracy guarantee.
- Chemistry uses the **mhchem** extension: write reactions as `\ce{2 H2 + O2 -> 2 H2O}`.
  Structural molecule diagrams (chemfig/TikZ) are **out of scope**.

## Tips for good search results

Accuracy comes from curation, not the algorithm:

- **Aliases** are the highest-leverage field. Add common names, abbreviations
  (`KE`, `SUVAT`, `PV=nRT`), and notation variants. Quote any alias containing
  `{`, `}`, `[`, `]`, or `,` (e.g. `"e^{ix}"`, `"E[X]"`).
- **`description`** and **`tags`** feed the semantic search surface — write a
  clear one-liner describing what the formula *is*, not just its symbols.

## Escaping LaTeX in YAML

Backslashes must be doubled inside double-quoted YAML strings: `"\\frac{a}{b}"`.
When in doubt, run `npm run validate` — it tells you exactly what failed to render.
