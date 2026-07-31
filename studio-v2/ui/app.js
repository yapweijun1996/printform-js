import { CommandBus } from "../core/command-bus.js";
import { createStandaloneHtml, loadRuntimeSources } from "../core/exporter.js";
import { parseProjectHtml, verifyImportedProject } from "../core/project-model.js";
import { stableStringify } from "../core/json.js";
import { analyzeMigration } from "../core/migrations.js";
import { currentFontBasePt } from "../core/typography.js";
import { inspectColumnGroups } from "../core/column-inspection.js";
import { createSampleDocument, sampleDocumentKey } from "../samples/catalog.js";
import { installAgentGateway } from "../adapters/gateway.js";
import { sanitizeExecutableContent } from "../core/operations.js";
import { installWebMcpAdapter } from "../adapters/webmcp.js";
import { clearRecoveryDraft, loadRecoveryDraft, saveRecoveryDraft } from "./draft-cache.js";
import { downloadHtml, readHtmlFile, saveHtmlWithPicker } from "./file-io.js";
import { listenForPreview, renderPreview, setPreviewOverlayEnabled } from "./preview.js";
import { renderDiffSections } from "./diff-view.js";
import { currentUiLocale, initUiI18n, setUiLocale, t } from "./ui-i18n.js";
import { renderContractVersion, renderDataPolicy, renderMetrics, renderQualityView, renderStatus, renderWebMcpStatus, refreshStatusText } from "./status-view.js";

const $ = (selector) => document.querySelector(selector);
const editors = {
  manifest: $("#manifest-editor"), schema: $("#schema-editor"), i18n: $("#i18n-editor"), theme: $("#theme-editor"),
  template: $("#template-editor"), sampleData: $("#sample-editor")
};
let bus;
let webMcp;
let previewTimer;
let overlayEnabled = true;
let dirty = false;
let activeSampleKey = sampleDocumentKey();
let fingerprint = createSampleDocument(activeSampleKey).manifest.documentId;
let lastValidation;

// Shared ordering space for the ONE visible #preview-frame: every render
// request (human-edit debounce, or an agent's preview_changes/apply_changes
// candidate) claims the next token before touching the iframe. Candidate
// requests register themselves here and are resolved/rejected by the shared
// listenForPreview callback below when their token comes back; the
// committed-state path doesn't need to register (message.revision already
// disambiguates it against bus.revision) but still draws from the same
// counter so the two paths can never collide on a token value.
let previewToken = 0;
const pendingCandidateRenders = new Map();
// Generous on purpose: a full candidate render pays for iframe reload +
// runtime fetch + serializing the whole project (not just PrintForm's own
// pagination, which is the only thing the 100/500-row perf BUDGET test
// measures) — empirically well past a few seconds for large boundary
// scenarios at non-default font scale. This is a "something is actually
// stuck" backstop, not a perf budget; the committed-state schedulePreview()
// path has no timeout at all today and this should not be tighter than that
// without real profiling data (see ROADMAP.md P2/E9 — pagination perf work
// is explicitly future, unstarted).
const CANDIDATE_RENDER_TIMEOUT_MS = 30_000;

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
  $("#font-scale-input").value = currentFontBasePt(project.themeCss);
  renderColumnWidthGroups(inspectColumnGroups(project.templateHtml, project));
}

// Rebuilt from the template on every load/change (same as the raw editors
// above) rather than diffed in place — column groups can appear, disappear,
// or change column count across an arbitrary template edit, so there is no
// stable identity to patch against.
function renderColumnWidthGroups(groups) {
  const container = $("#column-widths-groups");
  container.innerHTML = "";
  groups.forEach((group) => {
    const wrapper = document.createElement("div");
    wrapper.className = "column-widths-group";
    const fields = document.createElement("div");
    fields.className = "column-widths-fields";
    group.columns.forEach((column) => {
      const label = document.createElement("label");
      label.textContent = column.label;
      const input = document.createElement("input");
      input.type = "text";
      input.value = column.width;
      input.placeholder = t("editor.columnWidthPlaceholder");
      label.appendChild(input);
      fields.appendChild(label);
    });
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = t("editor.applyColumnWidths");
    button.addEventListener("click", () => applyColumnWidths(group.tableSelector, fields));
    wrapper.append(fields, button);
    container.appendChild(wrapper);
  });
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
    const token = ++previewToken;
    try { await renderPreview($("#preview-frame"), bus.project, bus.revision, overlayEnabled, token); }
    catch (error) {
      renderStatus("status.failed", "blocked");
      toast(error.message);
    }
  }, 180);
}

function setCandidatePreviewBanner(active) {
  $("#candidate-preview-banner").classList.toggle("hidden", !active);
}

// Injected into CommandBus so preview_changes/apply_changes can get a REAL
// render (not just static schema validation) by reusing this one visible
// iframe instead of standing up a second hidden one. Runs concurrently with
// schedulePreview()'s own committed-state renders; both share the token
// counter and the same listenForPreview callback below, so a reply can only
// ever be claimed by the request that's actually still waiting on it.
function renderCandidateForPreview(project, revision) {
  const token = ++previewToken;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingCandidateRenders.delete(token)) reject(new Error("Candidate render timed out"));
      if (!pendingCandidateRenders.size) setCandidatePreviewBanner(false);
    }, CANDIDATE_RENDER_TIMEOUT_MS);
    pendingCandidateRenders.set(token, { resolve, reject, timer });
    setCandidatePreviewBanner(true);
    renderPreview($("#preview-frame"), project, revision, overlayEnabled, token).catch((error) => {
      if (pendingCandidateRenders.delete(token)) { clearTimeout(timer); reject(error); }
      if (!pendingCandidateRenders.size) setCandidatePreviewBanner(false);
    });
  });
}

function installBus(project, reason = "load") {
  webMcp?.dispose();
  pendingCandidateRenders.forEach(({ reject, timer }) => { clearTimeout(timer); reject(new Error("Studio project was replaced before the candidate render finished")); });
  pendingCandidateRenders.clear();
  setCandidatePreviewBanner(false);
  bus = new CommandBus(project, { renderCandidate: renderCandidateForPreview });
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

// Maps diffProjects' changedSections keys to the editor that owns them and
// the i18n key already used for that editor's <summary> label — reusing the
// existing labels keeps the diff panel's section names consistent with the
// editor panel instead of introducing a second, parallel set of names.
const SOURCE_SECTION_META = {
  manifest: { editorKey: "manifest", labelKey: "section.manifest", json: true },
  schema: { editorKey: "schema", labelKey: "section.schema", json: true },
  i18n: { editorKey: "i18n", labelKey: "section.translations", json: true },
  themeCss: { editorKey: "theme", labelKey: "section.theme", json: false },
  templateHtml: { editorKey: "template", labelKey: "section.template", json: false },
  sampleData: { editorKey: "sampleData", labelKey: "section.sample", json: true }
};

function buildDiffSections(changedSections) {
  return changedSections.map((key) => {
    if (key === "trust") {
      return { key, label: t("diff.trust"), isTrust: true, before: bus.project.trust, after: bus.project.trust === "trusted" ? "untrusted" : "trusted" };
    }
    const meta = SOURCE_SECTION_META[key];
    if (!meta) return null;
    const editorValue = editors[meta.editorKey].value;
    // Both sides go through the SAME stableStringify() the project's own
    // diffProjects() uses for JSON sections, so key-reordering with no real
    // value change never shows as a spurious full-section diff here either.
    const before = meta.json ? stableStringify(bus.project[key]) : String(bus.project[key] ?? "");
    const after = meta.json ? stableStringify(JSON.parse(editorValue)) : editorValue;
    return { key, label: t(meta.labelKey), before, after, truncatedLabel: t("diff.truncated") };
  }).filter(Boolean);
}

function showSourceDiff(changedSections, errorCount) {
  return new Promise((resolve) => {
    const modal = $("#source-diff-modal");
    const applyBtn = $("#source-diff-apply");
    const cancelBtn = $("#source-diff-cancel");
    $("#source-diff-summary").textContent = t("diff.summary", { count: changedSections.length, errors: errorCount });
    renderDiffSections($("#source-diff-body"), buildDiffSections(changedSections));
    modal.classList.remove("hidden");

    function cleanup(result) {
      modal.classList.add("hidden");
      applyBtn.removeEventListener("click", onApply);
      cancelBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    }
    function onApply() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onBackdrop(event) { if (event.target === modal) cleanup(false); }
    function onKeydown(event) { if (event.key === "Escape") cleanup(false); }

    applyBtn.addEventListener("click", onApply);
    cancelBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKeydown);
  });
}

async function applySource() {
  try {
    const operations = sourceOperations();
    const preview = await bus.execute("preview_changes", { expectedRevision: bus.revision, operations });
    if (!preview.ok) throw new Error(preview.error.message);
    if (!preview.result.diff.changed) { toast(t("toast.noChanges")); return; }
    const approved = await showSourceDiff(preview.result.diff.changedSections, preview.result.validation.errors.length);
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

// set_font_scale/set_column_widths are operation TYPES (operation-schemas.js),
// not their own CommandBus tools — unlike set_locale/set_asset_source, they
// carry no extra business rule beyond generic operation validation, so they
// go through the generic apply_changes tool directly (same no-modal,
// direct-apply pattern; just without a dedicated wrapper tool).
async function applyFontScale() {
  try {
    const basePt = Number($("#font-scale-input").value);
    const operations = [{ type: "set_font_scale", basePt }];
    const result = await bus.execute("apply_changes", { expectedRevision: bus.revision, operations, reason: `font scale: ${basePt}pt` });
    if (!result.ok) throw new Error(result.error.message);
    toast(t("toast.fontScaleApplied"));
  } catch (error) { toast(t("toast.fontScaleFailed", { message: error.message })); }
}

async function applyColumnWidths(tableSelector, fieldsContainer) {
  try {
    const widths = Array.from(fieldsContainer.querySelectorAll("input")).map((input) => input.value.trim());
    const operations = [{ type: "set_column_widths", tableSelector, widths }];
    const result = await bus.execute("apply_changes", { expectedRevision: bus.revision, operations, reason: `column widths: ${tableSelector}` });
    if (!result.ok) throw new Error(result.error.message);
    toast(t("toast.columnWidthsApplied"));
  } catch (error) { toast(t("toast.columnWidthsFailed", { message: error.message })); }
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
  // The raw editors above are plain textareas (data-ui-i18n handles their
  // static labels), but this panel's button text/placeholders are generated
  // in JS at render time and are otherwise invisible to applyMessages().
  renderColumnWidthGroups(inspectColumnGroups(bus.project.templateHtml, bus.project));
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
  $("#apply-font-scale-button").addEventListener("click", applyFontScale);
  $("#document-select").addEventListener("change", (event) => selectSample(event.target.value));
  $("#diagnostics-button").addEventListener("click", downloadDiagnostics);
  $("#reset-trust-button").addEventListener("click", resetTrust);
  $("#ui-locale-select").addEventListener("change", changeUiLocale);
  $("#real-data-mode").addEventListener("change", (event) => { renderDataPolicy(event.target.checked); if (event.target.checked) clearRecoveryDraft(); });
  window.addEventListener("printform:ui-locale", refreshLocalizedUi);
  window.addEventListener("beforeunload", (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
  $("#overlay-toggle").addEventListener("change", (event) => {
    overlayEnabled = event.target.checked;
    setPreviewOverlayEnabled($("#preview-frame"), overlayEnabled);
  });
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
  const pendingCandidate = pendingCandidateRenders.get(message.token);
  if (pendingCandidate) {
    pendingCandidateRenders.delete(message.token);
    clearTimeout(pendingCandidate.timer);
    if (!pendingCandidateRenders.size) setCandidatePreviewBanner(false);
    if (message.type === "rendered") pendingCandidate.resolve(message.payload);
    else pendingCandidate.reject(new Error(message.payload?.message || "Candidate render failed"));
    return;
  }
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
renderContractVersion();
bindUi();
$("#document-select").value = activeSampleKey;
installBus(createSampleDocument(activeSampleKey), "initial");
setupRecovery();
setupServiceWorker();
loadRuntimeSources().catch((error) => toast(t("toast.runtimeFailed", { message: error.message })));
