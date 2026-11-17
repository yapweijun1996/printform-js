import { BLOCKS } from './design-authoring.js';

const keys = ['enabled','label','layout','breakBefore','keepTogether'];
const number = (value,min,max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const exact = (value,allowed,label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key=>!allowed.includes(key))) throw new Error(`Unsupported ${label} property.`);
};
export function validateSection(block,id) {
  exact(block,keys,`${id} block`);
  if (typeof block.enabled !== 'boolean' || typeof block.label !== 'string' || block.label.length > 100) throw new Error(`Invalid ${id} block.`);
  for (const key of ['breakBefore','keepTogether']) if (block[key] !== undefined && typeof block[key] !== 'boolean') throw new Error(`Invalid ${key} setting.`);
  if (block.layout !== undefined) {
    exact(block.layout,['columns','gap'],'section layout');
    if (block.layout.columns !== undefined && (!Number.isInteger(block.layout.columns) || !number(block.layout.columns,1,4))) throw new Error('Section layout needs one to four columns.');
    if (block.layout.gap !== undefined && !number(block.layout.gap,0,48)) throw new Error('Section gap must be between 0 and 48px.');
    if (id === 'items') throw new Error('Table layout uses column widths, not section grid columns.');
  }
}

// Shared section-local validation. Cross-section invariants still run on the final design.
export function sectionPropertiesChange(design,target,patch) {
  const reject = message => { throw Object.assign(new Error(`UNSAFE_PROPOSAL: ${message}`),{code:'UNSAFE_PROPOSAL'}); };
  if (!BLOCKS.includes(target)) reject('Select an existing document section.');
  try { exact(patch,keys,'section patch'); } catch (error) { reject(error.message); }
  const next = structuredClone(design), changes = [];
  for (const [property,value] of Object.entries(patch)) {
    changes.push({target,property,before:design.blocks[target][property],after:value});
    // The human form can reset its optional grid; JSON operation schemas are unchanged.
    if (value === undefined) delete next.blocks[target][property];
    else next.blocks[target][property] = structuredClone(value);
  }
  try { validateSection(next.blocks[target],target); } catch (error) { reject(error.message); }
  return {design:next,changes,diagnostics:[]};
}
