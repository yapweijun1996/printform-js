import { applyOperations, diffProjects } from "./operations.js";
import { hashRenderProject } from "./render-provenance.js";
import { sha256, stableStringify } from "./json.js";
import { mergeRenderReport } from "./render-report.js";
import { getFormSpec } from "./form-spec.js";
import { isTerminalStatus } from "./transaction-state.js";
import { recoverTransaction } from "./transaction-recovery-service.js";
import {
  auditChanges,
  checkLease,
  currentTransaction,
  iso,
  leaseError,
  legacyJournal,
  markConflict,
  now,
  projectContentHash,
  rollbackAfterFailure,
  save,
  setStatus,
  stateName,
  transactionId,
  view,
} from "./transaction-common.js";

function candidateFormSpecHash(project) {
  return sha256(stableStringify(getFormSpec(project))).then((hash) => `sha256:${hash}`);
}

export function beginTransaction(bus, baseRevision = bus.revision, agentId = bus.agentId, owner = bus.owner) {
  bus.ensureRevision(baseRevision);
  bus.expireStaleTransactions(now(bus));
  const created = now(bus);
  const leaseId = transactionId("lease");
  const transaction = {
    transaction_id: transactionId(),
    form_id: bus.transactionStore.formId,
    base_revision: baseRevision,
    working_revision: baseRevision,
    owner: owner || agentId || bus.agentId,
    agent_id: agentId || bus.agentId,
    status: "draft",
    state: stateName("draft"),
    patches: [],
    changes: [],
    preview_hash: null,
    validation_result: null,
    approval: null,
    lease: {
      owner: owner || agentId || bus.agentId,
      lease_id: leaseId,
      lease_expires_at: new Date(created.getTime() + bus.leaseDurationMs).toISOString(),
      heartbeat: created.toISOString(),
    },
    created_at: created.toISOString(),
    updated_at: created.toISOString(),
    previewed_at: null,
    approved_at: null,
    committed_at: null,
    commit_result: null,
    evidence_pack_ref: null,
  };
  bus.persistTransaction(transaction);
  bus.auditTransaction("transaction_started", transaction, { lease_id: leaseId, lease_expires_at: transaction.lease.lease_expires_at });
  bus.auditTransaction("lease_acquired", transaction, { lease_id: leaseId, lease_expires_at: transaction.lease.lease_expires_at });
  legacyJournal(bus, "BEGIN_EDIT", transaction, { revision: baseRevision });
  legacyJournal(bus, "LEASE_ACQUIRED", transaction, { lease_id: leaseId, lease_expires_at: transaction.lease.lease_expires_at });
  return view(transaction);
}

export function requireTransaction(bus, id) {
  const transaction = currentTransaction(bus, id);
  const actualRevision = Math.max(bus.revision, bus.transactionStore.getHeadRevision());
  if (transaction.base_revision !== actualRevision) {
    const error = new Error(`Revision conflict: expected ${transaction.base_revision}, current ${actualRevision}`);
    error.code = "REVISION_CONFLICT";
    error.expectedRevision = transaction.base_revision;
    error.actualRevision = actualRevision;
    throw error;
  }
  return transaction;
}

export async function previewTransaction(bus, operations, expectedRevision, existingId = null) {
  const started = existingId ? null : beginTransaction(bus, expectedRevision);
  let transaction;
  try {
    transaction = existingId ? requireTransaction(bus, existingId) : currentTransaction(bus, started.transaction_id);
    bus.ensureRevision(expectedRevision);
    checkLease(bus, transaction);
    bus.maybeFail("before_preview");
    const baseProjectHash = await projectContentHash(bus.project);
    const preview = bus.preview(operations, expectedRevision);
    const candidateContentHash = await projectContentHash(preview.candidate);
    const candidateReport = await bus.getCandidateReport(preview.candidate, preview.revision);
    const validation = candidateReport ? mergeRenderReport(preview.validation, candidateReport.report) : preview.validation;
    transaction.changes = structuredClone(operations);
    transaction.patches = structuredClone(operations);
    transaction.base_project_hash = baseProjectHash;
    transaction.candidate_form_spec_hash = await candidateFormSpecHash(preview.candidate);
    transaction.working_revision = preview.revision;
    transaction.validation_result = structuredClone(validation);
    transaction.candidate_content_hash = candidateContentHash;
    transaction.preview_hash = candidateReport?.hash || null;
    transaction.candidate_report = candidateReport?.report ? structuredClone(candidateReport.report) : null;
    transaction.previewed_at = iso(bus);
    transaction.render_status = candidateReport?.report?.status || "static-only";
    const status = validation.valid ? "validated" : "previewed";
    setStatus(bus, transaction, status, "preview_created", {
      changes: auditChanges(operations),
      preview_hash: transaction.preview_hash,
      candidate_content_hash: candidateContentHash,
      validation: { valid: validation.valid, error_count: validation.errors.length, warning_count: validation.warnings.length },
    }, "PREVIEW");
    return { transaction, preview, validation, candidateReport };
  } catch (error) {
    if (!transaction) throw error;
    if (error.code === "REVISION_CONFLICT") markConflict(bus, transaction, error);
    else rollbackAfterFailure(bus, transaction, error);
    throw error;
  }
}

export function approveTransaction(bus, input) {
  const transaction = currentTransaction(bus, input.transactionId);
  try {
    bus.ensureRevision(input.expectedRevision);
    checkLease(bus, transaction, input);
    if (!["previewed", "validated", "approved"].includes(transaction.status)) throw leaseError("PREVIEW_REQUIRED", "A fresh preview is required before approval");
    if (input.expectedCandidateHash !== transaction.preview_hash) throw leaseError("CANDIDATE_HASH_MISMATCH", "Approved candidate no longer matches the preview", { expectedCandidateHash: input.expectedCandidateHash, actualCandidateHash: transaction.preview_hash, validation: transaction.validation_result });
    if (input.requireValid !== false && !transaction.validation_result?.valid) throw leaseError("CANDIDATE_INVALID", "Candidate validation failed", { validation: transaction.validation_result });
    transaction.approval = { actor: input.owner || input.agentId || bus.owner || bus.agentId, approved_at: iso(bus), preview_hash: transaction.preview_hash };
    transaction.approved_at = transaction.approval.approved_at;
    setStatus(bus, transaction, "approved", "approved", { approval: transaction.approval, preview_hash: transaction.preview_hash }, "APPROVE");
    bus.maybeFail("after_approval");
    return view(transaction);
  } catch (error) {
    if (error.code === "REVISION_CONFLICT") markConflict(bus, transaction, error);
    else if (!["INJECTED_CRASH", "CANDIDATE_HASH_MISMATCH", "CANDIDATE_INVALID", "PREVIEW_REQUIRED"].includes(error.code)) rollbackAfterFailure(bus, transaction, error);
    throw error;
  }
}

export async function applyApprovedTransaction(bus, input) {
  const transaction = currentTransaction(bus, input.transactionId);
  try {
    bus.ensureRevision(input.expectedRevision);
    checkLease(bus, transaction, input);
    if (transaction.status !== "approved") throw leaseError("TRANSACTION_NOT_APPROVED", "Transaction must be approved from a current preview before commit");
    if (input.expectedCandidateHash !== transaction.preview_hash) throw leaseError("CANDIDATE_HASH_MISMATCH", "Approved candidate no longer matches the preview", { expectedCandidateHash: input.expectedCandidateHash, actualCandidateHash: transaction.preview_hash, validation: transaction.validation_result });
    if (input.requireValid !== false && !transaction.validation_result?.valid) throw leaseError("CANDIDATE_INVALID", "Candidate validation failed", { validation: transaction.validation_result });
    let candidate;
    try { candidate = applyOperations(bus.project, transaction.changes); }
    catch (error) { rollbackAfterFailure(bus, transaction, error); throw error; }
    const candidateContentHash = await projectContentHash(candidate);
    if (candidateContentHash !== transaction.candidate_content_hash) throw leaseError("CANDIDATE_CONTENT_MISMATCH", "The project changed after preview; the transaction must be previewed again", { expectedCandidateHash: transaction.candidate_content_hash, actualCandidateHash: candidateContentHash });
    const diff = diffProjects(bus.project, candidate);
    if (!diff.changed) {
      transaction.commit_result = { status: "committed", no_op: true, revision: bus.revision, committed_at: iso(bus) };
      setStatus(bus, transaction, "committing", "commit_started", { no_op: true }, "COMMIT_STARTED");
      setStatus(bus, transaction, "committed", "revision_committed", { no_op: true, revision: bus.revision }, "COMMIT");
      transaction.committed_at = iso(bus);
      bus.persistTransaction(transaction);
      return { revision: bus.revision, diff, validation: transaction.validation_result, candidateHash: transaction.preview_hash, transaction: view(transaction) };
    }
    transaction.commit_result = { status: "committing", expected_revision: transaction.base_revision, candidate_content_hash: transaction.candidate_content_hash, started_at: iso(bus) };
    setStatus(bus, transaction, "committing", "commit_started", { expected_revision: transaction.base_revision, candidate_content_hash: transaction.candidate_content_hash }, "COMMIT_STARTED");
    bus.maybeFail("during_commit");
    const revision = await bus.commit(candidate, input.reason || "transaction commit", { expectedRevision: transaction.base_revision, expectedProjectHash: transaction.base_project_hash, transactionId: transaction.transaction_id, candidateHash: transaction.candidate_content_hash });
    transaction.working_revision = revision;
    transaction.commit_result = { status: "committed", revision, candidate_content_hash: transaction.candidate_content_hash, committed_at: iso(bus) };
    bus.maybeFail("after_revision_write");
    if (transaction.candidate_report?.status === "ready" && transaction.preview_hash) {
      const committedProjectHash = await hashRenderProject(bus.project);
      bus.recordRenderReport(transaction.candidate_report, { revision, candidateHash: committedProjectHash, baseProjectHash: committedProjectHash, source: "committed" });
    }
    setStatus(bus, transaction, "committed", "revision_committed", { revision, changes: auditChanges(transaction.changes), preview_hash: transaction.preview_hash }, "COMMIT");
    transaction.committed_at = iso(bus);
    bus.persistTransaction(transaction);
    return { revision, diff, validation: transaction.validation_result, candidateHash: transaction.preview_hash, transaction: view(transaction) };
  } catch (error) {
    if (error.code === "REVISION_CONFLICT" || error.code === "STORE_CONFLICT") markConflict(bus, transaction, error);
    else if (error.code === "INJECTED_CRASH") rollbackAfterFailure(bus, transaction, error);
    else if (!["CANDIDATE_HASH_MISMATCH", "CANDIDATE_INVALID", "TRANSACTION_NOT_APPROVED", "CANDIDATE_CONTENT_MISMATCH"].includes(error.code)) rollbackAfterFailure(bus, transaction, error);
    throw error;
  }
}

export function rollbackTransaction(bus, id) {
  const transaction = currentTransaction(bus, id);
  if (transaction.status === "committed") throw leaseError("TRANSACTION_ALREADY_COMMITTED", "A committed transaction can only be reverted with undo_revision");
  if (transaction.status === "rolled_back") return view(transaction);
  if (transaction.status === "committing" || transaction.status === "recovery_required") {
    const recovered = recoverTransaction(bus, { transactionId: id });
    if (recovered.status === "committed") throw leaseError("TRANSACTION_ALREADY_COMMITTED", "The commit completed and cannot be rolled back");
    if (recovered.status === "rolled_back") return view(recovered);
  }
  checkLease(bus, transaction);
  setStatus(bus, transaction, "rolled_back", "rolled_back", { reason: "explicit_rollback" }, "ROLLBACK");
  transaction.rolled_back_at = iso(bus);
  bus.persistTransaction(transaction);
  return view(transaction);
}

export function revisionComparison(bus, fromRevision, toRevision) {
  const from = bus.history.entries.find((entry) => entry.revision === fromRevision);
  const to = bus.history.entries.find((entry) => entry.revision === toRevision);
  if (!from || !to) throw Object.assign(new Error("Revision is no longer available in the in-memory history window"), { code: "REVISION_NOT_AVAILABLE" });
  return { fromRevision, toRevision, diff: diffProjects(from.project, to.project) };
}

export async function commitConvenienceTransaction(bus, operations, expectedRevision, reason) {
  const preview = await previewTransaction(bus, operations, expectedRevision);
  approveTransaction(bus, { expectedRevision, transactionId: preview.transaction.transaction_id, expectedCandidateHash: preview.transaction.preview_hash, requireValid: false });
  return applyApprovedTransaction(bus, { expectedRevision, transactionId: preview.transaction.transaction_id, expectedCandidateHash: preview.transaction.preview_hash, requireValid: false, reason });
}
