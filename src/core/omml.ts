// Word / OMML export (best-effort tier). The MathML→OMML conversion is isolated
// behind the OmmlConverter interface and lazy-loads `mathml2omml` (LGPL-3.0) so
// the LGPL code is never statically bundled into the MIT core. See NOTICE.
//
// Guaranteed fallback: if conversion is unavailable, we still emit a valid .docx
// (with the formula as text) so the user always has a working file. Never throws.

import type { Formula } from './types.js';
import { toMathML } from './renderPreview.js';
import type { FormatResult } from './formats.js';

export const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Swappable MathML→OMML converter. Returns an `<m:oMath>…</m:oMath>` string. */
export interface OmmlConverter {
  toOmml(mathml: string): Promise<string> | string;
}

// Default converter: lazy-imports the LGPL library only when Word export runs.
let converter: OmmlConverter = {
  async toOmml(mathml: string): Promise<string> {
    const mod = await import('mathml2omml');
    return mod.mml2omml(mathml);
  },
};

/** Replace the converter (e.g. to inject a permissive/mock implementation). */
export function setOmmlConverter(next: OmmlConverter): void {
  converter = next;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&apos;'
  );
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function documentXml(bodyInner: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
<w:body><w:p>${bodyInner}</w:p></w:body>
</w:document>`;
}

async function buildDocx(bodyInner: string): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate');
  const zipped = zipSync({
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(RELS),
    'word/document.xml': strToU8(documentXml(bodyInner)),
  });
  // Copy into a fresh ArrayBuffer so the Blob gets a clean, correctly-typed buffer.
  const buf = zipped.slice();
  return new Blob([buf], { type: DOCX_MIME });
}

/**
 * Build a Word export for a formula. Primary: an editable native equation via
 * MathML→OMML. Fallback: a .docx containing the formula as text. Also exposes
 * the MathML as `text` for the "copy MathML to Word" clipboard path.
 */
export async function getWord(formula: Formula): Promise<FormatResult> {
  const mathml = toMathML(formula.latex);
  let bodyInner: string;
  let note: string | undefined;

  try {
    const omml = await converter.toOmml(mathml);
    // mml2omml returns a namespaced <m:oMath>; wrap for display math.
    bodyInner = `<m:oMathPara>${omml}</m:oMathPara>`;
  } catch {
    // Guaranteed fallback: a valid .docx with the formula as plain text.
    bodyInner = `<w:r><w:t xml:space="preserve">${escapeXml(formula.latex)}</w:t></w:r>`;
    note = 'Editable-equation conversion unavailable — the .docx contains the formula as text.';
  }

  const blob = await buildDocx(bodyInner);
  return {
    kind: 'word',
    tier: 'best-effort',
    mime: DOCX_MIME,
    blob,
    filename: `${formula.id}.docx`,
    text: mathml, // for the clipboard-MathML attempt
    note,
  };
}
