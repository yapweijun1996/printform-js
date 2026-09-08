// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renderRequests: [],
  previewListener: null,
  renderStatus: vi.fn(),
  renderQualityView: vi.fn(),
  renderMetrics: vi.fn(),
  toast: vi.fn(),
  onRenderState: vi.fn()
}));

vi.mock("../../studio-v2/ui/preview.js", () => ({
  renderPreview: vi.fn((_frame, project, revision, _overlay, token) => new Promise((resolve, reject) => {
    mocks.renderRequests.push({ project, revision, token, resolve, reject });
  })),
  listenForPreview: vi.fn((_frame, callback) => {
    mocks.previewListener = callback;
    return () => {};
  }),
  setPreviewOverlayEnabled: vi.fn()
}));
vi.mock("../../studio-v2/ui/status-view.js", () => ({
  renderStatus: mocks.renderStatus,
  renderQualityView: mocks.renderQualityView,
  renderMetrics: mocks.renderMetrics
}));
vi.mock("../../studio-v2/ui/preview-wheel.js", () => ({
  bindPreviewWheel: vi.fn(() => () => {}),
  scrollPreviewHorizontally: vi.fn()
}));
vi.mock("../../studio-v2/ui/layout-snapshot.js", () => ({
  decorateRenderReport: vi.fn((report) => report)
}));
vi.mock("../../studio-v2/core/render-provenance.js", () => ({
  hashRenderProject: vi.fn(async (project) => `hash:${project.id}`)
}));

const { createRenderController } = await import("../../studio-v2/ui/render-controller.js");

function createBus(id, revision) {
  return {
    project: { id, trust: "trusted" },
    revision,
    readiness: () => ({ productionValid: false }),
    validation: () => ({ errors: [], warnings: [] }),
    recordRenderReport: vi.fn()
  };
}

describe("render controller request ownership", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.renderRequests.length = 0;
    mocks.previewListener = null;
    document.body.innerHTML = '<div class="preview-viewport"></div><iframe id="preview-frame"></iframe><div id="candidate-preview-banner"></div>';
  });

  it("ignores a late failure from an older committed render request", async () => {
    let bus = createBus("document-a", 0);
    const controller = createRenderController({
      getBus: () => bus,
      getOverlayEnabled: () => true,
      toast: mocks.toast,
      onCandidateState: vi.fn(),
      onRenderState: mocks.onRenderState
    });

    controller.schedulePreview(0);
    await vi.advanceTimersByTimeAsync(0);
    bus = createBus("document-b", 1);
    controller.schedulePreview(0);
    await vi.advanceTimersByTimeAsync(0);

    mocks.renderRequests[0].reject(new Error("old preview failed"));
    await Promise.resolve();

    expect(mocks.renderStatus).not.toHaveBeenCalledWith("status.failed", "blocked");
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.onRenderState).toHaveBeenLastCalledWith(expect.objectContaining({
      revision: 1,
      renderStatus: "rendering"
    }));
  });

  it("keeps a newer candidate visible when an older candidate fails late", async () => {
    const bus = createBus("document-a", 0);
    const controller = createRenderController({
      getBus: () => bus,
      getOverlayEnabled: () => true,
      toast: mocks.toast,
      onCandidateState: vi.fn(),
      onRenderState: mocks.onRenderState
    });

    const first = controller.renderCandidate({ id: "candidate-a" }, 0);
    first.catch(() => {});
    const second = controller.renderCandidate({ id: "candidate-b" }, 0);
    second.catch(() => {});
    mocks.renderRequests[0].reject(new Error("old candidate failed"));
    await Promise.resolve();

    expect(controller.candidateActive).toBe(true);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("does not restore committed output for an old candidate frame error", async () => {
    const bus = createBus("document-a", 0);
    const controller = createRenderController({
      getBus: () => bus,
      getOverlayEnabled: () => true,
      toast: mocks.toast,
      onCandidateState: vi.fn(),
      onRenderState: mocks.onRenderState
    });
    controller.listen();

    const first = controller.renderCandidate({ id: "candidate-a" }, 0);
    first.catch(() => {});
    const second = controller.renderCandidate({ id: "candidate-b" }, 0);
    second.catch(() => {});
    mocks.previewListener({ token: mocks.renderRequests[0].token, type: "error", payload: { message: "old frame failed" } });
    await Promise.resolve();

    expect(controller.candidateActive).toBe(true);
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
