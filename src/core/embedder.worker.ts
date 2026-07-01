/// <reference lib="webworker" />
// Web Worker that hosts transformers.js + all-MiniLM-L6-v2 and embeds queries
// off the main thread. WebGPU when available, WASM/CPU fallback. The model is
// cached in IndexedDB by transformers.js so reloads are fast and offline.

import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers';

// Cache model weights in the browser (IndexedDB) and fetch from the HF CDN.
env.allowLocalModels = false;
env.useBrowserCache = true;

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

type InMessage =
  | { type: 'init' }
  | { type: 'embed'; id: number; text: string };

type OutMessage =
  | { type: 'ready'; backend: string }
  | { type: 'progress'; status: string; progress?: number; file?: string }
  | { type: 'result'; id: number; vector: number[] }
  | { type: 'error'; id?: number; message: string };

const post = (m: OutMessage) => (self as DedicatedWorkerGlobalScope).postMessage(m);

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
let backend = 'unknown';

async function loadExtractor(): Promise<FeatureExtractionPipeline> {
  const progress = (p: { status: string; progress?: number; file?: string }) =>
    post({ type: 'progress', status: p.status, progress: p.progress, file: p.file });

  // Try WebGPU first; fall back to WASM (CPU) if unavailable/unsupported.
  try {
    // @ts-expect-error - `gpu` is present in browsers that support WebGPU.
    if (typeof navigator !== 'undefined' && navigator.gpu) {
      const ext = await pipeline('feature-extraction', MODEL_ID, {
        device: 'webgpu',
        progress_callback: progress,
      });
      backend = 'webgpu';
      return ext;
    }
  } catch {
    // fall through to WASM
  }
  const ext = await pipeline('feature-extraction', MODEL_ID, {
    device: 'wasm',
    progress_callback: progress,
  });
  backend = 'wasm';
  return ext;
}

function ensureLoaded(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = loadExtractor().then((ext) => {
      post({ type: 'ready', backend });
      return ext;
    });
  }
  return extractorPromise;
}

self.addEventListener('message', async (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      await ensureLoaded();
    } else if (msg.type === 'embed') {
      const extractor = await ensureLoaded();
      const output = await extractor(msg.text, { pooling: 'mean', normalize: true });
      post({ type: 'result', id: msg.id, vector: Array.from(output.data as Float32Array) });
    }
  } catch (err) {
    post({
      type: 'error',
      id: msg.type === 'embed' ? msg.id : undefined,
      message: err instanceof Error ? err.message : String(err),
    });
  }
});
