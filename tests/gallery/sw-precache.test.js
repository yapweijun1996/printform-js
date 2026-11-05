// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const source = fs.readFileSync(path.join(root, "gallery/sw.js"), "utf8");

function fixture({ failPath } = {}) {
  const paths = Array.from({ length: 12 }, (_, index) => `assets/${index}.js`);
  const hashes = Object.fromEntries(paths.map((file) => [file, "00".repeat(32)]));
  const listeners = new Map();
  const writes = [];
  let active = 0, maxActive = 0, deleted = false, deleteAtActive = -1;
  const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const response = (value) => ({
    ok: true,
    clone() { return response(value); },
    async arrayBuffer() { return value instanceof ArrayBuffer ? value : new ArrayBuffer(8); },
    async json() { return value; }
  });
  const fetch = async (request) => {
    const url = new URL(request, "https://example.test/gallery/");
    if (url.pathname.endsWith("/build-info.json")) return response({ build: "test" });
    active += 1; maxActive = Math.max(maxActive, active);
    await wait(4);
    if (url.pathname.endsWith(failPath || "__never__")) { active -= 1; throw new Error("synthetic precache failure"); }
    active -= 1;
    return response(new ArrayBuffer(8));
  };
  const cache = {
    async put(key) { active += 1; await wait(2); active -= 1; writes.push(key); },
    async match() { return undefined; },
    async keys() { return []; }
  };
  const self = {
    registration: { scope: "https://example.test/gallery/" },
    addEventListener(type, handler) { listeners.set(type, handler); },
    requireBuildIdentity: async (expected, pending) => {
      const value = await pending;
      if (!value.ok || (await value.json()).build !== expected) throw new Error("identity mismatch");
    },
    clients: { async matchAll() { return []; } }
  };
  const context = {
    self, fetch, URL, Promise, ArrayBuffer, Uint8Array, AbortController, setTimeout, clearTimeout,
    console, importScripts() {},
    crypto: { subtle: { async digest() { return new Uint8Array(32).buffer; } } },
    caches: {
      async open() { return cache; },
      async delete() { deleted = true; deleteAtActive = active; return true; },
      async keys() { return []; }
    }
  };
  const worker = source
    .replace('const BUILD = "dev";', 'const BUILD = "test";')
    .replace('const PRECACHE = "__PF_GALLERY_PRECACHE__";', `const PRECACHE = ${JSON.stringify(paths)};`)
    .replace('const HASHES = "__PF_GALLERY_HASHES__";', `const HASHES = ${JSON.stringify(hashes)};`);
  vm.runInNewContext(worker, context);
  return { listeners, paths, writes, get maxActive() { return maxActive; }, get deleted() { return deleted; }, get deleteAtActive() { return deleteAtActive; } };
}

async function install(app) {
  let pending;
  app.listeners.get("install")({ waitUntil(value) { pending = value; } });
  await pending;
}

describe("Gallery service-worker precache", () => {
  it("keeps downloads bounded while verifying and writing every asset", async () => {
    const app = fixture();
    await install(app);
    expect(app.maxActive).toBeGreaterThan(1);
    expect(app.maxActive).toBeLessThanOrEqual(6);
    expect(app.writes).toHaveLength(app.paths.length);
    expect(app.deleted).toBe(false);
  });

  it("waits for in-flight workers before deleting an incomplete cache", async () => {
    const app = fixture({ failPath: "assets/3.js" });
    await expect(install(app)).rejects.toThrow("synthetic precache failure");
    expect(app.deleted).toBe(true);
    expect(app.deleteAtActive).toBe(0);
  });
});
