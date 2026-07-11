// chrome.storage-backed store for a professor's custom formulas.
//
// Why not localStorage: a content script's `localStorage` belongs to the HOST
// PAGE's origin, so formulas added on wikipedia.org vanish on khanacademy.org.
// chrome.storage.local is shared across every page the extension runs on.
// ponytail: chrome.storage.local (extension-wide). Switch to `.sync` to also
// roam across the professor's devices — costs an ~8KB-per-item quota.

import type { Formula } from '../../src/core/types.js';
import type { CustomFormulaStore } from '../../src/react/useCustomFormulas.js';

// Minimal ambient type for the calls we use — avoids pulling in @types/chrome.
type StorageChange = { newValue?: unknown; oldValue?: unknown };
type ChangeListener = (changes: Record<string, StorageChange>, areaName: string) => void;
declare const chrome: {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
    onChanged: {
      addListener(cb: ChangeListener): void;
      removeListener(cb: ChangeListener): void;
    };
  };
};

export function chromeStore(key: string): CustomFormulaStore {
  return {
    async load() {
      const got = await chrome.storage.local.get(key);
      const value = got[key];
      return Array.isArray(value) ? (value as Formula[]) : [];
    },
    save(formulas) {
      void chrome.storage.local.set({ [key]: formulas });
    },
    // onChanged fires in every extension context (all tabs), so a formula added
    // in one tab shows up in the others without a reload. The hook's echo guard
    // ignores the copy of this event fired in the writer's own tab.
    subscribe(listener) {
      const handler: ChangeListener = (changes, areaName) => {
        if (areaName !== 'local' || !changes[key]) return;
        const value = changes[key].newValue;
        listener(Array.isArray(value) ? (value as Formula[]) : []);
      };
      chrome.storage.onChanged.addListener(handler);
      return () => chrome.storage.onChanged.removeListener(handler);
    },
  };
}
