// On-demand image export using MathJax's SVG output (KaTeX has no SVG export).
// Runs on a click, not per keystroke, so a ~50-100 ms render is fine.
//
// - toSVG(latex)  -> a self-contained SVG string (mhchem supported).
// - toPNG(latex)  -> a PNG Blob, rasterized from the SVG via <canvas>.
//
// MathJax is heavy; import it lazily so the keyword-only preview stays tiny.

import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor, type LiteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import type { MathDocument } from 'mathjax-full/js/core/MathDocument.js';
import type { LiteElement } from 'mathjax-full/js/adaptors/lite/Element.js';
import type { LiteText } from 'mathjax-full/js/adaptors/lite/Text.js';
import type { LiteDocument } from 'mathjax-full/js/adaptors/lite/Document.js';

export interface ExportOptions {
  /** Foreground color applied to the (otherwise `currentColor`) glyphs. */
  color?: string;
  /** Render as display (block) math. Defaults to true. */
  display?: boolean;
}

export interface PngOptions extends ExportOptions {
  /** Device-pixel multiplier for crisp HiDPI output. Defaults to 3. */
  scale?: number;
  /** Background fill. `null`/omitted = transparent. */
  background?: string | null;
}

// Approximate CSS pixels per `ex` unit used to size the exported raster.
const EX_PX = 8;

let adaptor: LiteAdaptor | null = null;
let doc: MathDocument<LiteElement | LiteText, LiteText, LiteDocument> | null = null;

function getDoc() {
  if (!doc) {
    adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    const tex = new TeX({ packages: AllPackages }); // AllPackages includes mhchem
    const svg = new SVG({ fontCache: 'local' }); // keep defs inside each SVG => standalone
    doc = mathjax.document('', { InputJax: tex, OutputJax: svg });
  }
  return { adaptor: adaptor!, doc: doc! };
}

function parseExAttr(svg: string, attr: 'width' | 'height'): number {
  const m = svg.match(new RegExp(`${attr}="([\\d.]+)ex"`));
  return m ? parseFloat(m[1]) : 0;
}

/** Render LaTeX to a self-contained SVG string. */
export function toSVG(latex: string, opts: ExportOptions = {}): string {
  const { adaptor, doc } = getDoc();
  // convert() returns the container element at runtime; its typed union includes
  // text/MmlNode which the adaptor's innerHTML doesn't accept.
  const node = doc.convert(latex, { display: opts.display ?? true }) as LiteElement;
  let svg = adaptor.innerHTML(node);

  // Ensure it's a valid standalone document: xmlns + a concrete color.
  if (!svg.includes('xmlns=')) {
    svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  }
  const color = opts.color ?? '#111827';
  // MathJax paints with currentColor; set it via a style on the root <svg>.
  svg = svg.replace('<svg ', `<svg style="color:${color}" `);
  return svg;
}

/** Intrinsic pixel size the SVG will rasterize to at a given scale. */
function pixelSize(svg: string, scale: number): { width: number; height: number } {
  const w = Math.max(1, Math.ceil(parseExAttr(svg, 'width') * EX_PX * scale));
  const h = Math.max(1, Math.ceil(parseExAttr(svg, 'height') * EX_PX * scale));
  return { width: w, height: h };
}

/** Render LaTeX to a PNG Blob by rasterizing the SVG onto a canvas. */
export async function toPNG(latex: string, opts: PngOptions = {}): Promise<Blob> {
  const scale = opts.scale ?? 3;
  const svg = toSVG(latex, opts);
  const { width, height } = pixelSize(svg, scale);

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.width = width;
    img.height = height;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to rasterize SVG'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Convenience: trigger a browser download of a Blob under `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Convenience: download LaTeX as an .svg file. */
export function downloadSVG(latex: string, filename: string, opts?: ExportOptions): void {
  const svg = toSVG(latex, opts);
  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

/** Convenience: download LaTeX as a .png file. */
export async function downloadPNG(latex: string, filename: string, opts?: PngOptions): Promise<void> {
  const blob = await toPNG(latex, opts);
  downloadBlob(blob, filename);
}

/** Copy a PNG of the LaTeX to the clipboard, where supported. Returns success. */
export async function copyPNGToClipboard(latex: string, opts?: PngOptions): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    const blob = await toPNG(latex, opts);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
