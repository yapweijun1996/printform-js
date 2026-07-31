export const DEFAULT_FONT_BASE_PT = 9;
export const FONT_BASE_MIN_PT = 6;
export const FONT_BASE_MAX_PT = 14;

// Matches exactly the block buildTypographyBlock() generates, regardless of
// which base size it was generated with — used to find-and-replace a prior
// injection so set_font_scale can change the base without leaving a stale
// (or duplicate) block behind.
const TYPOGRAPHY_BLOCK_RE = /\/\* PrintForm type scale:[^]*?#pf-mount \.pf-font-plus-3 \{ font-size: var\(--pf-font-plus-3\); \}/;

function buildTypographyBlock(basePt = DEFAULT_FONT_BASE_PT) {
  const base = Math.max(FONT_BASE_MIN_PT, Math.min(FONT_BASE_MAX_PT, Number(basePt) || DEFAULT_FONT_BASE_PT));
  return `/* PrintForm type scale: ${base}pt base, 1pt steps */
#pf-mount {
  --pf-font-minus-3: ${base - 3}pt;
  --pf-font-minus-2: ${base - 2}pt;
  --pf-font-minus-1: ${base - 1}pt;
  --pf-font-default: ${base}pt;
  --pf-font-plus-1: ${base + 1}pt;
  --pf-font-plus-2: ${base + 2}pt;
  --pf-font-plus-3: ${base + 3}pt;
  font-size: var(--pf-font-default);
}
#pf-mount .pf-font-minus-3 { font-size: var(--pf-font-minus-3); }
#pf-mount .pf-font-minus-2 { font-size: var(--pf-font-minus-2); }
#pf-mount .pf-font-minus-1 { font-size: var(--pf-font-minus-1); }
#pf-mount .pf-font-default { font-size: var(--pf-font-default); }
#pf-mount .pf-font-plus-1 { font-size: var(--pf-font-plus-1); }
#pf-mount .pf-font-plus-2 { font-size: var(--pf-font-plus-2); }
#pf-mount .pf-font-plus-3 { font-size: var(--pf-font-plus-3); }`;
}

export const PRINT_TYPOGRAPHY_CSS = buildTypographyBlock(DEFAULT_FONT_BASE_PT);

export function stripPrintTypography(css = "") {
  return css.replace(TYPOGRAPHY_BLOCK_RE, "").trim();
}

export function withPrintTypography(css = "", basePt = DEFAULT_FONT_BASE_PT) {
  const source = css.trim();
  if (source.includes("--pf-font-default")) return source;
  return `${buildTypographyBlock(basePt)}\n${source}`.trim();
}

// Replaces the injected block's base size in place — strips any prior
// injection (at any base) first, so re-running this never duplicates or
// leaves a stale block, unlike withPrintTypography's one-shot guard.
export function setPrintTypographyBase(css = "", basePt = DEFAULT_FONT_BASE_PT) {
  return `${buildTypographyBlock(basePt)}\n${stripPrintTypography(css)}`.trim();
}
