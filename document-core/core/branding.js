// Reads/writes the single CSS custom property that drives the .pf-brand
// heading color, mirroring the --pf-font-* injection pattern in
// typography.js. Deliberately scoped to ONLY this one color, not a general
// theming system: both standard templates reuse their brand hue in a dozen+
// other places (table headers, borders, backgrounds, the PO summary box)
// that are structural/layout choices baked into each template's specific
// design, not a single swappable "brand color" concept — retrofitting all
// of those into tokens is a much larger, more subjective design task than
// this covers, and is deliberately left out of scope.
const BRAND_BLOCK_RE = /#pf-mount\s*\{\s*--pf-brand-color:\s*#[0-9a-fA-F]{3,8};\s*\}/;

export function buildBrandColorBlock(hex) {
  return `#pf-mount { --pf-brand-color: ${hex}; }`;
}

// null (not a fallback color) when no block has been injected yet — unlike
// the font scale, there is no single sensible universal default brand color,
// and a project's template may not even have a .pf-brand element to color.
export function currentBrandColor(css = "") {
  const match = String(css || "").match(/--pf-brand-color:\s*(#[0-9a-fA-F]{3,8})/);
  return match ? match[1] : null;
}

export function stripBrandColor(css = "") {
  return String(css || "").replace(BRAND_BLOCK_RE, "").trim();
}

// Strips any prior injection first, so re-running this never duplicates or
// leaves a stale block behind, matching setPrintTypographyBase's contract.
export function setBrandColor(css = "", hex) {
  return `${buildBrandColorBlock(hex)}\n${stripBrandColor(css)}`.trim();
}
