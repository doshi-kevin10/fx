import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import manifest from './extension/manifest.config';

const stub = (name: string) => resolve(__dirname, `extension/src/stubs/${name}`);

/**
 * Drop the transformers.js semantic-search chunks (huge ONNX wasm) that v1
 * never loads. Image export (MathJax) stays so formulas can be dragged as PNGs.
 */
function pruneExtensionBundle(): Plugin {
  return {
    name: 'prune-extension-bundle',
    closeBundle() {
      const dist = resolve(__dirname, 'extension/dist');
      const assetsDir = join(dist, 'assets');
      const removed = new Set<string>();
      for (const file of readdirSync(assetsDir)) {
        if (/ort-wasm|embedder\.worker/.test(file)) {
          unlinkSync(join(assetsDir, file));
          removed.add(`assets/${file}`);
        }
      }
      const manifestPath = join(dist, 'manifest.json');
      const built = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        web_accessible_resources?: { resources: string[] }[];
      };
      for (const group of built.web_accessible_resources ?? []) {
        group.resources = group.resources.filter(
          (r) => !removed.has(r) && !/ort-wasm|embedder\.worker/.test(r),
        );
      }
      writeFileSync(manifestPath, `${JSON.stringify(built, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  plugins: [react(), crx({ manifest }), pruneExtensionBundle()],
  resolve: {
    alias: {
      // Semantic search stays disabled in v1; image export (MathJax) is enabled.
      [resolve(__dirname, 'src/core/embedder.ts')]: stub('embedder.ts'),
    },
  },
  build: {
    outDir: 'extension/dist',
    emptyOutDir: true,
    rollupOptions: {
      // crxjs only builds manifest-referenced HTML; the offscreen document is
      // loaded at runtime via chrome.offscreen, so add it as an explicit input.
      input: { offscreen: resolve(__dirname, 'extension/offscreen.html') },
    },
  },
  server: {
    fs: { allow: ['.'] },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
});
