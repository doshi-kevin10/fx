# Formulyze Browser Extension — Design Spec

**Date:** 2026-07-07  
**Status:** Approved

## Goal

Chrome MV3 extension that injects the `FormulaDock` floating ƒx pill (top-right) on every page. Keyword search in v1; semantic search as a later optional upgrade.

## User choices

- **UI:** Page overlay (A) — fixed top-right pill on all sites
- **On select:** Smart insert (B) — insert `$latex$` into focused field, else clipboard
- **Search:** Keyword-only v1, semantic later (C)

## Architecture

- `extension/` subfolder in the Formula repo, built with `@crxjs/vite-plugin` + React
- Content script on `<all_urls>`, runs at `document_idle`
- React mounts `FormulaDock` with corpus from `dist/index.json` + `dist/quantities.json`
- `enableSemantic={false}`, `enableImageExport={false}` in v1
- Hotkey: `alt+shift+f` (avoids ⌘K conflicts on host pages)
- Custom formulas via `storageKey: 'formulyze:extension:custom'`

## Smart insert

`focus-tracker.ts` records the last `input`, `textarea`, or `[contenteditable]` on `focusin`. `insert.ts` inserts `$latex$` at the cursor or returns false so `FormulaDock`'s built-in clipboard copy handles the fallback.

## Permissions

- `storage` — custom formulas
- `<all_urls>` host permission — content script injection

## Phase 2 (not in v1)

- Settings popup with semantic search toggle
- Bundle `embeddings.json` + ONNX model
- `host_permissions` for `huggingface.co`, CSP `wasm-unsafe-eval`

## Dev workflow

```bash
npm run build:data -- --no-embeddings
npm run ext:dev      # load unpacked from extension/dist
npm run ext:build    # production zip
```
