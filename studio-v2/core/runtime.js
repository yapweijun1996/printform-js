import { bindTemplate } from "./binding.js";
import { LIMITS, SECTION_IDS } from "./constants.js";
import { inspectRenderedDocument } from "./acceptance.js";
import { parseJson } from "./json.js";
import { validateData, validateSchemaProfile } from "./schema.js";

function readJson(doc, id) {
  const element = doc.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return parseJson(element.textContent, id);
}

function waitForAssets(doc, timeoutMs = 5000) {
  const fonts = doc.fonts?.ready || Promise.resolve();
  const images = Array.from(doc.images).map((image) => {
    if (image.complete) return image.naturalWidth ? Promise.resolve() : Promise.reject(new Error(`Image failed: ${image.src}`));
    return new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", () => reject(new Error(`Image failed: ${image.src}`)), { once: true });
    });
  });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Asset readiness timed out")), timeoutMs));
  return Promise.race([Promise.all([fonts, ...images]), timeout]);
}

function maxArrayLength(value) {
  if (Array.isArray(value)) return Math.max(value.length, ...value.map(maxArrayLength), 0);
  if (value && typeof value === "object") return Math.max(0, ...Object.values(value).map(maxArrayLength));
  return 0;
}

export function installPrintFormDocument(globalScope = globalThis) {
  const doc = globalScope.document;
  let generation = 0;
  let explicitRenderRequested = false;

  function finish(result, mount, clear = false) {
    if (clear) mount?.replaceChildren();
    doc.documentElement.dataset.printformStatus = result.status;
    globalScope.dispatchEvent(new CustomEvent("printform:rendered", { detail: result }));
    return result;
  }

  function validate(data) {
    try {
      const manifest = readJson(doc, SECTION_IDS.manifest);
      const schema = readJson(doc, SECTION_IDS.schema);
      const profile = validateSchemaProfile(schema);
      if (!profile.valid) return profile;
      const report = validateData(schema, data);
      const maxRows = manifest.acceptance?.maxRows || LIMITS.rows;
      const rows = maxArrayLength(data);
      if (rows > maxRows) report.errors.push({ code: "ROW_LIMIT", path: "/", message: `${rows} rows exceed limit ${maxRows}` });
      report.valid = report.errors.length === 0;
      report.metrics = { rows };
      return report;
    } catch (error) {
      return { valid: false, errors: [{ code: error.code || "RUNTIME_CONFIG", path: "/", message: error.message }], warnings: [] };
    }
  }

  async function render(data, options = {}) {
    if (options.source !== "auto") explicitRenderRequested = true;
    const current = ++generation;
    const startedAt = performance.now();
    const manifest = readJson(doc, SECTION_IDS.manifest);
    const i18n = doc.getElementById(SECTION_IDS.i18n) ? readJson(doc, SECTION_IDS.i18n) : {};
    const actualData = data === undefined ? readJson(doc, SECTION_IDS.sampleData) : data;
    const template = doc.getElementById(SECTION_IDS.template);
    const mount = doc.getElementById("pf-mount");
    mount?.replaceChildren();
    const validation = validate(actualData);
    if (!validation.valid) {
      return finish({ status: "blocked", validation, metrics: { durationMs: performance.now() - startedAt } }, mount, true);
    }
    if (!template || !mount) return finish({ status: "blocked", validation: { valid: false, errors: [{ code: "RUNTIME_MOUNT", path: "/", message: "Template or mount is missing" }], warnings: [] } }, mount, true);
    const locale = options.locale || manifest.locale || "en-MY";
    if (manifest.i18n?.supportedLocales?.length && !manifest.i18n.supportedLocales.includes(locale)) {
      return finish({ status: "blocked", validation: { valid: false, errors: [{ code: "LOCALE_UNSUPPORTED", path: "/options/locale", message: `Locale ${locale} is not supported by this document` }], warnings: [] } }, mount, true);
    }
    doc.documentElement.lang = locale;
    const bound = bindTemplate(template, actualData, manifest, { i18n, locale });
    validation.errors.push(...bound.report.errors);
    validation.warnings.push(...bound.report.warnings);
    if (validation.errors.length) return finish({ status: "blocked", validation: { ...validation, valid: false }, binding: bound.report }, mount, true);
    mount.replaceChildren(bound.fragment);
    delete globalScope.__printFormProcessed;
    delete globalScope.__printFormProcessing;
    try { await waitForAssets(doc, options.assetTimeoutMs || 5000); }
    catch (error) {
      return finish({ status: "blocked", validation: { valid: false, errors: [{ code: "ASSET_FAILURE", path: "/", message: error.message }], warnings: validation.warnings } }, mount, true);
    }
    if (current !== generation) return { status: "superseded", validation };
    if (!globalScope.PrintForm?.formatAll) return finish({ status: "blocked", validation: { valid: false, errors: [{ code: "PRINTFORM_RUNTIME_MISSING", path: "/", message: "PrintForm runtime is unavailable" }], warnings: [] } }, mount, true);
    await globalScope.PrintForm.formatAll({ force: true });
    const layout = inspectRenderedDocument(doc, manifest);
    const combined = { valid: layout.valid, errors: [...validation.errors, ...layout.errors], warnings: [...validation.warnings, ...layout.warnings] };
    const result = { status: combined.valid ? "ready" : "blocked", validation: combined, binding: bound.report, issues: layout.issues || [], metrics: { ...layout.metrics, rows: bound.report.rows, durationMs: performance.now() - startedAt } };
    return finish(result, mount);
  }

  const api = { version: "2.0.0", validate, render };
  globalScope.PrintFormDocument = Object.freeze(api);
  const autoRender = () => queueMicrotask(() => { if (!explicitRenderRequested) render(undefined, { source: "auto" }); });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", autoRender, { once: true });
  else autoRender();
  return api;
}
