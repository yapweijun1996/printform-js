import { resolvePointer } from "./json.js";
import { SAFE_URL_PROTOCOLS } from "./constants.js";

function formatValue(value, format, manifest, options = {}) {
  if (value === undefined || value === null) return "";
  const locale = options.locale || manifest.locale || "en-MY";
  if (format === "currency") {
    return new Intl.NumberFormat(locale, { style: "currency", currency: options.currency || manifest.currency || "MYR", ...options }).format(value);
  }
  if (format === "number") return new Intl.NumberFormat(locale, options).format(value);
  if (format === "percent") return new Intl.NumberFormat(locale, { style: "percent", ...options }).format(value);
  if (format === "date" || format === "datetime") {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const base = { timeZone: options.timeZone || manifest.timeZone || "Asia/Kuala_Lumpur", ...options };
    return format === "date" ? new Intl.DateTimeFormat(locale, base).format(date) : new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", ...base }).format(date);
  }
  return String(value);
}

function parseOptions(element) {
  const raw = element.getAttribute("data-pf-format-options");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function safeUrl(value, baseUrl = "https://printform.invalid/") {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, baseUrl);
    return SAFE_URL_PROTOCOLS.includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}

function bindElement(element, rootData, scope, manifest, report) {
  if (element.hasAttribute("data-pf-if")) {
    const value = resolvePointer(rootData, element.getAttribute("data-pf-if"), scope);
    if (!value) { element.remove(); return; }
  }
  if (element.hasAttribute("data-pf-text")) {
    const pointer = element.getAttribute("data-pf-text");
    const value = resolvePointer(rootData, pointer, scope);
    element.textContent = formatValue(value, element.getAttribute("data-pf-format"), manifest, parseOptions(element));
    report.bindings += 1;
    if (value === undefined) report.errors.push({ code: "MISSING_BINDING", path: pointer, message: `No value found for ${pointer}` });
  }
  if (element.hasAttribute("data-pf-href")) {
    const pointer = element.getAttribute("data-pf-href");
    const value = resolvePointer(rootData, pointer, scope);
    const href = safeUrl(value);
    if (href) element.setAttribute("href", href);
    else {
      element.removeAttribute("href");
      report.errors.push({ code: "UNSAFE_URL", path: pointer, message: `Unsafe or invalid URL at ${pointer}` });
    }
  }
  bindChildren(element, rootData, scope, manifest, report);
}

function expandRepeat(element, rootData, scope, manifest, report) {
  const pointer = element.getAttribute("data-pf-each");
  const items = resolvePointer(rootData, pointer, scope);
  const fragment = element.ownerDocument.createDocumentFragment();
  if (!Array.isArray(items)) {
    report.errors.push({ code: "REPEAT_NOT_ARRAY", path: pointer, message: `${pointer} must resolve to an array` });
    element.replaceWith(fragment);
    return;
  }
  items.forEach((item) => {
    const clone = element.cloneNode(true);
    clone.removeAttribute("data-pf-each");
    bindElement(clone, rootData, item, manifest, report);
    fragment.appendChild(clone);
  });
  report.rows += items.length;
  element.replaceWith(fragment);
}

function bindChildren(parent, rootData, scope, manifest, report) {
  Array.from(parent.children).forEach((child) => {
    if (child.hasAttribute("data-pf-each")) expandRepeat(child, rootData, scope, manifest, report);
    else bindElement(child, rootData, scope, manifest, report);
  });
}

export function bindTemplate(template, data, manifest = {}) {
  const fragment = template.content.cloneNode(true);
  const report = { bindings: 0, rows: 0, errors: [], warnings: [] };
  bindChildren(fragment, data, data, manifest, report);
  return { fragment, report };
}
