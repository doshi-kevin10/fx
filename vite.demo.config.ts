// Demo app build/dev server. Bundles everything (including transformers.js and
// mathjax) so the static demo works as a pure file drop on GitHub/Cloudflare Pages.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'demo',
  // Served under a subpath on GitHub Pages; override with `--base=/` locally.
  base: process.env.DEMO_BASE ?? '/formulize/',
  plugins: [react()],
  worker: { format: 'es' },
  // The demo imports the generated dist/*.json which live above the demo root.
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: '../demo/dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    // transformers.js ships wasm/ort; let Vite prebundle it cleanly.
    exclude: ['@huggingface/transformers'],
  },
});
