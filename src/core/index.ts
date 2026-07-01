// Framework-agnostic core: search + render + export. No React, no DOM assumptions
// beyond the export path (which is browser-only by nature).

export * from './types.js';
export { createSearchEngine } from './searchEngine.js';
export { renderToString, renderInto, isRenderable, toMathML } from './renderPreview.js';
export type { RenderOptions } from './renderPreview.js';
// exportImage (MathJax) is intentionally NOT value-exported from the barrel so it
// stays a lazy chunk; use getFormat('png'|'svg') for image export. Types only:
export type { ExportOptions, PngOptions } from './exportImage.js';
export { createEmbedder } from './embedder.js';
export type { Embedder, EmbedderOptions } from './embedder.js';
export {
  getFormat,
  copyResult,
  downloadResult,
  toUnicode,
  FORMAT_CONFIG,
  GUARANTEED_KINDS,
  BEST_EFFORT_KINDS,
} from './formats.js';
export type {
  FormatKind,
  FormatTier,
  FormatResult,
  FormatOptions,
  CopyOutcome,
} from './formats.js';
export { setOmmlConverter, DOCX_MIME } from './omml.js';
export type { OmmlConverter } from './omml.js';
export {
  createQuantityIndex,
  DEFAULT_QUANTITY_WEIGHTS,
} from './quantitySearch.js';
export type {
  QuantityIndex,
  QuantityWeights,
  QuantitySearchOptions,
} from './quantitySearch.js';
// NOTE: dimensionCheck.ts / units.ts / calculator.ts are intentionally NOT
// value-exported here — they pull in math.js, which must stay out of the base
// bundle (calculator.ts is lazy-imported by the calculator UI). Types are safe:
export type { SolveInput, SolveResult, CalcVariable } from './calculator.js';
export {
  slugify,
  makeUniqueId,
  takenNames,
  validateCustomFormula,
} from './customFormulas.js';
export type {
  CustomFormulaInput,
  ValidationError,
  ValidationResult,
} from './customFormulas.js';
