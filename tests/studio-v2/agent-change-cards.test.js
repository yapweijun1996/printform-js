import { describe, expect, it, vi } from "vitest";
import { renderChangeCardContent } from "../../studio-v2/ui/agent-change-cards.js";

describe("agent-change-cards component", () => {
  it("renders structured proposal and change items with target, what, and safety", () => {
    const container = document.createElement("div");
    const proposal = {
      proposalId: "prop-1",
      revision: 0,
      operations: [
        { type: "set_brand_color", hex: "#b42318" },
        { type: "set_font_scale", basePt: 12 },
        { type: "set_column_widths", tableSelector: ".prowitem", widths: ["20%", "60%", "20%"] }
      ],
      diff: { changed: true },
      validation: { valid: true, errors: [], warnings: [], metrics: { rows: 45, logicalPages: 2 } }
    };
    const baseProject = { themeCss: "--pf-brand-color: #173d9a;\n--pf-font-base: 9pt;" };
    const t = (key, vars, fallback) => fallback || key;

    renderChangeCardContent({
      container,
      proposal,
      baseProject,
      applyMode: "preview",
      status: "pending",
      t
    });

    const card = container.querySelector(".ai-change-card");
    expect(card).not.toBeNull();
    expect(card.classList.contains("ai-card-pending")).toBe(true);

    const changeItems = container.querySelectorAll(".ai-card-change-item");
    expect(changeItems).toHaveLength(3);

    expect(changeItems[0].textContent).toContain("Brand color");
    expect(changeItems[0].textContent).toContain("#173d9a");
    expect(changeItems[0].textContent).toContain("#b42318");

    expect(changeItems[1].textContent).toContain("Print font scale");
    expect(changeItems[1].textContent).toContain("9pt");
    expect(changeItems[1].textContent).toContain("12pt");

    expect(changeItems[2].textContent).toContain(".prowitem");
    expect(changeItems[2].textContent).toContain("20%, 60%, 20%");

    const validation = container.querySelector(".ai-card-validation");
    expect(validation.textContent).toContain("Pages: 2 · Rows: 45");

    const applyBtn = container.querySelector("#ai-apply-proposal");
    const discardBtn = container.querySelector("#ai-reject-proposal");
    expect(applyBtn).not.toBeNull();
    expect(discardBtn).not.toBeNull();
  });

  it("handles Apply and Discard button clicks in preview mode", () => {
    const container = document.createElement("div");
    const proposal = { proposalId: "prop-2", revision: 1, operations: [{ type: "set_brand_color", hex: "#000000" }] };
    const onApply = vi.fn();
    const onDiscard = vi.fn();
    const t = (k, v, fallback) => fallback || k;

    renderChangeCardContent({
      container,
      proposal,
      applyMode: "preview",
      status: "pending",
      t,
      onApply,
      onDiscard
    });

    container.querySelector("#ai-apply-proposal").click();
    expect(onApply).toHaveBeenCalledWith(proposal);

    container.querySelector("#ai-reject-proposal").click();
    expect(onDiscard).toHaveBeenCalledWith(proposal);
  });

  it("renders actionable Undo change button when proposal is applied", () => {
    const container = document.createElement("div");
    const proposal = { proposalId: "prop-3", revision: 1, appliedRevision: 2, operations: [{ type: "set_font_scale", basePt: 14 }] };
    const onUndo = vi.fn();
    const t = (k, v, fallback) => fallback || k;

    renderChangeCardContent({
      container,
      proposal,
      applyMode: "auto",
      status: "applied",
      t,
      onUndo
    });

    const badge = container.querySelector(".ai-card-status-badge");
    expect(badge.textContent).toBe("aiChat.card.applied");

    const undoBtn = container.querySelector(".ai-card-undo");
    expect(undoBtn).not.toBeNull();
    undoBtn.click();
    expect(onUndo).toHaveBeenCalledWith(proposal);
  });

  it("renders Redo change button when proposal is reverted", () => {
    const container = document.createElement("div");
    const proposal = { proposalId: "prop-4", revision: 2, appliedRevision: 2, operations: [] };
    const onRedo = vi.fn();
    const t = (k, v, fallback) => fallback || k;

    renderChangeCardContent({
      container,
      proposal,
      applyMode: "auto",
      status: "reverted",
      t,
      onRedo
    });

    const redoBtn = container.querySelector(".ai-card-redo");
    expect(redoBtn).not.toBeNull();
    redoBtn.click();
    expect(onRedo).toHaveBeenCalledWith(proposal);
  });
});
