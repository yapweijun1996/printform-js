#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { validateProject } from "../studio-v2/core/acceptance.js";
import { canonicalProjectContent, parseProjectHtml } from "../studio-v2/core/project-model.js";
import { sha256 } from "../studio-v2/core/json.js";

const filename = process.argv[2];
if (!filename) {
  console.error("Usage: npm run validate:v2 -- <printform.html>");
  process.exit(2);
}

const absolute = path.resolve(filename);
let output;
let exitCode = 0;

try {
  const html = fs.readFileSync(absolute, "utf8");
  const dom = new JSDOM("");
  globalThis.DOMParser = dom.window.DOMParser;
  if (!globalThis.crypto) Object.defineProperty(globalThis, "crypto", { value: dom.window.crypto });
  const project = parseProjectHtml(html);
  const validation = validateProject(project, { htmlBytes: Buffer.byteLength(html) });
  const documentRuntime = new JSDOM(html).window.document.getElementById("pf-document-runtime");
  const actualRuntimeHash = documentRuntime ? await sha256(documentRuntime.textContent) : "";
  const actualContentHash = await sha256(canonicalProjectContent(project));
  const attestation = {
    present: Boolean(project.attestation),
    runtimeHashValid: Boolean(project.attestation) && project.attestation.runtimeHash === actualRuntimeHash && project.runtime?.hash === actualRuntimeHash,
    contentHashValid: Boolean(project.attestation) && project.attestation.contentHash === actualContentHash
  };
  if (!attestation.runtimeHashValid) validation.errors.push({ code: "RUNTIME_HASH_MISMATCH", path: "/runtime", message: "Embedded runtime does not match its attestation", severity: "error" });
  if (!attestation.contentHashValid) validation.errors.push({ code: "CONTENT_HASH_MISMATCH", path: "/attestation", message: "Document content changed after validation", severity: "error" });
  validation.valid = validation.errors.length === 0;
  validation.productionValid = validation.valid;
  output = { file: absolute, valid: validation.valid, validation, attestation, layout: { verified: false, note: "Run browser validation for pagination and overflow metrics" } };
  if (!output.valid) exitCode = 1;
} catch (error) {
  output = { file: absolute, valid: false, error: { code: error.code || "VALIDATOR_FAILURE", message: error.message } };
  exitCode = 1;
}

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exitCode = exitCode;
