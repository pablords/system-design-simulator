// Polyfill window & location & event listeners for node test environment
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = globalThis;
}

if (!globalThis.window.location) {
  Object.defineProperty(globalThis.window, 'location', {
    value: {
      hostname: 'localhost',
      host: 'localhost:5173',
      href: 'http://localhost:5173',
      protocol: 'http:',
      origin: 'http://localhost:5173',
    },
    writable: true,
  });
}

if (typeof globalThis.window.addEventListener === 'undefined') {
  globalThis.window.addEventListener = () => {};
  globalThis.window.removeEventListener = () => {};
}

if (typeof (globalThis as any).addEventListener === 'undefined') {
  (globalThis as any).addEventListener = () => {};
  (globalThis as any).removeEventListener = () => {};
}

// Polyfill localStorage for node test environment
const storageMap = new Map<string, string>();
const storageMock = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storageMap.set(key, String(value));
  },
  removeItem: (key: string) => {
    storageMap.delete(key);
  },
  clear: () => {
    storageMap.clear();
  },
  get length() {
    return storageMap.size;
  },
  key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
};

try {
  Object.defineProperty(Object.prototype, 'localStorage', {
    get() {
      return storageMock;
    },
    set() {},
    configurable: true,
  });
} catch {}

try {
  Object.defineProperty(globalThis, 'localStorage', {
    get() {
      return storageMock;
    },
    set() {},
    configurable: true,
  });
} catch {}

if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
