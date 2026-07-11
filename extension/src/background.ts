// Service worker: relays formula-render requests from content scripts to the
// offscreen document (which it lazily creates), since only an extension page
// may call chrome.offscreen.createDocument.

// Built to extension/offscreen.html (Vite keeps the input's path); the URL is
// resolved relative to the extension root.
const OFFSCREEN_URL = 'extension/offscreen.html';
let creating: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creating) {
    creating = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ['BLOBS'],
        justification: 'Render formula LaTeX to a PNG image off the host page (avoids page CSP).',
      })
      // Swallow ONLY the benign "already exists" race; rethrow real failures so
      // the caller can report them.
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (/single offscreen|already/i.test(msg)) return;
        throw err;
      })
      .finally(() => {
        creating = null;
      });
  }
  await creating;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'fx-render') return;
  void (async () => {
    try {
      await ensureOffscreen();
      const result = await chrome.runtime.sendMessage({
        type: 'fx-render-offscreen',
        latex: message.latex,
        scale: message.scale,
      });
      sendResponse(result);
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  })();
  return true; // async sendResponse
});
