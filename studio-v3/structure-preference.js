export const STRUCTURE_KEY = 'printform-studio-v3:structure-open';
// The Design structure tree starts hidden; only an explicit user choice opens it.
export function restoreStructureOpen(storage = null) {
  try { return (storage || globalThis.localStorage).getItem(STRUCTURE_KEY) === '1'; } catch { return false; /* Default stays hidden without storage. */ }
}
export function persistStructureOpen(open,storage = null) {
  try { (storage || globalThis.localStorage).setItem(STRUCTURE_KEY,open ? '1' : '0'); } catch { /* Preference storage is optional. */ }
}
