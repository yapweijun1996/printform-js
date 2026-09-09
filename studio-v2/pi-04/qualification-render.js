import { renderPreview, listenForPreview } from "../ui/preview.js";
import { decorateRenderReport } from "../ui/layout-snapshot.js";
import { hashRenderProject } from "../core/render-provenance.js";

const RENDER_TIMEOUT_MS = 15_000;

function runtimeFetch(originalFetch, input, init) {
  const url = typeof input === "string" ? input : input?.url;
  if (url === "../dist/printform-document.js" || url === "../dist/printform.js") {
    return originalFetch(`/dist/${url.slice("../dist/".length)}`, init);
  }
  return originalFetch(input, init);
}

function createFrame() {
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
  document.body.append(frame);
  return frame;
}

function waitForReport(frame, revision, token) {
  let cancelListener = () => {};
  let timer;
  const report = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      cancelListener();
      reject(Object.assign(new Error("PI-04 render timed out."), { code: "RENDER_TIMEOUT" }));
    }, RENDER_TIMEOUT_MS);
    cancelListener = listenForPreview(frame, (message) => {
      if (message.revision !== revision || message.token !== token) return;
      clearTimeout(timer); cancelListener();
      if (message.type === "rendered") resolve(message.payload);
      else reject(Object.assign(new Error(message.payload?.message || "PI-04 render failed."), { code: "RENDER_FAILED" }));
    });
  });
  return { report, cancel: () => { clearTimeout(timer); cancelListener(); } };
}

export async function renderProject(bus, project, revision, source = "committed") {
  const frame = createFrame();
  const token = `pi04-render-${revision}-${source}-${Date.now()}`;
  const originalFetch = globalThis.fetch;
  let pendingReport;
  globalThis.fetch = (input, init) => runtimeFetch(originalFetch, input, init);
  try {
    pendingReport = waitForReport(frame, revision, token);
    await renderPreview(frame, project, revision, false, token, {
      dataPolicy: bus.dataPolicy, isCurrent: () => bus.active && bus.revision === revision
    });
    const report = decorateRenderReport(await pendingReport.report);
    if (!bus.active || bus.revision !== revision) throw Object.assign(new Error("PI-04 render became stale."), { code: "STALE_RENDER" });
    const projectHash = await hashRenderProject(project);
    if (source === "committed") {
      bus.recordRenderReport(report, {
        revision, candidateHash: projectHash, baseProjectHash: projectHash,
        source, token
      });
    }
    return {
      ...report, status: report.status, revision: report.revision ?? revision,
      visualMode: "geometry", logicalPages: report.metrics?.logicalPages ?? 0,
      overflowElements: report.metrics?.overflowElements ?? 0
    };
  } finally {
    pendingReport?.cancel();
    globalThis.fetch = originalFetch;
    frame.remove();
  }
}

export async function renderCurrentProject(bus) {
  return renderProject(bus, bus.project, bus.revision, "committed");
}
