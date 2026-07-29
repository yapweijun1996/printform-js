export const PRINT_TYPOGRAPHY_CSS = `/* PrintForm type scale: 9pt base, 1pt steps */
#pf-mount {
  --pf-font-minus-3: 6pt;
  --pf-font-minus-2: 7pt;
  --pf-font-minus-1: 8pt;
  --pf-font-default: 9pt;
  --pf-font-plus-1: 10pt;
  --pf-font-plus-2: 11pt;
  --pf-font-plus-3: 12pt;
  font-size: var(--pf-font-default);
}
#pf-mount .pf-font-minus-3 { font-size: var(--pf-font-minus-3); }
#pf-mount .pf-font-minus-2 { font-size: var(--pf-font-minus-2); }
#pf-mount .pf-font-minus-1 { font-size: var(--pf-font-minus-1); }
#pf-mount .pf-font-default { font-size: var(--pf-font-default); }
#pf-mount .pf-font-plus-1 { font-size: var(--pf-font-plus-1); }
#pf-mount .pf-font-plus-2 { font-size: var(--pf-font-plus-2); }
#pf-mount .pf-font-plus-3 { font-size: var(--pf-font-plus-3); }`;

export function withPrintTypography(css = "") {
  const source = css.trim();
  if (source.includes("--pf-font-default")) return source;
  return `${PRINT_TYPOGRAPHY_CSS}\n${source}`.trim();
}
