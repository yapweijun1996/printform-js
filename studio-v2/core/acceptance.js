import { LIMITS, PROTOCOL_VERSION, TRUST, protocolMajor } from "./constants.js";
import { validateData, validateSchemaProfile } from "./schema.js";
import { validateAssetSlots } from "./assets.js";
import { validateI18n } from "./i18n.js";
import { validateBusinessRules } from "./business-rules.js";

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
  // Schema-profile and data errors carry node-relative paths ("/properties/x",
  // "/unexpectedField"); prefix them with their owning section so UIs and
  // agents can route each issue to the right editor/source.
  const prefixPath = (prefix) => (item) => ({ ...item, path: `${prefix}${!item.path || item.path === "/" ? "" : item.path}` });
  const profile = validateSchemaProfile(project.schema);
  errors.push(...profile.errors.map(prefixPath("/schema")));
  if (profile.valid) {
    const dataReport = validateData(project.schema, project.sampleData);
    errors.push(...dataReport.errors.map(prefixPath("/sampleData")));
    if (dataReport.valid) errors.push(...validateBusinessRules(project.sampleData).errors);
  }
  errors.push(...validateI18n(project).errors);
  errors.push(...validateAssetSlots(project).errors);
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
  // Defense in depth: re-derive from content instead of trusting the stored
  // flag, so a stale/reset trust flag cannot attest a template that still
  // carries executable markup.
  if (project.trust !== TRUST.untrusted && (/<script[\s>]/i.test(project.templateHtml || "") || /<\/style|<script[\s>]/i.test(project.themeCss || ""))) {
    errors.push(error("EXECUTABLE_MARKUP_PRESENT", "Template or theme contains executable markup despite trusted flag", "/template"));
  }
  if (options.htmlBytes > limits.maxHtmlBytes) errors.push(error("HTML_SIZE_LIMIT", `HTML exceeds ${limits.maxHtmlBytes} bytes`, "/"));
  return {
    valid: errors.length === 0,
    productionValid: errors.length === 0,
    errors,
    warnings,
    metrics: { rows, logicalPages: options.logicalPages || 0, htmlBytes: options.htmlBytes || 0 }
  };
}

// Short CSS path scoped to the containing logical page, so an agent can
// locate a flagged element without screenshots.
function cssPathWithinPage(node) {
  const parts = [];
  let current = node;
  let depth = 6;
  while (current && current.nodeType === 1 && depth > 0 && !current.classList.contains("printform_page")) {
    if (current.id) { parts.unshift(`#${current.id}`); return parts.join(" > "); }
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
    parts.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${siblings.indexOf(current) + 1})` : tag);
    current = parent;
    depth -= 1;
  }
  return parts.join(" > ") || node.tagName?.toLowerCase() || "unknown";
}

function issueEntry(code, node, pageIndex) {
  const rect = node.getBoundingClientRect();
  const text = (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
  return {
    code,
    pageIndex,
    selector: cssPathWithinPage(node),
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
    ...(text ? { text } : {})
  };
}

const MAX_ISSUE_DETAILS = 20;

export function inspectRenderedDocument(doc, manifest, options = {}) {
  const errors = [];
  const warnings = [];
  const pages = doc.querySelectorAll(".printform_page");
  const pageList = Array.from(pages);
  const pageIndexOf = (node) => pageList.indexOf(node.closest?.(".printform_page") || node);
  const limit = manifest.acceptance?.maxLogicalPages || LIMITS.logicalPages;
  if (!pages.length) errors.push(error("PAGINATION_FAILED", "PrintForm did not produce logical pages"));
  if (pages.length > limit) errors.push(error("PAGE_LIMIT", `${pages.length} pages exceed the ${limit} page limit`));
  // P0-B content-integrity check (docs/STUDIO_V2_ENGINEERING_ROADMAP.zh-CN.md
  // "验证数量、顺序、重复与遗漏"): .prowitem rows are cloned-then-placed by
  // the pagination engine, never split (unlike .ptac/.paddt long-text
  // segments) — so the count of .prowitem_processed elements in the final
  // output must exactly equal how many rows data-pf-each bound. A mismatch
  // means the pagination engine silently dropped or duplicated a data row,
  // which no other check here would otherwise catch.
  const expectedRowCount = options.expectedRowCount;
  const rowNodes = Array.from(doc.querySelectorAll(".prowitem_processed"));
  const actualRowCount = rowNodes.length;
  if (Number.isFinite(expectedRowCount) && actualRowCount !== expectedRowCount) {
    errors.push(error("ROW_COUNT_MISMATCH", `Rendered ${actualRowCount} item row(s) but data binding produced ${expectedRowCount}; pagination may have dropped or duplicated a row`));
  }
  // Order/identity check: binding.js tags each row with its source-array
  // position (data-pf-row-index) before pagination ever touches it. Older
  // exported documents predating that attribute have none of these tags —
  // skip gracefully rather than false-positive on every legacy export; the
  // count check above still applies to them.
  const taggedRows = rowNodes.filter((node) => node.hasAttribute("data-pf-row-index"));
  if (taggedRows.length) {
    const summarize = (values) => values.slice(0, 20).join(", ") + (values.length > 20 ? ` (+${values.length - 20} more)` : "");
    const occurrences = new Map();
    const sequence = taggedRows.map((node) => {
      const index = Number(node.getAttribute("data-pf-row-index"));
      occurrences.set(index, (occurrences.get(index) || 0) + 1);
      return index;
    });
    const duplicates = Array.from(occurrences.entries()).filter(([, count]) => count > 1).map(([index]) => index).sort((a, b) => a - b);
    if (duplicates.length) errors.push(error("ROW_DUPLICATE_INDEX", `Row index ${summarize(duplicates)} rendered more than once`));
    if (Number.isFinite(expectedRowCount)) {
      const missing = [];
      for (let i = 0; i < expectedRowCount; i += 1) if (!occurrences.has(i)) missing.push(i);
      if (missing.length) errors.push(error("ROW_MISSING_INDEX", `Row index ${summarize(missing)} never rendered`));
    }
    if (!sequence.every((value, i) => i === 0 || value > sequence[i - 1])) {
      errors.push(error("ROW_ORDER_MISMATCH", "Rendered rows are not in the same order as the source data"));
    }
  }
  const overflow = pageList.flatMap((page, pageIndex) => {
    const pageRect = page.getBoundingClientRect();
    return Array.from(page.querySelectorAll("table,td,th,img,[data-pf-text],[data-pf-href]")).filter((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      return rect.left < pageRect.left - 1 || rect.right > pageRect.right + 1;
    }).map((node) => ({ node, pageIndex }));
  });
  if (overflow.length) errors.push(error("HORIZONTAL_OVERFLOW", `${overflow.length} rendered elements overflow horizontally`));
  const templateRoot = doc.getElementById("pf-template")?.content?.querySelector(".printform");
  // Repeated-region completeness: data-repeat-header/-docinfo are simple
  // page-wide flags with no per-row exception (unlike rowheader, which row
  // classes like without_prowheader can opt out of) — if the template
  // declares one "y", every logical page must actually carry it, or the
  // pagination engine silently dropped a repeating section on some page.
  const isRepeatFlagOn = (value) => ["y", "yes", "true", "1"].includes(String(value ?? "").trim().toLowerCase());
  [
    { flag: "repeatHeader", selector: ".pheader_processed", code: "HEADER_MISSING" },
    { flag: "repeatDocinfo", selector: ".pdocinfo_processed", code: "DOCINFO_MISSING" }
  ].forEach(({ flag, selector, code }) => {
    if (!isRepeatFlagOn(templateRoot?.dataset[flag])) return;
    const missingOn = pageList.filter((page) => !page.querySelector(selector));
    if (missingOn.length) errors.push(error(code, `${missingOn.length} of ${pageList.length} page(s) are missing the repeated ${selector} despite data-${flag.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="y"`));
  });
  // Overlap: a page's direct children (header/docinfo/rowheader/footer
  // chrome, plus the row container) are always meant to stack top-to-bottom
  // in normal block flow — no floats or absolute positioning in these
  // templates. Two adjacent sections whose rects overlap vertically is a
  // real rendering bug (a border and the following section landing on the
  // same coordinate, visually merging, is exactly the failure mode this
  // catches automatically instead of relying on someone noticing by eye).
  const sectionOverlaps = pageList.flatMap((page, pageIndex) => {
    const children = Array.from(page.children).filter((child) => {
      const rect = child.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const pairs = [];
    for (let i = 1; i < children.length; i += 1) {
      const prevRect = children[i - 1].getBoundingClientRect();
      const currRect = children[i].getBoundingClientRect();
      if (currRect.top < prevRect.bottom - 1) pairs.push({ pageIndex, a: children[i - 1], b: children[i] });
    }
    return pairs;
  });
  if (sectionOverlaps.length) errors.push(error("SECTION_OVERLAP", `${sectionOverlaps.length} adjacent section pair(s) visually overlap instead of stacking cleanly`));
  const expectedPageHeight = Number(templateRoot?.dataset.papersizeHeight) || 0;
  const verticalOverflow = expectedPageHeight
    ? pageList.filter((page) => Math.max(page.scrollHeight, page.getBoundingClientRect().height) > expectedPageHeight + 1)
    : [];
  if (verticalOverflow.length) errors.push(error("VERTICAL_OVERFLOW", `${verticalOverflow.length} logical pages exceed the ${expectedPageHeight}px page height`));
  if (!doc.documentElement.lang) errors.push(error("LANG_MISSING", "Exported document requires an html lang attribute"));
  if (!doc.title.trim()) errors.push(error("TITLE_MISSING", "Exported document requires a title"));
  doc.querySelectorAll("img:not([alt])").forEach(() => errors.push(error("IMAGE_ALT_MISSING", "Every image requires alt text")));
  if (doc.querySelector(".prowheader") && !doc.querySelector(".prowheader th")) errors.push(error("TABLE_HEADER_MISSING", "Row header tables require semantic th cells"));
  doc.querySelectorAll("a").forEach((link) => { if (!link.textContent.trim()) errors.push(error("LINK_LABEL_MISSING", "Every link requires visible label text")); });
  const lowContrast = contrastFailures(doc);
  if (lowContrast.length) errors.push(error("CONTRAST_FAILURE", `${lowContrast.length} text elements do not meet WCAG contrast thresholds`));
  warnings.push(warning("PRINT_PREVIEW_REQUIRED", "Confirm fonts, DPI and page margins in the system print preview"));
  // Element-level details (selector + geometry) so agents can target fixes
  // without screenshots; capped per category to bound the report size.
  const issues = [
    ...overflow.slice(0, MAX_ISSUE_DETAILS).map(({ node, pageIndex }) => issueEntry("HORIZONTAL_OVERFLOW", node, pageIndex)),
    ...verticalOverflow.slice(0, MAX_ISSUE_DETAILS).map((page) => issueEntry("VERTICAL_OVERFLOW", page, pageIndexOf(page))),
    ...lowContrast.slice(0, MAX_ISSUE_DETAILS).map((node) => issueEntry("CONTRAST_FAILURE", node, pageIndexOf(node)))
  ];
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues,
    metrics: {
      logicalPages: pages.length,
      overflowElements: overflow.length,
      verticalOverflowPages: verticalOverflow.length,
      contrastFailures: lowContrast.length,
      renderedRows: actualRowCount,
      ...(Number.isFinite(expectedRowCount) ? { expectedRows: expectedRowCount } : {})
    }
  };
}
