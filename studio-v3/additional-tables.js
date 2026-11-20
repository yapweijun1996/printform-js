import { validPointer } from './design-authoring.js';

export const MAX_ADDITIONAL_TABLES = 4;
export function tableDefinitions(design) {
  return [{id:'items',label:design.blocks.items.label,collection:design.collection,columns:design.columns,enabled:design.blocks.items.enabled,repeatHeader:design.repeatTable,breakBefore:design.breakBefore || Boolean(design.blocks.items.breakBefore)},...(design.additionalTables || [])];
}
export function tableOf(design,id) { return tableDefinitions(design).find(table=>table.id === id) || null; }
export function fieldRows(design,id) { return tableOf(design,id)?.columns || design[id] || []; }
export const isTable = (design,id) => Boolean(tableOf(design,id));
export function validateTableCollection(collection,message = 'Collection must be an absolute JSON pointer such as /items.') {
  if (!validPointer(collection)) throw new Error(message);
}
export function setTableCollection(design,id,collection) {
  const table = tableOf(design,id);
  if (!table) throw new Error('Select an existing source table.');
  validateTableCollection(collection);
  if (id === 'items') design.collection = collection;
  else table.collection = collection;
}
export function validateAdditionalTables(design,validateColumn,assets,ids) {
  if (design.additionalTables === undefined) return;
  if (!Array.isArray(design.additionalTables) || design.additionalTables.length > MAX_ADDITIONAL_TABLES) throw new Error('Use at most four additional source tables.');
  const tables = new Set(['items']);
  for (const table of design.additionalTables) {
    if (!table || typeof table !== 'object' || Array.isArray(table) || Object.keys(table).some(key=>!['id','label','collection','columns','enabled','repeatHeader','breakBefore'].includes(key))) throw new Error('Unsupported additional table property.');
    if (typeof table.id !== 'string' || !/^table-[a-z0-9-]{1,40}$/.test(table.id) || tables.has(table.id)) throw new Error('Additional tables need unique table- prefixed IDs.');
    tables.add(table.id);
    const collectionMessage = 'Additional table needs a label and an absolute collection pointer.';
    if (typeof table.label !== 'string' || table.label.length > 100) throw new Error(collectionMessage);
    validateTableCollection(table.collection,collectionMessage);
    for (const key of ['enabled','repeatHeader','breakBefore']) if (typeof table[key] !== 'boolean') throw new Error(`Invalid additional table ${key}.`);
    if (!Array.isArray(table.columns) || !table.columns.length || table.columns.length > 30) throw new Error('Additional tables need one to thirty columns.');
    if (ids.has(table.id) || ids.has(`${table.id}-header`)) throw new Error('Table ID collides with a field.');
    ids.add(table.id); ids.add(`${table.id}-header`);
    table.columns.forEach(column=>validateColumn(column,table.id,assets,ids,true));
    if (table.columns.reduce((sum,column)=>sum+column.width,0) > 100.01) throw new Error('Column widths must total 100% or less.');
  }
}
