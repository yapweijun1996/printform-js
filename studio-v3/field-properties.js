import { FORMATS } from './design-authoring.js';
import { validateFieldStyle } from './element-style.js';

const styleKeys = ['labelStyle','valueStyle'];
const propertyKeys = ['label','format','showLabel',...styleKeys];

export function validateFieldProperties(field) {
  if (typeof field.label !== 'string' || field.label.length > 100 || !FORMATS.includes(field.format ?? '')) {
    throw new Error('Invalid field label, text or format.');
  }
  if (field.showLabel !== undefined && typeof field.showLabel !== 'boolean') throw new Error('showLabel must be a boolean.');
  for (const key of styleKeys) if (field[key] !== undefined) validateFieldStyle(field[key]);
}

// Read only the field properties shared by both adapters. Binding and geometry
// changes belong to their own services and policy checks.
export function fieldPropertiesChange(field, patch) {
  const changes = Object.fromEntries(Object.entries(patch).filter(([key])=>propertyKeys.includes(key)));
  try { validateFieldProperties({...field,...changes}); } catch (error) {
    throw Object.assign(new Error(`UNSAFE_PROPOSAL: ${error.message}`),{code:'UNSAFE_PROPOSAL'});
  }
  for (const key of styleKeys) if (Object.hasOwn(changes,key) && changes[key] !== undefined) {
    const entries = Object.entries(changes[key]).filter(([,value])=>value !== undefined);
    const previous = field[key];
    const unchanged = entries.length === Object.keys(previous || {}).length && entries.every(([name,value])=>previous?.[name] === value);
    changes[key] = entries.length ? structuredClone(unchanged ? previous : Object.fromEntries(entries)) : undefined;
  }
  return changes;
}
