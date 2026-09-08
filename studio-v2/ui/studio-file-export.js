import { createStandaloneHtml } from "../core/exporter.js";
import { assertPolicyCurrent, isPolicyCurrent, policyError } from "../core/data-policy.js";
import { downloadHtml, saveHtmlWithPicker } from "./file-io.js";
import { t } from "./ui-i18n.js";

export function createFileExport({ getBus, getDataPolicy, setDirty, setSaveState, toast }) {
  return async function exportDocument(trusted, { confirmExport = true } = {}) {
    const bus = getBus();
    const policy = getDataPolicy();
    const revision = bus?.revision;
    const documentId = bus?.project?.manifest?.documentId;
    const sameContext = () => getBus() === bus && getBus()?.project?.manifest?.documentId === documentId && isPolicyCurrent(policy, getDataPolicy());
    const currentSnapshot = () => sameContext() && bus.revision === revision;
    const assertCurrent = () => {
      if (!bus || !policy || !getDataPolicy()) throw policyError("FILE_CONTEXT_UNAVAILABLE");
      assertPolicyCurrent(policy, getDataPolicy());
      if (!currentSnapshot()) throw policyError("STALE_FILE_CONTEXT");
    };
    let blank = null;
    let saveAttempted = false;
    let confirmed = null;
    try {
      assertCurrent();
      const project = structuredClone(bus.project);
      blank = trusted ? null : window.open("", "_blank");
      let validation;
      if (trusted) {
        const readiness = await bus.execute("request_export");
        assertCurrent();
        if (!readiness.ok || !readiness.result?.ready) throw new Error(t("error.qualityNotReady"));
        validation = readiness.result.validation;
        if (!window.confirm(t("confirm.productionExport", { warnings: validation.warnings.length }))) {
          setSaveState("cancelled");
          return { ok: false, reason: "cancelled" };
        }
      } else if (confirmExport && !window.confirm(t("confirm.untrustedExport"))) {
        setSaveState("cancelled");
        blank?.close();
        return { ok: false, reason: "cancelled" };
      }
      assertCurrent();
      setSaveState("saving");
      saveAttempted = true;
      const transactionId = trusted ? await bus.ensurePublishTransaction() : bus.transactionStore.head.transaction_id;
      assertCurrent();
      const transaction = transactionId ? bus.getTransaction(transactionId) : null;
      const previewHash = transaction?.preview_hash || bus.renderReport?.provenance?.candidateHash;
      const result = await createStandaloneHtml(project, {
        requireTrusted: trusted, validation, revision, previewHash, transactionId, dataPolicy: policy, assertCurrent
      });
      assertCurrent();
      if (trusted && result.evidencePack) bus.recordEvidencePack(result.evidencePack);
      const filename = `${documentId || "printform"}${trusted ? "" : "-untrusted"}.html`;
      if (trusted && "showSaveFilePicker" in window && window.confirm(t("confirm.savePicker"))
        && await saveHtmlWithPicker(result.html, filename, t("picker.description"), { assertCurrent })) {
        confirmed = { ok: true, mode: "saved", filename, stale: !currentSnapshot() };
        if (sameContext()) {
          setDirty(!currentSnapshot());
          setSaveState(currentSnapshot() ? "saved" : "unsaved");
        }
        toast(t("toast.saved", { filename }));
        return confirmed;
      }
      assertCurrent();
      downloadHtml(result.html, filename);
      confirmed = { ok: true, mode: "download-started", filename, saved: false };
      setSaveState("download-started");
      toast(t("toast.downloadStarted", { filename, bytes: result.bytes }));
      blank?.close();
      return confirmed;
    } catch (error) {
      blank?.close();
      // Feedback failure cannot undo or reclassify a confirmed file write/download request.
      if (confirmed) return { ...confirmed, feedbackFailed: true };
      const cancelled = error?.name === "AbortError";
      const unconfirmed = error?.code === "FILE_WRITE_UNCONFIRMED";
      const stale = ["STALE_FILE_CONTEXT", "STALE_POLICY_CONTEXT", "FILE_CONTEXT_UNAVAILABLE"].includes(error?.code);
      if (sameContext()) setSaveState(stale ? "unsaved" : unconfirmed ? "unconfirmed" : cancelled ? "cancelled" : saveAttempted ? "failed" : "unsaved");
      toast(t(unconfirmed ? "toast.saveUnconfirmed" : cancelled ? "toast.exportCancelled" : "toast.exportFailed", { message: error.message }));
      return { ok: false, reason: stale ? "stale" : unconfirmed ? "unconfirmed" : cancelled ? "cancelled" : "failed", error };
    }
  };
}
