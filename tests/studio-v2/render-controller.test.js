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
  OVERLAY_COMMAND_SOURCE: "printform-studio-v2-command",
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
    invalidateRenderReport: vi.fn(),
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

  it("projects a current iframe error as a failed committed render", async () => {
    const bus = createBus("document-a", 0);
    const controller = createRenderController({
      getBus: () => bus,
      getOverlayEnabled: () => true,
      toast: mocks.toast,
      onCandidateState: vi.fn(),
      onRenderState: mocks.onRenderState
    });
    controller.listen();
    controller.schedulePreview(0);
    await vi.advanceTimersByTimeAsync(0);

    mocks.previewListener({ token: mocks.renderRequests[0].token, revision: 0, type: "error", payload: { message: "iframe exploded" } });

    expect(mocks.renderStatus).toHaveBeenCalledWith("status.failed", "blocked");
    expect(mocks.toast).toHaveBeenCalledWith("iframe exploded");
    expect(mocks.onRenderState).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 0, renderStatus: "failed", errorCount: 1 }));
  });

  it("fails a current committed render when no iframe report arrives before timeout", async () => {
    const bus = createBus("document-a", 0);
    const controller = createRenderController({
      getBus: () => bus,
      getOverlayEnabled: () => true,
      toast: mocks.toast,
      onCandidateState: vi.fn(),
      onRenderState: mocks.onRenderState
    });
    controller.schedulePreview(0);
    await vi.advanceTimersByTimeAsync(0);
    mocks.renderRequests[0].resolve({ status: "ready" });
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(mocks.renderStatus).toHaveBeenCalledWith("status.failed", "blocked");
    expect(mocks.toast).toHaveBeenCalledWith("Preview timed out");
    expect(mocks.onRenderState).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 0, renderStatus: "failed", errorCount: 1 }));
  });

  it("preserves a current report while restoring the committed iframe", async () => {
    const bus = createBus("document-a", 0);
    bus.renderReport = { status: "ready" };
    const controller = createRenderController({
      getBus: () => bus,
      getOverlayEnabled: () => true,
      toast: mocks.toast,
      onCandidateState: vi.fn(),
      onRenderState: mocks.onRenderState
    });

    controller.restoreCommitted();
    await vi.advanceTimersByTimeAsync(0);

    expect(bus.invalidateRenderReport).not.toHaveBeenCalled();
    expect(mocks.renderStatus).toHaveBeenCalledWith("status.rendering", "pending");
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

  it("forwards only current-render preview selections", async () => {
    const bus = createBus("document-a", 0);
    const onPreviewSelection = vi.fn();
    const controller = createRenderController({
      getBus: () => bus,
      getOverlayEnabled: () => true,
      toast: mocks.toast,
      onCandidateState: vi.fn(),
      onRenderState: mocks.onRenderState,
      onPreviewSelection
    });
    controller.listen();
    controller.schedulePreview(0);
    await vi.advanceTimersByTimeAsync(0);
    const token = mocks.renderRequests[0].token;

    mocks.previewListener({ type: "selection", revision: 0, token, payload: { componentId: "table-default-header" } });
    mocks.previewListener({ type: "selection", revision: 0, token: token - 1, payload: { componentId: "stale" } });

    expect(onPreviewSelection).toHaveBeenCalledTimes(1);
    expect(onPreviewSelection).toHaveBeenCalledWith(
      { componentId: "table-default-header" },
      { revision: 0, token, candidate: false }
    );
  });

  it("routes a quality issue to the current sandbox render", () => {
    const bus = createBus("document-a", 3);
    const controller = createRenderController({
      getBus: () => bus,
      getOverlayEnabled: () => true,
      toast: mocks.toast,
      onCandidateState: vi.fn(),
      onRenderState: mocks.onRenderState
    });
    const frame = document.querySelector("#preview-frame");
    const postMessage = vi.spyOn(frame.contentWindow, "postMessage").mockImplementation(() => {});

    expect(controller.navigateToIssue({ pageIndex: 1, selector: "#quality-target", componentId: "project-info-2" })).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({
      source: "printform-studio-v2-command",
      type: "focus-issue",
      revision: 3,
      token: 0,
      issue: { pageIndex: 1, selector: "#quality-target", componentId: "project-info-2" }
    }, "*");
  });
});
