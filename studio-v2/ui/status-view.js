import { t, translateIssue } from "./ui-i18n.js";

const $ = (selector) => document.querySelector(selector);

export function renderQualityView(validation, trust) {
  const summary = $("#quality-summary");
  summary.textContent = validation.productionValid
    ? t("quality.pass", { count: validation.warnings.length })
    : t("quality.blocked", { count: validation.errors.length });
  const list = $("#issue-list");
  list.replaceChildren();
  [...validation.errors, ...validation.warnings].slice(0, 30).forEach((item) => {
    const li = document.createElement("li");
    li.className = item.severity || (validation.errors.includes(item) ? "error" : "warning");
    li.textContent = `${item.code}: ${translateIssue(item)}`;
    list.appendChild(li);
  });
  $("#export-button").disabled = !validation.productionValid;
  const review = validation.reviewReceipt;
  $("#review-status").textContent = review ? t("review.pass", { revision: review.reviewedRevision }) : t("review.pending");
  $("#reset-trust-button").classList.toggle("hidden", trust !== "untrusted");
}

export function renderWebMcpStatus(adapter) {
  $("#webmcp-status").textContent = adapter?.supported ? t("webmcp.registered", { count: adapter.registered.length }) : t("webmcp.unavailable");
}

export function renderDataPolicy(realData) {
  $("#data-policy").textContent = t(realData ? "data.real" : "data.synthetic");
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
