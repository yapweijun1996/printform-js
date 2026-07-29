export const LAYOUT_REVIEW_CHECKLIST = Object.freeze([
  "Inspect full-page screenshots for every logical page",
  "Check clipping, overlap, horizontal and vertical overflow",
  "Check hierarchy, 9pt readability, spacing and table column balance",
  "Check repeated letterhead, document context, footer and page numbers",
  "Check totals, notes and signatures remain logically grouped",
  "Check logo proportions, contrast and long multilingual text"
]);

const blockingSeverity = new Set(["critical", "major"]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

export function createLayoutReviewReceipt(revision, renderReport, input, attempt) {
  if (renderReport?.status !== "ready") fail("LAYOUT_PREVIEW_NOT_READY", "A ready browser render is required before layout review completion");
  if (input.reviewer !== "ai-agent") fail("AI_REVIEW_REQUIRED", "Layout review must be completed by an AI agent");
  if (!String(input.browser || "").trim()) fail("REVIEW_BROWSER_REQUIRED", "Review browser evidence is required");
  const evidence = new Set(input.evidence || []);
  if (!evidence.has("full-page-screenshot") || !evidence.has("layout-metrics")) {
    fail("REVIEW_EVIDENCE_REQUIRED", "Full-page screenshot and layout metrics evidence are required");
  }
  const scenarios = new Set(input.scenarios || []);
  if (!scenarios.has("default") || !scenarios.has("long-text")) {
    fail("REVIEW_SCENARIOS_REQUIRED", "Default and long-text scenarios must be reviewed");
  }
  const findings = Array.isArray(input.findings) ? input.findings : [];
  const unresolved = findings.filter((item) => item.status !== "fixed" && blockingSeverity.has(item.severity));
  if (unresolved.length) fail("REVIEW_ISSUES_OPEN", `${unresolved.length} major or critical layout issues are not fixed`);
  const metrics = renderReport.metrics || {};
  if (metrics.overflowElements || metrics.verticalOverflowPages || metrics.contrastFailures) {
    fail("REVIEW_METRICS_FAILED", "Layout metrics still contain production-blocking failures");
  }
  return Object.freeze({
    status: "pass",
    reviewedRevision: revision,
    reviewer: "ai-agent",
    browser: String(input.browser),
    scenarios: [...scenarios],
    evidence: [...evidence],
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
  return { status: receipt.status, reviewedRevision: receipt.reviewedRevision, browser: receipt.browser, reviewedAt: receipt.reviewedAt };
}
