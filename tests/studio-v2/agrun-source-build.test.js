// @vitest-environment node
import fs from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { AGRUN_VENDOR_PROVENANCE } from "../../studio-v2/vendor/agrun.provenance.js";
import { buildAgrun, verifyDerivation } from "../../scripts/agrun-source-build.mjs";

const expected = JSON.parse(fs.readFileSync("scripts/vendor/agrun-v4/exports.json", "utf8"));
function load(bytes) {
  const exports = {};
  let evalProbes = 0;
  const context = vm.createContext({
    exports, module: { exports }, TextEncoder, TextDecoder, URL, URLSearchParams, AbortController,
    Headers, Request, Response, TransformStream, ReadableStream, WritableStream,
    Function: function blockedFunction() { evalProbes += 1; throw new EvalError("strict CSP eval blocked"); }
  }, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext(bytes.toString(), context, { timeout: 3000 });
  return { exports, evalProbes };
}

describe("audited compatible AGRUN source build", () => {
  it("reproduces all 119 V4 export types without even probing dynamic compilation", async () => {
    const bytes = await buildAgrun();
    expect(bytes.equals(fs.readFileSync("studio-v2/vendor/agrun.min.js"))).toBe(true);
    const result = load(bytes);
    expect(result.evalProbes).toBe(0);
    expect(Object.fromEntries(Object.entries(result.exports).map(([name, value]) => [name, typeof value]))).toEqual(expected);
    const runtime = result.exports.createRuntime({ sessionStore: result.exports.createInMemorySessionStore(), globalMemory: { enabled: false } });
    expect(runtime.createSession).toBeTypeOf("function");
    expect(runtime.openSession).toBeTypeOf("function");
    expect(runtime.runStream).toBeTypeOf("function");
    expect(() => result.exports.createInMemorySessionStore({ maxSessions: 0 })).toThrow();
    expect(() => result.exports.defineAction({ name: "invalid" })).toThrow();
  });

  it("reproduces the original initialization probe when the sole source patch is disabled", async () => {
    const baseline = load(await buildAgrun({ jitless: false }));
    expect(baseline.evalProbes).toBeGreaterThan(0);
    expect(Object.fromEntries(Object.entries(baseline.exports).map(([name, value]) => [name, typeof value]))).toEqual(expected);
  });

  it.each([
    ["upstream hash", { upstreamSha256: "0".repeat(64) }],
    ["pin", { commit: "0".repeat(40) }],
    ["extra patch", { patches: [...AGRUN_VENDOR_PROVENANCE.patches, { id: "other", sha256: "0".repeat(64) }] }],
    ["recipe", { derivation: { ...AGRUN_VENDOR_PROVENANCE.derivation, recipeSha256: "0".repeat(64) } }],
    ["source manifest", { derivation: { ...AGRUN_VENDOR_PROVENANCE.derivation, manifestSha256: "0".repeat(64) } }],
    ["toolchain", { derivation: { ...AGRUN_VENDOR_PROVENANCE.derivation, tools: { vite: "0", rolldown: "0" } } }]
  ])("rejects changed %s provenance", (_name, changes) => {
    expect(() => verifyDerivation({ ...AGRUN_VENDOR_PROVENANCE, ...changes })).toThrow();
  });
});
