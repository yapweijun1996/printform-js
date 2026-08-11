import { createScenario } from "./sample-scenarios.js";
import {
  createEvidenceReceipt,
  createLayoutObservation,
  createLayoutReviewReceipt,
  detectBrowser,
  LAYOUT_REVIEW_CHECKLIST,
  REQUIRED_EVIDENCE_SCENARIOS
} from "./layout-review.js";
import { verifyCurrentRender } from "./render-provenance.js";

export const REVIEW_COMMANDS = new Set([
  "begin_layout_review", "capture_layout_evidence", "complete_layout_review"
]);

async function beginReview(bus, input) {
  bus.ensureRevision(input.expectedRevision);
  if (bus.renderReport?.status !== "ready") {
    throw Object.assign(new Error("Wait for a ready browser preview before starting review"), {
      code: "LAYOUT_PREVIEW_NOT_READY"
    });
  }
  const currentRender = await verifyCurrentRender(bus.renderReport, bus.project, bus.revision);
  if (!currentRender.ok) throw Object.assign(new Error(currentRender.message), currentRender);
  bus.reviewReceipt = null;
  bus.reviewAttempts += 1;
  if (bus.reviewAttempts > 3) {
    throw Object.assign(new Error("The three-pass automatic review limit is exhausted for this revision"), {
      code: "REVIEW_ATTEMPT_LIMIT"
    });
  }
  return {
    revision: bus.revision,
    attempt: bus.reviewAttempts,
    checklist: LAYOUT_REVIEW_CHECKLIST,
    requiredScenarios: REQUIRED_EVIDENCE_SCENARIOS,
    metrics: bus.renderReport.metrics,
    issues: bus.renderReport.issues || []
  };
}

function unavailablePixel(report) {
  const validation = report.validation || {
    valid: false, productionValid: false, errors: [], warnings: []
  };
  validation.valid = false;
  validation.productionValid = false;
  validation.errors = [...(validation.errors || []), {
    code: report.pixelCapture?.code || "PIXEL_CAPTURE_UNAVAILABLE",
    path: "/pixelSnapshot",
    severity: "error",
    message: "Synthetic pixel capture was unavailable"
  }];
  return validation;
}

async function captureEvidence(bus, input) {
  bus.ensureRevision(input.expectedRevision);
  if (!bus.renderCandidate) {
    throw Object.assign(new Error("This session cannot render scenarios, so it cannot issue layout evidence"), {
      code: "EVIDENCE_UNAVAILABLE"
    });
  }
  const candidate = {
    ...bus.project,
    sampleData: createScenario(bus.project.sampleData, input.scenario)
  };
  const visualMode = input.visualMode === "pixels" ? "pixels" : "geometry";
  const { report } = await bus.getCandidateReport(candidate, bus.revision, input.scenario, { visualMode });
  if (report.status !== "ready" || (visualMode === "pixels" && !report.pixelSnapshot)) {
    const missingPixels = visualMode === "pixels" && !report.pixelSnapshot;
    return {
      revision: bus.revision,
      scenario: input.scenario,
      evidence: null,
      observation: createLayoutObservation({ revision: bus.revision, scenario: input.scenario, renderReport: report }),
      validation: missingPixels ? unavailablePixel(report) : report.validation,
      metrics: report.metrics,
      ...(missingPixels ? { pixelCapture: report.pixelCapture || { code: "PIXEL_CAPTURE_UNAVAILABLE" } } : {})
    };
  }
  const receipt = await createEvidenceReceipt({
    evidenceId: globalThis.crypto.randomUUID(),
    revision: bus.revision,
    scenario: input.scenario,
    renderReport: report,
    browser: detectBrowser()
  });
  bus.evidenceReceipts.set(receipt.evidenceId, receipt);
  const capturedScenarios = Array.from(new Set(
    Array.from(bus.evidenceReceipts.values(), (item) => item.scenario)
  ));
  return {
    revision: bus.revision,
    scenario: input.scenario,
    evidence: receipt,
    requiredScenarios: REQUIRED_EVIDENCE_SCENARIOS,
    capturedScenarios
  };
}

async function completeReview(bus, input) {
  bus.ensureRevision(input.expectedRevision);
  if (!bus.reviewAttempts) {
    throw Object.assign(new Error("begin_layout_review must be called first"), {
      code: "REVIEW_NOT_STARTED"
    });
  }
  const currentRender = await verifyCurrentRender(bus.renderReport, bus.project, bus.revision);
  if (!currentRender.ok) throw Object.assign(new Error(currentRender.message), currentRender);
  bus.reviewReceipt = createLayoutReviewReceipt(
    bus.revision, bus.renderReport, input, bus.reviewAttempts,
    bus.evidenceReceipts, currentRender.projectHash
  );
  bus.dispatchEvent(new CustomEvent("review", {
    detail: { revision: bus.revision, review: bus.reviewReceipt }
  }));
  return { revision: bus.revision, review: bus.reviewReceipt };
}

export async function executeReviewCommand(bus, name, input) {
  if (name === "begin_layout_review") return beginReview(bus, input);
  if (name === "capture_layout_evidence") return captureEvidence(bus, input);
  return completeReview(bus, input);
}
