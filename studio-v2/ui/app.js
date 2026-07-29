import { CommandBus } from "../core/command-bus.js";
import { createStandaloneHtml, loadRuntimeSources } from "../core/exporter.js";
import { parseProjectHtml, verifyImportedProject } from "../core/project-model.js";
import { stableStringify } from "../core/json.js";
import { analyzeMigration } from "../core/migrations.js";
import { createSalesInvoiceProject } from "../samples/sales-invoice.js";
import { installAgentGateway } from "../adapters/gateway.js";
import { installWebMcpAdapter } from "../adapters/webmcp.js";
import { clearRecoveryDraft, loadRecoveryDraft, saveRecoveryDraft } from "./draft-cache.js";
import { downloadHtml, readHtmlFile, saveHtmlWithPicker } from "./file-io.js";
import { listenForPreview, renderPreview } from "./preview.js";

const $ = (selector) => document.querySelector(selector);
const editors = {
  manifest: $("#manifest-editor"), schema: $("#schema-editor"), i18n: $("#i18n-editor"), theme: $("#theme-editor"),
  template: $("#template-editor"), sampleData: $("#sample-editor")
};
let bus;
let webMcp;
let previewTimer;
let dirty = false;
let fingerprint = "sales-invoice-pilot";
let lastValidation;

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.add("hidden"), 3500);
}

function setEditors(project) {
  editors.manifest.value = stableStringify(project.manifest);
  editors.schema.value = stableStringify(project.schema);
  editors.i18n.value = stableStringify(project.i18n || {});
  editors.theme.value = project.themeCss;
  editors.template.value = project.templateHtml;
  editors.sampleData.value = stableStringify(project.sampleData);
  $("#locale-select").value = project.manifest.locale || "en-MY";
  $("#revision-label").textContent = `Revision ${bus.revision}`;
}

function renderQuality(validation) {
  lastValidation = validation;
  const summary = $("#quality-summary");
  summary.textContent = validation.productionValid
    ? `生产质量门通过 · ${validation.warnings.length} 项提醒`
    : `已阻断 · ${validation.errors.length} 项错误`;
  const list = $("#issue-list");
  list.replaceChildren();
  [...validation.errors, ...validation.warnings].slice(0, 30).forEach((item) => {
    const li = document.createElement("li");
    li.className = item.severity || (validation.errors.includes(item) ? "error" : "warning");
    li.textContent = `${item.code}: ${item.message}`;
    list.appendChild(li);
  });
  $("#export-button").disabled = !validation.productionValid;
  const review = validation.reviewReceipt;
  $("#review-status").textContent = review ? `通过 · Revision ${review.reviewedRevision}` : "待完成";
  $("#reset-trust-button").classList.toggle("hidden", bus.project.trust !== "untrusted");
}

function schedulePreview() {
  clearTimeout(previewTimer);
  renderQuality(bus.readiness());
  $("#render-status").className = "status pending";
  $("#render-status").textContent = "渲染中";
  previewTimer = setTimeout(async () => {
    try { await renderPreview($("#preview-frame"), bus.project, bus.revision); }
    catch (error) {
      $("#render-status").className = "status blocked";
      $("#render-status").textContent = "预览失败";
      toast(error.message);
    }
  }, 180);
}

function installBus(project, reason = "load") {
  webMcp?.dispose();
  bus = new CommandBus(project);
  installAgentGateway(bus);
  webMcp = installWebMcpAdapter(bus);
  $("#webmcp-status").textContent = webMcp.supported ? `已注册 ${webMcp.registered.length} tools` : "浏览器未启用（UI/CDP 可用）";
  bus.addEventListener("change", (event) => {
    dirty = true;
    setEditors(event.detail.project);
    renderQuality(bus.validation());
    schedulePreview();
    if (!$("#real-data-mode").checked) saveRecoveryDraft(event.detail.project, fingerprint);
  });
  bus.addEventListener("review", () => renderQuality(bus.readiness()));
  setEditors(project);
  renderQuality(bus.readiness());
  schedulePreview();
  if (reason !== "initial") toast(`已载入：${project.manifest.title || "PrintForm"}`);
}

function sourceOperations() {
  return [
    { type: "replace_manifest", value: JSON.parse(editors.manifest.value) },
    { type: "replace_schema", value: JSON.parse(editors.schema.value) },
    { type: "replace_i18n", value: JSON.parse(editors.i18n.value) },
    { type: "replace_theme", value: editors.theme.value },
    { type: "replace_template", value: editors.template.value },
    { type: "replace_sample_data", value: JSON.parse(editors.sampleData.value) }
  ];
}

async function applySource() {
  try {
    const operations = sourceOperations();
    const preview = await bus.execute("preview_changes", { expectedRevision: bus.revision, operations });
    if (!preview.ok) throw new Error(preview.error.message);
    const changed = preview.result.diff.changedSections.join(", ") || "无";
    const approved = window.confirm(`源码逃生口将修改：${changed}\n错误：${preview.result.validation.errors.length}\n确认原子应用到草稿？`);
    if (!approved) return;
    const result = await bus.execute("apply_changes", { expectedRevision: bus.revision, operations, reason: "human-approved source edit" });
    if (!result.ok) throw new Error(result.error.message);
    toast(`已应用 Revision ${result.result.revision}`);
  } catch (error) { toast(`无法应用：${error.message}`); }
}

async function applyLogoSources() {
  try {
    const sources = [["letterhead-logo", $("#letterhead-logo-source")], ["footer-logo", $("#footer-logo-source")]].filter(([, input]) => input.value.trim());
    if (!sources.length) throw new Error("请先填写至少一个 Logo URL");
    for (const [slot, input] of sources) {
      const result = await bus.execute("set_asset_source", { expectedRevision: bus.revision, slot, source: input.value.trim() });
      if (!result.ok) throw new Error(result.error.message);
      input.value = "";
    }
    toast("Logo 已写入隔离草稿；请等待重新分页并完成 AI 布局审查");
  } catch (error) { toast(`Logo 替换失败：${error.message}`); }
}

async function importFile(file) {
  try {
    const html = await readHtmlFile(file);
    const parsed = parseProjectHtml(html);
    const verified = await verifyImportedProject(parsed, html);
    const migration = analyzeMigration(verified.project);
    if (migration.action === "read-only") throw new Error(`Protocol ${migration.source} can only be opened read-only by this Studio version`);
    let project = verified.project;
    if (migration.action === "preview") {
      if (!window.confirm(`检测到协议 ${migration.source}。查看并应用到 ${migration.target} 的同主版本迁移草稿？`)) throw new Error("Migration was not approved");
      project = migration.candidate;
    }
    fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
    dirty = false;
    installBus(project, "import");
  } catch (error) { toast(`导入被拒绝：${error.message}`); }
}

async function exportDocument(trusted) {
  const blank = trusted ? null : window.open("", "_blank");
  try {
    let productionValidation;
    if (trusted) {
      const readiness = await bus.execute("request_export");
      if (!readiness.result?.ready) throw new Error("生产质量门尚未通过");
      productionValidation = readiness.result.validation;
      if (!window.confirm(`即将生成生产有效 HTML。\n错误 0；警告 ${readiness.result.validation.warnings.length}。\n请在下载后完成系统打印预览。`)) return;
    } else if (!window.confirm("此文件将标记为 Untrusted，不能作为 Studio 生产验证制品。继续？")) { blank?.close(); return; }
    const result = await createStandaloneHtml(bus.project, { requireTrusted: trusted, validation: productionValidation });
    const filename = `${bus.project.manifest.documentId || "printform"}${trusted ? "" : "-untrusted"}.html`;
    if (trusted && "showSaveFilePicker" in window) {
      const usePicker = window.confirm("使用浏览器“另存为”选择位置？选择取消将改用普通下载。 ");
      if (usePicker && await saveHtmlWithPicker(result.html, filename)) {
        dirty = false; clearRecoveryDraft(); toast(`已保存 ${filename}`); return;
      }
    }
    downloadHtml(result.html, filename);
    dirty = false; clearRecoveryDraft(); toast(`已导出 ${filename} · ${result.bytes} bytes`);
    blank?.close();
  } catch (error) { blank?.close(); toast(`导出失败：${error.message}`); }
}

async function openPrintPreview() {
  const target = window.open("", "_blank");
  if (!target) return toast("浏览器阻止了预览窗口");
  try {
    const result = await createStandaloneHtml(bus.project, { requireTrusted: false, networkDisabled: true });
    const url = URL.createObjectURL(new Blob([result.html], { type: "text/html" }));
    target.location = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) { target.close(); toast(error.message); }
}

function downloadDiagnostics() {
  const payload = { generatedAt: new Date().toISOString(), studio: "2.0.0", protocol: bus.project.manifest.protocolVersion, revision: bus.revision, trust: bus.project.trust, validation: lastValidation, userAgent: navigator.userAgent };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = "printform-diagnostics.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function resetTrust() {
  if (!window.confirm("确认已审查此项目？这会移除全部工程师自定义脚本，并在下次导出时换回 Studio 固定 runtime。")) return;
  const project = { ...bus.project, customScripts: [], trust: "trusted", trustReasons: [], runtime: null, attestation: null };
  installBus(project, "trust reset");
  dirty = true;
}

function bindUi() {
  $("#apply-source-button").addEventListener("click", applySource);
  $("#import-file").addEventListener("change", (event) => importFile(event.target.files[0]));
  $("#validate-button").addEventListener("click", () => { renderQuality(bus.readiness()); toast("已完成本地质量检查"); });
  $("#export-button").addEventListener("click", () => exportDocument(true));
  $("#export-untrusted-button").addEventListener("click", () => exportDocument(false));
  $("#print-button").addEventListener("click", openPrintPreview);
  $("#undo-button").addEventListener("click", async () => { const result = await bus.execute("undo_revision", { expectedRevision: bus.revision }); if (!result.ok) toast(result.error.message); });
  $("#scenario-select").addEventListener("change", async (event) => { const result = await bus.execute("set_sample_scenario", { expectedRevision: bus.revision, scenario: event.target.value }); if (!result.ok) toast(result.error.message); });
  $("#locale-select").addEventListener("change", async (event) => { const result = await bus.execute("set_locale", { expectedRevision: bus.revision, locale: event.target.value }); if (!result.ok) toast(result.error.message); });
  $("#apply-logo-button").addEventListener("click", applyLogoSources);
  $("#diagnostics-button").addEventListener("click", downloadDiagnostics);
  $("#reset-trust-button").addEventListener("click", resetTrust);
  $("#real-data-mode").addEventListener("change", (event) => { $("#data-policy").textContent = event.target.checked ? "真实数据：仅本会话，不缓存" : "仅合成数据"; if (event.target.checked) clearRecoveryDraft(); });
  window.addEventListener("beforeunload", (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
}

function setupRecovery() {
  const draft = loadRecoveryDraft();
  if (!draft) return;
  $("#restore-banner").classList.remove("hidden");
  $("#restore-button").addEventListener("click", () => { fingerprint = draft.fingerprint; installBus(draft.project, "recovery"); $("#restore-banner").classList.add("hidden"); });
  $("#discard-restore-button").addEventListener("click", () => { clearRecoveryDraft(); $("#restore-banner").classList.add("hidden"); });
}

function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").then((registration) => {
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) $("#update-banner").classList.remove("hidden"); });
    });
    $("#update-button").addEventListener("click", () => { if (dirty) return toast("请先导出或保存当前草稿"); registration.waiting?.postMessage({ type: "SKIP_WAITING" }); });
  }).catch((error) => console.warn("PWA registration failed", error));
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload());
}

listenForPreview((message) => {
  if (message.revision !== bus.revision) return;
  if (message.type === "rendered") {
    bus.recordRenderReport(message.payload);
    renderQuality(bus.readiness());
    const ready = message.payload.status === "ready";
    $("#render-status").className = `status ${ready ? "ready" : "blocked"}`;
    $("#render-status").textContent = ready ? "可打印" : "已阻断";
    $("#metrics-output").textContent = JSON.stringify(message.payload.metrics, null, 2);
  } else toast(`预览脚本错误：${message.payload.message}`);
});

bindUi();
installBus(createSalesInvoiceProject(), "initial");
setupRecovery();
setupServiceWorker();
loadRuntimeSources().catch((error) => toast(`Runtime 载入失败：${error.message}`));
