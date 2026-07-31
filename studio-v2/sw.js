const CACHE_PREFIX = "printform-studio-v2";
const CACHE_VERSION = "2.1.0-__PRINTFORM_BUILD__";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const APP_SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./icon.svg",
  "./agent-setup.json", "./agent-setup.schema.json", "./AGENT_SETUP.md", "./llms.txt",
  "./styles/base.css", "./styles/layout.css", "./styles/components.css",
  "./ui/app.js", "./ui/file-io.js", "./ui/draft-cache.js", "./ui/preview.js", "./ui/status-view.js", "./ui/ui-i18n.js",
  "./ui/locales/en.js", "./ui/locales/zh.js", "./ui/locales/ms.js", "./ui/locales/ja.js", "./ui/locales/vi.js",
  "./adapters/gateway.js", "./adapters/webmcp.js",
  "./core/constants.js", "./core/json.js", "./core/schema.js", "./core/binding.js", "./core/typography.js", "./core/i18n.js", "./core/business-rules.js",
  "./core/acceptance.js", "./core/project-model.js", "./core/operations.js",
  "./core/history.js", "./core/command-bus.js", "./core/tool-contracts.js",
  "./core/sample-scenarios.js", "./core/migrations.js", "./core/assets.js", "./core/exporter.js",
  "./core/layout-review.js", "./core/logo-placeholder.js",
  "./samples/catalog.js", "./samples/sales-invoice.js", "./samples/sales-invoice-i18n.js",
  "./samples/purchase-order.js", "./samples/purchase-order-schema.js", "./samples/purchase-order-layout.js", "./samples/purchase-order-i18n.js",
  "../dist/printform.js", "../dist/printform-document.js"
];

self.addEventListener("install", (event) => {
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
  event.respondWith(caches.match(event.request, matchOptions).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch((error) => {
    if (isNavigation) return caches.match("./index.html");
    throw error;
  })));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
