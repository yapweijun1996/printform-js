const KEY = "printform-studio-v2-recovery";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function saveRecoveryDraft(project, fingerprint) {
  localStorage.setItem(KEY, JSON.stringify({ version: 1, savedAt: Date.now(), fingerprint, project }));
}

export function loadRecoveryDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(KEY));
    if (!draft || Date.now() - draft.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return draft;
  } catch {
    localStorage.removeItem(KEY);
    return null;
  }
}

export function clearRecoveryDraft() {
  localStorage.removeItem(KEY);
}
