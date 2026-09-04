import { describe, expect, it, vi } from "vitest";
import { createDocumentContextView } from "../../studio-v2/ui/agent-document-context.js";

function setupDom() {
  document.body.innerHTML = `
    <section id="ai-document-context">
      <span id="ai-context-doc-name"></span>
      <span id="ai-context-revision"></span>
      <span id="ai-context-state"></span>
      <span id="ai-context-status"></span>
      <span id="ai-context-selection-val"></span>
      <select id="ai-context-scope-select">
        <option value="all">All sections</option>
        <option value="layout">Layout</option>
        <option value="table">Table columns</option>
        <option value="theme">Theme & brand</option>
      </select>
    </section>
  `;
}

describe("agent-document-context view", () => {
  it("initializes with default state and renders connected elements", () => {
    setupDom();
    const t = (key, vars, fallback) => fallback || key;
    const view = createDocumentContextView({ get: (sel) => document.querySelector(sel), t });

    expect(document.querySelector("#ai-context-doc-name").textContent).toBe("PrintForm Document");
    expect(document.querySelector("#ai-context-revision").textContent).toBe("r0");
    expect(document.querySelector("#ai-context-state").textContent).toBe("aiChat.context.committed");
    expect(document.querySelector("#ai-context-status").textContent).toBe("aiChat.context.printable");
    expect(document.querySelector("#ai-context-selection-val").textContent).toBe("aiChat.context.entireDocument");
    expect(document.querySelector("#ai-context-scope-select").value).toBe("all");
  });

  it("updates document context dynamically on real state changes", () => {
    setupDom();
    const t = (key, vars, fallback) => {
      if (key === "aiChat.context.candidate") return `Candidate (r${vars?.revision})`;
      if (key === "aiChat.context.blocked") return "Blocked";
      if (key === "aiChat.context.issues") return `${vars?.count} issues`;
      return fallback || key;
    };
    const view = createDocumentContextView({ get: (sel) => document.querySelector(sel), t });

    view.update({
      documentTitle: "Purchase Order — Crimson",
      revision: 2,
      stateMode: "candidate",
      candidateRevision: 3,
      errorCount: 1,
      selection: "Table columns (.prowitem)"
    });

    expect(document.querySelector("#ai-context-doc-name").textContent).toBe("Purchase Order — Crimson");
    expect(document.querySelector("#ai-context-revision").textContent).toBe("r2");
    expect(document.querySelector("#ai-context-state").textContent).toBe("Candidate (r3)");
    expect(document.querySelector("#ai-context-status").textContent).toBe("Blocked");
    expect(document.querySelector("#ai-context-selection-val").textContent).toBe("Table columns (.prowitem)");
  });

  it("triggers onScopeChange when scope selector changes", () => {
    setupDom();
    const onScopeChange = vi.fn();
    const t = (key, vars, fallback) => fallback || key;
    createDocumentContextView({ get: (sel) => document.querySelector(sel), t, onScopeChange });

    const select = document.querySelector("#ai-context-scope-select");
    select.value = "table";
    select.dispatchEvent(new Event("change"));

    expect(onScopeChange).toHaveBeenCalledWith("table");
  });
});
