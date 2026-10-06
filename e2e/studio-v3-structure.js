// Seeds the remembered "structure panel open" preference, as if the user had opened it before.
// The default (hidden) is covered separately in studio-v3-structure-default.spec.js.
export const keepStructureOpen = page => page.addInitScript(() => { try { localStorage.setItem('printform-studio-v3:structure-open','1'); } catch { /* storage unavailable */ } });
