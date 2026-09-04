import { currentBrandColor } from "../core/branding.js";
import { currentFontBasePt } from "../core/typography.js";

function escapeText(str) {
  return String(str ?? "");
}

function describeOperation(op, baseProject, t) {
  switch (op?.type) {
    case "set_brand_color": {
      const before = currentBrandColor(baseProject?.themeCss);
      return {
        target: t("editor.brandColor", {}, "Brand color"),
        before: before || null,
        after: op.hex,
        description: `${op.hex}`,
        safety: t("aiChat.card.safe", {}, "Safe semantic change")
      };
    }
    case "set_font_scale": {
      const before = currentFontBasePt(baseProject?.themeCss);
      return {
        target: t("editor.fontScale", {}, "Print font scale"),
        before: before ? `${before}pt` : null,
        after: `${op.basePt}pt`,
        description: `Base font size: ${op.basePt}pt`,
        safety: t("aiChat.card.safe", {}, "Safe semantic change")
      };
    }
    case "set_column_widths": {
      return {
        target: `${t("editor.tableColumns", {}, "Table columns")} (${op.tableSelector})`,
        before: null,
        after: Array.isArray(op.widths) ? op.widths.join(", ") : String(op.widths),
        description: Array.isArray(op.widths) ? op.widths.join(", ") : String(op.widths),
        safety: t("aiChat.card.safe", {}, "Safe semantic change")
      };
    }
    case "set_manifest_value": {
      return {
        target: `Manifest (${op.path})`,
        before: null,
        after: typeof op.value === "object" ? JSON.stringify(op.value) : String(op.value),
        description: typeof op.value === "object" ? JSON.stringify(op.value) : String(op.value),
        safety: t("aiChat.card.safe", {}, "Safe semantic change")
      };
    }
    case "set_asset_slot": {
      const displayUrl = op.url ? (op.url.startsWith("data:") ? "data:image/..." : op.url) : "cleared";
      return {
        target: `Asset slot: ${op.slot}`,
        before: null,
        after: displayUrl,
        description: displayUrl,
        safety: t("aiChat.card.safe", {}, "Safe semantic change")
      };
    }
    case "set_attribute": {
      return {
        target: `Attribute ${op.attribute} on ${op.selector}`,
        before: null,
        after: String(op.value),
        description: `${op.attribute} = "${op.value}"`,
        safety: t("aiChat.card.safe", {}, "Safe semantic change")
      };
    }
    default: {
      return {
        target: op?.type || "Operation",
        before: null,
        after: null,
        description: JSON.stringify(op || {}),
        safety: t("aiChat.card.safe", {}, "Safe semantic change")
      };
    }
  }
}

export function renderChangeCardContent({
  container,
  proposal,
  baseProject = null,
  applyMode = "auto",
  status = "pending",
  t,
  onApply = () => {},
  onDiscard = () => {},
  onUndo = () => {},
  onRedo = () => {}
}) {
  container.replaceChildren();
  if (!proposal) return;

  const card = document.createElement("div");
  card.className = `ai-change-card ai-card-${status}`;
  card.dataset.proposalId = proposal.proposalId || "";
  card.dataset.revision = String(proposal.revision ?? "");

  // Header
  const header = document.createElement("div");
  header.className = "ai-card-header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "ai-card-title-group";

  const heading = document.createElement("h3");
  heading.className = "ai-card-title";
  heading.textContent = t("aiChat.proposal.title", {}, "Design proposal ready");

  const badge = document.createElement("span");
  badge.className = `ai-card-status-badge ai-badge-${status}`;
  if (status === "applied") {
    badge.textContent = t("aiChat.card.applied", { revision: proposal.appliedRevision ?? proposal.revision ?? "?" });
  } else if (status === "reverted") {
    badge.textContent = t("aiChat.card.reverted", {}, "Reverted");
  } else if (status === "blocked") {
    badge.textContent = t("aiChat.card.blocked", {}, "Blocked");
  } else {
    badge.textContent = t("aiChat.card.pending", {}, "Preview ready");
  }

  titleGroup.append(heading, badge);
  header.append(titleGroup);
  card.append(header);

  // Changes list
  const changesList = document.createElement("div");
  changesList.className = "ai-card-changes";

  const operations = Array.isArray(proposal.operations) ? proposal.operations : [];
  if (operations.length === 0) {
    const emptyRow = document.createElement("p");
    emptyRow.className = "ai-card-empty-changes";
    emptyRow.textContent = t("aiChat.card.noDiff", {}, "No visual changes");
    changesList.append(emptyRow);
  } else {
    operations.forEach((op) => {
      const item = describeOperation(op, baseProject, t);
      const row = document.createElement("div");
      row.className = "ai-card-change-item";

      const targetEl = document.createElement("div");
      targetEl.className = "ai-change-target";
      targetEl.innerHTML = `<span class="ai-item-label">${escapeText(t("aiChat.card.target", {}, "Target"))}:</span> <strong class="ai-item-val">${escapeText(item.target)}</strong>`;

      const whatEl = document.createElement("div");
      whatEl.className = "ai-change-what";
      if (item.before && item.after) {
        whatEl.innerHTML = `<span class="ai-change-before">${escapeText(t("aiChat.card.before", { value: item.before }, `Before: ${item.before}`))}</span> <span class="ai-change-arrow">→</span> <span class="ai-change-after">${escapeText(t("aiChat.card.after", { value: item.after }, `After: ${item.after}`))}</span>`;
      } else {
        whatEl.innerHTML = `<span class="ai-item-label">${escapeText(t("aiChat.card.what", {}, "Change"))}:</span> <span class="ai-change-val">${escapeText(item.description)}</span>`;
      }

      const safetyEl = document.createElement("div");
      safetyEl.className = "ai-change-safety";
      safetyEl.innerHTML = `<span class="ai-safety-icon" aria-hidden="true">🔒</span> <span class="ai-safety-text">${escapeText(item.safety)}</span>`;

      row.append(targetEl, whatEl, safetyEl);
      changesList.append(row);
    });
  }
  card.append(changesList);

  // Validation Card section
  const validationSec = document.createElement("div");
  validationSec.className = "ai-card-validation";

  const valHeader = document.createElement("div");
  valHeader.className = "ai-validation-status";
  const errors = proposal.validation?.errors || [];
  const warnings = proposal.validation?.warnings || [];
  const valid = (proposal.validation?.valid ?? true) && errors.length === 0;

  if (valid) {
    valHeader.className += " is-valid";
    valHeader.innerHTML = `<span class="ai-val-icon" aria-hidden="true">✓</span> <span>${escapeText(t("quality.pass", { count: warnings.length }))}</span>`;
  } else {
    valHeader.className += " is-blocked";
    valHeader.innerHTML = `<span class="ai-val-icon" aria-hidden="true">✕</span> <span>${escapeText(t("quality.blocked", { count: errors.length }))}</span>`;
  }
  validationSec.append(valHeader);

  const metrics = proposal.validation?.metrics;
  if (metrics && typeof metrics === "object") {
    const metricsRow = document.createElement("div");
    metricsRow.className = "ai-validation-metrics";
    const pages = metrics.logicalPages ?? "—";
    const rows = metrics.renderedRows ?? metrics.rows ?? "—";
    metricsRow.textContent = `Pages: ${pages} · Rows: ${rows}`;
    validationSec.append(metricsRow);
  }
  card.append(validationSec);

  // Technical details (for inspector / debug / tests compatibility)
  const details = document.createElement("details");
  details.className = "ai-proposal-details";
  const summary = document.createElement("summary");
  summary.textContent = t("aiChat.proposal.details", {}, "Technical diff & validation");
  const diffPre = document.createElement("pre");
  diffPre.id = "ai-proposal-diff";
  diffPre.textContent = JSON.stringify({
    proposalId: proposal.proposalId,
    revision: proposal.revision,
    candidateHash: proposal.candidateHash,
    diff: proposal.diff
  }, null, 2);
  const valPre = document.createElement("pre");
  valPre.id = "ai-proposal-validation";
  valPre.textContent = JSON.stringify(proposal.validation || {}, null, 2);
  details.append(summary, diffPre, valPre);
  card.append(details);

  // Action Buttons
  const actionsBar = document.createElement("div");
  actionsBar.className = "ai-card-actions";

  if (status === "pending" && applyMode === "preview") {
    const applyBtn = document.createElement("button");
    applyBtn.id = "ai-apply-proposal";
    applyBtn.type = "button";
    applyBtn.className = "button ai-card-apply-btn";
    applyBtn.textContent = t("aiChat.card.apply", {}, "Apply changes");
    applyBtn.addEventListener("click", () => onApply(proposal));

    const discardBtn = document.createElement("button");
    discardBtn.id = "ai-reject-proposal";
    discardBtn.type = "button";
    discardBtn.className = "secondary ai-card-discard-btn";
    discardBtn.textContent = t("aiChat.card.discard", {}, "Discard");
    discardBtn.addEventListener("click", () => onDiscard(proposal));

    actionsBar.append(applyBtn, discardBtn);
  } else if (status === "applied") {
    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "secondary ai-card-undo";
    undoBtn.textContent = t("aiChat.card.undo", {}, "Undo change");
    undoBtn.addEventListener("click", () => onUndo(proposal));
    actionsBar.append(undoBtn);
  } else if (status === "reverted") {
    const redoBtn = document.createElement("button");
    redoBtn.type = "button";
    redoBtn.className = "secondary ai-card-redo";
    redoBtn.textContent = t("aiChat.card.redo", {}, "Redo change");
    redoBtn.addEventListener("click", () => onRedo(proposal));
    actionsBar.append(redoBtn);
  }

  if (actionsBar.children.length > 0) {
    card.append(actionsBar);
  }

  container.append(card);
}
