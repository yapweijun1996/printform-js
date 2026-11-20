import { fieldRows } from './additional-tables.js';

function unsafe(message) {
  throw Object.assign(new Error(`UNSAFE_PROPOSAL: ${message}`),{code:'UNSAFE_PROPOSAL'});
}

// Callers own a private design and validate the complete edit before committing.
export function addField(design,section,value) {
  const fields = fieldRows(design,section);
  if (fields.some(field=>field.id === value.id)) unsafe('Field ID already exists in this section.');
  const field = structuredClone(value);
  for (const key of ['format','label','pointer']) if (!Object.hasOwn(field,key)) field[key] = '';
  fields.push(field);
  return field;
}

export function removeField(design,section,index) {
  const fields = fieldRows(design,section);
  if (!Number.isInteger(index) || index < 0 || index >= fields.length) unsafe('Select an existing field.');
  return fields.splice(index,1)[0];
}

export function reorderFields(design,section,order) {
  const fields = fieldRows(design,section);
  const byId = new Map(fields.map(field=>[`${section}-${field.id}`,field]));
  if (!Array.isArray(order) || order.length !== fields.length || new Set(order).size !== fields.length || order.some(id=>!byId.has(id))) {
    unsafe('Field order must contain every field in the section exactly once.');
  }
  fields.splice(0,fields.length,...order.map(id=>byId.get(id)));
}
