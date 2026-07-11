import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { App } from './App.js';

const HOST_ID = 'formulyze-ext-host';

/** Mount React into an isolated host on the page (styles injected by CRXJS). */
export function mountFormulyze(): void {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  // Keep the host inert so it never steals layout; FormulaDock is position:fixed.
  host.style.cssText = 'position:fixed;inset:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2147483647;';
  document.documentElement.appendChild(host);

  const root = createRoot(host);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
