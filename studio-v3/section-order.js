import { BLOCKS, sectionOrder } from './design-authoring.js';

export function validateSectionOrder(order) {
  if (!Array.isArray(order) || order.length !== BLOCKS.length || new Set(order).size !== BLOCKS.length || order.some(id=>!BLOCKS.includes(id))) throw new Error('Section order must contain every section exactly once.');
}
// Validate permutation here; final-design validation owns repeat-header constraints
// so one atomic operation batch may turn repeating off before or after reordering.
export function sectionOrderChange(design,order) {
  try { validateSectionOrder(order); } catch (error) {
    throw Object.assign(new Error(`UNSAFE_PROPOSAL: ${error.message}`),{code:'UNSAFE_PROPOSAL'});
  }
  const next=structuredClone(design);next.sectionOrder=[...order];
  return {design:next,changes:[{target:'document',property:'sectionOrder',before:sectionOrder(design),after:next.sectionOrder}],diagnostics:[]};
}
