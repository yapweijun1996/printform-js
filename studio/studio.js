import { createStudioState, persistStudioState } from "./studio-state.js";
import { classify, escapeAttribute, query } from "./studio-dom.js";
import { createStudioI18n } from "./studio-i18n.js";
import { createConfigController } from "./studio-config.js";
import { createDataController } from "./studio-data.js";
import { createDocumentController } from "./studio-document.js";
import { createPreviewController } from "./studio-preview.js";
import { createTemplateController } from "./studio-templates.js";
import { createStudioActions } from "./studio-actions.js";
import { createResponsiveController } from "./studio-responsive.js";

const app = {
  state: createStudioState(),
  $: query,
  classify,
  escapeAttribute,
  persist() { persistStudioState(this.state); }
};

Object.assign(app, createStudioI18n(app.state, app.$));
Object.assign(app, createDataController(app));
Object.assign(app, createConfigController(app));
Object.assign(app, createDocumentController(app));
Object.assign(app, createPreviewController(app));
Object.assign(app, createTemplateController(app));
Object.assign(app, createStudioActions(app));
Object.assign(app, createResponsiveController(app));

const { state } = app;
let checkTopbarFit = null;

function boot() {
  app.applyI18n();
  checkTopbarFit = app.setupResponsiveTopbar();
  app.setupMobilePanels();
  app.setupPreviewScaling();
  app.setupRestoreBanner();

  fetch("./mustache-lite.js")
    .then((response) => response.text())
    .then((source) => { state.mustacheLiteSource = source; })
    .catch(() => { /* package export is unavailable without the helper source */ });

  Promise.all([
    fetch("../docs/config-reference.json").then((response) => response.json()),
    fetch("./templates.json").then((response) => response.json())
  ]).then((results) => {
    const configReference = results[0];
    state.descriptors = (configReference.mainConfig || []).concat(configReference.paddtConfig || []);
    state.templates = results[1].templates || [];
    if (!state.templateId || !state.templates.some((template) => template.id === state.templateId)) {
      state.templateId = state.templates[0] && state.templates[0].id;
    }
    app.buildTemplatePicker();
    app.buildConfigPanel();
    if (state.compare) app.setCompare(true);
    return app.loadTemplate(state.templateId);
  }).catch((error) => {
    app.$("#log-view").innerHTML = `<div class="error">boot failed: ${app.escapeAttribute(error.message)}</div>`;
  });

  app.$("#template-select").addEventListener("change", (event) => app.loadTemplate(event.target.value));
  app.$("#lang-toggle").addEventListener("click", () => {
    state.lang = state.lang === "zh" ? "en" : "zh";
    app.persist();
    app.applyI18n();
    app.buildTemplatePicker();
    app.buildConfigPanel();
    ["A", "B"].forEach((side) => {
      const metrics = state.metrics[side];
      if (metrics) {
        const status = side === "A" ? app.$("#status-a") : app.$("#status-b");
        status.textContent = `${metrics.logicalPages} ${app.t("pages")}`;
      }
    });
    app.$("#mode-toggle").textContent = app.t(state.viewMode === "structure" ? "modePreview" : "modeStructure");
    if (checkTopbarFit) checkTopbarFit();
    const banner = app.$("#restore-banner");
    if (banner.style.display !== "none") {
      const countA = Object.keys(state.overrides.A).length;
      const countB = Object.keys(state.overrides.B).length;
      app.$("#restore-banner-text").textContent = app.t("restoredNotice").replace("{a}", countA).replace("{b}", countB);
    }
  });
  app.$("#compare-toggle").addEventListener("click", () => app.setCompare(!state.compare));
  app.$("#mode-toggle").addEventListener("click", () => app.setViewMode(state.viewMode === "structure" ? "preview" : "structure"));
  app.$("#toggle-config").addEventListener("click", () => document.body.classList.toggle("hide-config"));
  app.$("#toggle-inspector").addEventListener("click", () => document.body.classList.toggle("hide-inspector"));
  app.$("#export-html").addEventListener("click", app.exportHtml);
  app.$("#print-preview").addEventListener("click", app.openPrintPreview);
  app.$("#import-html").addEventListener("click", () => app.$("#import-file-input").click());
  app.$("#import-file-input").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) app.importTemplateFile(file);
    event.target.value = "";
  });

  app.$("#config-search").addEventListener("input", app.buildConfigPanel);
  app.$("#side-a-btn").addEventListener("click", () => app.setActiveSide("A"));
  app.$("#side-b-btn").addEventListener("click", () => app.setActiveSide("B"));
  app.$("#copy-a-to-b").addEventListener("click", () => {
    state.overrides.B = JSON.parse(JSON.stringify(state.overrides.A));
    app.persist();
    if (state.activeSide === "B") app.buildConfigPanel();
    app.reload("B");
  });
  app.$("#copy-config").addEventListener("click", app.copyConfigJson);
  app.$("#reset-all").addEventListener("click", app.resetAll);

  app.$("#be-apply").addEventListener("click", () => {
    if (state.selectedBlockIndex !== null) app.applyBlockEdit(state.selectedBlockIndex, app.$("#be-html").value);
  });
  app.$("#be-duplicate").addEventListener("click", () => {
    if (state.selectedBlockIndex === null) return;
    app.duplicateBlock(state.selectedBlockIndex);
    app.$("#be-selected").style.display = "none";
    state.selectedBlockIndex = null;
  });
  app.$("#be-delete").addEventListener("click", () => {
    if (state.selectedBlockIndex === null) return;
    app.deleteBlock(state.selectedBlockIndex);
    app.$("#be-selected").style.display = "none";
    state.selectedBlockIndex = null;
  });
  let rowTimer = null;
  app.$("#row-count-range").addEventListener("input", (event) => {
    app.$("#row-count-value").textContent = event.target.value;
    clearTimeout(rowTimer);
    rowTimer = setTimeout(() => app.setRowCount(Number(event.target.value)), 400);
  });

  let dataTimer = null;
  app.$("#data-json").addEventListener("input", (event) => {
    clearTimeout(dataTimer);
    const text = event.target.value;
    dataTimer = setTimeout(() => {
      try {
        const parsed = JSON.parse(text);
        state.sampleData = parsed;
        localStorage.setItem(`pfstudio.data.${state.templateId}`, JSON.stringify(parsed));
        app.hideDataJsonError();
        app.reloadAll();
      } catch (error) {
        const prefix = state.lang === "zh" ? "JSON 解析错误: " : "JSON parse error: ";
        app.showDataJsonError(prefix + error.message);
      }
    }, 500);
  });
  app.$("#data-regenerate").addEventListener("click", () => {
    app.showConfirm(app.t("regenerateConfirm")).then((ok) => {
      if (!ok) return;
      state.sampleData = app.buildSampleSkeleton(state.workingHtml);
      app.$("#data-json").value = JSON.stringify(state.sampleData, null, 2);
      localStorage.setItem(`pfstudio.data.${state.templateId}`, JSON.stringify(state.sampleData));
      app.hideDataJsonError();
      app.reloadAll();
    });
  });
  app.$("#data-export-package").addEventListener("click", app.exportDataPackage);
}

boot();
