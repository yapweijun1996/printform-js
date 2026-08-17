import { createStandaloneHtml } from "../core/exporter.js";
import { parseProjectHtml, verifyImportedProject } from "../core/project-model.js";
import { analyzeMigration } from "../core/migrations.js";
import { sanitizeExecutableContent } from "../core/operations.js";
import { sanitizeValidation } from "../core/agent-sanitize.js";
import { renderDiffSections } from "./diff-view.js";
import { clearRecoveryDraft } from "./draft-cache.js";
import { downloadHtml, readHtmlFile, saveHtmlWithPicker } from "./file-io.js";
import { stableStringify } from "../core/json.js";
import { t } from "./ui-i18n.js";

const $ = (selector) => document.querySelector(selector);
const SECTION_META = {
  manifest: { editorKey: "manifest", labelKey: "section.manifest", json: true }, schema: { editorKey: "schema", labelKey: "section.schema", json: true },
  i18n: { editorKey: "i18n", labelKey: "section.translations", json: true }, themeCss: { editorKey: "theme", labelKey: "section.theme", json: false },
  templateHtml: { editorKey: "template", labelKey: "section.template", json: false }, sampleData: { editorKey: "sampleData", labelKey: "section.sample", json: true }
};

export function createStudioActions({ getBus, getFingerprint, setFingerprint, getDirty, setDirty, getEditor, installBus, toast }) {
  async function applyPreview(bus, preview, reason, requireValid = false) {
    const approved = await bus.execute("approve_transaction", {
      expectedRevision: preview.result.revision,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid,
    });
    if (!approved.ok) throw new Error(approved.error.message);
    return bus.execute("apply_changes", {
      expectedRevision: preview.result.revision,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid,
      reason,
    });
  }

  async function previewAndApply(bus, operations, reason, requireValid = false) {
    const preview = await bus.execute("preview_changes", { expectedRevision: bus.revision, operations });
    if (!preview.ok) throw new Error(preview.error.message);
    return applyPreview(bus, preview, reason, requireValid);
  }

  function sourceDiffSections(changedSections) {
    const bus = getBus();
    return changedSections.map((key) => {
      if (key === "trust") return { key, label: t("diff.trust"), isTrust: true, before: bus.project.trust, after: bus.project.trust === "trusted" ? "untrusted" : "trusted" };
      const meta = SECTION_META[key]; if (!meta) return null;
      const afterText = getEditor(meta.editorKey).value;
      const before = meta.json ? stableStringify(bus.project[key]) : String(bus.project[key] ?? "");
      const after = meta.json ? stableStringify(JSON.parse(afterText)) : afterText;
      return { key, label: t(meta.labelKey), before, after, truncatedLabel: t("diff.truncated") };
    }).filter(Boolean);
  }

  function showSourceDiff(changedSections, errorCount) {
    return new Promise((resolve) => {
      const modal = $("#source-diff-modal"); const apply = $("#source-diff-apply"); const cancel = $("#source-diff-cancel");
      $("#source-diff-summary").textContent = t("diff.summary", { count: changedSections.length, errors: errorCount }); renderDiffSections($("#source-diff-body"), sourceDiffSections(changedSections)); modal.classList.remove("hidden");
      const cleanup = (value) => { modal.classList.add("hidden"); apply.removeEventListener("click", onApply); cancel.removeEventListener("click", onCancel); modal.removeEventListener("click", onBackdrop); document.removeEventListener("keydown", onKeydown); resolve(value); };
      const onApply = () => cleanup(true); const onCancel = () => cleanup(false); const onBackdrop = (event) => { if (event.target === modal) cleanup(false); }; const onKeydown = (event) => { if (event.key === "Escape") cleanup(false); };
      apply.addEventListener("click", onApply); cancel.addEventListener("click", onCancel); modal.addEventListener("click", onBackdrop); document.addEventListener("keydown", onKeydown);
    });
  }

  async function applySource() {
    try {
      const bus = getBus(); const operations = getEditor("sourceOperations")(); const preview = await bus.execute("preview_changes", { expectedRevision: bus.revision, operations });
      if (!preview.ok) throw new Error(preview.error.message); if (!preview.result.diff.changed) return toast(t("toast.noChanges"));
      if (!await showSourceDiff(preview.result.diff.changedSections, preview.result.validation.errors.length)) return;
       const result = await applyPreview(bus, preview, "human-approved source edit"); if (!result.ok) throw new Error(result.error.message); toast(t("toast.applied", { revision: result.result.revision }));
    } catch (error) { toast(t("toast.applyFailed", { message: error.message })); }
  }

  async function applyLogoSources() {
    try { const bus = getBus(); const sources = [["letterhead-logo", $("#letterhead-logo-source")], ["footer-logo", $("#footer-logo-source")]].filter(([, input]) => input.value.trim()); if (!sources.length) throw new Error(t("error.logoRequired")); for (const [slot, input] of sources) { const result = await bus.execute("set_asset_source", { expectedRevision: bus.revision, slot, source: input.value.trim() }); if (!result.ok) throw new Error(result.error.message); input.value = ""; } toast(t("toast.logoApplied")); }
    catch (error) { toast(t("toast.logoFailed", { message: error.message })); }
  }

  async function applyOperation(operation, successKey, failureKey, reason) {
    try { const bus = getBus(); const result = await previewAndApply(bus, [operation], reason); if (!result.ok) throw new Error(result.error.message); toast(t(successKey)); }
    catch (error) { toast(t(failureKey, { message: error.message })); }
  }
  const applyFontScale = () => applyOperation({ type: "set_font_scale", basePt: Number($("#font-scale-input").value) }, "toast.fontScaleApplied", "toast.fontScaleFailed", "font scale");
  const applyBrandColor = () => applyOperation({ type: "set_brand_color", hex: $("#brand-color-text").value.trim() }, "toast.brandColorApplied", "toast.brandColorFailed", "brand color");
  const applyColumnWidths = (tableSelector, fields) => applyOperation({ type: "set_column_widths", tableSelector, widths: Array.from(fields.querySelectorAll("input"), (input) => input.value.trim()) }, "toast.columnWidthsApplied", "toast.columnWidthsFailed", "column widths");

  async function applyPageSettings() {
    try { const bus = getBus(); const operations = [{ type: "set_attribute", selector: ".printform", name: "data-papersize-width", value: $("#page-width-input").value }, { type: "set_attribute", selector: ".printform", name: "data-papersize-height", value: $("#page-height-input").value }]; const result = await previewAndApply(bus, operations, "page settings"); if (!result.ok) throw new Error(result.error.message); toast(t("toast.pageSettingsApplied")); }
    catch (error) { toast(t("toast.pageSettingsFailed", { message: error.message })); }
  }
  async function applyRepeatFlags() { const operations = Array.from($("#repeat-flags-fields").querySelectorAll("input"), (input) => ({ type: "set_attribute", selector: ".printform", name: input.dataset.attribute, value: input.checked ? "y" : "n" })); try { const bus = getBus(); const result = await previewAndApply(bus, operations, "repeated areas"); if (!result.ok) throw new Error(result.error.message); toast(t("toast.repeatFlagsApplied")); } catch (error) { toast(t("toast.repeatFlagsFailed", { message: error.message })); } }
  async function applyDataContract() { try { const bus = getBus(); const result = await previewAndApply(bus, getEditor("dataContractOperations")(), "data contract edit"); if (!result.ok) throw new Error(result.error.message); toast(t("toast.dataContractApplied")); } catch (error) { toast(t("toast.dataContractFailed", { message: error.message })); } }

  async function importFile(file) {
    try { const html = await readHtmlFile(file); const verified = await verifyImportedProject(parseProjectHtml(html), html); const migration = analyzeMigration(verified.project); if (migration.action === "read-only") throw new Error(t("error.protocolReadOnly", { source: migration.source })); let project = verified.project; if (migration.action === "preview") { if (!window.confirm(t("confirm.migration", { source: migration.source, target: migration.target }))) throw new Error(t("error.migrationRejected")); project = migration.candidate; } setFingerprint(`${file.name}:${file.size}:${file.lastModified}`); setDirty(false); installBus(project, "import"); }
    catch (error) { toast(t("toast.importRejected", { message: error.message })); }
  }

  async function exportDocument(trusted, { confirmExport = true } = {}) {
    const blank = trusted ? null : window.open("", "_blank");
    try { let validation; if (trusted) { const readiness = await getBus().execute("request_export"); if (!readiness.result?.ready) throw new Error(t("error.qualityNotReady")); validation = readiness.result.validation; if (!window.confirm(t("confirm.productionExport", { warnings: validation.warnings.length }))) return { ok: false, reason: "cancelled" }; } else if (confirmExport && !window.confirm(t("confirm.untrustedExport"))) { blank?.close(); return { ok: false, reason: "cancelled" }; }
      const bus = getBus(); const transactionId = trusted ? await bus.ensurePublishTransaction() : bus.transactionStore.head.transaction_id; const transaction = transactionId ? bus.getTransaction(transactionId) : null; const previewHash = transaction?.preview_hash || bus.renderReport?.provenance?.candidateHash; const result = await createStandaloneHtml(bus.project, { requireTrusted: trusted, validation, revision: bus.revision, previewHash, transactionId }); if (trusted && result.evidencePack) bus.recordEvidencePack(result.evidencePack); const filename = `${bus.project.manifest.documentId || "printform"}${trusted ? "" : "-untrusted"}.html`;
      if (trusted && "showSaveFilePicker" in window && window.confirm(t("confirm.savePicker")) && await saveHtmlWithPicker(result.html, filename, t("picker.description"))) { setDirty(false); clearRecoveryDraft(); toast(t("toast.saved", { filename })); return { ok: true, mode: "saved", filename }; }
      downloadHtml(result.html, filename); setDirty(false); clearRecoveryDraft(); toast(t("toast.exported", { filename, bytes: result.bytes })); blank?.close(); return { ok: true, mode: "download", filename };
    } catch (error) { blank?.close(); toast(t("toast.exportFailed", { message: error.message })); return { ok: false, reason: "failed", error }; }
  }

  function saveDraft() { return exportDocument(false, { confirmExport: false }); }

  async function openPrintPreview() { const bus = getBus(); if (bus.project.trust === "untrusted" || (bus.project.customScripts || []).length) return toast(t("error.printUntrusted", {}, "Print preview is disabled for untrusted documents.")); const target = window.open("", "_blank"); if (!target) return toast(t("toast.popupBlocked")); target.opener = null; try { const result = await createStandaloneHtml(bus.project, { requireTrusted: false, networkDisabled: true }); const url = URL.createObjectURL(new Blob([result.html], { type: "text/html" })); target.location = url; setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (error) { target.close(); toast(error.message); } }

  function downloadDiagnostics(lastValidation, studio, contract) { const bus = getBus(); const payload = { generatedAt: new Date().toISOString(), studio, agentContract: contract, protocol: bus.project.manifest.protocolVersion, revision: bus.revision, trust: bus.project.trust, validation: sanitizeValidation(lastValidation), userAgent: navigator.userAgent }; const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "printform-diagnostics.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000); }

  function resetTrust() { if (!window.confirm(t("confirm.resetTrust"))) return; const bus = getBus(); installBus({ ...bus.project, ...sanitizeExecutableContent(bus.project), customScripts: [], trust: "trusted", trustReasons: [], runtime: null, attestation: null }, "trust reset"); setDirty(true); }
  return { applySource, applyLogoSources, applyFontScale, applyBrandColor, applyColumnWidths, applyPageSettings, applyRepeatFlags, applyDataContract, importFile, exportDocument, saveDraft, openPrintPreview, downloadDiagnostics, resetTrust };
}
