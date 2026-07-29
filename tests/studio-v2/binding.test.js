import { describe, expect, it } from "vitest";
import { bindTemplate, safeUrl } from "../../studio-v2/core/binding.js";

describe("PrintForm v2 declarative binding", () => {
  it("expands rows, formats values and writes text safely", () => {
    const template = document.createElement("template");
    template.innerHTML = `<div><p data-pf-text="/title"></p><div data-pf-each="/items"><span data-pf-text="./name"></span><b data-pf-text="./price" data-pf-format="currency"></b></div></div>`;
    const result = bindTemplate(template, { title: "<script>unsafe</script>", items: [{ name: "A", price: 12 }, { name: "B", price: 3 }] }, { locale: "en-MY", currency: "MYR" });
    const host = document.createElement("div");
    host.append(result.fragment);
    expect(host.querySelectorAll("span")).toHaveLength(2);
    expect(host.querySelector("p").innerHTML).toContain("&lt;script&gt;");
    expect(host.querySelector("b").textContent).toContain("12.00");
    expect(result.report.rows).toBe(2);
  });

  it("accepts only the supported URL protocols", () => {
    expect(safeUrl("https://example.com")).toBe("https://example.com");
    expect(safeUrl("mailto:test@example.com")).toBe("mailto:test@example.com");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
  });

  it("treats unresolved pointers as hard binding errors", () => {
    const template = document.createElement("template");
    template.innerHTML = `<span data-pf-text="/missing"></span>`;
    expect(bindTemplate(template, {}, {}).report.errors[0].code).toBe("MISSING_BINDING");
  });
});
