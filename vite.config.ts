// Library build: emits ESM to dist/lib with type declarations.
// Heavy runtime deps (react, katex, mathjax, fuse.js, transformers) are kept
// external so the consumer's bundler code-splits and dedupes them.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Anything under these package roots stays external.
const externalPrefixes = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'katex',
  'fuse.js',
  'mathjax-full',
  '@huggingface/transformers',
  'mathml2omml', // LGPL — kept external, never statically bundled into MIT core
  'fflate',
  'mathjs', // build-time only, but externalize defensively
];

const isExternal = (id: string) =>
  externalPrefixes.some((p) => id === p || id.startsWith(p + '/'));

export default defineConfig({
  plugins: [
    react(),
    dts({ include: ['src'], exclude: ['**/*.test.{ts,tsx}'], entryRoot: 'src', outDir: 'dist/lib' }),
    {
      // Ship the stylesheet alongside the JS (it isn't imported by any module).
      name: 'copy-css',
      closeBundle() {
        copyFileSync(
          resolve(__dirname, 'src/react/formulize.css'),
          resolve(__dirname, 'dist/lib/formulize.css')
        );
      },
    },
  ],
  // The worker build is a separate Rollup pass — externalize transformers here
  // too, or it inlines the whole (~59 MB) library into the worker chunk. Modern
  // bundlers (Vite/webpack 5) re-resolve the bare import when consuming the
  // published `new URL(...worker.js, import.meta.url)` reference.
  worker: {
    format: 'es',
    rollupOptions: { external: isExternal },
  },
  build: {
    outDir: 'dist/lib',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'core/index': resolve(__dirname, 'src/core/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: isExternal,
      output: {
        // Keep the worker as its own predictable chunk.
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
});
