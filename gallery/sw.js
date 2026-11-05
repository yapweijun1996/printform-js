importScripts("./build-identity-classic.js");
const BUILD = "dev";
const SHELL_CACHE = `pf-gallery-shell-${BUILD}`;
const THUMB_CACHE = "pf-gallery-thumbs-v1";
const PRECACHE = "__PF_GALLERY_PRECACHE__";
const HASHES = "__PF_GALLERY_HASHES__";
// Keep the network bounded while avoiding the serial install cost of a large shell.
// The worker still verifies and writes every resource before it becomes usable.
const PRECACHE_CONCURRENCY = 6;
// A stalled asset must eventually release install cleanup; two minutes leaves
// room for the release's 11 MB font on a slow connection without hanging forever.
const PRECACHE_RESOURCE_TIMEOUT = 120000;
const canon = (url) => { const value = new URL(url); value.search = ""; value.hash = ""; return value.href; };

async function fetchResource(input, init = {}, consume) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PRECACHE_RESOURCE_TIMEOUT);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return consume ? await consume(response) : response;
  }
  finally { clearTimeout(timeout); }
}

function fetchBuildIdentity(input) {
  return fetchResource(input, { cache: "no-store" }, async (response) => {
    if (!response.ok) return { ok: false, async json() { return null; } };
    const identity = await response.clone().json();
    return { ok: true, async json() { return identity; } };
  });
}

async function cacheResource(cache, path) {
  const url = new URL(path, self.registration.scope);
  url.searchParams.set("v", BUILD);
  const { response, body } = await fetchResource(url, { cache: "no-store" }, async (value) => {
    if (!value.ok) throw new Error(`Precache failed: ${path}`);
    return { response: value, body: await value.clone().arrayBuffer() };
  });
  const digest = await crypto.subtle.digest("SHA-256", body);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hex !== HASHES[path]) throw new Error(`Precache integrity failed: ${path}`);
  await cache.put(canon(url), response);
}

async function cachePrecache(cache) {
  let next = 0;
  let firstError;
  const worker = async () => {
    while (!firstError) {
      const path = PRECACHE[next++];
      if (path === undefined) return;
      try { await cacheResource(cache, path); }
      catch (error) { if (!firstError) firstError = error; }
    }
  };
  const count = Math.min(PRECACHE_CONCURRENCY, PRECACHE.length);
  await Promise.all(Array.from({ length: count }, worker));
  if (firstError) throw firstError;
}

self.addEventListener("install", (event) => event.waitUntil((async () => {
  // Do not install an unbuilt source checkout.
  if (!Array.isArray(PRECACHE)) throw new Error("Gallery worker requires a site build");
  try {
    await self.requireBuildIdentity(BUILD, fetchBuildIdentity(`./build-info.json?v=${BUILD}`));
    const cache = await caches.open(SHELL_CACHE);
    await cachePrecache(cache);
    await self.requireBuildIdentity(BUILD, fetchBuildIdentity(`./build-info.json?v=${BUILD}`));
  } catch (error) {
    await caches.delete(SHELL_CACHE);
    throw error;
  }
})()));
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  // Old open tabs still reference immutable releases. Never delete their assets.
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (!clients.length) for (const name of await caches.keys()) {
    if (name.startsWith("pf-gallery-shell-") && name !== SHELL_CACHE) await caches.delete(name);
  }
  await self.clients.claim();
  clients.forEach((client) => client.postMessage({ type: "PWA_READY", build: BUILD }));
})()));
self.addEventListener("message", (event) => {
  if (!event.source?.url || new URL(event.source.url).origin !== self.location.origin || !event.source.url.startsWith(self.registration.scope)) return;
  if (event.data?.type === "GET_BUILD") event.ports[0]?.postMessage({ type: "BUILD", build: BUILD });
  // Preserve the original Gallery's explicit Update now message for old clients.
  const legacyActivation = event.data?.build === undefined && Object.keys(event.data || {}).length === 1;
  if (event.data?.type === "SKIP_WAITING" && (event.data.build === BUILD || legacyActivation)) event.waitUntil(self.skipWaiting());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  // Metadata is ONLY a network availability check, never the running version.
  if (url.href.startsWith(new URL("./build-info.json", self.registration.scope).href)) {
    event.respondWith(fetch(request, { cache: "no-store" })); return;
  }
  const key = canon(url);
  if (url.pathname.includes("/thumbs/")) {
    event.respondWith((async () => {
      const cache = await caches.open(THUMB_CACHE), saved = await cache.match(key);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(key, response.clone());
        const keys = await cache.keys();
        for (const old of keys.slice(0, Math.max(0, keys.length - 120))) await cache.delete(old);
      }
      return response;
    })()); return;
  }
  event.respondWith((async () => {
    const release = url.pathname.match(/\/releases\/([\w-]+)\//)?.[1];
    const cache = await caches.open(release ? `pf-gallery-shell-${release}` : SHELL_CACHE);
    const index = new URL("./index.html", self.registration.scope).href;
    const normalized = key === self.registration.scope ? index : key;
    const saved = await cache.match(normalized);
    if (saved) return saved;
    const response = await fetch(request);
    if (response.status === 404 && url.pathname.includes("/designs/")) {
      const client = await self.clients.get(event.clientId);
      client?.postMessage({ type: "DESIGN_404" });
    }
    return response;
  })());
});
