const SAFE_METRICS = new Set([
  "rows", "logicalPages", "htmlBytes", "pageCount", "width", "height",
  "maxPageHeight", "overflowPages", "totalHeight", "overflowElements",
  "verticalOverflowPages", "contrastFailures", "renderedRows", "expectedRows",
  "durationMs"
]);

function finiteNumber(value) { return typeof value === "number" && Number.isFinite(value) ? value : null; }

function sanitizeRect(rect) {
  if (!rect || typeof rect !== "object") return undefined;
  const result = {};
  for (const key of ["x", "y", "width", "height", "top", "left", "right", "bottom"]) {
    const value = finiteNumber(rect[key]);
    if (value !== null) result[key] = value;
  }
  return Object.keys(result).length ? result : undefined;
}

function sanitizeIssue(issue = {}) {
  const result = {};
  for (const key of ["code", "path", "severity", "selector", "pageIndex", "keyword"]) {
    if (typeof issue[key] === "string" || typeof issue[key] === "number") result[key] = issue[key];
  }
  const rect = sanitizeRect(issue.rect);
  if (rect) result.rect = rect;
  return result;
}

function sanitizeMetrics(metrics = {}) {
  return Object.fromEntries(Object.entries(metrics || {}).filter(([key, value]) => SAFE_METRICS.has(key) && (typeof value === "number" || typeof value === "boolean")));
}

function sanitizeSnapshot(snapshot) {
  if (!snapshot || snapshot.redacted !== true || snapshot.source !== "geometry-only" || snapshot.mimeType !== "image/svg+xml") return undefined;
  const dataUrl = typeof snapshot.dataUrl === "string" ? snapshot.dataUrl : "";
  const prefixes = ["data:image/svg+xml;base64,", "data:image/svg+xml;charset=utf-8,"];
  const prefix = prefixes.find((item) => dataUrl.startsWith(item));
  if (!prefix || dataUrl.length > 4_000_000) return undefined;
  try {
    const encoded = dataUrl.slice(prefix.length);
    const svg = prefix.includes("base64") ? atob(encoded) : decodeURIComponent(encoded);
    if (!svg.startsWith("<svg") || !svg.endsWith("</svg>") || /<(?:text|image|foreignObject|script)\b|(?:href\s*=\s*["'](?:https?:|javascript:)|url\(\s*(?:https?:|javascript:))/i.test(svg)) return undefined;
  } catch { return undefined; }
  return {
    source: "geometry-only", redacted: true, mimeType: "image/svg+xml", dataUrl,
    width: Number.isFinite(snapshot.width) ? snapshot.width : undefined,
    height: Number.isFinite(snapshot.height) ? snapshot.height : undefined,
    pageCount: Number.isInteger(snapshot.pageCount) ? snapshot.pageCount : undefined
  };
}

function sanitizePixelSnapshot(snapshot, realData = false) {
  if (realData || !snapshot || snapshot.source !== "sandbox-pixel" || snapshot.syntheticData !== true || snapshot.redacted !== false) return undefined;
  const dataUrl = typeof snapshot.dataUrl === "string" ? snapshot.dataUrl : "";
  if (!/^data:image\/(?:png|jpeg|webp);base64,/.test(dataUrl) || !["image/png", "image/jpeg", "image/webp"].includes(snapshot.mimeType) || dataUrl.length > 5_000_000) return undefined;
  return {
    source: "sandbox-pixel", syntheticData: true, redacted: false,
    mimeType: snapshot.mimeType, dataUrl,
    width: Number.isFinite(snapshot.width) ? snapshot.width : undefined,
    height: Number.isFinite(snapshot.height) ? snapshot.height : undefined,
    pageCount: Number.isInteger(snapshot.pageCount) ? snapshot.pageCount : undefined
  };
}

export function sanitizeValidation(validation) {
  if (!validation || typeof validation !== "object") return validation;
  const sanitizeList = (items) => Array.isArray(items) ? items.map(sanitizeIssue) : [];
  const result = {
    valid: Boolean(validation.valid),
    productionValid: Boolean(validation.productionValid),
    errors: sanitizeList(validation.errors),
    warnings: sanitizeList(validation.warnings),
    metrics: sanitizeMetrics(validation.metrics),
    issues: sanitizeList(validation.issues)
  };
  if (validation.reviewReceipt && typeof validation.reviewReceipt === "object") {
    result.reviewReceipt = {
      revision: validation.reviewReceipt.revision,
      status: validation.reviewReceipt.status,
      attempt: validation.reviewReceipt.attempt
    };
  }
  return result;
}

function sanitizeReview(review) {
  if (!review || typeof review !== "object") return review;
  const result = {
    status: review.status,
    revision: review.revision,
    attempt: review.attempt,
    requiredScenarios: Array.isArray(review.requiredScenarios) ? [...review.requiredScenarios] : undefined,
    capturedScenarios: Array.isArray(review.capturedScenarios) ? [...review.capturedScenarios] : undefined,
    scenarios: Array.isArray(review.scenarios) ? [...review.scenarios] : undefined,
    browsers: Array.isArray(review.browsers) ? review.browsers.map(({ name, version }) => ({ name, version })) : undefined,
    metrics: sanitizeMetrics(review.metrics)
  };
  if (Array.isArray(review.evidence)) result.evidence = review.evidence.map(({ evidenceId, scenario, candidateHash, baseProjectHash, layoutFingerprint, renderReportHash, snapshotHash, visualMode, pixelSnapshotHash, coverage, createdAt }) => ({ evidenceId, scenario, candidateHash, baseProjectHash, layoutFingerprint, renderReportHash, snapshotHash, visualMode, pixelSnapshotHash, coverage, createdAt }));
  if (Array.isArray(review.findings)) result.findings = review.findings.map(({ code, severity, status }) => ({ code, severity, status }));
  return result;
}

function sanitizeEvidence(evidence, realData = false) {
  if (!evidence || typeof evidence !== "object") return evidence;
  return {
    evidenceId: evidence.evidenceId,
    revision: evidence.revision,
    scenario: evidence.scenario,
    candidateHash: evidence.candidateHash,
    baseProjectHash: evidence.baseProjectHash,
    browser: evidence.browser && { name: evidence.browser.name, version: evidence.browser.version },
    layoutFingerprint: evidence.layoutFingerprint,
    renderReportHash: evidence.renderReportHash,
    snapshotHash: evidence.snapshotHash,
    snapshot: sanitizeSnapshot(evidence.snapshot),
    visualMode: !realData && evidence.visualMode === "pixels" ? "pixels" : "geometry",
    ...(realData ? {} : { pixelSnapshotHash: evidence.pixelSnapshotHash, pixelSnapshot: sanitizePixelSnapshot(evidence.pixelSnapshot, realData) }),
    coverage: evidence.coverage && {
      capturedPages: evidence.coverage.capturedPages,
      totalPages: evidence.coverage.totalPages,
      complete: evidence.coverage.complete === true
    },
    metrics: sanitizeMetrics(evidence.metrics),
    createdAt: evidence.createdAt
  };
}

function sanitizeObservation(observation, realData = false) {
  if (!observation || typeof observation !== "object") return undefined;
  const snapshot = sanitizeSnapshot(observation.snapshot);
  const pixelSnapshot = sanitizePixelSnapshot(observation.pixelSnapshot, realData);
  if (!snapshot && !pixelSnapshot) return undefined;
  return {
    revision: Number.isInteger(observation.revision) ? observation.revision : undefined,
    scenario: typeof observation.scenario === "string" ? observation.scenario : undefined,
    visualMode: pixelSnapshot ? "pixels" : "geometry",
    ...(snapshot ? { snapshot } : {}),
    ...(pixelSnapshot ? { pixelSnapshot } : {}),
    metrics: sanitizeMetrics(observation.metrics),
    issues: Array.isArray(observation.issues) ? observation.issues.map(sanitizeIssue) : [],
    validation: sanitizeValidation(observation.validation)
  };
}

function sanitizeTransaction(transaction) {
  if (!transaction || typeof transaction !== "object") return transaction;
  const operation = (item = {}) => Object.fromEntries(
    ["type", "path", "selector", "slot", "tableSelector", "componentId", "bindingType"]
      .filter((key) => item[key] !== undefined)
      .map((key) => [key, item[key]]),
  );
  return {
    transaction_id: transaction.transaction_id,
    form_id: transaction.form_id,
    base_revision: transaction.base_revision,
    working_revision: transaction.working_revision,
    owner: transaction.owner,
    agent_id: transaction.agent_id,
    status: transaction.status,
    state: transaction.state,
    patches: Array.isArray(transaction.patches) ? transaction.patches.map(operation) : [],
    changes: Array.isArray(transaction.changes) ? transaction.changes.map(operation) : [],
    preview_hash: transaction.preview_hash,
    candidate_content_hash: transaction.candidate_content_hash,
    candidate_form_spec_hash: transaction.candidate_form_spec_hash,
    validation_result: sanitizeValidation(transaction.validation_result),
    approval: transaction.approval && { actor: transaction.approval.actor, approved_at: transaction.approval.approved_at, preview_hash: transaction.approval.preview_hash },
    lease: transaction.lease && { owner: transaction.lease.owner, lease_id: transaction.lease.lease_id, lease_expires_at: transaction.lease.lease_expires_at, heartbeat: transaction.lease.heartbeat },
    created_at: transaction.created_at,
    updated_at: transaction.updated_at,
    previewed_at: transaction.previewed_at,
    approved_at: transaction.approved_at,
    committed_at: transaction.committed_at,
    commit_result: transaction.commit_result && Object.fromEntries(Object.entries(transaction.commit_result).filter(([key]) => /status|revision|hash|at$/.test(key))),
    evidence_pack_ref: transaction.evidence_pack_ref && Object.fromEntries(Object.entries(transaction.evidence_pack_ref).filter(([key]) => /hash|revision|at$|transaction_id/.test(key))),
    conflict: transaction.conflict,
    supersedes_transaction_id: transaction.supersedes_transaction_id,
  };
}

function sanitizeError(error = {}) {
  const result = { code: error.code || "COMMAND_FAILED", message: "Command failed" };
  if (Number.isInteger(error.expectedRevision)) result.expectedRevision = error.expectedRevision;
  if (Number.isInteger(error.actualRevision)) result.actualRevision = error.actualRevision;
  if (typeof error.expectedCandidateHash === "string") result.expectedCandidateHash = error.expectedCandidateHash;
  if (typeof error.actualCandidateHash === "string") result.actualCandidateHash = error.actualCandidateHash;
  for (const key of ["transactionId", "owner", "leaseId", "phase"]) if (typeof error[key] === "string") result[key] = error[key];
  if (error.validation) result.validation = sanitizeValidation(error.validation);
  return result;
}

export function sanitizeAgentResult(name, result, { realData = false } = {}) {
  if (!result || typeof result !== "object") return result;
  const sanitized = structuredClone(result);
  if (sanitized.validation) sanitized.validation = sanitizeValidation(sanitized.validation);
  if (sanitized.review) sanitized.review = sanitizeReview(sanitized.review);
  if (sanitized.evidence) sanitized.evidence = sanitizeEvidence(sanitized.evidence, realData);
  if (sanitized.observation) sanitized.observation = sanitizeObservation(sanitized.observation, realData);
  if (sanitized.metrics) sanitized.metrics = sanitizeMetrics(sanitized.metrics);
  if (sanitized.issues) sanitized.issues = sanitized.issues.map(sanitizeIssue);
  if (sanitized.safeSnapshot) sanitized.safeSnapshot = sanitizeSnapshot(sanitized.safeSnapshot);
  if (realData) delete sanitized.pixelSnapshot;
  else if (sanitized.pixelSnapshot) sanitized.pixelSnapshot = sanitizePixelSnapshot(sanitized.pixelSnapshot);
  if (name === "get_project_summary") {
    delete sanitized.title;
    sanitized.review = sanitizeReview(sanitized.review);
  }
  if (realData && sanitized.projectName) delete sanitized.projectName;
  if (sanitized.reviewReceipt) {
    sanitized.reviewReceipt = {
      revision: sanitized.reviewReceipt.revision,
      status: sanitized.reviewReceipt.status,
      attempt: sanitized.reviewReceipt.attempt
    };
  }
  if (sanitized.transaction) sanitized.transaction = sanitizeTransaction(sanitized.transaction);
  if (Array.isArray(sanitized.transactions)) sanitized.transactions = sanitized.transactions.map(sanitizeTransaction);
  return sanitized;
}

export function sanitizeAgentResponse(name, response, options = {}) {
  if (!response || typeof response !== "object") return response;
  if (!response.ok) return { ok: false, error: sanitizeError(response.error) };
  return { ok: true, result: sanitizeAgentResult(name, response.result, options) };
}
