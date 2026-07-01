// Main-thread handle to the embedding Web Worker. Lazily spawns the worker,
// tracks outstanding requests by id, and surfaces load progress + readiness.
//
// The worker is created with `new URL(..., import.meta.url)` so bundlers
// (Vite/webpack) emit it as a separate chunk and keep transformers.js out of
// the main bundle until semantic search is actually requested.

export interface EmbedderOptions {
  /** Called with model download/progress events while warming up. */
  onProgress?: (status: string, progress?: number) => void;
  /** Called once the model is loaded and ready. */
  onReady?: (backend: string) => void;
}

export interface Embedder {
  /** Embed a single query into a normalized 384-dim vector. */
  embed(text: string): Promise<number[]>;
  /** Resolves when the model is loaded. Rejects if load fails. */
  ready(): Promise<string>;
  /** Whether the model has finished loading. */
  readonly isReady: boolean;
  /** Terminate the worker and free resources. */
  dispose(): void;
}

type WorkerOut =
  | { type: 'ready'; backend: string }
  | { type: 'progress'; status: string; progress?: number; file?: string }
  | { type: 'result'; id: number; vector: number[] }
  | { type: 'error'; id?: number; message: string };

export function createEmbedder(opts: EmbedderOptions = {}): Embedder {
  const worker = new Worker(new URL('./embedder.worker.ts', import.meta.url), {
    type: 'module',
  });

  let isReady = false;
  let backend = 'unknown';
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: number[]) => void; reject: (e: Error) => void }>();

  let readyResolve!: (backend: string) => void;
  let readyReject!: (e: Error) => void;
  const readyPromise = new Promise<string>((res, rej) => {
    readyResolve = res;
    readyReject = rej;
  });

  worker.addEventListener('message', (e: MessageEvent<WorkerOut>) => {
    const msg = e.data;
    switch (msg.type) {
      case 'progress':
        opts.onProgress?.(msg.status, msg.progress);
        break;
      case 'ready':
        isReady = true;
        backend = msg.backend;
        opts.onReady?.(msg.backend);
        readyResolve(msg.backend);
        break;
      case 'result': {
        const p = pending.get(msg.id);
        if (p) {
          pending.delete(msg.id);
          p.resolve(msg.vector);
        }
        break;
      }
      case 'error': {
        const err = new Error(msg.message);
        if (msg.id != null && pending.has(msg.id)) {
          pending.get(msg.id)!.reject(err);
          pending.delete(msg.id);
        } else if (!isReady) {
          readyReject(err);
        }
        break;
      }
    }
  });

  worker.addEventListener('error', (e) => {
    const err = new Error(e.message || 'Embedder worker crashed');
    if (!isReady) readyReject(err);
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  });

  // Kick off model loading immediately.
  worker.postMessage({ type: 'init' });

  return {
    embed(text: string): Promise<number[]> {
      const id = nextId++;
      return new Promise<number[]>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ type: 'embed', id, text });
      });
    },
    ready: () => readyPromise,
    get isReady() {
      return isReady;
    },
    dispose() {
      worker.terminate();
      for (const p of pending.values()) p.reject(new Error('Embedder disposed'));
      pending.clear();
      void backend;
    },
  };
}
