import { fieldKind } from './design-authoring.js';

// The retained pointer is an inspector hint, separate from the effective binding.
export function fieldBindingChange(field, patch, {relative, rememberedPointer} = {}) {
  const changes = {...patch};
  const {kind} = patch;
  if (kind === 'static' || kind === 'image') {
    if (!Object.hasOwn(patch,'pointer') && field.pointer) changes.pointer = '';
  }
  if (kind && kind !== 'image') {
    for (const key of ['assetId','height','fit',...(!relative ? ['width'] : [])]) {
      if (!Object.hasOwn(patch,key) && field[key] !== undefined) changes[key] = undefined;
    }
  }
  if (kind && kind !== 'barcode' && !Object.hasOwn(patch,'barcode') && field.barcode !== undefined) {
    changes.barcode = undefined;
  }
  const next = structuredClone(field);
  for (const [key,value] of Object.entries(changes)) {
    if (value === undefined) delete next[key];
    else next[key] = structuredClone(value);
  }
  if (rememberedPointer !== undefined) next.lastPointer = rememberedPointer;
  else if (next.pointer !== field.pointer || fieldKind(next) !== fieldKind(field)) {
    const previous = next.pointer || field.pointer || field.lastPointer;
    if (previous !== undefined) next.lastPointer = previous;
  }
  return {field:next,changes};
}
