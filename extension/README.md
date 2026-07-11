# Formulyze Chrome Extension

Floating **ƒx** formula finder on every page. Search by keyword, pick a result, and smart-insert LaTeX into the focused text field (or copy to clipboard).

## Load in Chrome (development)

```bash
npm run build:data -- --no-embeddings
npm run ext:dev
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `extension/dist` (created after the dev server starts)

Visit any page — the top-right pill appears. Press **Alt+Shift+F** to toggle the dock.

## Production build

```bash
npm run ext:build
```

Load `extension/dist` as unpacked, or zip it for the Chrome Web Store.

## v1 scope

- Keyword + quantity search (offline)
- Smart insert into `input`, `textarea`, and `contenteditable`
- Custom formulas (saved in extension `localStorage`)
- **Not yet:** semantic search, PNG/SVG export (stubs keep the bundle lean)

## Permissions

- `storage` — custom formulas
- `<all_urls>` — inject the content script
