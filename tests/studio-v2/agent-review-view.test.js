import { describe, expect, it, vi } from "vitest";
import { bindLayoutReviewView } from "../../studio-v2/ui/agent-review-view.js";

function translate(key, values = {}) {
  return `${key} ${Object.entries(values).map(([name, value]) => `${name}=${value}`).join(" ")}`;
}

describe("AI layout review progress card", () => {
  it("renders bounded pass progress and findings as text only", () => {
    document.body.innerHTML = `<section id="ai-review-card" hidden><p id="ai-review-progress"></p><ol id="ai-review-findings"></ol></section>`;
    const status = vi.fn();
    const view = bindLayoutReviewView({ get: (selector) => document.querySelector(selector), t: translate, status });
    view.observe({ type: "layout_review_started", detail: { pass: 1, maxPasses: 3 } });
    expect(document.querySelector("#ai-review-card").hidden).toBe(false);
    expect(document.querySelector("#ai-review-progress").textContent).toContain("pass=1");

    view.observe({
      type: "layout_repair_proposed",
      detail: {
        pass: 1, operationCount: 2,
        findings: [{ code: "OVERFLOW", severity: "major", message: "<img src=x onerror=alert(1)>" }]
      }
    });
    const item = document.querySelector("#ai-review-findings li");
    expect(item.textContent).toContain("<img src=x");
    expect(item.querySelector("img")).toBeNull();
    expect(item.dataset.severity).toBe("major");
    expect(status).toHaveBeenCalledWith("aiChat.status.approval");
  });
});
