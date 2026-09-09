export function createStudioActions(app) {
  const { state } = app;

  function setActiveSide(side) {
    state.activeSide = side;
    app.$("#side-a-btn").classList.toggle("active", side === "A");
    app.$("#side-b-btn").classList.toggle("active", side === "B");
    app.buildConfigPanel();
    app.renderMetrics();
    app.renderLogs();
  }

  function setCompare(on) {
    state.compare = on;
    app.$("#compare-toggle").classList.toggle("toggled", on);
    app.$("#slot-b").style.display = on ? "" : "none";
    app.$("#ab-selector").classList.toggle("visible", on);
    if (!on) setActiveSide("A");
    app.persist();
    if (on) app.reload("B");
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    app.$("#mode-toggle").textContent = app.t(mode === "structure" ? "modePreview" : "modeStructure");
    app.$("#mode-toggle").classList.toggle("toggled", mode === "structure");
    app.$("#block-editor").style.display = mode === "structure" ? "" : "none";
    state.selectedBlockIndex = null;
    app.$("#be-selected").style.display = "none";
    app.$("#row-count-range").disabled = true;
    app.reloadAll();
  }

  function warnIfPrintformNotInlined() {
    if (state.printformSource) return;
    app.addLog(state.activeSide, { level: "warn", text: app.t("printformNotInlined") });
  }

  function exportHtml() {
    warnIfPrintformNotInlined();
    const html = app.synthesizeHtml(state.activeSide, true);
    if (html === null) return;
    const blob = new Blob([html], { type: "text/html" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${state.templateId}-configured.html`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 5000);
  }

  function exportDataPackage() {
    warnIfPrintformNotInlined();
    const html = app.synthesizePackageHtml();
    if (html === null) return;
    const blob = new Blob([html], { type: "text/html" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${state.templateId}-package.html`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 5000);
  }

  function openPrintPreview() {
    const html = app.synthesizeHtml(state.activeSide, false, true);
    if (html === null) return;
    const preview = window.open("about:blank");
    if (!preview) {
      app.addLog(state.activeSide, { level: "warn", text: app.t("popupBlocked") });
      return;
    }
    preview.document.open();
    preview.document.write(html);
    preview.document.close();
  }

  function copyConfigJson() {
    const json = JSON.stringify(app.currentOverrides(), null, 2);
    navigator.clipboard.writeText(json).then(() => {
      const button = app.$("#copy-config");
      const original = button.textContent;
      button.textContent = app.t("copied");
      setTimeout(() => { button.textContent = original; }, 1200);
    });
  }

  function showConfirm(message) {
    return new Promise((resolve) => {
      const modal = app.$("#confirm-modal");
      const okButton = app.$("#confirm-modal-ok");
      const cancelButton = app.$("#confirm-modal-cancel");
      app.$("#confirm-modal-text").textContent = message;
      modal.style.display = "flex";

      function cleanup(result) {
        modal.style.display = "none";
        okButton.removeEventListener("click", onOk);
        cancelButton.removeEventListener("click", onCancel);
        modal.removeEventListener("click", onBackdrop);
        document.removeEventListener("keydown", onKeydown);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onBackdrop(event) { if (event.target === modal) cleanup(false); }
      function onKeydown(event) { if (event.key === "Escape") cleanup(false); }
      okButton.addEventListener("click", onOk);
      cancelButton.addEventListener("click", onCancel);
      modal.addEventListener("click", onBackdrop);
      document.addEventListener("keydown", onKeydown);
    });
  }

  function resetAll() {
    showConfirm(app.t("resetConfirm")).then((ok) => {
      if (!ok) return;
      state.overrides[state.activeSide] = {};
      app.persist();
      app.buildConfigPanel();
      app.scheduleReload(state.activeSide);
    });
  }

  function setupRestoreBanner() {
    const countA = Object.keys(state.overrides.A).length;
    const countB = Object.keys(state.overrides.B).length;
    if (countA + countB === 0) return;
    const banner = app.$("#restore-banner");
    const text = app.$("#restore-banner-text");
    text.textContent = app.t("restoredNotice").replace("{a}", countA).replace("{b}", countB);
    banner.style.display = "";
    app.$("#restore-banner-dismiss").addEventListener("click", () => { banner.style.display = "none"; });
    app.$("#restore-banner-reset").addEventListener("click", () => {
      state.overrides = { A: {}, B: {} };
      app.persist();
      app.buildConfigPanel();
      app.reloadAll();
      banner.style.display = "none";
    });
  }

  return {
    setActiveSide, setCompare, setViewMode, warnIfPrintformNotInlined,
    exportHtml, exportDataPackage, openPrintPreview, copyConfigJson, showConfirm,
    resetAll, setupRestoreBanner
  };
}
