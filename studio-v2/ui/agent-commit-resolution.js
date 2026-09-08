const UNCERTAIN_APPLY_CODES = new Set([
  "COMMIT_IN_PROGRESS",
  "RECOVERY_REQUIRED",
  "SERVER_UNAVAILABLE",
  "NETWORK_ERROR",
  "TIMEOUT",
  "COMMIT_RESPONSE_LOST",
  "INJECTED_CRASH",
  "AGENT_DIAGNOSTIC",
]);

function recoveryError(transactionId) {
  return Object.assign(new Error("The commit outcome requires recovery."), {
    code: "RECOVERY_REQUIRED",
    transactionId,
  });
}

function committedRevision(transaction) {
  const revision = transaction?.commit_result?.revision ?? transaction?.working_revision;
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : null;
}

async function resolveCommitOutcome(gateway, proposal) {
  let response;
  try {
    response = await gateway.execute("get_transaction", { transactionId: proposal.transactionId });
  } catch {
    throw recoveryError(proposal.transactionId);
  }
  if (!response?.ok) throw recoveryError(proposal.transactionId);
  const transaction = response.result?.transaction;
  if (!transaction || transaction.preview_hash !== proposal.candidateHash || transaction.status !== "committed") {
    throw recoveryError(proposal.transactionId);
  }
  const revision = committedRevision(transaction);
  if (revision === null) throw recoveryError(proposal.transactionId);
  return {
    ok: true,
    result: {
      already_committed: true,
      committed_revision: revision,
      revision,
      diff: proposal.diff,
      validation: proposal.validation || transaction.validation_result,
      candidateHash: transaction.preview_hash,
      transaction,
    },
  };
}

export async function executeApplyWithResolution({ gateway, executeApproval, proposal, input }) {
  let response;
  try {
    response = await executeApproval("apply_changes", input);
  } catch {
    return resolveCommitOutcome(gateway, proposal);
  }
  if (response?.ok) return response;
  const code = response?.error?.code;
  if (!UNCERTAIN_APPLY_CODES.has(code)) {
    throw Object.assign(new Error("Apply failed."), { code: code || "APPLY_FAILED" });
  }
  return resolveCommitOutcome(gateway, proposal);
}
