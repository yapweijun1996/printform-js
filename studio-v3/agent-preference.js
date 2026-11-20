export const AGENT_KEY = 'printform-studio-v3:work-in-steps';
// "Work in steps" is on unless the person turned it off; a browser without storage keeps the default.
export function agentEnabled(storage = null) {
  try { return (storage || globalThis.localStorage).getItem(AGENT_KEY) !== 'off'; } catch { return true; }
}
export function setAgentEnabled(enabled,storage = null) {
  try { (storage || globalThis.localStorage).setItem(AGENT_KEY,enabled ? 'on' : 'off'); } catch { /* Preference storage is optional. */ }
}

export const ANSWER_ONLY_KEY = 'printform-studio-v3:answer-only';
// Keep the restrictive mode in this browser tab. Independent tabs choose their own mode.
export function answerOnlyEnabled(storage = null) {
  try { return (storage || globalThis.sessionStorage).getItem(ANSWER_ONLY_KEY) === 'on'; } catch { return false; }
}
export function setAnswerOnlyEnabled(enabled,storage = null) {
  try {
    const tab = storage || globalThis.sessionStorage;
    if (enabled) tab.setItem(ANSWER_ONLY_KEY,'on');
    else tab.removeItem(ANSWER_ONLY_KEY);
  } catch { /* The current checkbox remains authoritative when preference storage is unavailable. */ }
}
