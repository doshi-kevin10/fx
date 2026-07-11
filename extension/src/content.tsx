// Content-script entry: track editable fields and mount the floating dock.

import 'katex/dist/katex.min.css';
import '../../src/react/formulize.css';
import { mountFormulyze } from './mount.js';
import { startFocusTracker } from './focus-tracker.js';

const HOST_ID = 'formulyze-ext-host';

if (!document.getElementById(HOST_ID)) {
  startFocusTracker();
  mountFormulyze();
}
