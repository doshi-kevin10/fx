// Minimal ambient types for the chrome.* APIs this extension uses — avoids a
// full @types/chrome dependency. Picked up automatically for files under extension/.

type FxStorageChange = { newValue?: unknown; oldValue?: unknown };

declare namespace chrome {
  namespace storage {
    interface StorageArea {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    }
    const local: StorageArea;
    const onChanged: {
      addListener(cb: (changes: Record<string, FxStorageChange>, areaName: string) => void): void;
      removeListener(cb: (changes: Record<string, FxStorageChange>, areaName: string) => void): void;
    };
  }
  namespace runtime {
    function getURL(path: string): string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function sendMessage(message: unknown): Promise<any>;
    const onMessage: {
      addListener(
        cb: (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          message: any,
          sender: unknown,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void;
    };
  }
  namespace offscreen {
    function createDocument(opts: { url: string; reasons: string[]; justification: string }): Promise<void>;
    function hasDocument(): Promise<boolean>;
  }
}
