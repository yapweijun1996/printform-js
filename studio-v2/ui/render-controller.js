import { renderPreview, listenForPreview, setPreviewOverlayEnabled } from "./preview.js";
import { renderMetrics, renderQualityView, renderStatus } from "./status-view.js";
import { decorateRenderReport } from "./layout-snapshot.js";
import { hashRenderProject } from "../core/render-provenance.js";
import { bindPreviewWheel, scrollPreviewHorizontally } from "./preview-wheel.js";

const $ = (selector) => document.querySelector(selector);
const CANDIDATE_TIMEOUT = 30_000;

export function createRenderController({ getBus, getOverlayEnabled, getDataPolicy = () => null, toast, onCandidateState, onRenderState = () => {} }) {
  let previewTimer;
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
    schedulePreview(0);
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

  function schedulePreview(delay = 180) {
    clearTimeout(previewTimer);
    const bus = getBus(); if (!bus) return;
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
      }
      catch (error) {
        if (getBus() !== bus || bus.revision !== revision || token !== requestToken) return;
        renderStatus("status.failed", "blocked"); onRenderState({ revision, renderStatus: "failed", readiness: bus.readiness(), errorCount: 1 }); toast(error.message);
      }
    }, delay);
  }

  function markPending() {
    clearTimeout(previewTimer);
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
      } else toast(message.payload?.message || "Preview failed");
    });
  }

  function replaceProject() {
    token += 1;
    pending.forEach(({ reject, timer }) => { clearTimeout(timer); reject(new Error("Studio project was replaced")); });
    pending.clear(); clearTimeout(previewTimer); setCandidateState(false);
  }

  function toggleOverlay(enabled) { setPreviewOverlayEnabled($("#preview-frame"), enabled); }

  async function recordCommitted(report, revision, requestToken) {
    const bus = getBus();
    if (!bus || bus.revision !== revision || token !== requestToken) return;
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

  return { renderCandidate, schedulePreview, markPending, listen, replaceProject, restoreCommitted, setCandidateState, toggleOverlay, dispose: disposePreviewWheel, get candidateActive() { return candidateActive; } };
}
