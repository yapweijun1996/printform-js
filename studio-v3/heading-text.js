export function validateHeading(value) {
  if (typeof value !== 'string' || value.length > 100) throw new Error('Document heading must contain at most 100 characters.');
}

// Changing stored text never enables a hidden header or grants editing authority.
export function headingTextChange(design,value) {
  try { validateHeading(value); } catch (error) {
    throw Object.assign(new Error(`UNSAFE_PROPOSAL: ${error.message}`),{code:'UNSAFE_PROPOSAL'});
  }
  const next = structuredClone(design); next.title = value;
  return {design:next,changes:[{target:'header-title',property:'title',before:design.title,after:value}],diagnostics:[]};
}
