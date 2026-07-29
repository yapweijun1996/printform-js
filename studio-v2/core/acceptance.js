import { LIMITS, PROTOCOL_VERSION, TRUST, protocolMajor } from "./constants.js";
import { validateData, validateSchemaProfile } from "./schema.js";

function error(code, message, path = "/") {
  return { code, message, path, severity: "error" };
}

function warning(code, message, path = "/") {
  return { code, message, path, severity: "warning" };
}

function rgb(value) {
  const match = String(value).match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
  return match ? match.slice(1, 4).map(Number) : null;
}

function luminance(color) {
  const channels = color.map((value) => value / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function effectiveBackground(node, view) {
  let current = node;
  while (current) {
    const color = view.getComputedStyle(current).backgroundColor;
    if (color && color !== "transparent" && !color.endsWith(", 0)")) return rgb(color);
    current = current.parentElement;
  }
  return [255, 255, 255];
}

function contrastFailures(doc) {
  const view = doc.defaultView;
  if (!view?.getComputedStyle) return [];
  return Array.from(doc.querySelectorAll(".printform_page h1,.printform_page h2,.printform_page p,.printform_page td,.printform_page th,.printform_page a,.printform_page span")).filter((node) => {
    if (!node.textContent.trim()) return false;
    const style = view.getComputedStyle(node);
    const foreground = rgb(style.color);
    const background = effectiveBackground(node, view);
    if (!foreground || !background) return false;
    const fontSize = Number.parseFloat(style.fontSize) || 16;
    const bold = Number.parseInt(style.fontWeight, 10) >= 700;
    const minimum = fontSize >= 24 || (bold && fontSize >= 18.66) ? 3 : 4.5;
    return contrast(foreground, background) + 0.01 < minimum;
  });
}

export function countRows(data) {
  let maximum = 0;
  const visit = (value) => {
    if (Array.isArray(value)) {
      maximum = Math.max(maximum, value.length);
      value.forEach(visit);
    } else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(data);
  return maximum;
}

export function validateProject(project, options = {}) {
  const errors = [];
  const warnings = [];
  const manifest = project.manifest || {};
  if (protocolMajor(manifest.protocolVersion) !== protocolMajor(PROTOCOL_VERSION)) {
    errors.push(error("PROTOCOL_MAJOR_UNSUPPORTED", `Protocol ${manifest.protocolVersion || "missing"} is not supported`, "/manifest/protocolVersion"));
  } else if (manifest.protocolVersion !== PROTOCOL_VERSION) {
    warnings.push(warning("PROTOCOL_MIGRATION_AVAILABLE", `Protocol ${manifest.protocolVersion} requires a reviewed same-major migration`, "/manifest/protocolVersion"));
  }
  const profile = validateSchemaProfile(project.schema);
  errors.push(...profile.errors);
  if (profile.valid) {
    const dataReport = validateData(project.schema, project.sampleData);
    errors.push(...dataReport.errors);
  }
  const limits = {
    maxHtmlBytes: LIMITS.htmlBytes,
    maxRows: LIMITS.rows,
    maxLogicalPages: LIMITS.logicalPages,
    ...(manifest.acceptance || {})
  };
  const rows = countRows(project.sampleData);
  if (rows > limits.maxRows) errors.push(error("ROW_LIMIT", `${rows} rows exceed the ${limits.maxRows} row limit`, "/sampleData"));
  if (!project.templateHtml || !project.templateHtml.includes("printform")) errors.push(error("PRINTFORM_ROOT_MISSING", "Template must contain a .printform root", "/template"));
  if (project.trust === TRUST.untrusted) errors.push(error("UNTRUSTED_SCRIPT", "Custom executable script prevents production attestation", "/trust"));
  if (options.htmlBytes > limits.maxHtmlBytes) errors.push(error("HTML_SIZE_LIMIT", `HTML exceeds ${limits.maxHtmlBytes} bytes`, "/"));
  return {
    valid: errors.length === 0,
    productionValid: errors.length === 0,
    errors,
    warnings,
    metrics: { rows, logicalPages: options.logicalPages || 0, htmlBytes: options.htmlBytes || 0 }
  };
}

export function inspectRenderedDocument(doc, manifest) {
  const errors = [];
  const warnings = [];
  const pages = doc.querySelectorAll(".printform_page");
  const limit = manifest.acceptance?.maxLogicalPages || LIMITS.logicalPages;
  if (!pages.length) errors.push(error("PAGINATION_FAILED", "PrintForm did not produce logical pages"));
  if (pages.length > limit) errors.push(error("PAGE_LIMIT", `${pages.length} pages exceed the ${limit} page limit`));
  const overflow = Array.from(pages).flatMap((page) => {
    const pageRect = page.getBoundingClientRect();
    return Array.from(page.querySelectorAll("table,td,th,img,[data-pf-text],[data-pf-href]")).filter((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      return rect.left < pageRect.left - 1 || rect.right > pageRect.right + 1;
    });
  });
  if (overflow.length) errors.push(error("HORIZONTAL_OVERFLOW", `${overflow.length} rendered elements overflow horizontally`));
  if (!doc.documentElement.lang) errors.push(error("LANG_MISSING", "Exported document requires an html lang attribute"));
  if (!doc.title.trim()) errors.push(error("TITLE_MISSING", "Exported document requires a title"));
  doc.querySelectorAll("img:not([alt])").forEach(() => errors.push(error("IMAGE_ALT_MISSING", "Every image requires alt text")));
  if (doc.querySelector(".prowheader") && !doc.querySelector(".prowheader th")) errors.push(error("TABLE_HEADER_MISSING", "Row header tables require semantic th cells"));
  doc.querySelectorAll("a").forEach((link) => { if (!link.textContent.trim()) errors.push(error("LINK_LABEL_MISSING", "Every link requires visible label text")); });
  const lowContrast = contrastFailures(doc);
  if (lowContrast.length) errors.push(error("CONTRAST_FAILURE", `${lowContrast.length} text elements do not meet WCAG contrast thresholds`));
  warnings.push(warning("PRINT_PREVIEW_REQUIRED", "Confirm fonts, DPI and page margins in the system print preview"));
  return { valid: errors.length === 0, errors, warnings, metrics: { logicalPages: pages.length, overflowElements: overflow.length, contrastFailures: lowContrast.length } };
}
