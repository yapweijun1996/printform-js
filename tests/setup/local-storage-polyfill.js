// Node 22+ ships a native `localStorage`/`sessionStorage` global that is a
// non-functional stub unless the process is started with a real
// `--localstorage-file <path>` (hence the "was provided without a valid
// path" warning vitest runs print). Because that native global already
// exists, vitest-environment-jsdom's window inherits/exposes the same broken
// stub instead of constructing its own working Storage — every setItem call
// silently does nothing (getItem/setItem aren't even functions on it).
//
// A plain `new JSDOM()` outside vitest does NOT show this problem (its
// window.localStorage works normally), so this is specifically a Node
// runtime vs. test-environment interaction, not a jsdom or app bug. Rather
// than depend on jsdom internals to sort it out, install a small
// self-contained in-memory Storage polyfill so any test touching
// localStorage/sessionStorage gets predictable, working behavior.
function createMemoryStorage() {
  let store = new Map();
  return {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => { store.set(String(key), String(value)); },
    removeItem: (key) => { store.delete(String(key)); },
    clear: () => { store = new Map(); },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; }
  };
}

if (typeof globalThis.window !== "undefined") {
  const localStorage = createMemoryStorage();
  const sessionStorage = createMemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: localStorage, configurable: true, writable: true });
  Object.defineProperty(globalThis, "sessionStorage", { value: sessionStorage, configurable: true, writable: true });
  Object.defineProperty(globalThis.window, "localStorage", { value: localStorage, configurable: true, writable: true });
  Object.defineProperty(globalThis.window, "sessionStorage", { value: sessionStorage, configurable: true, writable: true });
}
