import React from 'react';
import { createRoot } from 'react-dom/client';
// @ts-ignore - mathml2omml ships no type declarations
import { mml2omml } from 'mathml2omml';
import { setOmmlConverter } from '../../src/index.js';
import 'katex/dist/katex.min.css';
import '../../src/react/formulize.css';
import { App } from './App.js';

// Opt into editable Word (.docx) export in the demo by injecting an OMML
// converter. The library ships none by default so it stays fully MIT; consumers
// who want editable equations install mathml2omml (LGPL) and inject it here.
setOmmlConverter({ toOmml: (mathml: string) => mml2omml(mathml) });

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
