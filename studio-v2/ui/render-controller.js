import { renderPreview, listenForPreview, setPreviewOverlayEnabled } from "./preview.js";
import { renderMetrics, renderQualityView, renderStatus } from "./status-view.js";
import { decorateRenderReport } from "./layout-snapshot.js";
import { hashRenderProject } from "../core/render-provenance.js";
import { bindPreviewWheel, scrollPreviewHorizontally } from "./preview-wheel.js";

const $ = (selector) => document.querySelector(selector);
const CANDIDATE_TIMEOUT = 30_000;

export function createRenderController({ getBus, getOverlayEnabled, toast, onCandidateState }) {
  let previewTimer;
  let token = 0;
  let candidateActive = false;
  const pending = new Map();
  const disposePreviewWheel = bindPreviewWheel($(".preview-viewport"));

  function setCandidateState(active) {
    candidateActive = Boolean(active);
    $("#candidate-preview-banner").classList.toggle("hidden", !candidateActive);
    onCandidateState(candidateActive);
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
        restoreCommitted();
      }, CANDIDATE_TIMEOUT);
      pending.set(requestToken, { resolve, reject, timer });
      renderPreview($("#preview-frame"), project, revision, getOverlayEnabled(), requestToken, { ...options, capturePixels: options.visualMode === "pixels" }).catch((error) => {
        const current = pending.get(requestToken);
        if (!current) return;
        pending.delete(requestToken); clearTimeout(current.timer); current.reject(error); restoreCommitted();
      });
    });
  }

  function schedulePreview(delay = 180) {
    clearTimeout(previewTimer);
    const bus = getBus(); if (!bus) return;
    renderQualityView(bus.readiness(), bus.project.trust); renderStatus("status.rendering", "pending");
    previewTimer = setTimeout(async () => {
      const requestToken = ++token;
      try { await renderPreview($("#preview-frame"), bus.project, bus.revision, getOverlayEnabled(), requestToken); }
      catch (error) { renderStatus("status.failed", "blocked"); toast(error.message); }
    }, delay);
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
        if (message.type === "rendered") candidate.resolve(decorateRenderReport(message.payload));
        else { candidate.reject(new Error(message.payload?.message || "Candidate render failed")); restoreCommitted(); }
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
    renderQualityView(bus.readiness(), bus.project.trust);
    const ready = report.status === "ready";
    renderStatus(ready ? "status.ready" : "status.blocked", ready ? "ready" : "blocked");
    renderMetrics(report.issues?.length ? { ...report.metrics, issues: report.issues } : report.metrics);
  }

  return { renderCandidate, schedulePreview, listen, replaceProject, restoreCommitted, setCandidateState, toggleOverlay, dispose: disposePreviewWheel, get candidateActive() { return candidateActive; } };
}
