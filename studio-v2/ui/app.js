import { CommandBus } from "../core/command-bus.js";
import { createStandaloneHtml, loadRuntimeSources } from "../core/exporter.js";
import { parseProjectHtml, verifyImportedProject } from "../core/project-model.js";
import { stableStringify } from "../core/json.js";
import { analyzeMigration } from "../core/migrations.js";
import { createSampleDocument, sampleDocumentKey } from "../samples/catalog.js";
import { installAgentGateway } from "../adapters/gateway.js";
import { sanitizeExecutableContent } from "../core/operations.js";
import { installWebMcpAdapter } from "../adapters/webmcp.js";
import { clearRecoveryDraft, loadRecoveryDraft, saveRecoveryDraft } from "./draft-cache.js";
import { downloadHtml, readHtmlFile, saveHtmlWithPicker } from "./file-io.js";
import { listenForPreview, renderPreview } from "./preview.js";
import { currentUiLocale, initUiI18n, setUiLocale, t } from "./ui-i18n.js";
import { renderDataPolicy, renderMetrics, renderQualityView, renderStatus, renderWebMcpStatus, refreshStatusText } from "./status-view.js";

const $ = (selector) => document.querySelector(selector);
const editors = {
  manifest: $("#manifest-editor"), schema: $("#schema-editor"), i18n: $("#i18n-editor"), theme: $("#theme-editor"),
  template: $("#template-editor"), sampleData: $("#sample-editor")
};
let bus;
let webMcp;
let previewTimer;
let dirty = false;
let activeSampleKey = sampleDocumentKey();
let fingerprint = createSampleDocument(activeSampleKey).manifest.documentId;
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
  $("#revision-label").textContent = t("editor.revision", { revision: bus.revision });
}

function renderQuality(validation) {
  lastValidation = validation;
  renderQualityView(validation, bus.project.trust);
}

function schedulePreview() {
  clearTimeout(previewTimer);
  renderQuality(bus.readiness());
  renderStatus("status.rendering", "pending");
  previewTimer = setTimeout(async () => {
    try { await renderPreview($("#preview-frame"), bus.project, bus.revision); }
    catch (error) {
      renderStatus("status.failed", "blocked");
      toast(error.message);
    }
  }, 180);
}

function installBus(project, reason = "load") {
  webMcp?.dispose();
  bus = new CommandBus(project);
  installAgentGateway(bus);
  webMcp = installWebMcpAdapter(bus);
  renderWebMcpStatus(webMcp);
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
  if (reason !== "initial") toast(t("toast.loaded", { title: project.manifest.title || "PrintForm" }));
}

function selectSample(key) {
  if (dirty && !window.confirm(t("confirm.discardSample"))) {
    $("#document-select").value = activeSampleKey;
    return;
  }
  activeSampleKey = key;
  const project = createSampleDocument(key);
  fingerprint = project.manifest.documentId;
  dirty = false;
  history.replaceState(null, "", `${location.pathname}?sample=${encodeURIComponent(key)}`);
  installBus(project, "sample");
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
    const changed = preview.result.diff.changedSections.join(", ") || t("source.none");
    const approved = window.confirm(t("confirm.applySource", { changed, errors: preview.result.validation.errors.length }));
    if (!approved) return;
    const result = await bus.execute("apply_changes", { expectedRevision: bus.revision, operations, reason: "human-approved source edit" });
    if (!result.ok) throw new Error(result.error.message);
    toast(t("toast.applied", { revision: result.result.revision }));
  } catch (error) { toast(t("toast.applyFailed", { message: error.message })); }
}

async function applyLogoSources() {
  try {
    const sources = [["letterhead-logo", $("#letterhead-logo-source")], ["footer-logo", $("#footer-logo-source")]].filter(([, input]) => input.value.trim());
    if (!sources.length) throw new Error(t("error.logoRequired"));
    for (const [slot, input] of sources) {
      const result = await bus.execute("set_asset_source", { expectedRevision: bus.revision, slot, source: input.value.trim() });
      if (!result.ok) throw new Error(result.error.message);
      input.value = "";
    }
    toast(t("toast.logoApplied"));
  } catch (error) { toast(t("toast.logoFailed", { message: error.message })); }
}

async function importFile(file) {
  try {
    const html = await readHtmlFile(file);
    const parsed = parseProjectHtml(html);
    const verified = await verifyImportedProject(parsed, html);
    const migration = analyzeMigration(verified.project);
    if (migration.action === "read-only") throw new Error(t("error.protocolReadOnly", { source: migration.source }));
    let project = verified.project;
    if (migration.action === "preview") {
      if (!window.confirm(t("confirm.migration", { source: migration.source, target: migration.target }))) throw new Error(t("error.migrationRejected"));
      project = migration.candidate;
    }
    fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
    dirty = false;
    installBus(project, "import");
  } catch (error) { toast(t("toast.importRejected", { message: error.message })); }
}

async function exportDocument(trusted) {
  const blank = trusted ? null : window.open("", "_blank");
  try {
    let productionValidation;
    if (trusted) {
      const readiness = await bus.execute("request_export");
      if (!readiness.result?.ready) throw new Error(t("error.qualityNotReady"));
      productionValidation = readiness.result.validation;
      if (!window.confirm(t("confirm.productionExport", { warnings: readiness.result.validation.warnings.length }))) return;
    } else if (!window.confirm(t("confirm.untrustedExport"))) { blank?.close(); return; }
    const result = await createStandaloneHtml(bus.project, { requireTrusted: trusted, validation: productionValidation });
    const filename = `${bus.project.manifest.documentId || "printform"}${trusted ? "" : "-untrusted"}.html`;
    if (trusted && "showSaveFilePicker" in window) {
      const usePicker = window.confirm(t("confirm.savePicker"));
      if (usePicker && await saveHtmlWithPicker(result.html, filename, t("picker.description"))) {
        dirty = false; clearRecoveryDraft(); toast(t("toast.saved", { filename })); return;
      }
    }
    downloadHtml(result.html, filename);
    dirty = false; clearRecoveryDraft(); toast(t("toast.exported", { filename, bytes: result.bytes }));
    blank?.close();
  } catch (error) { blank?.close(); toast(t("toast.exportFailed", { message: error.message })); }
}

async function openPrintPreview() {
  // A blob: URL inherits the Studio's origin. Never navigate a window that
  // still holds window.opener to a document that may embed custom scripts —
  // an imported untrusted file could read opener.localStorage (recovery
  // drafts with real data) and drive the agent gateway from inside the page.
  if (bus.project.trust === "untrusted" || (bus.project.customScripts || []).length) {
    return toast(t("error.printUntrusted", {}, "Print preview is disabled for untrusted documents. Review and reset trust first."));
  }
  const target = window.open("", "_blank");
  if (!target) return toast(t("toast.popupBlocked"));
  target.opener = null;
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
  if (!window.confirm(t("confirm.resetTrust"))) return;
  // Flipping the flag alone would re-trust a template that still contains the
  // <script> which demoted it — strip executable content at the same time.
  const sanitized = sanitizeExecutableContent(bus.project);
  const project = { ...bus.project, ...sanitized, customScripts: [], trust: "trusted", trustReasons: [], runtime: null, attestation: null };
  installBus(project, "trust reset");
  dirty = true;
}

async function changeUiLocale(event) {
  const previous = currentUiLocale();
  try { await setUiLocale(event.target.value); }
  catch {
    event.target.value = previous;
    toast(t("toast.languageFailed"));
  }
}

function refreshLocalizedUi() {
  if (!bus) return;
  renderQuality(lastValidation || bus.readiness());
  renderWebMcpStatus(webMcp);
  renderDataPolicy($("#real-data-mode").checked);
  refreshStatusText();
  $("#revision-label").textContent = t("editor.revision", { revision: bus.revision });
}

function bindUi() {
  $("#apply-source-button").addEventListener("click", applySource);
  $("#import-file").addEventListener("change", (event) => importFile(event.target.files[0]));
  $("#validate-button").addEventListener("click", () => { renderQuality(bus.readiness()); toast(t("toast.validationDone")); });
  $("#export-button").addEventListener("click", () => exportDocument(true));
  $("#export-untrusted-button").addEventListener("click", () => exportDocument(false));
  $("#print-button").addEventListener("click", openPrintPreview);
  $("#undo-button").addEventListener("click", async () => { const result = await bus.execute("undo_revision", { expectedRevision: bus.revision }); if (!result.ok) toast(result.error.message); });
  $("#scenario-select").addEventListener("change", async (event) => { const result = await bus.execute("set_sample_scenario", { expectedRevision: bus.revision, scenario: event.target.value }); if (!result.ok) toast(result.error.message); });
  $("#locale-select").addEventListener("change", async (event) => { const result = await bus.execute("set_locale", { expectedRevision: bus.revision, locale: event.target.value }); if (!result.ok) toast(result.error.message); });
  $("#apply-logo-button").addEventListener("click", applyLogoSources);
  $("#document-select").addEventListener("change", (event) => selectSample(event.target.value));
  $("#diagnostics-button").addEventListener("click", downloadDiagnostics);
  $("#reset-trust-button").addEventListener("click", resetTrust);
  $("#ui-locale-select").addEventListener("change", changeUiLocale);
  $("#real-data-mode").addEventListener("change", (event) => { renderDataPolicy(event.target.checked); if (event.target.checked) clearRecoveryDraft(); });
  window.addEventListener("printform:ui-locale", refreshLocalizedUi);
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
    // A worker can already be waiting when the page loads (user ignored the
    // banner and reloaded) — updatefound never fires for it.
    if (registration.waiting && navigator.serviceWorker.controller) $("#update-banner").classList.remove("hidden");
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) $("#update-banner").classList.remove("hidden"); });
    });
    $("#update-button").addEventListener("click", () => { if (dirty) return toast(t("toast.saveBeforeUpdate")); registration.waiting?.postMessage({ type: "SKIP_WAITING" }); });
  }).catch((error) => console.warn("PWA registration failed", error));
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload());
}

listenForPreview($("#preview-frame"), (message) => {
  if (message.revision !== bus.revision) return;
  if (message.type === "rendered") {
    bus.recordRenderReport(message.payload);
    renderQuality(bus.readiness());
    const ready = message.payload.status === "ready";
    renderStatus(ready ? "status.ready" : "status.blocked", ready ? "ready" : "blocked");
    renderMetrics(message.payload.issues?.length ? { ...message.payload.metrics, issues: message.payload.issues } : message.payload.metrics);
  } else toast(t("toast.previewError", { message: message.payload.message }));
});

await initUiI18n();
bindUi();
$("#document-select").value = activeSampleKey;
installBus(createSampleDocument(activeSampleKey), "initial");
setupRecovery();
setupServiceWorker();
loadRuntimeSources().catch((error) => toast(t("toast.runtimeFailed", { message: error.message })));
