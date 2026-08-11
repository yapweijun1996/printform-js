import { LIMITS } from "./constants.js";
import { inlineProjectAssets } from "./assets.js";
import { validateProject } from "./acceptance.js";
import { serializeStandalone } from "./project-model.js";

let sourceCache;

export async function loadRuntimeSources() {
  if (!sourceCache) {
    sourceCache = Promise.all([
      fetch("../dist/printform-document.js").then(requireOk).then((response) => response.text()),
      fetch("../dist/printform.js").then(requireOk).then((response) => response.text())
    ]).then(([documentRuntime, printform]) => ({ documentRuntime, printform, runtimeVersion: "2.0.0" }));
  }
  return sourceCache;
}

function requireOk(response) {
  if (!response.ok) throw new Error(`Runtime source returned HTTP ${response.status}`);
  return response;
}

export async function createStandaloneHtml(project, options = {}) {
  const validation = options.validation || validateProject(project);
  if (options.requireTrusted !== false && !validation.productionValid) {
    const error = new Error("Project is not eligible for a trusted production export");
    error.code = "EXPORT_BLOCKED";
    error.validation = validation;
    throw error;
  }
  const assets = await inlineProjectAssets(project, options.baseUrl);
  const sources = await loadRuntimeSources();
  const html = await serializeStandalone(assets.project, sources, validation, { trusted: options.requireTrusted !== false, networkDisabled: options.networkDisabled, scriptNonce: options.scriptNonce });
  const bytes = new TextEncoder().encode(html).byteLength;
  if (bytes > (project.manifest.acceptance?.maxHtmlBytes || LIMITS.htmlBytes)) {
    const error = new Error(`Export is ${bytes} bytes and exceeds the configured limit`);
    error.code = "HTML_SIZE_LIMIT";
    throw error;
  }
  return { html, bytes, validation, warnings: [...validation.warnings, ...assets.warnings] };
}
