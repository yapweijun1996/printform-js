export async function readClientStorage(page) {
  return page.evaluate(async () => {
    const read = (storage) => Object.fromEntries(Object.keys(storage).sort().map((key) => [key, storage.getItem(key)]));
    const databaseNames = typeof indexedDB.databases === "function"
      ? (await indexedDB.databases()).map(({ name }) => name).filter(Boolean).sort()
      : [];
    const indexedDb = [];
    for (const name of databaseNames) {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
      });
      const stores = [];
      for (const storeName of Array.from(db.objectStoreNames)) {
        const store = db.transaction(storeName, "readonly").objectStore(storeName);
        const records = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error("IndexedDB read failed"));
        });
        stores.push({ name: storeName, records: records.map((value) => {
          try { return JSON.parse(JSON.stringify(value)); }
          catch { return String(value); }
        }) });
      }
      db.close();
      indexedDb.push({ name, stores });
    }
    const cacheNames = typeof caches === "undefined" ? [] : (await caches.keys()).sort();
    const cacheEntries = [];
    for (const name of cacheNames) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        let body = null;
        try { body = response ? await response.clone().text() : null; } catch { body = "[binary]"; }
        cacheEntries.push({ cache: name, url: request.url, body });
      }
    }
    return {
      local: read(localStorage), session: read(sessionStorage),
      databases: databaseNames, indexedDb, cacheNames, cacheEntries
    };
  });
}
