/** Extension build stub — semantic search ships in a later release. */

import type { Embedder, EmbedderOptions } from '../../../src/core/embedder.js';

export type { Embedder, EmbedderOptions };

export function createEmbedder(_opts: EmbedderOptions = {}): Embedder {
  throw new Error('Semantic search is not enabled in the Formulyze extension yet.');
}
