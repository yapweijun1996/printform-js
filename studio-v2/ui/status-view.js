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
  ["/trust", "template-editor"]
];

function editorForPath(path) {
  const hit = PATH_EDITORS.find(([prefix]) => String(path || "").startsWith(prefix));
  return hit ? hit[1] : null;
}

function focusEditor(editorId) {
  const editor = document.getElementById(editorId);
  if (!editor) return;
  const details = editor.closest("details");
  if (details) details.open = true;
  editor.scrollIntoView({ block: "center", behavior: "smooth" });
  editor.focus({ preventScroll: true });
  editor.classList.remove("editor-flash");
  // restart the highlight animation even when re-clicking the same entry
  void editor.offsetWidth;
  editor.classList.add("editor-flash");
  editor.addEventListener("animationend", () => editor.classList.remove("editor-flash"), { once: true });
}

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
    const editorId = editorForPath(item.path);
    if (editorId) {
      li.classList.add("clickable");
      li.title = item.path;
      li.tabIndex = 0;
      li.addEventListener("click", () => focusEditor(editorId));
      li.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); focusEditor(editorId); } });
    }
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
