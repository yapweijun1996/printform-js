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
      <span id="ai-context-selection-meta"></span>
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
    expect(document.querySelector("#ai-context-status").textContent).toBe("status.waiting");
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

    expect(onScopeChange).toHaveBeenCalledWith({ kind: "table", tableId: "default" });
  });

  it("does not show Printable until current production readiness passes", () => {
    setupDom();
    const t = (key, vars, fallback) => ({
      "aiChat.context.blocked": "Blocked",
      "aiChat.context.printable": "Printable",
      "aiChat.context.issues": `${vars?.count} issues`
    }[key] || fallback || key);
    const view = createDocumentContextView({ get: (sel) => document.querySelector(sel), t });

    view.update({ renderStatus: "ready", readiness: { productionValid: false, errors: [{ code: "LAYOUT_REVIEW_REQUIRED" }], warnings: [] }, errorCount: 0 });
    expect(document.querySelector("#ai-context-status").textContent).toBe("Blocked");

    view.update({ readiness: { productionValid: true, errors: [], warnings: [] }, errorCount: 0 });
    expect(document.querySelector("#ai-context-status").textContent).toBe("Printable");

    view.update({ warningCount: 1 });
    expect(document.querySelector("#ai-context-status").textContent).toBe("1 issues");
  });

  it("renders document-specific table scope options and resets stale selections", () => {
    setupDom();
    const onScopeChange = vi.fn();
    const t = (key, vars, fallback) => fallback || key;
    const view = createDocumentContextView({
      get: (sel) => document.querySelector(sel),
      t,
      onScopeChange,
      scopeOptions: [
        { value: "all", label: "All sections", selection: "Entire document", scope: { kind: "document" } },
        { value: "table:valuation", label: "Table valuation", selection: "Table valuation", scope: { kind: "table", tableId: "valuation" } },
      ]
    });

    const select = document.querySelector("#ai-context-scope-select");
    expect(Array.from(select.options, (option) => option.value)).toEqual(["all", "table:valuation"]);
    select.value = "table:valuation";
    select.dispatchEvent(new Event("change"));
    expect(onScopeChange).toHaveBeenLastCalledWith({ kind: "table", tableId: "valuation" });
    view.update({ scopeOptions: [{ value: "all", label: "All sections", selection: "Entire document", scope: { kind: "document" } }] });
    expect(select.value).toBe("all");
    expect(onScopeChange).toHaveBeenLastCalledWith({ kind: "document" });
  });

  it("renders structural preview selection details without exposing values", () => {
    setupDom();
    const t = (key, vars, fallback) => fallback || key;
    const view = createDocumentContextView({ get: (sel) => document.querySelector(sel), t });

    view.update({
      scope: "table",
      selection: "Table default · DataTable (table-header) [table-default-header]",
      selectionDetails: {
        componentId: "table-default-header", tableId: "default", type: "DataTable", role: "table-header", source: "preview"
      }
    });

    const meta = document.querySelector("#ai-context-selection-meta");
    expect(meta.textContent).toBe("DataTable · table-header · table=default · table-default-header");
    expect(meta.dataset.componentId).toBe("table-default-header");
    expect(meta.dataset.tableId).toBe("default");
    expect(meta.dataset.source).toBe("preview");
    expect(meta.textContent).not.toContain("Example Business");
    view.update({ selection: "Entire document", scope: "all" });
    expect(meta.dataset.componentId).toBe("");
    expect(meta.dataset.source).toBe("scope-control");
  });
});
