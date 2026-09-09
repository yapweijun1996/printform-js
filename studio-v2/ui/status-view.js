import { AGENT_CONTRACT_VERSION } from "../core/constants.js";
import { t, translateIssue } from "./ui-i18n.js";

const $ = (selector) => document.querySelector(selector);

// Maps a validation issue path prefix to the source editor that owns it, so
// quality-gate entries can jump straight to the right textarea.
const PATH_EDITORS = [
  ["/manifest", "manifest-editor"],
  ["/schema", "schema-editor"],
  ["/i18n", "i18n-editor"],
  ["/theme", "theme-editor"],
  ["/template", "template-editor"],
  ["/sampleData", "sample-editor"],
  ["/trust", "template-editor"],
  ["/spec", "template-editor"]
];

const ACTION_KEYS = Object.freeze({
  HORIZONTAL_OVERFLOW: "quality.action.horizontalOverflow",
  VERTICAL_OVERFLOW: "quality.action.verticalOverflow",
  CONTRAST_FAILURE: "quality.action.contrast"
});

function editorForPath(path) {
  const hit = PATH_EDITORS.find(([prefix]) => String(path || "").startsWith(prefix));
  return hit ? hit[1] : null;
}

function focusEditor(editorId) {
  const editor = document.getElementById(editorId);
  if (!editor) return;
  const details = editor.closest("details");
  if (details) details.open = true;
  editor.scrollIntoView?.({ block: "center", behavior: "smooth" });
  editor.focus({ preventScroll: true });
  editor.classList.remove("editor-flash");
  // restart the highlight animation even when re-clicking the same entry
  void editor.offsetWidth;
  editor.classList.add("editor-flash");
  editor.addEventListener("animationend", () => editor.classList.remove("editor-flash"), { once: true });
}

function issueDetail(item) {
  return item?.details && typeof item.details === "object" ? item.details : {};
}

function issueTarget(item, detail) {
  const page = Number.isInteger(detail.page) ? detail.page : item.page;
  const rawPageIndex = Number.isInteger(detail.pageIndex) ? detail.pageIndex : item.pageIndex;
  const pageIndex = Number.isInteger(rawPageIndex) ? rawPageIndex : Number.isInteger(page) ? page - 1 : -1;
  const selector = detail.selector || item.selector || "";
  const componentId = detail.component_id || detail.componentId || item.component_id || item.componentId || "";
  if (pageIndex < 0 || (!componentId && (!selector || selector === "unknown"))) return null;
  return { pageIndex, selector, componentId };
}

function issueLocation(item, detail, target) {
  const page = Number.isInteger(detail.page) ? detail.page : Number.isInteger(item.page)
    ? item.page
    : target ? target.pageIndex + 1 : null;
  const componentId = detail.component_id || detail.componentId || item.component_id || item.componentId || "";
  const path = item.path || detail.path || "";
  const parts = [];
  if (Number.isInteger(page) && page > 0) parts.push(t("quality.locationPage", { page }));
  if (componentId) parts.push(t("quality.locationComponent", { component: componentId }));
  if (path && path !== "/") parts.push(t("quality.locationPath", { path }));
  return parts.length ? parts.join(" · ") : t("quality.locationUnknown");
}

function emitIssueNavigation(target) {
  if (!target) return;
  window.dispatchEvent(new CustomEvent("printform:quality-navigate", { detail: target }));
}

function localizedAction(item, detail, editorId, target) {
  const action = item.recommended_action || detail.recommended_action;
  if (action) return ACTION_KEYS[item.code] ? t(ACTION_KEYS[item.code], {}, action) : action;
  if (editorId) return t("quality.action.editSource");
  if (target) return t("quality.action.inspectPreview");
  return t("quality.action.inspectFallback");
}

function qualityItems(validation, errors, warnings) {
  const issues = Array.isArray(validation.issues) ? validation.issues.filter((item) => item && typeof item === "object") : [];
  const matched = new Set();
  const entries = [...errors, ...warnings].flatMap((item) => {
    const details = issues.filter((issue) => issue.code === item.code);
    if (!details.length) return [item];
    return details.map((issue) => {
      matched.add(issue);
      return { ...item, details: { ...issueDetail(item), ...issue } };
    });
  });
  issues.forEach((issue) => {
    if (!matched.has(issue)) entries.push({ ...issue, severity: "error", message: issue.reason || issue.recommended_action || "" });
  });
  return entries;
}

export function renderQualityView(validation = {}, trust) {
  const summary = $("#quality-summary");
  const errors = Array.isArray(validation.errors) ? validation.errors : [];
  const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];
  summary.textContent = validation.productionValid
    ? t("quality.pass", { count: warnings.length })
    : t("quality.blocked", { count: errors.length });
  const list = $("#issue-list");
  list.replaceChildren();
  qualityItems(validation, errors, warnings).slice(0, 30).forEach((item) => {
    const detail = issueDetail(item);
    const target = issueTarget(item, detail);
    const editorId = editorForPath(item.path || detail.path);
    const li = document.createElement("li");
    const actionable = Boolean(editorId || target);
    li.className = item.severity || (errors.includes(item) ? "error" : "warning");
    li.classList.add("issue-item");
    const heading = document.createElement(actionable ? "button" : "div");
    heading.className = actionable ? "issue-action" : "issue-heading";
    heading.textContent = `${item.code}: ${translateIssue(item)}`;
    if (actionable) {
      li.classList.add("clickable");
      heading.type = "button";
      heading.title = t("quality.openIssue");
      heading.addEventListener("click", () => {
        if (editorId) focusEditor(editorId);
        emitIssueNavigation(target);
      });
    }
    li.appendChild(heading);
    const location = document.createElement("div");
    location.className = "issue-location";
    location.textContent = t("quality.location", { value: issueLocation(item, detail, target) });
    li.appendChild(location);
    const reason = item.reason || detail.reason;
    if (reason) {
      const reasonNode = document.createElement("div");
      reasonNode.className = "issue-reason";
      reasonNode.textContent = t("quality.reason", { reason });
      li.appendChild(reasonNode);
    }
    const action = document.createElement("div");
    action.className = "issue-next-action";
    action.textContent = t("quality.nextAction", { action: localizedAction(item, detail, editorId, target) });
    li.appendChild(action);
    list.appendChild(li);
  });
  $("#export-button").disabled = !validation.productionValid;
  const chip = $("#export-readiness");
  if (chip) {
    const ready = validation.productionValid;
    chip.className = `status ${ready ? "ready" : "blocked"}`;
    chip.textContent = t(ready ? "actions.exportReady" : "actions.exportBlocked");
    chip.setAttribute("aria-label", t(ready ? "actions.exportReadyLabel" : "actions.exportBlockedLabel"));
  }
  const review = validation.reviewReceipt;
  $("#review-status").textContent = review ? t("review.pass", { revision: review.reviewedRevision }) : t("review.pending");
  $("#reset-trust-button").classList.toggle("hidden", trust !== "untrusted");
}

// Read from the constant, never written into index.html: a hardcoded version
// there silently drifts on every contract bump (it sat at 1.1.0 through both
// the 1.2.0 and 2.0.0 releases, telling engineers the wrong contract while
// get_capabilities reported the real one).
export function renderContractVersion() {
  $("#contract-version").textContent = AGENT_CONTRACT_VERSION;
}

export function renderWebMcpStatus(adapter) {
  $("#webmcp-status").textContent = adapter?.supported ? t("webmcp.registered", { count: adapter.registered.length }) : t("webmcp.unavailable");
}

export function renderDataPolicy(policy, persistence = null) {
  const classification = typeof policy === "string" ? policy : policy?.classification;
  const key = classification === "real" ? "data.real" : classification === "unknown" ? "data.unknown" : "data.synthetic";
  const text = t(key, {}, classification === "unknown" ? "Unknown data: restrictive, no durable document state" : undefined);
  const persistenceUnavailable = persistence?.persistenceState === "volatile-fallback";
  const node = $("#data-policy");
  if (!node) return;
  delete node.dataset.uiI18n;
  node.textContent = persistenceUnavailable
    ? `${text} · ${t("data.persistenceUnavailable", {}, "Persistence unavailable; current changes remain memory-only")}`
    : text;
}

export function renderStatus(key, className) {
  const node = $("#render-status");
  node.className = `status ${className}`;
  node.dataset.statusKey = key;
  delete node.dataset.uiI18n;
  node.textContent = t(key);
}

export function refreshStatusText() {
  const node = $("#render-status");
  node.textContent = t(node.dataset.statusKey || "status.waiting");
}

export function renderMetrics(metrics) {
  const node = $("#metrics-output");
  delete node.dataset.uiI18n;
  node.textContent = JSON.stringify(metrics, null, 2);
}
