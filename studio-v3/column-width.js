// Column percentages are local values; total width is validated after the atomic batch.
export function validateColumnWidth(width) {
  if (typeof width !== 'number' || !Number.isFinite(width) || width < 1 || width > 100) throw new Error('Column width must be between 1 and 100%.');
}
export function columnWidthChange(column,width) {
  try { validateColumnWidth(width); } catch (error) { throw Object.assign(new Error(`UNSAFE_PROPOSAL: ${error.message}`),{code:'UNSAFE_PROPOSAL'}); }
  return {...structuredClone(column),width};
}
