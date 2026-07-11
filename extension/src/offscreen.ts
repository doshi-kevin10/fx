// Offscreen document: renders LaTeX → PNG in the EXTENSION's context, where the
// host page's CSP doesn't apply. The content script's own <img>/canvas rasterize
// is blocked on strict sites (Google Docs), so we do it here and hand back a PNG.

import { toPNG } from '../../src/core/exportImage.js';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'fx-render-offscreen') return;
  void (async () => {
    try {
      const blob = await toPNG(message.latex, { scale: message.scale ?? 3 });
      sendResponse({ ok: true, dataUrl: await blobToDataUrl(blob) });
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  })();
  return true; // keep the message channel open for the async sendResponse
});
