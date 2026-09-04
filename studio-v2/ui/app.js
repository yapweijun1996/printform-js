import { AGENT_CONTRACT_VERSION, STUDIO_VERSION } from "../core/constants.js";
import { CommandBus } from "../core/command-bus.js";
import { createSampleDocument, sampleDocumentKey } from "../samples/catalog.js";
import { installAgentGateway } from "../adapters/gateway.js";
import { installWebMcpAdapter } from "../adapters/webmcp.js";
import { clearRecoveryDraft, loadRecoveryDraft, saveRecoveryDraft } from "./draft-cache.js";
import { initUiI18n, currentUiLocale, setUiLocale, t } from "./ui-i18n.js";
import { renderContractVersion, renderDataPolicy, renderQualityView, renderWebMcpStatus, refreshStatusText } from "./status-view.js";
import { createEditorPanel } from "./editor-panel.js";
import { createRenderController } from "./render-controller.js";
import { createStudioActions } from "./studio-actions.js";
import { initAgentPanel } from "./agent-panel.js";
import { setupServiceWorkerUpgrade } from "./service-worker-upgrade.js";
import { bindHorizontalWheel } from "./preview-wheel.js";
import { bindInspectorResize } from "./inspector-resize.js";
import { analyzeMigration } from "../core/migrations.js";
import { parseProjectHtml, verifyImportedProject } from "../core/project-model.js";

const $ = (selector) => document.querySelector(selector);
let bus;
let webMcp;
let dirty = false;
let overlayEnabled = true;
let activeSampleKey = sampleDocumentKey();
let fingerprint = createSampleDocument(activeSampleKey).manifest.documentId;
let lastValidation;
let editor;
let renderer;
let actions;
let agentPanel;
let editorToggle;

function toast(message) {
  const node = $("#toast"); node.textContent = message; node.classList.remove("hidden"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.add("hidden"), 3500);
}
function renderQuality(validation) { lastValidation = validation; renderQualityView(validation, bus.project.trust); }
function setDirty(value) { dirty = Boolean(value); }
function getEditor(key) { if (key === "sourceOperations") return editor.sourceOperations; if (key === "dataContractOperations") return editor.dataContractOperations; return editor.editors[key]; }
function refreshHistoryControls() {
  const state = bus?.historyState?.() || { canUndo: false, canRedo: false };
  const undo = $("#undo-button");
  const redo = $("#redo-button");
  if (undo) undo.disabled = !state.canUndo;
  if (redo) redo.disabled = !state.canRedo;
  agentPanel?.refreshHistoryControls?.(state);
}
async function performHistoryAction(name) {
  if (!bus) return;
  agentPanel?.onProjectChanged();
  const result = await bus.execute(name, { expectedRevision: bus.revision });
  if (!result.ok) toast(result.error.message);
  refreshHistoryControls();
}

function installBus(project, reason = "load") {
  webMcp?.dispose(); renderer?.replaceProject();
  bus = new CommandBus(project, {
    renderCandidate: (...args) => renderer.renderCandidate(...args),
    transactionStorage: window.localStorage,
    agentId: "studio-ui",
  });
  installAgentGateway(bus, window, { isRealData: () => $("#real-data-mode").checked });
  webMcp = installWebMcpAdapter(bus, null, { isRealData: () => $("#real-data-mode").checked });
  renderWebMcpStatus(webMcp);
  agentPanel?.onProjectChanged(project);
  bus.addEventListener("change", (event) => {
    dirty = true;
    editor.setEditors(event.detail.project);
    renderQuality(bus.validation());
    renderer.restoreCommitted();
    refreshHistoryControls();
    agentPanel?.updateDocumentContext({
      documentTitle: event.detail.project.manifest?.title || "PrintForm Document",
      documentId: event.detail.project.manifest?.documentId || "",
      revision: bus.revision,
      errorCount: bus.validation()?.errors?.length || 0,
      warningCount: bus.validation()?.warnings?.length || 0,
      stateMode: "committed"
    });
    if (!$("#real-data-mode").checked) saveRecoveryDraft(event.detail.project, fingerprint);
  });
  bus.addEventListener("review", () => {
    renderQuality(bus.readiness());
    agentPanel?.updateDocumentContext({
      errorCount: bus.validation()?.errors?.length || 0,
      warningCount: bus.validation()?.warnings?.length || 0
    });
  });
  editor.setEditors(project);
  renderQuality(bus.readiness());
  renderer.schedulePreview();
  refreshHistoryControls();
  agentPanel?.updateDocumentContext({
    documentTitle: project.manifest?.title || "PrintForm Document",
    documentId: project.manifest?.documentId || "",
    revision: bus.revision,
    errorCount: bus.validation()?.errors?.length || 0,
    warningCount: bus.validation()?.warnings?.length || 0,
    stateMode: "committed",
    selection: "Entire document"
  });
  if (reason !== "initial") toast(t("toast.loaded", { title: project.manifest.title || "PrintForm" }));
}

function selectSample(key) {
  if (dirty && !window.confirm(t("confirm.discardSample"))) { $("#document-select").value = activeSampleKey; return; }
  activeSampleKey = key; const project = createSampleDocument(key); fingerprint = project.manifest.documentId; dirty = false; history.replaceState(null, "", `${location.pathname}?sample=${encodeURIComponent(key)}`); installBus(project, "sample");
}

// A topbar popover menu (⋯ More, Export ▾). The panel uses the native Popover
// API so it renders in the top layer and escapes the topbar's overflow
// clipping; we only position it (fixed, below and right-aligned to the trigger)
// and mirror aria-expanded. Popover gives Esc + outside-click light-dismiss and
// one-open-at-a-time for free. A no-Popover fallback is kept for completeness.
function bindTopbarMenu(trigger, panel) {
  if (!trigger || !panel) return;
  const supported = typeof panel.showPopover === "function" && "popover" in HTMLElement.prototype;
  const isOpen = () => (supported ? panel.matches(":popover-open") : !panel.hidden);
  function place() {
    const rect = trigger.getBoundingClientRect();
    const width = panel.offsetWidth || 200;
    let left = Math.round(rect.right - width);
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    panel.style.position = "fixed";
    panel.style.top = `${Math.round(rect.bottom + 6)}px`;
    panel.style.left = `${left}px`;
  }
  function onEnvChange() { if (isOpen()) close(); }
  function open() {
    if (supported) { if (!panel.matches(":popover-open")) panel.showPopover(); }
    else panel.hidden = false;
    place();
    trigger.setAttribute("aria-expanded", "true");
    (panel.querySelector('[role="menuitem"], button, [tabindex]') || panel).focus?.();
    window.addEventListener("resize", onEnvChange, { passive: true });
    window.addEventListener("scroll", onEnvChange, { passive: true, capture: true });
  }
  function close() {
    if (supported) { if (panel.matches(":popover-open")) panel.hidePopover(); }
    else panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    window.removeEventListener("resize", onEnvChange);
    window.removeEventListener("scroll", onEnvChange, { capture: true });
  }
  if (supported) {
    panel.addEventListener("toggle", (event) => { if (event.newState === "open") open(); else close(); });
  } else {
    trigger.removeAttribute("popovertarget");
    panel.hidden = true;
    trigger.addEventListener("click", () => (isOpen() ? close() : open()));
    document.addEventListener("click", (event) => { if (isOpen() && !panel.contains(event.target) && event.target !== trigger && !trigger.contains(event.target)) close(); });
  }
  // Explicit Escape close + focus return (UA popover light-dismiss covers
  // outside-click; Escape is handled here so focus reliably lands on the trigger).
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !isOpen()) return;
    close();
    trigger.focus();
  });
  // A menuitem activation closes the menu.
  panel.addEventListener("click", (event) => { if (event.target.closest('[role="menuitem"]')) close(); });
}

function bindEditorToggle() {
  const panel = $("#editor-panel");
  const toggle = $("#editor-toggle");
  const label = $("#editor-toggle-label");
  const close = $("#editor-panel-close");
  if (!panel || !toggle) return null;
  let open = false;
  function update(next, { moveFocus = false, restoreFocus = false, focusTarget = toggle } = {}) {
    open = Boolean(next);
    const actionKey = open ? "editor.toggle.hide" : "editor.toggle.show";
    panel.classList.toggle("is-closed", !open);
    document.body.classList.toggle("editor-closed", !open);
    panel.setAttribute("aria-hidden", String(!open));
    if ("inert" in panel) panel.inert = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", t(actionKey));
    toggle.setAttribute("title", t(actionKey));
    if (label) label.textContent = t(actionKey);
    if (close) {
      close.textContent = t("editor.toggle.hide");
      close.setAttribute("aria-label", t("editor.toggle.hide"));
      close.setAttribute("title", t("editor.toggle.hide"));
    }
    if (open && moveFocus) setTimeout(() => close?.focus(), 50);
    if (!open && restoreFocus) setTimeout(() => focusTarget?.focus(), 50);
  }
  function flip(source) {
    const next = !open;
    update(next, { moveFocus: next, restoreFocus: !next, focusTarget: toggle });
    if (source === close && next) close?.focus();
  }
  toggle.addEventListener("click", () => flip(toggle));
  close?.addEventListener("click", () => flip(close));
  // Keep source editing opt-in so the printable preview is the default view.
  update(false);
  return { refresh: () => update(open) };
}

function bindTabs() {
  const tabs = Array.from(document.querySelectorAll(".inspector-tabs [role=tab]"));
  const panel = $(".inspector-panel");
  const header = $(".inspector-header");
  const toggle = $("#inspector-toggle");
  const floating = $("#ai-floating-launcher");
  const close = $("#inspector-close");
  const launchers = [toggle, floating].filter(Boolean);
  let restoreTarget = toggle;
  let desktopLayout = window.innerWidth > 1080;
  function setOpen(open, { restoreFocus = false, moveFocus = false, focusTarget = restoreTarget } = {}) {
    const next = Boolean(open);
    panel.classList.toggle("is-open", next);
    panel.classList.toggle("is-closed", !next);
    document.body.classList.toggle("inspector-closed", !next);
    panel.setAttribute("aria-hidden", String(!next));
    if ("inert" in panel) panel.inert = !next;
    launchers.forEach((launcher) => launcher.setAttribute("aria-expanded", String(next)));
    if (next && moveFocus) {
      // Firefox/WebKit apply the clicked button's default focus after the
      // listener returns. Defer one task so the direct AI Designer entry has
      // the same keyboard result everywhere.
      setTimeout(() => close?.focus(), 50);
    }
    if (!next && restoreFocus) setTimeout(() => focusTarget?.focus(), 50);
  }
  function select(tab) { tabs.forEach((item) => { const selected = item === tab; item.setAttribute("aria-selected", String(selected)); $(`#${item.getAttribute("aria-controls")}`).hidden = !selected; }); header?.setAttribute("data-active-tab", tab.id); setOpen(true); }
  tabs.forEach((tab, index) => { tab.addEventListener("click", () => select(tab)); tab.addEventListener("keydown", (event) => { if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return; event.preventDefault(); const next = tabs[(index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]; next.focus(); select(next); }); });
  function openAiDesigner(source) {
    const next = !panel.classList.contains("is-open");
    if (next) {
      restoreTarget = source || toggle;
      const aiTab = tabs.find((item) => item.id === "ai-designer-tab");
      if (aiTab) select(aiTab);
      setOpen(true, { moveFocus: true });
      return;
    }
    setOpen(false, { restoreFocus: true, focusTarget: source });
  }
  toggle?.addEventListener("click", () => openAiDesigner(toggle));
  floating?.addEventListener("click", () => openAiDesigner(floating));
  close?.addEventListener("click", () => setOpen(false, { restoreFocus: true }));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !panel.classList.contains("is-open")) return;
    setOpen(false, { restoreFocus: true });
  });
  window.addEventListener("resize", () => {
    const nextDesktop = window.innerWidth > 1080;
    if (nextDesktop === desktopLayout) return;
    desktopLayout = nextDesktop;
  });
  // Keep the inspector opt-in on every viewport. Only an explicit launcher
  // click should expose validation, agent, or AI Designer controls.
  setOpen(false);
  panel.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || window.innerWidth > 1080 || !panel.classList.contains("is-open")) return;
    const activePanel = panel.querySelector('[role="tabpanel"]:not([hidden])');
    const focusable = [
      // Header now carries the tab switcher, the AI action cluster and Close in
      // DOM order; offsetParent filters out the AI cluster when it is hidden on
      // the Quality/Agent tabs.
      ...panel.querySelectorAll(".inspector-header button:not([disabled])"),
      ...(activePanel?.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex=\"-1\"])") || [])
    ].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}

function bindUi() {
  $("#apply-source-button").addEventListener("click", actions.applySource); $("#import-file").addEventListener("change", (event) => actions.importFile(event.target.files[0]));
  $("#validate-button").addEventListener("click", () => { renderQuality(bus.readiness()); toast(t("toast.validationDone")); }); $("#export-button").addEventListener("click", () => actions.exportDocument(true)); $("#export-untrusted-button").addEventListener("click", () => actions.exportDocument(false)); $("#print-button").addEventListener("click", actions.openPrintPreview);
  $("#undo-button").addEventListener("click", () => performHistoryAction("undo_revision")); $("#redo-button").addEventListener("click", () => performHistoryAction("redo_revision"));
  $("#scenario-select").addEventListener("change", async (event) => { const result = await bus.execute("set_sample_scenario", { expectedRevision: bus.revision, scenario: event.target.value }); if (!result.ok) toast(result.error.message); }); $("#locale-select").addEventListener("change", async (event) => { const result = await bus.execute("set_locale", { expectedRevision: bus.revision, locale: event.target.value }); if (!result.ok) toast(result.error.message); });
  $("#apply-logo-button").addEventListener("click", actions.applyLogoSources); $("#apply-font-scale-button").addEventListener("click", actions.applyFontScale); $("#apply-brand-color-button").addEventListener("click", actions.applyBrandColor); $("#brand-color-input").addEventListener("input", (event) => { $("#brand-color-text").value = event.target.value; }); $("#apply-page-settings-button").addEventListener("click", actions.applyPageSettings); $("#apply-repeat-flags-button").addEventListener("click", actions.applyRepeatFlags); $("#apply-data-contract-button").addEventListener("click", actions.applyDataContract);
  $("#document-select").addEventListener("change", (event) => selectSample(event.target.value)); $("#diagnostics-button").addEventListener("click", () => actions.downloadDiagnostics(lastValidation, STUDIO_VERSION, AGENT_CONTRACT_VERSION)); $("#reset-trust-button").addEventListener("click", actions.resetTrust); $("#ui-locale-select").addEventListener("change", changeUiLocale);
  $("#real-data-mode").addEventListener("change", async (event) => { renderDataPolicy(event.target.checked); if (event.target.checked) clearRecoveryDraft(); await agentPanel.setRealData(event.target.checked); }); $("#overlay-toggle").addEventListener("change", (event) => { overlayEnabled = event.target.checked; renderer.toggleOverlay(overlayEnabled); });
  window.addEventListener("printform:ui-locale", refreshLocalizedUi); window.addEventListener("beforeunload", (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }); editorToggle = bindEditorToggle(); bindTabs(); bindInspectorResize();
  bindHorizontalWheel($(".actions"));
  bindHorizontalWheel($(".preview-viewport"));
  bindTopbarMenu($("#more-menu-button"), $("#more-menu"));
  bindTopbarMenu($("#export-menu-button"), $("#export-menu"));
  $("#import-file-item")?.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); $("#import-file").click(); } });
}

async function changeUiLocale(event) { const previous = currentUiLocale(); try { await setUiLocale(event.target.value); } catch { event.target.value = previous; toast(t("toast.languageFailed")); } }
function refreshLocalizedUi() { if (!bus) return; renderQuality(lastValidation || bus.readiness()); renderWebMcpStatus(webMcp); renderDataPolicy($("#real-data-mode").checked); refreshStatusText(); $("#revision-label").textContent = t("editor.revision", { revision: bus.revision }); editor.refresh(); editorToggle?.refresh(); }

function setupRecovery() { const draft = loadRecoveryDraft(); if (!draft) return; $("#restore-banner").classList.remove("hidden"); $("#restore-button").addEventListener("click", () => { fingerprint = draft.fingerprint; installBus(draft.project, "recovery"); $("#restore-banner").classList.add("hidden"); }); $("#discard-restore-button").addEventListener("click", () => { clearRecoveryDraft(); $("#restore-banner").classList.add("hidden"); }); }
await initUiI18n();
editor = createEditorPanel({ getBus: () => bus, onApplyColumnWidths: (...args) => actions.applyColumnWidths(...args), onApplyDataContract: () => actions.applyDataContract() });
renderer = createRenderController({ getBus: () => bus, getOverlayEnabled: () => overlayEnabled, toast, onCandidateState: () => {} });
actions = createStudioActions({ getBus: () => bus, getFingerprint: () => fingerprint, setFingerprint: (value) => { fingerprint = value; }, getDirty: () => dirty, setDirty, getEditor, installBus, toast });
agentPanel = initAgentPanel({
  realData: $("#real-data-mode").checked,
  getGateway: () => window.PrintFormStudioAgent,
  getBaseProject: () => bus?.project,
  getHistoryState: () => bus?.historyState?.() || {},
  onHistoryAction: performHistoryAction,
  onCandidateState: (active) => {
    if (active) renderer.setCandidateState(true);
    else renderer.restoreCommitted();
  },
  onRealDataChange: (active) => renderDataPolicy(active)
});
renderContractVersion(); bindUi(); renderer.listen(); $("#document-select").value = activeSampleKey; installBus(createSampleDocument(activeSampleKey), "initial"); setupRecovery(); setupServiceWorkerUpgrade({ isDirty: () => dirty, toast, translateMessage: t, onSaveDraft: () => actions.saveDraft() });
if (!window.Agrun) toast("AI Designer runtime did not load; existing Studio tools remain available.");
