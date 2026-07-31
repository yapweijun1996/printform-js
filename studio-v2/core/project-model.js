import { LIMITS, PROTOCOL_VERSION, SECTION_IDS, TRUST } from "./constants.js";
import { parseJson, sha256, sha256Base64, stableStringify } from "./json.js";
import { withPrintTypography } from "./typography.js";

const ALLOWED_EXECUTABLE_IDS = new Set(["pf-document-runtime", "pf-printform-runtime"]);

function requireElement(doc, id) {
  const all = doc.querySelectorAll(`#${id}`);
  if (all.length !== 1) {
    const error = new Error(`Expected exactly one #${id} section, found ${all.length}`);
    error.code = "SECTION_CARDINALITY";
    throw error;
  }
  return all[0];
}

function readJsonSection(doc, key, fallback) {
  const element = doc.getElementById(SECTION_IDS[key]);
  if (!element && fallback !== undefined) return fallback;
  return parseJson(requireElement(doc, SECTION_IDS[key]).textContent, SECTION_IDS[key]);
}

function detectTrust(doc) {
  const executable = Array.from(doc.scripts).filter((script) => {
    const type = (script.type || "text/javascript").toLowerCase();
    return !["application/json", "application/schema+json", "application/ld+json"].includes(type);
  });
  return executable.every((script) => ALLOWED_EXECUTABLE_IDS.has(script.id)) ? TRUST.trusted : TRUST.untrusted;
}

function readCustomScripts(doc) {
  return Array.from(doc.scripts).filter((script) => {
    const type = (script.type || "text/javascript").toLowerCase();
    return !["application/json", "application/schema+json", "application/ld+json"].includes(type) && !ALLOWED_EXECUTABLE_IDS.has(script.id);
  }).map((script) => script.outerHTML);
}

export function parseProjectHtml(html) {
  if (new TextEncoder().encode(html).byteLength > LIMITS.htmlBytes) {
    const error = new Error("HTML exceeds the 10 MB import limit");
    error.code = "HTML_SIZE_LIMIT";
    throw error;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const manifest = readJsonSection(doc, "manifest");
  const template = requireElement(doc, SECTION_IDS.template);
  const theme = requireElement(doc, SECTION_IDS.theme);
  return {
    manifest,
    schema: readJsonSection(doc, "schema"),
    i18n: readJsonSection(doc, "i18n", {}),
    themeCss: theme.textContent,
    templateHtml: template.innerHTML.trim(),
    sampleData: readJsonSection(doc, "sampleData"),
    attestation: readJsonSection(doc, "attestation", null),
    runtime: readRuntimeMetadata(doc),
    trust: detectTrust(doc),
    customScripts: readCustomScripts(doc),
    sourceHtml: html
  };
}

function readRuntimeMetadata(doc) {
  const runtime = doc.getElementById("pf-document-runtime");
  return runtime ? { version: runtime.dataset.version || "unknown", hash: runtime.dataset.hash || "" } : null;
}

export function canonicalProjectContent(project) {
  const templateDoc = new DOMParser().parseFromString(`<template id="pf-canonical">${project.templateHtml}</template>`, "text/html");
  const normalizedTemplate = templateDoc.getElementById("pf-canonical").innerHTML.trim();
  const sections = [stableStringify(project.manifest), stableStringify(project.schema)];
  if (Object.keys(project.i18n || {}).length) sections.push(stableStringify(project.i18n));
  return [
    ...sections, project.themeCss.trim(),
    normalizedTemplate, stableStringify(project.sampleData), project.runtime?.version || "",
    project.runtime?.hash || "", ...(project.customScripts || [])
  ].join("\n---printform-section---\n");
}

export async function createAttestation(project, validation, runtimeSource, runtimeVersion) {
  const runtimeHash = await sha256(runtimeSource);
  const candidate = { ...project, runtime: { version: runtimeVersion, hash: runtimeHash } };
  return {
    protocolVersion: PROTOCOL_VERSION,
    runtimeVersion,
    runtimeHash,
    contentHash: await sha256(canonicalProjectContent(candidate)),
    validatedAt: new Date().toISOString(),
    validator: "PrintForm Studio v2",
    result: validation.valid ? "pass" : "fail",
    summary: { errors: validation.errors.length, warnings: validation.warnings.length },
    layoutReview: validation.reviewReceipt || null,
    browsers: ["Chromium", "Firefox", "WebKit"]
  };
}

export async function verifyImportedProject(project, html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const runtimeElement = doc.getElementById("pf-document-runtime");
  const reasons = [];
  if (!runtimeElement) reasons.push("RUNTIME_MISSING");
  const runtimeHash = runtimeElement ? await sha256(runtimeElement.textContent) : "";
  const contentHash = await sha256(canonicalProjectContent(project));
  if (!project.attestation) reasons.push("ATTESTATION_MISSING");
  if (project.runtime?.hash !== runtimeHash || project.attestation?.runtimeHash !== runtimeHash) reasons.push("RUNTIME_HASH_MISMATCH");
  if (project.attestation?.contentHash !== contentHash) reasons.push("CONTENT_HASH_MISMATCH");
  if ((project.customScripts || []).length) reasons.push("CUSTOM_SCRIPT_PRESENT");
  const trusted = reasons.length === 0;
  return {
    project: { ...project, trust: trusted ? TRUST.trusted : TRUST.untrusted, trustReasons: reasons },
    verification: { trusted, reasons, runtimeHash, contentHash }
  };
}

function escapeScript(text) {
  return String(text).replace(/<\/script/gi, "<\\/script");
}

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function jsonBlock(id, type, value) {
  return `<script id="${id}" type="${type}">\n${escapeScript(stableStringify(value))}\n</script>`;
}

export async function serializeStandalone(project, sources, validation, options = {}) {
  const runtimeVersion = sources.runtimeVersion || "2.0.0";
  const inlineDocumentRuntime = `\n${escapeScript(sources.documentRuntime)}\n`;
  const inlinePrintformRuntime = `\n${escapeScript(sources.printform)}\n`;
  const runtimeHash = await sha256(inlineDocumentRuntime);
  const next = { ...project, runtime: { version: runtimeVersion, hash: runtimeHash } };
  const attestation = await createAttestation(next, validation, inlineDocumentRuntime, runtimeVersion);
  const trusted = options.trusted !== false && project.trust !== TRUST.untrusted && validation.valid;
  const [documentHash, printformHash] = await Promise.all([
    sha256Base64(inlineDocumentRuntime), sha256Base64(inlinePrintformRuntime)
  ]);
  // allowExternalHttps must open img/font in EVERY variant, or a project that
  // legitimately keeps an https logo can never reach a "ready" preview and is
  // permanently blocked from export despite the capability being declared.
  const externalSources = project.manifest.assets?.allowExternalHttps ? " https:" : "";
  const untrustedCsp = options.networkDisabled
    ? `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:${externalSources}; font-src data:${externalSources}; connect-src 'none'; base-uri 'none'; form-action 'none'`
    : "default-src 'self' data: blob: https:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:; font-src data: https:";
  const csp = trusted
    ? `default-src 'none'; script-src 'sha256-${documentHash}' 'sha256-${printformHash}'; style-src 'unsafe-inline'; img-src data:${externalSources}; font-src data:${externalSources}; connect-src 'none'; base-uri 'none'; form-action 'none'`
    : untrustedCsp;
  const title = project.manifest.title || "PrintForm Document";
  const lang = project.manifest.locale || "en-MY";
  const trustBanner = trusted ? "" : "<meta name=\"printform-trust\" content=\"untrusted\">";
  const customScripts = trusted ? "" : (project.customScripts || []).join("\n");
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
  ${trustBanner}
  <title>${escapeHtml(title)}</title>
  ${jsonBlock(SECTION_IDS.manifest, "application/json", project.manifest)}
  ${jsonBlock(SECTION_IDS.schema, "application/schema+json", project.schema)}
  ${jsonBlock(SECTION_IDS.i18n, "application/json", project.i18n || {})}
  <style id="${SECTION_IDS.theme}">\n${project.themeCss.trim().replace(/<\/style/gi, "<\\/style")}\n</style>
</head>
<body>
  <main id="pf-mount" aria-live="polite"></main>
  <template id="${SECTION_IDS.template}">\n${project.templateHtml.trim()}\n</template>
  ${jsonBlock(SECTION_IDS.sampleData, "application/json", project.sampleData)}
  ${jsonBlock(SECTION_IDS.attestation, "application/json", attestation)}
  <script id="pf-document-runtime" data-version="${escapeHtml(runtimeVersion)}" data-hash="${runtimeHash}">${inlineDocumentRuntime}</script>
  <script id="pf-printform-runtime">${inlinePrintformRuntime}</script>
  ${customScripts}
</body>
</html>\n`;
}

export function createEmptyProject() {
  return {
    manifest: { protocolVersion: PROTOCOL_VERSION, title: "Untitled PrintForm", locale: "en-MY", currency: "MYR", timeZone: "Asia/Kuala_Lumpur", acceptance: { maxHtmlBytes: LIMITS.htmlBytes, maxRows: LIMITS.rows, maxLogicalPages: LIMITS.logicalPages } },
    schema: { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", properties: {}, additionalProperties: false },
    i18n: {},
    themeCss: withPrintTypography("#pf-mount { color: #111; font-family: Arial, sans-serif; }"),
    templateHtml: "<div class=\"printform\"><div class=\"pheader\"><h1 data-pf-text=\"/title\"></h1></div></div>",
    sampleData: {}, attestation: null, runtime: null, trust: TRUST.trusted, trustReasons: [], customScripts: [], sourceHtml: ""
  };
}
