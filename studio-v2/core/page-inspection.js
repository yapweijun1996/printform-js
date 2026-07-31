// Discovers the page-level config carried as data-* attributes on the single
// <section class="printform"> root, so the P1 Page settings and Repeated
// areas panels can show real current values instead of a blank form. Both
// standard samples set every attribute below explicitly (see
// src/printform/config.js's CONFIG_DESCRIPTORS for the full engine-wide set,
// which is much larger — this only surfaces what the two standard templates
// actually use). Read-only: never mutates templateHtml, only describes it.
const PRINTFORM_ROOT_SELECTOR = ".printform";

// Ordered to match the reading order engineers see in the template markup
// itself (papersize width/height, then repeat flags in header→footer order).
const REPEAT_FLAGS = [
  { key: "header", attribute: "data-repeat-header" },
  { key: "docinfo", attribute: "data-repeat-docinfo" },
  { key: "rowheader", attribute: "data-repeat-rowheader" },
  { key: "ptacRowheader", attribute: "data-repeat-ptac-rowheader" },
  { key: "footer", attribute: "data-repeat-footer" },
  { key: "footerLogo", attribute: "data-repeat-footer-logo" },
  { key: "footerPagenum", attribute: "data-repeat-footer-pagenum" }
];

function findPrintformRoot(templateHtml) {
  const template = document.createElement("template");
  template.innerHTML = templateHtml;
  return template.content.querySelector(PRINTFORM_ROOT_SELECTOR);
}

export function inspectPageSettings(templateHtml) {
  const root = findPrintformRoot(templateHtml);
  if (!root || !root.hasAttribute("data-papersize-width") || !root.hasAttribute("data-papersize-height")) return null;
  const width = Number(root.getAttribute("data-papersize-width"));
  const height = Number(root.getAttribute("data-papersize-height"));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { selector: PRINTFORM_ROOT_SELECTOR, width, height };
}

// Only flags actually present as attributes are returned — an absent
// attribute falls back to the engine's own CONFIG_DESCRIPTORS default, which
// this panel has no business silently overriding by rendering a checkbox for
// a value the template never set.
export function inspectRepeatFlags(templateHtml) {
  const root = findPrintformRoot(templateHtml);
  if (!root) return [];
  return REPEAT_FLAGS.filter((flag) => root.hasAttribute(flag.attribute))
    .map((flag) => ({ ...flag, value: root.getAttribute(flag.attribute) === "y" }));
}
