import { TRUST } from "./constants.js";
import { cloneJson, parseJson, stableStringify } from "./json.js";
import { validateData } from "./schema.js";
import { OPERATION_SCHEMAS } from "./operation-schemas.js";

export function cloneProject(project) {
  return {
    ...project,
    manifest: cloneJson(project.manifest),
    schema: cloneJson(project.schema),
    i18n: cloneJson(project.i18n || {}),
    sampleData: cloneJson(project.sampleData),
    attestation: cloneJson(project.attestation),
    runtime: cloneJson(project.runtime),
    customScripts: [...(project.customScripts || [])],
    trustReasons: [...(project.trustReasons || [])],
    sourceHtml: ""
  };
}

function templateDocument(html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template;
}

function requireSelector(template, selector) {
  const matches = template.content.querySelectorAll(selector);
  if (matches.length !== 1) {
    const error = new Error(`Selector must match exactly one element: ${selector} (matched ${matches.length})`);
    error.code = "SELECTOR_CARDINALITY";
    throw error;
  }
  return matches[0];
}

const FORBIDDEN_PATH_TOKENS = new Set(["__proto__", "constructor", "prototype"]);

function setJsonPath(target, path, value) {
  const parts = String(path || "").split("/").filter(Boolean).map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (!parts.length) throw Object.assign(new Error("JSON path cannot target the document root"), { code: "INVALID_OPERATION_PATH" });
  // "__proto__"/"constructor" segments would walk into Object.prototype and
  // pollute every object in the page (e.g. faking allowExternalHttps=true).
  if (parts.some((part) => FORBIDDEN_PATH_TOKENS.has(part))) {
    throw Object.assign(new Error("JSON path may not reference prototype members"), { code: "INVALID_OPERATION_PATH" });
  }
  let cursor = target;
  parts.slice(0, -1).forEach((part) => {
    if (!Object.prototype.hasOwnProperty.call(cursor, part) || !cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts.at(-1)] = value;
}

// Validates one operation against its discriminated-union shape before any
// mutation runs, so a malformed operation (missing field, wrong type, or an
// extra field a client made up) fails with one stable code/path instead of
// an ad-hoc DOM exception or a silently wrong write partway through
// applyOperation's dispatch chain. Unknown `type` values are intentionally
// left to the existing UNSUPPORTED_OPERATION branch below — this only
// covers types that already have a documented, known shape.
function validateOperationShape(operation) {
  const schema = OPERATION_SCHEMAS[operation.type];
  if (!schema) return;
  const report = validateData(schema, operation);
  if (!report.valid) {
    const first = report.errors[0];
    const error = new Error(`Invalid ${operation.type} operation${first ? ` at ${first.path}: ${first.message}` : ""}`);
    error.code = "INVALID_OPERATION_SHAPE";
    error.details = report.errors;
    throw error;
  }
}

function applyOperation(project, operation) {
  if (!operation || typeof operation !== "object") throw Object.assign(new Error("Operation must be an object"), { code: "INVALID_OPERATION" });
  validateOperationShape(operation);
  if (operation.type === "set_manifest_value") setJsonPath(project.manifest, operation.path, cloneJson(operation.value));
  else if (operation.type === "replace_manifest") project.manifest = cloneJson(operation.value);
  else if (operation.type === "replace_schema") project.schema = cloneJson(operation.value);
  else if (operation.type === "replace_i18n") project.i18n = cloneJson(operation.value);
  else if (operation.type === "replace_sample_data") project.sampleData = cloneJson(operation.value);
  else if (operation.type === "replace_theme") project.themeCss = String(operation.value || "");
  else if (operation.type === "replace_template") project.templateHtml = String(operation.value || "");
  else if (operation.type === "set_asset_slot") {
    const template = templateDocument(project.templateHtml);
    const matches = Array.from(template.content.querySelectorAll("[data-pf-asset-slot]")).filter((node) => node.getAttribute("data-pf-asset-slot") === operation.slot);
    if (matches.length !== 1) throw Object.assign(new Error(`Asset slot must match exactly once: ${operation.slot} (matched ${matches.length})`), { code: "ASSET_SLOT_CARDINALITY" });
    matches[0].setAttribute("src", String(operation.source || ""));
    project.templateHtml = template.innerHTML.trim();
  }
  else if (operation.type === "set_text") {
    const template = templateDocument(project.templateHtml);
    requireSelector(template, operation.selector).textContent = String(operation.value ?? "");
    project.templateHtml = template.innerHTML.trim();
  } else if (operation.type === "set_attribute") {
    const template = templateDocument(project.templateHtml);
    const target = requireSelector(template, operation.selector);
    if (operation.value === null) target.removeAttribute(operation.name);
    else target.setAttribute(operation.name, String(operation.value));
    project.templateHtml = template.innerHTML.trim();
  } else throw Object.assign(new Error(`Unsupported operation: ${operation.type}`), { code: "UNSUPPORTED_OPERATION" });
  // themeCss is serialized raw into <style>: a "</style><script>…" payload
  // breaks out of the style element, so it must demote trust exactly like a
  // <script> in the template does.
  if (/<script[\s>]/i.test(project.templateHtml) || /<\/style|<script[\s>]/i.test(project.themeCss || "")) project.trust = TRUST.untrusted;
  project.attestation = null;
}

export function applyOperations(project, operations) {
  if (!Array.isArray(operations) || !operations.length) throw Object.assign(new Error("At least one operation is required"), { code: "EMPTY_OPERATION_SET" });
  const candidate = cloneProject(project);
  operations.forEach((operation) => applyOperation(candidate, operation));
  return candidate;
}

export function previewSourceEdit(project, section, content) {
  const operation = { type: "" };
  // manifest goes through applyOperations like every other section — the old
  // hand-rolled clone here skipped the executable-markup trust re-check.
  if (section === "manifest") operation.type = "replace_manifest";
  else if (section === "schema") operation.type = "replace_schema";
  else if (section === "i18n") operation.type = "replace_i18n";
  else if (section === "sampleData") operation.type = "replace_sample_data";
  else if (section === "theme") operation.type = "replace_theme";
  else if (section === "template") operation.type = "replace_template";
  else throw Object.assign(new Error(`Unknown section: ${section}`), { code: "UNKNOWN_SECTION" });
  operation.value = ["manifest", "schema", "i18n", "sampleData"].includes(section) ? parseJson(content, section) : content;
  return applyOperations(project, [operation]);
}

// Removes executable content from template/theme so "reset trust" actually
// removes what demoted the trust, instead of just flipping the flag back.
export function sanitizeExecutableContent(project) {
  const template = templateDocument(project.templateHtml || "");
  template.content.querySelectorAll("script").forEach((node) => node.remove());
  template.content.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      else if (/^(href|src|xlink:href)$/i.test(attribute.name) && /^\s*javascript:/i.test(attribute.value)) node.removeAttribute(attribute.name);
    });
  });
  return {
    templateHtml: template.innerHTML.trim(),
    themeCss: String(project.themeCss || "").replace(/<\/?(?:script|style)[^>]*>?/gi, "")
  };
}

export function diffProjects(before, after) {
  const sections = ["manifest", "schema", "i18n", "themeCss", "templateHtml", "sampleData", "trust"];
  const changedSections = sections.filter((key) => {
    const left = typeof before[key] === "object" ? stableStringify(before[key]) : String(before[key]);
    const right = typeof after[key] === "object" ? stableStringify(after[key]) : String(after[key]);
    return left !== right;
  });
  return { changed: changedSections.length > 0, changedSections, operationCount: changedSections.length };
}
