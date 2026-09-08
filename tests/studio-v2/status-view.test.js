import { describe, expect, it } from "vitest";
import { renderDataPolicy } from "../../studio-v2/ui/status-view.js";

describe("data policy status", () => {
  it("surfaces a volatile fallback instead of claiming durable persistence", () => {
    document.body.innerHTML = '<span id="data-policy" data-ui-i18n="data.synthetic"></span>';

    renderDataPolicy({ classification: "synthetic" }, { persistenceState: "volatile-fallback" });

    expect(document.querySelector("#data-policy").textContent).toMatch(/Synthetic data only/);
    expect(document.querySelector("#data-policy").textContent).toMatch(/Persistence unavailable/);
    expect(document.querySelector("#data-policy").hasAttribute("data-ui-i18n")).toBe(false);
  });
});
