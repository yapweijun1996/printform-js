const CACHE_PREFIX = "printform-studio-v2";
const BUILD_ID = "__PRINTFORM_BUILD__";
const CACHE_VERSION = `2.1.0-${BUILD_ID}`;
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
// Unstamped build id = running from the repo, not a Pages deploy. Cache-first
// with a never-changing cache name would serve stale app files forever in
// local dev, so fall back to network-first there.
const DEV_MODE = BUILD_ID.startsWith("__");
// Replaced with a real array literal by scripts/build-site.mjs, which walks the
// built output. It used to be maintained by hand, and adding a module without
// remembering to list it here broke offline loading twice in one day — the
// module 404s once the network is gone, and nothing in the app says why.
// Generating it removes the chance to forget.
const APP_SHELL = "__PRINTFORM_APP_SHELL__";

self.addEventListener("install", (event) => {
  // A string means the placeholder was never substituted, i.e. this is the
  // repo copy being served in local dev rather than a built artifact. Dev is
  // network-first anyway (see DEV_MODE), so precaching there buys nothing —
  // skip it instead of failing install on a bogus URL.
  if (!Array.isArray(APP_SHELL)) return;
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)))));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  // Navigations carry query strings ("?sample=purchase-order-red") that are
  // not cache keys — match ignoring search, and fall back to the cached app
  // shell when the network is down so offline reloads keep working.
  const isNavigation = event.request.mode === "navigate";
  const matchOptions = isNavigation ? { ignoreSearch: true } : undefined;
  const fromNetwork = () => fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  });
  if (DEV_MODE) {
    event.respondWith(fromNetwork().catch(() => caches.match(event.request, matchOptions).then((cached) => {
      if (cached) return cached;
      if (isNavigation) return caches.match("./index.html");
      return Response.error();
    })));
    return;
  }
  event.respondWith(caches.match(event.request, matchOptions).then((cached) => cached || fromNetwork().catch((error) => {
    if (isNavigation) return caches.match("./index.html");
    throw error;
  })));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
