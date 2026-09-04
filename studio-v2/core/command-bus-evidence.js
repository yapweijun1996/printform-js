import { isLeaseManagedStatus, isTerminalStatus, transitionTransaction } from "./transaction-state.js";

export function expireStaleTransactions(bus, now = bus.clock()) {
  const timestamp = new Date(now).getTime();
  const expired = [];
  for (const item of bus.transactionStore.listActiveTransactions()) {
    if (!isLeaseManagedStatus(item.status) || !item.lease?.lease_expires_at) continue;
    if (new Date(item.lease.lease_expires_at).getTime() > timestamp) continue;
    const transaction = bus.refreshTransaction(item.transaction_id);
    if (!transaction || isTerminalStatus(transaction.status)) continue;
    transitionTransaction(transaction, "expired");
    transaction.expired_at = new Date(timestamp).toISOString();
    transaction.lease = null;
    bus.persistTransaction(transaction);
    bus.auditTransaction("lease_expired", transaction, { reason: "lease_timeout" });
    bus.transactionJournal.append({ type: "LEASE_EXPIRED", transaction_id: transaction.transaction_id, revision: bus.revision, agent_id: transaction.agent_id });
    expired.push(bus.transactionView(transaction));
  }
  return expired;
}

export async function ensurePublishTransaction(bus) {
  const committed = bus.transactionStore.listTransactions()
    .filter((transaction) => transaction.status === "committed" && transaction.working_revision === bus.revision)
    .sort((left, right) => String(right.committed_at || right.updated_at).localeCompare(String(left.committed_at || left.updated_at)));
  if (committed[0]) return committed[0].transaction_id;

  const preview = await bus.previewTransaction([], bus.revision);
  const transactionId = preview.transaction.transaction_id;
  const candidateHash = preview.transaction.preview_hash;
  bus.approveTransaction({
    expectedRevision: bus.revision,
    transactionId,
    expectedCandidateHash: candidateHash,
    requireValid: true,
  });
  const applied = await bus.applyApprovedTransaction({
    expectedRevision: bus.revision,
    transactionId,
    expectedCandidateHash: candidateHash,
    requireValid: true,
    reason: "publish evidence anchor",
  });
  return applied.transaction.transaction_id;
}

export function recordEvidencePack(bus, pack) {
  if (!pack || pack.revision !== bus.revision) {
    throw Object.assign(new Error("Evidence pack revision does not match the current draft"), { code: "EVIDENCE_REVISION_MISMATCH" });
  }
  bus.maybeFail("during_evidence_write");
  const transactionId = pack.transactionId || bus.transactionStore.head.transaction_id;
  const transaction = transactionId ? bus.transactionStore.getTransaction(transactionId) : null;
  if (transaction?.preview_hash && pack.previewHash && transaction.preview_hash !== pack.previewHash) {
    throw Object.assign(new Error("Evidence pack preview hash does not match the approved transaction"), { code: "EVIDENCE_PREVIEW_MISMATCH" });
  }
  if (transaction?.candidate_form_spec_hash && pack.formSpecHash && transaction.candidate_form_spec_hash !== pack.formSpecHash) {
    throw Object.assign(new Error("Evidence pack FormSpec hash does not match the approved transaction"), { code: "EVIDENCE_FORMSPEC_MISMATCH" });
  }
  const anchor = bus.transactionStore.anchorEvidence({ transactionId, pack, actor: bus.owner || bus.agentId });
  bus.evidencePack = structuredClone(pack);
  bus.transactionJournal.append({ type: "EVIDENCE_PACK", revision: bus.revision, pack: bus.evidencePack });
  bus.transactionJournal.append({
    type: "EVIDENCE_ANCHORED", revision: bus.revision, transaction_id: anchor.transaction_id,
    evidence_pack_hash: anchor.evidence_pack_hash, artifact_hash: anchor.artifact_hash
  });
  const saved = bus.transactionStore.getTransaction(anchor.transaction_id);
  if (saved) bus.transactions.set(anchor.transaction_id, saved);
  return structuredClone(bus.evidencePack);
}
