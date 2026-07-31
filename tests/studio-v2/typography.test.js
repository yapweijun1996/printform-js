import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../../studio-v2/core/project-model.js";
import { currentFontBasePt, PRINT_TYPOGRAPHY_CSS, setPrintTypographyBase, withPrintTypography } from "../../studio-v2/core/typography.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

describe("PrintForm typography scale", () => {
  it("defines a 9pt default and seven one-point levels", () => {
    expect(PRINT_TYPOGRAPHY_CSS).toContain("--pf-font-minus-3: 6pt");
    expect(PRINT_TYPOGRAPHY_CSS).toContain("--pf-font-default: 9pt");
    expect(PRINT_TYPOGRAPHY_CSS).toContain("--pf-font-plus-3: 12pt");
    expect(PRINT_TYPOGRAPHY_CSS).toContain(".pf-font-plus-1");
  });

  it("adds the scale once to new projects", () => {
    const project = createEmptyProject();
    expect(project.themeCss.match(/--pf-font-default:\s*9pt/g)).toHaveLength(1);
    expect(withPrintTypography(project.themeCss)).toBe(project.themeCss);
  });

  it("uses the scale in the production pilot", () => {
    const project = createSalesInvoiceProject();
    expect(project.themeCss).toContain("font-size: var(--pf-font-default)");
    expect(project.themeCss).not.toMatch(/font-size:\s*\d+px/);
  });

  it("reads the current base size back out for the P1 font-scale panel", () => {
    const project = createEmptyProject();
    expect(currentFontBasePt(project.themeCss)).toBe(9);
    expect(currentFontBasePt(setPrintTypographyBase(project.themeCss, 12))).toBe(12);
    expect(currentFontBasePt("")).toBe(9);
    expect(currentFontBasePt("body { color: red; }")).toBe(9);
  });
});
