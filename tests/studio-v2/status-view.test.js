import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderDataPolicy, renderQualityView } from "../../studio-v2/ui/status-view.js";
import { setUiLocale } from "../../studio-v2/ui/ui-i18n.js";

beforeEach(() => {
  document.body.innerHTML = `
    <div id="quality-summary"></div><ol id="issue-list"></ol>
    <button id="export-button"></button><span id="export-readiness"></span>
    <span id="review-status"></span><button id="reset-trust-button"></button>
    <details><textarea id="sample-editor"></textarea></details>
  `;
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(async () => {
  await setUiLocale("en-MY", document, false);
});

describe("data policy status", () => {
  it("surfaces a volatile fallback instead of claiming durable persistence", () => {
    document.body.innerHTML = '<span id="data-policy" data-ui-i18n="data.synthetic"></span>';

    renderDataPolicy({ classification: "synthetic" }, { persistenceState: "volatile-fallback" });

    expect(document.querySelector("#data-policy").textContent).toMatch(/Synthetic data only/);
    expect(document.querySelector("#data-policy").textContent).toMatch(/Persistence unavailable/);
    expect(document.querySelector("#data-policy").hasAttribute("data-ui-i18n")).toBe(false);
  });
});

describe("actionable quality issues", () => {
  it("shows page/component/path details and emits a visual navigation target", () => {
    const targets = [];
    const listener = (event) => targets.push(event.detail);
    window.addEventListener("printform:quality-navigate", listener);

    renderQualityView({
      productionValid: false,
      errors: [{
        code: "HORIZONTAL_OVERFLOW",
        path: "/render/page/2",
        message: "overflow"
      }],
      warnings: [],
      issues: [{
        code: "HORIZONTAL_OVERFLOW",
          page: 2,
          pageIndex: 1,
          component_id: "project-info-2",
          selector: "#overflow-target",
          reason: "Element exceeds the logical page width",
          recommended_action: "Reduce column widths"
      }]
    }, "trusted");

    const item = document.querySelector("#issue-list li");
    expect(item.textContent).toContain("page 2");
    expect(item.textContent).toContain("component project-info-2");
    expect(item.textContent).toContain("path /render/page/2");
    expect(item.textContent).toContain("Next action");
    expect(item.querySelector("button")).not.toBeNull();

    item.querySelector("button").click();

    expect(targets).toEqual([{ pageIndex: 1, selector: "#overflow-target", componentId: "project-info-2" }]);
    window.removeEventListener("printform:quality-navigate", listener);
  });

  it("keeps source routing for fields and names an unlocatable legacy issue", () => {
    renderQualityView({
      productionValid: false,
      errors: [
        { code: "MIN_ITEMS", path: "/sampleData/items", message: "missing", severity: "error" },
        { code: "RENDER_FAILED", path: "/", message: "legacy failure", severity: "error" }
      ],
      warnings: []
    }, "trusted");

    const items = [...document.querySelectorAll("#issue-list li")];
    expect(items[0].querySelector("button")).not.toBeNull();
    items[0].querySelector("button").click();
    expect(document.querySelector("#sample-editor")).toBe(document.activeElement);
    expect(items[1].textContent).toContain("Preview target unavailable");
    expect(items[1].querySelector("button")).toBeNull();
  });

  it("localizes the issue message, location labels and next-action label", async () => {
    await setUiLocale("zh-CN", document, false);
    renderQualityView({
      productionValid: false,
      errors: [{ code: "MIN_ITEMS", path: "/sampleData/items", message: "missing" }],
      warnings: []
    }, "trusted");

    const text = document.querySelector("#issue-list li").textContent;
    expect(text).toContain("至少需要一行数据");
    expect(text).toContain("位置：");
    expect(text).toContain("下一步：");
  });
});
