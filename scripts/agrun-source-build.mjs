import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT_DIR = path.join(ROOT, "scripts/vendor/agrun-v4");
export const AGRUN_V4_COMMIT = "c631669ac927ff734a37eeef863941f040445182";
export const AGRUN_V4_UPSTREAM = "377b8fd0186fdef8e5e521c1b6fd69ebe4f2ed18538cb3c4c76948f34e906195";
export const AGRUN_CSP_PATCH = "83de172fd0d4d5d9d249869dfa1c78f38d6ab2e3938c75543cc761533c16b281";
const INPUT_SHA = "37da219b43fce0c46aa2bbdb98959c62880b80a5532a17adb403918f192df719";
export const AGRUN_BUILD_TOOLS = Object.freeze({ vite: "8.1.5", rolldown: "1.1.5", esbuild: "0.28.1" });
export function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function sourceBuildIdentity() {
  return {
    kind: "source-build-v4-csp-jitless",
    manifestSha256: sha256(fs.readFileSync(path.join(INPUT_DIR, "manifest.json"))),
    recipeSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    tools: AGRUN_BUILD_TOOLS
  };
}

export function verifyDerivation(provenance) {
  if (provenance.commit !== AGRUN_V4_COMMIT || provenance.upstreamSha256 !== AGRUN_V4_UPSTREAM) {
    throw new Error("Derived AGRUN must retain the approved V4 upstream pin and original bundle hash");
  }
  const identity = sourceBuildIdentity();
  if (JSON.stringify(provenance.derivation) !== JSON.stringify(identity)) {
    throw new Error("AGRUN source manifest, recipe or toolchain provenance changed");
  }
  if (JSON.stringify(provenance.patches) !== JSON.stringify([{ id: "zod-jitless", sha256: AGRUN_CSP_PATCH }])) {
    throw new Error("Only the audited Zod initialization patch is allowed");
  }
}

function readInputs() {
  const manifest = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, "manifest.json")));
  const archive = fs.readFileSync(path.join(INPUT_DIR, "inputs.json.gz"));
  const patch = fs.readFileSync(path.join(INPUT_DIR, "zod-jitless.patch"));
  if (manifest.commit !== AGRUN_V4_COMMIT || manifest.upstreamSha256 !== AGRUN_V4_UPSTREAM
    || sha256(archive) !== INPUT_SHA || manifest.inputsSha256 !== INPUT_SHA
    || sha256(patch) !== AGRUN_CSP_PATCH || manifest.patchSha256 !== AGRUN_CSP_PATCH) {
    throw new Error("AGRUN fixed source inputs or patch integrity failed");
  }
  const inputs = JSON.parse(gunzipSync(archive).toString("utf8"));
  if (Object.keys(inputs).length !== manifest.inputsFiles) throw new Error("AGRUN source file count changed");
  return inputs;
}

function pinnedResolver(root) {
  const deps = path.join(root, "node_modules");
  const aliases = {
    ai: "ai/dist/index.mjs",
    "@vercel/oidc": "@vercel/oidc/dist/index-browser.js",
    "eventsource-parser/stream": "eventsource-parser/dist/stream.js",
    zod: "zod/index.js", "zod/v3": "zod/v3/index.js", "zod/v4": "zod/v4/index.js",
    "@opentelemetry/api": "@opentelemetry/api/build/esm/index.js"
  };
  for (const name of ["provider", "provider-utils", "gateway", "deepseek", "google", "openai"]) {
    aliases[`@ai-sdk/${name}`] = `@ai-sdk/${name}/dist/index.mjs`;
  }
  return {
    name: "fixed-agrun-v4-inputs", enforce: "pre",
    resolveId(id, importer) {
      if (!importer) return null;
      let resolved;
      if (aliases[id]) {
        resolved = path.join(deps, aliases[id]);
        if (importer.includes("/@ai-sdk/deepseek/")) {
          const nested = path.join(deps, "@ai-sdk/deepseek/node_modules", aliases[id]);
          if (fs.existsSync(nested)) resolved = nested;
        }
      } else if (id.startsWith(".")) {
        resolved = path.resolve(path.dirname(importer), id);
        const marker = "/esm/node_modules/";
        if (resolved.includes(marker)) resolved = path.join(deps, resolved.split(marker)[1]);
        if (!fs.existsSync(resolved) && resolved.endsWith("/dist/index.js")) resolved = resolved.slice(0, -3) + ".mjs";
      } else if (path.isAbsolute(id)) resolved = id;
      else throw new Error(`Unpinned AGRUN dependency: ${id}`);
      if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("AGRUN source import escaped its fixed inputs");
      for (const candidate of [resolved, `${resolved}.js`, path.join(resolved, "index.js")]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      }
      throw new Error(`Missing fixed AGRUN source: ${id}`);
    }
  };
}

export async function buildAgrun({ jitless = true } = {}) {
  const { build } = await import("vite");
  const { transform } = await import("esbuild");
  for (const [tool, expected] of Object.entries(AGRUN_BUILD_TOOLS)) {
    if (require(`${tool}/package.json`).version !== expected) throw new Error(`AGRUN build requires ${tool} ${expected}`);
  }
  const inputs = readInputs();
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "printform-agrun-v4-")));
  try {
    for (const [relative, content] of Object.entries(inputs)) {
      if (!/^(esm|node_modules)\//.test(relative) || relative.split("/").includes("..") || typeof content !== "string") {
        throw new Error("Invalid AGRUN archived source path or content");
      }
      const target = path.join(root, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
    const core = path.join(root, "node_modules/zod/v4/core/core.js");
    const source = fs.readFileSync(core, "utf8");
    const before = "export const globalConfig = {};";
    if (source.split(before).length !== 2) throw new Error("Zod source patch precondition failed");
    if (jitless) fs.writeFileSync(core, source.replace(before, "export const globalConfig = { jitless: true };"));
    const result = await build({
      root, configFile: false, logLevel: "silent", plugins: [pinnedResolver(root)],
      build: { write: false, minify: true, lib: {
        entry: path.join(root, "esm/index.js"), name: "Agrun", formats: ["umd"], fileName: () => "agrun.min.js"
      } }
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((entry) => entry.output);
    if (outputs.length !== 1 || outputs[0].type !== "chunk" || outputs[0].imports.length || outputs[0].dynamicImports.length) {
      throw new Error("AGRUN build must remain one self-contained browser bundle");
    }
    // Encode template literals as strings so the generated vendor file also
    // follows the repository's 300-line rule, preserving their actual values.
    const compact = await transform(outputs[0].code, {
      minify: true, legalComments: "inline", supported: { "template-literal": false }
    });
    return Buffer.from(compact.code);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
