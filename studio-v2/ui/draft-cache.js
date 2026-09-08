const KEY = "printform-studio-v2-recovery";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function saveRecoveryDraft(project, fingerprint, { policy = null } = {}) {
  if (policy?.classification !== "synthetic" || policy.allowRecovery !== true) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, savedAt: Date.now(), fingerprint, classification: policy?.classification || "synthetic", project }));
    return true;
  } catch (error) {
    // QuotaExceededError (large projects with inlined logos) or Safari private
    // mode — recovery is best-effort and must not throw out of the change bus.
    console.warn("PrintForm Studio: recovery draft not saved", error);
    return false;
  }
}

function readStoredDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(KEY));
    if (!draft || !Number.isFinite(draft.savedAt) || Date.now() - draft.savedAt > MAX_AGE_MS) return null;
    return draft;
  } catch {
    return null;
  }
}

export function peekRecoveryDraft() {
  const draft = readStoredDraft();
  if (!draft) return null;
  const classification = ["synthetic", "unknown", "real"].includes(draft.classification) ? draft.classification : "unknown";
  return { version: draft.version, savedAt: draft.savedAt, fingerprint: draft.fingerprint || null, classification };
}

export function loadRecoveryDraft({ policy = null, explicit = false } = {}) {
  if (!policy || (policy.allowRecovery !== true && !explicit)) return null;
  return readStoredDraft();
}

export function clearRecoveryDraft() {
  localStorage.removeItem(KEY);
}
