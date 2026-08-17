import { isLeaseManagedStatus } from "./transaction-state.js";
import {
  checkLease,
  currentTransaction,
  iso,
  leaseDuration,
  leaseError,
  leaseToken,
  markConflict,
  now,
  save,
  setStatus,
  view,
  revisionConflict,
} from "./transaction-common.js";

export function renewLease(bus, input) {
  const transaction = currentTransaction(bus, input.transactionId);
  if (!isLeaseManagedStatus(transaction.status)) throw leaseError("LEASE_NOT_RENEWABLE", "Only active draft transactions have renewable leases");
  checkLease(bus, transaction, input);
  const heartbeat = now(bus);
  transaction.lease.heartbeat = heartbeat.toISOString();
  transaction.lease.lease_expires_at = new Date(heartbeat.getTime() + (Number(input.durationMs) || leaseDuration(bus))).toISOString();
  save(bus, transaction, "lease_renewed", { lease_id: transaction.lease.lease_id, lease_expires_at: transaction.lease.lease_expires_at }, "LEASE_RENEWED");
  return view(transaction);
}

export function releaseLease(bus, input) {
  const transaction = currentTransaction(bus, input.transactionId);
  checkLease(bus, transaction, input);
  const leaseId = transaction.lease?.lease_id || null;
  transaction.lease = null;
  if (isLeaseManagedStatus(transaction.status)) {
    transaction.expired_at = iso(bus);
    setStatus(bus, transaction, "expired", "lease_released", { lease_id: leaseId }, "LEASE_RELEASED");
  } else {
    save(bus, transaction, "lease_released", { lease_id: leaseId }, "LEASE_RELEASED");
  }
  return view(transaction);
}

export function takeoverTransaction(bus, input) {
  const previous = currentTransaction(bus, input.transactionId);
  if (previous.status !== "expired") throw leaseError("TAKEOVER_NOT_ALLOWED", "Only an expired transaction can be taken over");
  const baseRevision = input.baseRevision ?? previous.base_revision;
  bus.ensureRevision(baseRevision);
  const owner = input.owner || input.agentId || bus.owner || bus.agentId;
  const started = now(bus);
  const replacement = {
    transaction_id: globalThis.crypto?.randomUUID?.() || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    form_id: previous.form_id,
    base_revision: baseRevision,
    working_revision: baseRevision,
    owner,
    agent_id: input.agentId || bus.agentId,
    status: "draft",
    state: "DRAFT",
    patches: [],
    changes: [],
    preview_hash: null,
    validation_result: null,
    approval: null,
    lease: {
      owner,
      lease_id: leaseToken(),
      lease_expires_at: new Date(started.getTime() + leaseDuration(bus)).toISOString(),
      heartbeat: started.toISOString(),
    },
    supersedes_transaction_id: previous.transaction_id,
    created_at: started.toISOString(),
    updated_at: started.toISOString(),
    commit_result: null,
    evidence_pack_ref: null,
  };
  bus.persistTransaction(replacement);
  bus.auditTransaction("lease_takeover", replacement, { supersedes_transaction_id: previous.transaction_id, lease_id: replacement.lease.lease_id });
  bus.auditTransaction("lease_acquired", replacement, { lease_id: replacement.lease.lease_id, takeover: true });
  bus.transactionJournal.append({ type: "LEASE_TAKEOVER", transaction_id: replacement.transaction_id, supersedes_transaction_id: previous.transaction_id, revision: baseRevision, agent_id: replacement.agent_id });
  return view(replacement);
}

export function listActiveTransactions(bus) {
  bus.expireStaleTransactions(now(bus));
  return bus.transactionStore.listActiveTransactions();
}

export function getTransaction(bus, id) { return view(currentTransaction(bus, id)); }

export function recoverTransaction(bus, { transactionId: id } = {}) {
  const transaction = currentTransaction(bus, id);
  if (!["committing", "recovery_required"].includes(transaction.status)) return view(transaction);
  const head = bus.transactionStore.head;
  const committedRevision = transaction.base_revision + 1;
  const hashMatches = !head.project_hash || !transaction.candidate_content_hash || head.project_hash === transaction.candidate_content_hash;
  if (head.revision === committedRevision && head.transaction_id === transaction.transaction_id && hashMatches) {
    transaction.working_revision = head.revision;
    transaction.commit_result = { ...(transaction.commit_result || {}), status: "committed", revision: head.revision, recovered_at: iso(bus) };
    setStatus(bus, transaction, "committed", "recovered", { outcome: "committed", revision: head.revision }, "RECOVERED");
    transaction.committed_at = iso(bus);
    bus.persistTransaction(transaction);
    return view(transaction);
  }
  if (head.revision === transaction.base_revision) {
    transaction.commit_result = { ...(transaction.commit_result || {}), status: "rolled_back", recovered_at: iso(bus) };
    setStatus(bus, transaction, "rolled_back", "recovered", { outcome: "rolled_back", revision: head.revision }, "RECOVERED");
    transaction.rolled_back_at = iso(bus);
    bus.persistTransaction(transaction);
    return view(transaction);
  }
  markConflict(bus, transaction, revisionConflict(transaction.base_revision, head.revision));
  return view(transaction);
}

export function resolveConflict(bus, input) {
  const transaction = currentTransaction(bus, input.transactionId);
  if (transaction.status !== "conflicted") return view(transaction);
  if (input.action !== "rollback") throw leaseError("CONFLICT_RESOLUTION_REQUIRED", "Only explicit rollback is supported for a conflicted transaction");
  transaction.conflict_resolved_at = iso(bus);
  setStatus(bus, transaction, "rolled_back", "rolled_back", { reason: "conflict_resolution" }, "ROLLBACK");
  return view(transaction);
}
