export const TRANSACTION_STATUS = Object.freeze({
  DRAFT: "draft",
  PREVIEWED: "previewed",
  VALIDATED: "validated",
  APPROVED: "approved",
  COMMITTING: "committing",
  COMMITTED: "committed",
  ROLLED_BACK: "rolled_back",
  EXPIRED: "expired",
  CONFLICTED: "conflicted",
  RECOVERY_REQUIRED: "recovery_required",
});

const TRANSITIONS = Object.freeze({
  draft: new Set(["previewed", "validated", "rolled_back", "expired", "conflicted"]),
  previewed: new Set(["validated", "approved", "rolled_back", "expired", "conflicted"]),
  validated: new Set(["approved", "rolled_back", "expired", "conflicted"]),
  approved: new Set(["committing", "rolled_back", "expired", "conflicted"]),
  committing: new Set(["committed", "rolled_back", "conflicted", "recovery_required"]),
  recovery_required: new Set(["committed", "rolled_back", "conflicted"]),
  committed: new Set(),
  rolled_back: new Set(),
  expired: new Set(),
  // A conflict is terminal for normal editing, but an explicit
  // resolve_conflict/rollback operation may close its audit record.
  conflicted: new Set(["rolled_back"]),
});

const DISPLAY_STATE = Object.freeze(Object.fromEntries(
  Object.entries(TRANSACTION_STATUS).map(([name, value]) => [value, name]),
));

export function stateName(status) {
  return DISPLAY_STATE[status] || "UNKNOWN";
}

export function isTerminalStatus(status) {
  return [
    TRANSACTION_STATUS.COMMITTED,
    TRANSACTION_STATUS.ROLLED_BACK,
    TRANSACTION_STATUS.EXPIRED,
    TRANSACTION_STATUS.CONFLICTED,
  ].includes(status);
}

export function isLeaseManagedStatus(status) {
  return [
    TRANSACTION_STATUS.DRAFT,
    TRANSACTION_STATUS.PREVIEWED,
    TRANSACTION_STATUS.VALIDATED,
    TRANSACTION_STATUS.APPROVED,
  ].includes(status);
}

export function canTransition(from, to) {
  return from === to || Boolean(TRANSITIONS[from]?.has(to));
}

export function transitionTransaction(transaction, nextStatus) {
  const from = transaction.status;
  if (!canTransition(from, nextStatus)) {
    const error = new Error(`Invalid transaction state transition: ${from} -> ${nextStatus}`);
    error.code = "INVALID_TRANSACTION_STATE";
    error.from = from;
    error.to = nextStatus;
    throw error;
  }
  transaction.status = nextStatus;
  transaction.state = stateName(nextStatus);
  return transaction;
}

export function transactionStateSnapshot(transaction) {
  return {
    status: transaction?.status || null,
    state: stateName(transaction?.status),
  };
}
