import { sha256, stableStringify } from "./json.js";

export const LAYOUT_REVIEW_CHECKLIST = Object.freeze([
  "Inspect redacted geometry evidence for every logical page",
  "Check clipping, overlap, horizontal and vertical overflow",
  "Check hierarchy, 9pt readability, spacing and table column balance",
  "Check repeated letterhead, document context, footer and page numbers",
  "Check totals, notes and signatures remain logically grouped",
  "Check logo proportions, contrast and long multilingual text"
]);

// The scenarios that must each have a Studio-issued evidence receipt before a
// layout review can pass. Same two the review has always required — #18
// changed how they are proven, not which ones are needed.
export const REQUIRED_EVIDENCE_SCENARIOS = Object.freeze(["default", "long-text"]);

const blockingSeverity = new Set(["critical", "major"]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function safeSnapshot(report) {
  const snapshot = report?.safeSnapshot;
  if (!snapshot || snapshot.redacted !== true || snapshot.source !== "geometry-only" || snapshot.mimeType !== "image/svg+xml") return undefined;
  if (typeof snapshot.dataUrl !== "string" || !["data:image/svg+xml;base64,", "data:image/svg+xml;charset=utf-8,"].some((prefix) => snapshot.dataUrl.startsWith(prefix))) return undefined;
  return structuredClone(snapshot);
}

function safePixelSnapshot(report) {
  const snapshot = report?.pixelSnapshot;
  if (report?.provenance?.visualMode !== "pixels" || !snapshot || snapshot.source !== "sandbox-pixel" || snapshot.syntheticData !== true || snapshot.redacted !== false) return undefined;
  const dataUrl = typeof snapshot.dataUrl === "string" ? snapshot.dataUrl : "";
  if (!/^data:image\/(?:png|jpeg|webp);base64,/.test(dataUrl) || !["image/png", "image/jpeg", "image/webp"].includes(snapshot.mimeType) || dataUrl.length > 5_000_000) return undefined;
  return structuredClone({ ...snapshot, dataUrl });
}

// Best-effort browser identity for the receipt. Never trusted from agent
// input: an agent claiming "Chromium 150" is exactly the self-declaration
// #18 exists to remove, and #19's attestation.browsers is derived from these
// receipts rather than a hardcoded list.
export function detectBrowser(scope = globalThis) {
  const brands = scope.navigator?.userAgentData?.brands || [];
  const branded = brands.find((entry) => !/Not.?A.?Brand/i.test(entry.brand || ""));
  if (branded) return { name: branded.brand, version: String(branded.version || "") };
  const ua = String(scope.navigator?.userAgent || "");
  const match = ua.match(/(Firefox|Edg|Chrome|Safari)\/(\d+)/);
  if (match) return { name: match[1] === "Edg" ? "Edge" : match[1], version: match[2] };
  return { name: "unknown", version: "" };
}

// Signs what Studio itself measured. layoutFingerprint covers the structural
// geometry (page count, and every page child's class + integer rect);
// renderReportHash covers the whole report including validation errors and
// metrics. Neither carries business text, so a receipt stays safe to keep and
// to embed in an export even in real-ERP-data sessions.
export async function createEvidenceReceipt({ evidenceId, revision, scenario, renderReport, browser }) {
  if (renderReport?.status !== "ready") {
    fail("EVIDENCE_RENDER_NOT_READY", `Scenario "${scenario}" did not render cleanly, so no evidence can be issued`);
  }
  const provenance = renderReport.provenance;
  if (!provenance || provenance.source !== "candidate" || provenance.revision !== revision || !provenance.candidateHash || !provenance.baseProjectHash) {
    fail("EVIDENCE_PROVENANCE_REQUIRED", `Scenario "${scenario}" is missing candidate provenance`);
  }
  const snapshot = safeSnapshot(renderReport);
  const pixelSnapshot = safePixelSnapshot(renderReport);
  if (renderReport.provenance.visualMode === "pixels" && !pixelSnapshot) fail("PIXEL_CAPTURE_UNAVAILABLE", `Scenario "${scenario}" did not produce a safe synthetic pixel snapshot`);
  const capturedPages = pixelSnapshot?.pageCount || snapshot?.pageCount || 0;
  const totalPages = Number.isInteger(renderReport.metrics?.logicalPages) ? renderReport.metrics.logicalPages : 0;
  if (!capturedPages || !totalPages || capturedPages < totalPages) {
    fail("EVIDENCE_COVERAGE_INCOMPLETE", `Scenario "${scenario}" captured ${capturedPages} of ${totalPages} logical pages`);
  }
  return Object.freeze({
    evidenceId,
    revision,
    scenario,
    candidateHash: provenance.candidateHash,
    baseProjectHash: provenance.baseProjectHash,
    browser: Object.freeze({ ...browser }),
    layoutFingerprint: await sha256(stableStringify(renderReport.pageGeometry || [])),
    renderReportHash: await sha256(stableStringify(renderReport)),
    snapshotHash: await sha256(stableStringify(snapshot || null)),
    ...(snapshot ? { snapshot: Object.freeze(snapshot) } : {}),
    visualMode: pixelSnapshot ? "pixels" : "geometry",
    ...(pixelSnapshot ? { pixelSnapshotHash: await sha256(stableStringify(pixelSnapshot.dataUrl)), pixelSnapshot: Object.freeze(pixelSnapshot) } : {}),
    coverage: Object.freeze({ capturedPages, totalPages, complete: true }),
    metrics: Object.freeze(structuredClone(renderReport.metrics || {})),
    createdAt: new Date().toISOString()
  });
}

// An unsigned observation lets the multimodal reviewer inspect a broken
// scenario before a clean, signed evidence receipt can exist. It is never
// accepted by complete_layout_review and carries only the same privacy-gated
// images, geometry, metrics and issue codes already allowed through gateway
// sanitization.
export function createLayoutObservation({ revision, scenario, renderReport }) {
  const snapshot = safeSnapshot(renderReport);
  const pixelSnapshot = safePixelSnapshot(renderReport);
  if (!snapshot && !pixelSnapshot) return null;
  return {
    revision,
    scenario,
    visualMode: pixelSnapshot ? "pixels" : "geometry",
    ...(snapshot ? { snapshot } : {}),
    ...(pixelSnapshot ? { pixelSnapshot } : {}),
    metrics: structuredClone(renderReport?.metrics || {}),
    issues: structuredClone(renderReport?.issues || []),
    validation: structuredClone(renderReport?.validation || null)
  };
}

export function createLayoutReviewReceipt(revision, renderReport, input, attempt, evidenceStore = new Map(), expectedBaseProjectHash = "") {
  if (renderReport?.status !== "ready") fail("LAYOUT_PREVIEW_NOT_READY", "A ready browser render is required before layout review completion");
  if (input.reviewer !== "ai-agent") fail("AI_REVIEW_REQUIRED", "Layout review must be completed by an AI agent");
  // Agent Contract 2.0: self-declared evidence labels and browser strings are
  // gone. Callers still sending them are on 1.x and must upgrade — accepting
  // them alongside receipts would leave the bypass this check exists to close.
  if (input.evidence || input.browser || input.scenarios) {
    fail("EVIDENCE_RECEIPT_REQUIRED", "Agent Contract 2.0: pass evidenceIds from capture_layout_evidence instead of evidence/browser/scenarios labels");
  }
  const evidenceIds = Array.isArray(input.evidenceIds) ? input.evidenceIds : [];
  if (!evidenceIds.length) fail("EVIDENCE_RECEIPT_REQUIRED", "At least one Studio-issued evidence receipt is required");
  const receipts = evidenceIds.map((id) => {
    const receipt = evidenceStore.get(id);
    if (!receipt) fail("EVIDENCE_UNKNOWN", `Evidence receipt ${id} was not issued by this Studio session`);
    if (receipt.revision !== revision) fail("EVIDENCE_STALE", `Evidence receipt ${id} belongs to revision ${receipt.revision}, not ${revision}`);
    if (!expectedBaseProjectHash || receipt.baseProjectHash !== expectedBaseProjectHash) fail("EVIDENCE_PROVENANCE_MISMATCH", `Evidence receipt ${id} does not describe the current project`);
    return receipt;
  });
  const covered = new Set(receipts.map((receipt) => receipt.scenario));
  const missing = REQUIRED_EVIDENCE_SCENARIOS.filter((scenario) => !covered.has(scenario));
  if (missing.length) fail("REVIEW_SCENARIOS_REQUIRED", `Missing evidence for scenario(s): ${missing.join(", ")}`);
  const findings = Array.isArray(input.findings) ? input.findings : [];
  const blocking = findings.filter((item) => blockingSeverity.has(item.severity));
  if (blocking.length) fail("REVIEW_ISSUES_OPEN", `${blocking.length} major or critical layout issues remain in the fresh evidence`);
  const metrics = renderReport.metrics || {};
  if (metrics.overflowElements || metrics.verticalOverflowPages || metrics.contrastFailures) {
    fail("REVIEW_METRICS_FAILED", "Layout metrics still contain production-blocking failures");
  }
  // Every browser that actually issued one of these receipts, deduplicated —
  // this is what #19's attestation reports instead of a fixed browser list.
  const browsers = Array.from(new Map(receipts.map((receipt) => [`${receipt.browser.name} ${receipt.browser.version}`, receipt.browser])).values());
  return Object.freeze({
    status: "pass",
    reviewedRevision: revision,
    reviewer: "ai-agent",
    browsers,
    scenarios: [...covered],
    evidence: receipts.map(({ evidenceId, scenario, candidateHash, baseProjectHash, layoutFingerprint, renderReportHash, snapshotHash, visualMode, pixelSnapshotHash, coverage, createdAt }) => ({ evidenceId, scenario, candidateHash, baseProjectHash, layoutFingerprint, renderReportHash, snapshotHash, visualMode, pixelSnapshotHash, coverage, createdAt })),
    findings: findings.map(({ code, severity, status, message }) => ({ code, severity, status, message })),
    summary: String(input.summary || "Visual layout review passed"),
    attempt,
    reviewedAt: new Date().toISOString(),
    metrics: structuredClone(metrics)
  });
}

export function layoutReviewStatus(receipt, revision) {
  if (!receipt) return { status: "required", reviewedRevision: null };
  if (receipt.reviewedRevision !== revision) return { status: "stale", reviewedRevision: receipt.reviewedRevision };
  return { status: receipt.status, reviewedRevision: receipt.reviewedRevision, browsers: receipt.browsers, reviewedAt: receipt.reviewedAt };
}
