export async function approveAndApply(bus, preview, options = {}) {
  const expectedRevision = options.expectedRevision ?? preview.result.revision;
  const expectedCandidateHash = options.expectedCandidateHash ?? preview.result.candidateHash;
  const approval = await bus.execute("approve_transaction", {
    expectedRevision,
    transactionId: preview.result.transactionId,
    expectedCandidateHash,
    requireValid: options.requireValid,
  });
  if (!approval.ok) return approval;
  return bus.execute("apply_changes", {
    expectedRevision,
    transactionId: preview.result.transactionId,
    expectedCandidateHash,
    requireValid: options.requireValid,
    reason: options.reason,
  });
}
