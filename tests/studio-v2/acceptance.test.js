import { describe, expect, it } from "vitest";
import { inspectRenderedDocument } from "../../studio-v2/core/acceptance.js";

describe("rendered document acceptance", () => {
  it("blocks a logical page taller than the declared paper height", () => {
    document.documentElement.lang = "en-MY";
    document.head.innerHTML = "<title>Overflow test</title>";
    document.body.innerHTML = `
      <template id="pf-template"><section class="printform" data-papersize-height="1050"></section></template>
      <section class="printform_page"></section>`;
    const page = document.querySelector(".printform_page");
    Object.defineProperty(page, "scrollHeight", { configurable: true, value: 1062 });
    page.getBoundingClientRect = () => ({ left: 0, right: 750, top: 0, bottom: 1062, width: 750, height: 1062 });
    const report = inspectRenderedDocument(document, { acceptance: { maxLogicalPages: 100 } });
    expect(report.valid).toBe(false);
    expect(report.errors.some((item) => item.code === "VERTICAL_OVERFLOW")).toBe(true);
    expect(report.metrics.verticalOverflowPages).toBe(1);
  });
});
