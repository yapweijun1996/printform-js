import { GLOBAL_STYLE_KEYS } from './ai-authoring-contract.js';

const booleanKeys = GLOBAL_STYLE_KEYS.filter(key=>!['color','font','padding'].includes(key));
const number = (value,min,max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

// Used by stored-document validation as well as both editing adapters.
export function validateGlobalStyle(design) {
  if (typeof design.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(design.color) || !number(design.font,6,14) || !number(design.padding,2,16)) throw new Error('Invalid print style settings.');
  for (const key of booleanKeys) if (typeof design[key] !== 'boolean') throw new Error(`Invalid ${key} setting.`);
}

// Transform a private copy only. Scope, transactions and publication stay with callers.
export function globalStyleChange(design,patch) {
  const reject = message => { throw Object.assign(new Error(`UNSAFE_PROPOSAL: ${message}`),{code:'UNSAFE_PROPOSAL'}); };
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key=>!GLOBAL_STYLE_KEYS.includes(key))) reject('Unsupported global style property.');
  const next = structuredClone(design), changes = [];
  for (const [key,value] of Object.entries(patch)) {
    next[key] = structuredClone(value);
    changes.push({target:'style',property:key,before:design[key],after:value});
  }
  try { validateGlobalStyle(next); } catch (error) { reject(error.message); }
  return {design:next,changes,diagnostics:[]};
}
