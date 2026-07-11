// Content-script side: ask the service worker (→ offscreen document) to render
// a formula PNG, and turn the returned data URL into a Blob for clipboard/drag.
// Passed to <FormulaDock renderPng={...}> so the shared component never rasterizes
// on the host page (which strict-CSP sites like Google Docs block).

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(5, comma); // strip leading "data:"
  const mime = meta.split(';')[0] || 'image/png';
  const body = dataUrl.slice(comma + 1);
  if (/;base64/i.test(meta)) {
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  return new Blob([decodeURIComponent(body)], { type: mime });
}

export async function renderPngViaOffscreen(latex: string, scale = 3): Promise<Blob> {
  const res = await chrome.runtime.sendMessage({ type: 'fx-render', latex, scale });
  if (!res?.ok) throw new Error(res?.error ?? 'PNG render failed');
  return dataUrlToBlob(res.dataUrl as string);
}
