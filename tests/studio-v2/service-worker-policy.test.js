import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("studio-v2/sw.js", "utf8")
  .replace('"__PRINTFORM_APP_SHELL__"', JSON.stringify(["./", "./index.html", "./app.js"]));

function setup() {
  const listeners = new Map();
  const put = vi.fn(async () => {});
  const response = { ok: true, clone: () => response };
  const context = {
    URL,
    Promise,
    Set,
    Array,
    Response: { error: () => ({ error: true }) },
    self: {
      location: { href: "https://studio.test/studio-v2/sw.js", origin: "https://studio.test" },
      addEventListener: (type, listener) => listeners.set(type, listener),
      skipWaiting: vi.fn()
    },
    caches: {
      open: vi.fn(async () => ({ addAll: vi.fn(), put })),
      match: vi.fn(async () => null),
      keys: vi.fn(async () => [])
    },
    fetch: vi.fn(async () => response)
  };
  vm.runInNewContext(source, context, { filename: "studio-v2/sw.js" });
  return { context, fetch: context.fetch, put, fetchHandler: listeners.get("fetch") };
}

function request(url, mode = "navigate") {
  return { method: "GET", url, mode };
}

async function dispatch(fetchHandler, requestValue) {
  let result;
  fetchHandler({ request: requestValue, respondWith: (promise) => { result = promise; } });
  return result;
}

describe("service worker cache policy", () => {
  it("does not cache an arbitrary same-origin document navigation", async () => {
    const { fetch, put, fetchHandler } = setup();

    await dispatch(fetchHandler, request("https://studio.test/studio-v2/imported-customer.html"));

    expect(fetch).toHaveBeenCalledOnce();
    expect(put).not.toHaveBeenCalled();
  });

  it("caches only generated shell paths and ignores their query string", async () => {
    const { put, fetchHandler } = setup();

    await dispatch(fetchHandler, request("https://studio.test/studio-v2/?sample=synthetic"));
    await dispatch(fetchHandler, request("https://studio.test/studio-v2/app.js", "no-cors"));

    expect(put).toHaveBeenCalledTimes(2);
  });
});
