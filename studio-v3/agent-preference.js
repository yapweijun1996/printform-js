export const AGENT_KEY = 'printform-studio-v3:work-in-steps';
// "Work in steps" is on unless the person turned it off; a browser without storage keeps the default.
export function agentEnabled(storage = null) {
  try { return (storage || globalThis.localStorage).getItem(AGENT_KEY) !== 'off'; } catch { return true; }
}
export function setAgentEnabled(enabled,storage = null) {
  try { (storage || globalThis.localStorage).setItem(AGENT_KEY,enabled ? 'on' : 'off'); } catch { /* Preference storage is optional. */ }
}
