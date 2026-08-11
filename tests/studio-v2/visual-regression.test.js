import { describe, expect, it } from "vitest";
import { prepareVisualReviewEvidence } from "../../studio-v2/core/visual-regression.js";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const pixel = { source: "sandbox-pixel", syntheticData: true, redacted: false, mimeType: "image/png", dataUrl: "data:image/png;base64,AAAA" };

describe("synthetic visual regression metadata", () => {
  it("establishes a scenario baseline and flags a later pixel change", () => {
    const baselines = new Map();
    const first = prepareVisualReviewEvidence([{ evidence: { evidenceId: "a", scenario: "default", revision: 0, visualMode: "pixels", pixelSnapshotHash: hashA, pixelSnapshot: pixel } }], baselines);
    expect(first.context[0].visualRegression).toMatchObject({ available: true, changed: false, baselineEstablished: true });
    expect(first.parts[0]).toMatchObject({ type: "image", mimeType: "image/png", filename: "layout-default.png" });
    const second = prepareVisualReviewEvidence([{ evidence: { evidenceId: "b", scenario: "default", revision: 1, visualMode: "pixels", pixelSnapshotHash: hashB, pixelSnapshot: pixel } }], baselines);
    expect(second.context[0].visualRegression).toMatchObject({ available: true, changed: true, baselineHash: hashA, currentHash: hashB });
  });

  it("does not invent pixel metadata for geometry-only evidence", () => {
    const result = prepareVisualReviewEvidence([{ evidence: { evidenceId: "g", scenario: "long-text", revision: 0, visualMode: "geometry", snapshot: { dataUrl: "data:image/svg+xml;base64,AAAA", mimeType: "image/svg+xml" } } }], new Map());
    expect(result.context[0].visualRegression).toEqual({ available: false, changed: false });
    expect(result.parts[0].filename).toBe("layout-long-text.svg");
  });

  it("caps total image payload and falls back from pixels to geometry per scenario", () => {
    const large = (size) => `data:image/png;base64,${"A".repeat(size)}`;
    const geometry = { dataUrl: "data:image/svg+xml;base64,AAAA", mimeType: "image/svg+xml", source: "geometry-only" };
    const result = prepareVisualReviewEvidence([
      { evidence: { evidenceId: "a", scenario: "default", visualMode: "pixels", pixelSnapshot: { ...pixel, dataUrl: large(4_500_000) }, snapshot: geometry } },
      { evidence: { evidenceId: "b", scenario: "long-text", visualMode: "pixels", pixelSnapshot: { ...pixel, dataUrl: large(4_500_000) }, snapshot: geometry } }
    ], new Map());
    expect(result.parts.map((part) => part.mimeType)).toEqual(["image/png", "image/svg+xml"]);
    expect(result.context.map((item) => item.imageMode)).toEqual(["pixels", "geometry"]);
    expect(result.parts.reduce((total, part) => total + part.url.length, 0)).toBeLessThanOrEqual(8_000_000);
  });
});
