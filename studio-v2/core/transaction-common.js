import { revisionConflict } from "./history.js";
import { sha256, stableStringify } from "./json.js";
import {
  isTerminalStatus,
  stateName,
  transitionTransaction,
} from "./transaction-state.js";

export const DEFAULT_LEASE_MS = 30 * 1000;

export function transactionId(prefix = "tx") {
  return globalThis.crypto?.randomUUID?.()
    || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function now(bus) { return new Date(bus.clock?.() || Date.now()); }
export function iso(bus) { return now(bus).toISOString(); }
export function view(transaction) { return structuredClone(transaction); }

export function auditChanges(operations) {
  return operations.map((operation) => Object.fromEntries(
    ["type", "path", "selector", "slot", "tableSelector", "componentId", "bindingType"]
      .filter((key) => operation[key] !== undefined)
      .map((key) => [key, operation[key]]),
  ));
}

export function legacyJournal(bus, type, transaction, details = {}) {
  bus.transactionJournal.append({
    type,
    transaction_id: transaction?.transaction_id || details.transaction_id,
    revision: details.revision ?? transaction?.working_revision ?? bus.revision,
    agent_id: transaction?.agent_id || bus.agentId,
    ...details,
  });
}

export function save(bus, transaction, event, details = {}, legacyType = null) {
  bus.persistTransaction(transaction);
  bus.auditTransaction(event, transaction, details);
  if (legacyType) legacyJournal(bus, legacyType, transaction, details);
  return transaction;
}

export function setStatus(bus, transaction, status, event, details = {}, legacyType = null) {
  transitionTransaction(transaction, status);
  transaction.status_changed_at = iso(bus);
  return save(bus, transaction, event, details, legacyType);
}

export function leaseToken() { return transactionId("lease"); }
export function leaseDuration(bus) { return Number(bus.leaseDurationMs) || DEFAULT_LEASE_MS; }

export function leaseError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

export function currentTransaction(bus, id) {
  const transaction = bus.refreshTransaction(id);
  if (!transaction) throw leaseError("TRANSACTION_NOT_FOUND", `Unknown transaction: ${id}`);
  return transaction;
}

export function checkLease(bus, transaction, input = {}) {
  if (!transaction.lease) return;
  const expires = new Date(transaction.lease.lease_expires_at).getTime();
  if (expires <= now(bus).getTime()) {
    bus.expireStaleTransactions(now(bus));
    throw leaseError("LEASE_EXPIRED", "The transaction lease has expired", { transactionId: transaction.transaction_id });
  }
  const owner = input.owner || input.agentId || bus.owner || bus.agentId;
  if (owner && owner !== transaction.lease.owner) {
    throw leaseError("LEASE_OWNER_MISMATCH", "The transaction is leased by another owner", { transactionId: transaction.transaction_id, owner: transaction.lease.owner });
  }
  if (input.leaseId && input.leaseId !== transaction.lease.lease_id) {
    throw leaseError("LEASE_ID_MISMATCH", "The lease id does not match the active transaction lease", { transactionId: transaction.transaction_id });
  }
}

export function markConflict(bus, transaction, conflict) {
  if (!transaction || isTerminalStatus(transaction.status)) return transaction;
  try {
    transitionTransaction(transaction, "conflicted");
    transaction.conflict = {
      code: conflict.code || "REVISION_CONFLICT",
      expected_revision: conflict.expectedRevision ?? transaction.base_revision,
      actual_revision: conflict.actualRevision ?? bus.transactionStore.getHeadRevision(),
      detected_at: iso(bus),
    };
    save(bus, transaction, "conflict_detected", transaction.conflict, "CONFLICT");
  } catch {
    // A competing session may have updated this record first.
  }
  return transaction;
}

export function rollbackAfterFailure(bus, transaction, failure) {
  if (transaction.status === "committing") {
    transaction.last_error = { code: failure.code, phase: failure.phase, message: failure.message };
    transitionTransaction(transaction, "recovery_required");
    save(bus, transaction, "recovery_required", { phase: failure.phase }, "INTERRUPTED");
    return;
  }
  if (failure?.code === "INJECTED_CRASH") {
    transaction.last_error = { code: failure.code, phase: failure.phase, message: failure.message };
    save(bus, transaction, "recovery_required", { phase: failure.phase }, "INTERRUPTED");
    return;
  }
  if (!isTerminalStatus(transaction.status)) {
    setStatus(bus, transaction, "rolled_back", "rolled_back", { reason: failure?.code || "TRANSACTION_FAILED" }, "ROLLBACK");
  }
}

export function contentForHash(project) {
  const copy = structuredClone(project);
  delete copy.revision;
  return copy;
}

export async function projectContentHash(project) {
  return sha256(stableStringify(contentForHash(project)));
}

export { revisionConflict, stateName };
