import { describe,it,expect } from 'vitest';
import { restoreStructureOpen,persistStructureOpen,STRUCTURE_KEY } from '../studio-v3/structure-preference.js';
const store = (initial={}) => { const data={...initial}; return {data,getItem:k=>k in data?data[k]:null,setItem:(k,v)=> { data[k]=String(v); }}; };
describe('v3 structure panel preference',()=> {
  it('defaults to hidden when nothing was ever chosen',()=> expect(restoreStructureOpen(store())).toBe(false));
  it('restores only an explicit open choice',()=> {
    const s = store(); persistStructureOpen(true,s); expect(s.data[STRUCTURE_KEY]).toBe('1'); expect(restoreStructureOpen(s)).toBe(true);
    persistStructureOpen(false,s); expect(restoreStructureOpen(s)).toBe(false);
  });
  it('treats junk values as hidden',()=> expect(restoreStructureOpen(store({[STRUCTURE_KEY]:'yes'}))).toBe(false));
  it('stays usable when storage throws',()=> {
    const broken = {getItem() { throw new Error('blocked'); },setItem() { throw new Error('quota'); }};
    expect(restoreStructureOpen(broken)).toBe(false); expect(()=>persistStructureOpen(true,broken)).not.toThrow();
  });
});
