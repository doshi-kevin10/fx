import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'Formulyze',
  version: '0.1.2',
  description:
    'Floating formula finder — search math, physics, chemistry concepts and insert LaTeX anywhere.',
  icons: {
    128: 'extension/public/icons/icon.svg',
  },
  action: {
    default_title: 'Formulyze — Formula Finder',
    default_icon: {
      128: 'extension/public/icons/icon.svg',
    },
  },
  background: {
    service_worker: 'extension/src/background.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['extension/src/content.tsx'],
      run_at: 'document_idle',
    },
  ],
  permissions: ['storage', 'offscreen'],
  host_permissions: ['<all_urls>'],
});
