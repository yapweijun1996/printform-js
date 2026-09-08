import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION, STUDIO_VERSION } from "./constants.js";
import { TOOL_CONTRACTS } from "./tool-contracts.js";
import { AGENT_OPERATION_DEFINITIONS } from "./operation-schemas.js";
import { getAgentOperationCatalog } from "./operation-catalog.js";
import { SAMPLE_SCENARIOS } from "./sample-scenarios.js";
import { PRINT_LOCALES } from "./i18n.js";
import { projectComponent, projectDesignState, projectFormSpec, projectInspection, projectJournal, projectAudit, projectOperationSummary, projectSecurity, projectAnchor, projectPackValidation, projectTransaction } from "./agent-output-projectors-common.js";
import {
  compact, projectDiff, projectIssue, projectMetrics, projectValidation, projectionError,
  requireObject, safeBoolean, safeCode, safeCount, safeHash, safeRevision, safeScenario, safeTime,
  projectBrowser, projectCoverage, projectGeometry, projectPixels,
} from "./agent-output-primitives.js";

const STATUS = new Set(["pass", "required", "stale"]);
const FINDING_SEVERITY = new Set(["minor", "major", "critical"]);
const FINDING_STATUS = new Set(["fixed", "accepted", "open"]);
const VERSION = /^\d+\.\d+\.\d+$/;

function ref(context, kind, value) { return value == null ? null : context.references.referenceFor(kind, value); }
function safeVersion(value, required = false) {
  if (typeof value === "string" && (VERSION.test(value) || value === "unknown")) return value;
  if (!required && value == null) return undefined;
  throw projectionError("Invalid version in Agent output");
}
function scenarios(values) { return Array.isArray(values) ? values.map(safeScenario).filter(Boolean) : []; }
function projectStaticOperations() {
  return Object.entries(AGENT_OPERATION_DEFINITIONS).map(([type, definition]) => ({ type, description: definition.description, inputSchema: structuredClone(definition.schema), example: structuredClone(definition.example), risk: definition.risk }));
}
function projectStaticTools() {
  return TOOL_CONTRACTS.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: structuredClone(tool.inputSchema) }));
}
function projectCapabilities(result) {
  const source = requireObject(result, "capabilities").capabilities || {};
  return Object.fromEntries(["candidateHash", "candidateRealRender", "layoutEvidenceReceipts", "formSpec", "transactions", "persistentAudit", "durableTransactions", "atomicRevisionCas", "leaseRecovery"].map((key) => [key, safeBoolean(source[key])]));
}

function projectReviewFinding(finding, context) {
  requireObject(finding, "review finding");
  return compact({ code: safeCode(finding.code), severity: FINDING_SEVERITY.has(finding.severity) ? finding.severity : undefined, status: FINDING_STATUS.has(finding.status) ? finding.status : undefined });
}

function projectEvidenceReference(evidence, context) {
  requireObject(evidence, "evidence reference");
  const visualMode = evidence.visualMode === "pixels" ? "pixels" : evidence.visualMode === "geometry" ? "geometry" : undefined;
  if (!visualMode) throw projectionError("Invalid evidence visual mode");
  if (visualMode === "pixels" && !context.dataPolicy?.allowPixelEvidence) throw projectionError("Pixel evidence is not allowed in this policy context");
  return compact({
    evidenceId: ref(context, "evidence", evidence.evidenceId), scenario: safeScenario(evidence.scenario), candidateHash: safeHash(evidence.candidateHash, true), baseProjectHash: safeHash(evidence.baseProjectHash, true), layoutFingerprint: safeHash(evidence.layoutFingerprint, true), renderReportHash: safeHash(evidence.renderReportHash, true), snapshotHash: safeHash(evidence.snapshotHash, true), visualMode, pixelSnapshotHash: visualMode === "pixels" ? safeHash(evidence.pixelSnapshotHash, true) : undefined, coverage: projectCoverage(evidence.coverage), createdAt: safeTime(evidence.createdAt, true),
  });
}

function projectEvidence(evidence, context) {
  requireObject(evidence, "evidence");
  if (context.strict === false && evidence.revision === undefined) {
    const snapshot = projectGeometry(evidence.snapshot);
    const pixelSnapshot = projectPixels(evidence.pixelSnapshot, context);
    return compact({ visualMode: pixelSnapshot ? "pixels" : "geometry", snapshot, pixelSnapshot });
  }
  const reference = projectEvidenceReference(evidence, context);
  const visualMode = reference.visualMode;
  const snapshot = projectGeometry(evidence.snapshot);
  const pixelSnapshot = projectPixels(evidence.pixelSnapshot, context);
  if (visualMode === "geometry" && !snapshot) throw projectionError("Geometry evidence is unavailable");
  if (visualMode === "pixels" && !pixelSnapshot) throw projectionError("Synthetic pixel evidence is unavailable");
  return compact({ ...reference, revision: safeRevision(evidence.revision, true), browser: projectBrowser(evidence.browser), metrics: projectMetrics(evidence.metrics), snapshot, pixelSnapshot: visualMode === "pixels" ? pixelSnapshot : undefined });
}

function projectObservation(observation, context) {
  if (observation == null) return null;
  requireObject(observation, "layout observation");
  const snapshot = projectGeometry(observation.snapshot);
  const pixelSnapshot = projectPixels(observation.pixelSnapshot, context);
  let visualMode = observation.visualMode === "pixels" ? "pixels" : "geometry";
  if (visualMode === "pixels" && !pixelSnapshot && context.strict !== false) throw projectionError("Synthetic pixel observation is unavailable");
  if (visualMode === "pixels" && !pixelSnapshot) visualMode = "geometry";
  if (visualMode === "geometry" && !snapshot) throw projectionError("Geometry observation is unavailable");
  return compact({ revision: safeRevision(observation.revision, context.strict !== false), scenario: safeScenario(observation.scenario), visualMode, snapshot: visualMode === "geometry" ? snapshot : undefined, pixelSnapshot: visualMode === "pixels" ? pixelSnapshot : undefined, metrics: projectMetrics(observation.metrics), issues: Array.isArray(observation.issues) ? observation.issues.map((item) => projectIssue(item, context)).filter(Boolean) : undefined, validation: observation.validation === null ? null : projectValidation(observation.validation, context, false) });
}

function projectReviewReceipt(review, context) {
  requireObject(review, "review receipt");
  if (review.status !== "pass" || review.reviewer !== "ai-agent") throw projectionError("Invalid review receipt");
  return compact({ status: "pass", reviewedRevision: safeRevision(review.reviewedRevision, true), reviewer: "ai-agent", browsers: Array.isArray(review.browsers) ? review.browsers.map(projectBrowser).filter(Boolean) : [], scenarios: scenarios(review.scenarios), evidence: Array.isArray(review.evidence) ? review.evidence.map((item) => projectEvidenceReference(item, context)) : [], findings: Array.isArray(review.findings) ? review.findings.map((item) => projectReviewFinding(item, context)) : [], attempt: safeCount(review.attempt, true), reviewedAt: safeTime(review.reviewedAt, true), metrics: projectMetrics(review.metrics) });
}

function projectPack(pack, context) {
  requireObject(pack, "evidence pack");
  return compact({ artifactType: pack.artifactType === "printform" ? "printform" : undefined, protocolVersion: safeVersion(pack.protocolVersion, true), schemaVersion: safeVersion(pack.schemaVersion, true), runtimeVersion: safeVersion(pack.runtimeVersion, true), revision: safeRevision(pack.revision, true), transactionId: ref(context, "transaction", pack.transactionId), formSpecHash: safeHash(pack.formSpecHash, true), validation: projectPackValidation(pack.validation), pageCount: safeCount(pack.pageCount, true), previewHash: safeHash(pack.previewHash, false), exportHtmlHash: safeHash(pack.exportHtmlHash, false), exportHtmlHashScope: pack.exportHtmlHashScope === "html-with-embedded-export-hash-redacted" ? pack.exportHtmlHashScope : undefined, runtimeHash: safeHash(pack.runtimeHash, false), printformRuntimeHash: safeHash(pack.printformRuntimeHash, false), security: projectSecurity(pack.security), timestamp: safeTime(pack.timestamp, true), hash: safeHash(pack.hash, true) });
}

function projectApplyResult(result, context) {
  requireObject(result, "apply result");
  return { revision: safeRevision(result.revision, true), already_committed: safeBoolean(result.already_committed, false), committed_revision: safeRevision(result.committed_revision, false), diff: projectDiff(result.diff), validation: projectValidation(result.validation, context, true), candidateHash: safeHash(result.candidateHash, false), transaction: projectTransaction(result.transaction, context) };
}

function projectLayoutCapture(result, context) {
  const output = { revision: safeRevision(result.revision, context.strict !== false), scenario: safeScenario(result.scenario) };
  if (result.evidence) {
    output.evidence = projectEvidence(result.evidence, context);
    output.requiredScenarios = scenarios(result.requiredScenarios);
    output.capturedScenarios = scenarios(result.capturedScenarios);
    return output;
  }
  output.evidence = null;
  output.observation = projectObservation(result.observation, context);
  if (result.validation !== undefined) output.validation = projectValidation(result.validation, context, true);
  if (result.metrics !== undefined) output.metrics = projectMetrics(result.metrics);
  if (result.pixelCapture) output.pixelCapture = { code: safeCode(result.pixelCapture.code) };
  return output;
}

export function projectAgentResult(name, result, context) {
  requireObject(result, `${name} result`);
  switch (name) {
    case "get_capabilities": return { protocolVersion: PROTOCOL_VERSION, contractVersion: AGENT_CONTRACT_VERSION, studioVersion: STUDIO_VERSION, capabilities: projectCapabilities(result), tools: projectStaticTools(), sampleScenarios: [...SAMPLE_SCENARIOS], locales: [...PRINT_LOCALES], humanExportRequired: true, completionPolicy: "AI layout review must pass for the current revision before request_export can be ready" };
    case "get_project_summary": return { revision: safeRevision(result.revision, true), locale: PRINT_LOCALES.includes(result.locale) ? result.locale : "en-MY", trust: ["trusted", "untrusted"].includes(result.trust) ? result.trust : "untrusted", protocolVersion: safeVersion(result.protocolVersion, true), review: projectReviewStatus(result.review, context), validation: projectValidation(result.validation, context, true) };
    case "inspect_document": return { revision: safeRevision(result.revision, true), ...projectInspection(result, context) };
    case "get_form_spec": return { revision: safeRevision(result.revision, true), spec: projectFormSpec(result.spec, context) };
    case "list_components": return { revision: safeRevision(result.revision, true), components: Array.isArray(result.components) ? result.components.map((item) => projectComponent(item, context)) : [] };
    case "get_component": return { revision: safeRevision(result.revision, true), component: result.component === null ? null : projectComponent(result.component, context) };
    case "inspect_design_state": return projectDesignState(result, context, Object.keys(AGENT_OPERATION_DEFINITIONS));
    case "get_operation_catalog": return { revision: safeRevision(result.revision, true), operations: projectStaticOperations() };
    case "begin_transaction": case "renew_lease": case "release_lease": case "takeover_transaction": case "recover_transaction": case "resolve_conflict": case "rollback_transaction": case "approve_transaction": return projectTransaction(result, context);
    case "get_transaction": return { transaction: result.transaction === null ? null : projectTransaction(result.transaction, context) };
    case "list_active_transactions": return { transactions: Array.isArray(result.transactions) ? result.transactions.map((item) => projectTransaction(item, context)) : [] };
    case "get_revision": return { revision: safeRevision(result.revision, true), projectHash: safeHash(result.projectHash, false), transactionId: ref(context, "transaction", result.transactionId), committedAt: safeTime(result.committedAt, false) };
    case "get_audit_events": return { events: Array.isArray(result.events) ? result.events.map((item) => projectAudit(item, context, projectPack)) : [] };
    case "preview_changes": return { revision: safeRevision(result.revision, true), transactionId: ref(context, "transaction", result.transactionId), diff: projectDiff(result.diff), validation: projectValidation(result.validation, context, true), candidateHash: safeHash(result.candidateHash, false) };
    case "apply_changes": case "set_sample_scenario": return projectApplyResult(result, context);
    case "set_locale": return { ...projectApplyResult(result, context), locale: PRINT_LOCALES.includes(result.locale) ? result.locale : "en-MY" };
    case "set_asset_source": return { ...projectApplyResult(result, context), slot: ref(context, "slot", result.slot) };
    case "compare_revision": return { fromRevision: safeRevision(result.fromRevision, true), toRevision: safeRevision(result.toRevision, true), diff: projectDiff(result.diff) };
    case "get_transaction_history": return { revision: safeRevision(result.revision, true), entries: Array.isArray(result.entries) ? result.entries.map((item) => projectJournal(item, context, projectPack)) : [], transactions: Array.isArray(result.transactions) ? result.transactions.map((item) => projectTransaction(item, context)) : [], auditEvents: Array.isArray(result.auditEvents) ? result.auditEvents.map((item) => projectAudit(item, context, projectPack)) : [] };
    case "get_evidence_pack": return { revision: safeRevision(result.revision, true), evidencePack: result.evidencePack === null ? null : projectPack(result.evidencePack, context), anchor: result.anchor === null ? null : projectAnchor(result.anchor, context) };
    case "validate_project": return { revision: safeRevision(result.revision, true), validation: projectValidation(result.validation, context, true) };
    case "undo_revision": return { changed: safeBoolean(result.changed), revision: safeRevision(result.revision, true) };
    case "get_layout_review_status": return { revision: safeRevision(result.revision, true), review: projectReviewStatus(result.review, context), checklist: Array.isArray(result.checklist) ? result.checklist.filter((item) => typeof item === "string").map(() => "review-checklist-item") : [] };
    case "begin_layout_review": return { revision: safeRevision(result.revision, true), attempt: safeCount(result.attempt, true), checklist: Array.isArray(result.checklist) ? result.checklist.filter((item) => typeof item === "string").map(() => "review-checklist-item") : [], requiredScenarios: scenarios(result.requiredScenarios), metrics: projectMetrics(result.metrics), issues: Array.isArray(result.issues) ? result.issues.map((item) => projectIssue(item, context)).filter(Boolean) : [] };
    case "capture_layout_evidence": return projectLayoutCapture(result, context);
    case "complete_layout_review": return { revision: safeRevision(result.revision, true), review: projectReviewReceipt(result.review, context) };
    case "request_export": return { revision: safeRevision(result.revision, true), ready: safeBoolean(result.ready), validation: projectValidation(result.validation, context, true), requiresUserConfirmation: true };
    default: throw projectionError("The command is not registered in the Agent contract");
  }
}

export function projectReviewStatus(review, context) {
  requireObject(review, "review status");
  const status = STATUS.has(review.status) ? review.status : "required";
  return compact({ status, reviewedRevision: safeRevision(review.reviewedRevision, false) ?? null, browsers: Array.isArray(review.browsers) ? review.browsers.map(projectBrowser).filter(Boolean) : undefined, reviewedAt: safeTime(review.reviewedAt, false) });
}

export function sanitizeAgentResult(name, result, options = {}) {
  const context = options.context || options.projectionContext;
  if (context) return projectAgentResult(name, result, context);
  const fallback = { strict: false, dataPolicy: { allowPixelEvidence: options.realData !== true }, references: { referenceFor: (_kind, value) => value }, };
  return projectAgentResult(name, result, fallback);
}

export function sanitizeAgentResponse(name, response, options = {}) {
  if (!response || typeof response !== "object") return { ok: false, error: { code: "AGENT_OUTPUT_INVALID", message: "Agent output could not be projected safely" } };
  if (!response.ok) return { ok: false, error: projectAgentError(response.error, options.context || options.projectionContext) };
  try { return { ok: true, result: sanitizeAgentResult(name, response.result, options) }; }
  catch (error) { return { ok: false, error: { code: "AGENT_OUTPUT_INVALID", message: "Agent output could not be projected safely" } }; }
}

function projectAgentError(error = {}, context) {
  const references = context?.references || { referenceFor: (_kind, value) => value };
  return compact({ code: safeCode(error.code), message: "Command failed", expectedRevision: safeRevision(error.expectedRevision, false), actualRevision: safeRevision(error.actualRevision, false), expectedCandidateHash: safeHash(error.expectedCandidateHash, false), actualCandidateHash: safeHash(error.actualCandidateHash, false), transactionId: error.transactionId == null ? undefined : references.referenceFor("transaction", error.transactionId), leaseId: error.leaseId == null ? undefined : references.referenceFor("lease", error.leaseId), owner: error.owner == null ? undefined : references.referenceFor("identity", error.owner), phase: error.phase && /^[a-z_]{1,40}$/.test(error.phase) ? error.phase : undefined, validation: error.validation ? projectValidation(error.validation, context || { references }) : undefined });
}

export { projectAgentError };
