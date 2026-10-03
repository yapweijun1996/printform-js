export async function readClientStorage(page) {
  return page.evaluate(async () => {
    // Shell installation is independent of the operation being audited. Take
    // both snapshots after its cache population/activation has completed,
    // retaining every cache entry in the strict storage comparison below.
    if (navigator.serviceWorker) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const own = registrations.filter(r=>location.href.startsWith(r.scope));
      const settled = (worker,states)=>!worker || states.includes(worker.state) ? Promise.resolve() : new Promise(resolve=> {
        const check=()=> {if(states.includes(worker.state)){worker.removeEventListener('statechange',check);resolve();}};
        worker.addEventListener('statechange',check);check();
      });
      if (own.length) {
        await Promise.all(own.map(r=>settled(r.installing,['installed','activated','redundant'])));
        const ready = await navigator.serviceWorker.ready;
        await settled(ready.active,['activated','redundant']);
      }
    }
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
