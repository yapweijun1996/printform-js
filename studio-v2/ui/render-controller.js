import { renderPreview, listenForPreview, setPreviewOverlayEnabled, OVERLAY_COMMAND_SOURCE } from "./preview.js";
import { renderMetrics, renderQualityView, renderStatus } from "./status-view.js";
import { decorateRenderReport } from "./layout-snapshot.js";
import { hashRenderProject } from "../core/render-provenance.js";
import { bindPreviewWheel, scrollPreviewHorizontally } from "./preview-wheel.js";

const $ = (selector) => document.querySelector(selector);
const CANDIDATE_TIMEOUT = 30_000;
const COMMITTED_TIMEOUT = 30_000;

export function createRenderController({ getBus, getOverlayEnabled, getDataPolicy = () => null, toast, onCandidateState, onRenderState = () => {}, onPreviewSelection = () => {} }) {
  let previewTimer;
  let committedTimer;
  let token = 0;
  let candidateActive = false;
  const pending = new Map();
  const disposePreviewWheel = bindPreviewWheel($(".preview-viewport"));

  function setCandidateState(active) {
    candidateActive = Boolean(active);
    $("#candidate-preview-banner").classList.toggle("hidden", !candidateActive);
    onCandidateState(candidateActive);
    onRenderState({ renderStatus: candidateActive ? "candidate" : "waiting" });
  }

  function restoreCommitted() {
    setCandidateState(false);
    schedulePreview(0, { preserveReport: true });
  }

  function clearCommittedTimer() {
    clearTimeout(committedTimer);
    committedTimer = undefined;
  }

  function failCommitted(revision, requestToken, message) {
    const bus = getBus();
    if (!bus || bus.revision !== revision || token !== requestToken) return;
    clearCommittedTimer();
    bus.invalidateRenderReport?.();
    const validation = bus.validation();
    const readiness = bus.readiness();
    renderQualityView(readiness, bus.project.trust);
    renderStatus("status.failed", "blocked");
    onRenderState({ revision, renderStatus: "failed", readiness, errorCount: Math.max(1, validation.errors?.length || 0), warningCount: validation.warnings?.length || 0 });
    toast(message || "Preview failed");
  }

  function renderCandidate(project, revision, options = {}) {
    clearTimeout(previewTimer);
    const requestToken = ++token;
    setCandidateState(true);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!pending.delete(requestToken)) return;
        reject(new Error("Candidate render timed out"));
        if (token === requestToken) restoreCommitted();
      }, CANDIDATE_TIMEOUT);
      pending.set(requestToken, { resolve, reject, timer });
      renderPreview($("#preview-frame"), project, revision, getOverlayEnabled(), requestToken, {
        ...options,
        dataPolicy: getDataPolicy(),
        capturePixels: options.visualMode === "pixels",
        isCurrent: () => token === requestToken && pending.has(requestToken),
      }).then((result) => {
        if (!result?.stale) return;
        const current = pending.get(requestToken);
        if (!current) return;
        pending.delete(requestToken); clearTimeout(current.timer); current.reject(new Error("Candidate render superseded"));
      }).catch((error) => {
        const current = pending.get(requestToken);
        if (!current) return;
        pending.delete(requestToken); clearTimeout(current.timer); current.reject(error);
        if (token === requestToken) restoreCommitted();
      });
    });
  }

  function schedulePreview(delay = 180, { preserveReport = false } = {}) {
    clearTimeout(previewTimer);
    clearCommittedTimer();
    const bus = getBus(); if (!bus) return;
    if (!preserveReport) bus.invalidateRenderReport?.();
    const requestToken = ++token;
    const project = bus.project;
    const revision = bus.revision;
    renderQualityView(bus.readiness(), bus.project.trust); renderStatus("status.rendering", "pending"); onRenderState({ revision: bus.revision, renderStatus: "rendering", readiness: bus.readiness() });
    previewTimer = setTimeout(async () => {
      try {
        const result = await renderPreview($("#preview-frame"), project, revision, getOverlayEnabled(), requestToken, {
          dataPolicy: getDataPolicy(),
          isCurrent: () => getBus() === bus && bus.revision === revision && token === requestToken,
        });
        if (result?.stale) return;
        if (getBus() === bus && bus.revision === revision && token === requestToken) {
          committedTimer = setTimeout(() => failCommitted(revision, requestToken, "Preview timed out"), COMMITTED_TIMEOUT);
        }
      }
      catch (error) {
        failCommitted(revision, requestToken, error.message);
      }
    }, delay);
  }

  function markPending() {
    clearTimeout(previewTimer);
    clearCommittedTimer();
    token += 1;
    const bus = getBus();
    if (!bus) return;
    renderStatus("status.rendering", "pending");
    onRenderState({ revision: bus.revision, renderStatus: "rendering", readiness: bus.readiness() });
  }

  function listen() {
    return listenForPreview($("#preview-frame"), (message) => {
      if (message.type === "wheel") {
        scrollPreviewHorizontally($(".preview-viewport"), { ...message.payload, source: "frame" });
        return;
      }
      if (message.type === "selection") {
        if (message.token !== token || (message.revision !== undefined && message.revision !== getBus()?.revision)) return;
        onPreviewSelection(message.payload, { revision: message.revision, token: message.token, candidate: pending.has(message.token) });
        return;
      }
      const candidate = pending.get(message.token);
      if (candidate) {
        pending.delete(message.token); clearTimeout(candidate.timer);
        if (message.type === "rendered") {
          if (message.token !== token) candidate.reject(new Error("Candidate render superseded"));
          else candidate.resolve(decorateRenderReport(message.payload));
        } else {
          candidate.reject(new Error(message.payload?.message || "Candidate render failed"));
          if (message.token === token) restoreCommitted();
        }
        return;
      }
      const bus = getBus(); if (!bus || message.revision !== bus.revision || message.token !== token) return;
      if (message.type === "rendered") {
        const report = decorateRenderReport(message.payload);
        void recordCommitted(report, message.revision, message.token);
      } else failCommitted(message.revision, message.token, message.payload?.message || "Preview failed");
    });
  }

  function replaceProject() {
    token += 1;
    pending.forEach(({ reject, timer }) => { clearTimeout(timer); reject(new Error("Studio project was replaced")); });
    pending.clear(); clearTimeout(previewTimer); setCandidateState(false);
    clearCommittedTimer();
  }

  function toggleOverlay(enabled) { setPreviewOverlayEnabled($("#preview-frame"), enabled); }

  function navigateToIssue(issue) {
    const frame = $("#preview-frame");
    const bus = getBus();
    if (!frame?.contentWindow || !bus || !issue) return false;
    frame.contentWindow.postMessage({ source: OVERLAY_COMMAND_SOURCE, type: "focus-issue", revision: bus.revision, token, issue }, "*");
    return true;
  }

  async function recordCommitted(report, revision, requestToken) {
    const bus = getBus();
    if (!bus || bus.revision !== revision || token !== requestToken) return;
    clearCommittedTimer();
    const projectHash = await hashRenderProject(bus.project);
    if (bus.revision !== revision || token !== requestToken) return;
    bus.recordRenderReport(report, { revision, candidateHash: projectHash, baseProjectHash: projectHash, source: "committed", token: requestToken });
    const readiness = bus.readiness();
    const validation = bus.validation();
    renderQualityView(readiness, bus.project.trust);
    const ready = report.status === "ready";
    renderStatus(ready ? "status.ready" : "status.blocked", ready ? "ready" : "blocked");
    renderMetrics(report.issues?.length ? { ...report.metrics, issues: report.issues } : report.metrics);
    onRenderState({ revision, renderStatus: ready ? "ready" : "failed", readiness, errorCount: validation.errors?.length || 0, warningCount: validation.warnings?.length || 0 });
  }

  return { renderCandidate, schedulePreview, markPending, listen, replaceProject, restoreCommitted, setCandidateState, toggleOverlay, navigateToIssue, dispose: disposePreviewWheel, get candidateActive() { return candidateActive; } };
}
