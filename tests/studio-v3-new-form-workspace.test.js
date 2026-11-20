import {describe,expect,it} from 'vitest';
import {readNewFormCommand,readNewFormOpening} from '../studio-v3/new-form-workspace.js';

const ID = 'v3-767f7389-09bc-4510-95fb-7f8a4bcc1828';
const link = (kind='blank',id=ID,build='test-build')=>`#new-form=${kind}&document=${id}&build=${build}`;

describe('new form local host control',()=>{
  it.each(['blank','invoice','purchase','delivery'])('recognizes %s as a supported closed starter',kind=>{
    expect(readNewFormCommand(` /NEW    ${kind}\n`)).toEqual({kind});
    expect(readNewFormOpening(link(kind),'test-build')).toEqual({kind,id:ID});
  });
  it.each(['/new','/new company/secret','/new invoice and use customer data','/new constructor','/new __proto__'])(
    'handles an unsupported local command without marking it as a provider request: %s',request=>{
      expect(readNewFormCommand(request)).toEqual({error:expect.stringContaining('/new blank')});
    });
  it('leaves ordinary requests alone and rejects launches from an obsolete build or invalid ID',()=>{
    expect(readNewFormCommand('Start a purchase order')).toBeNull();
    expect(readNewFormOpening('#section','test-build')).toBeNull();
    for (const hash of [link('unknown'),link('blank','v3-bad'),link('blank',ID,'older-build')]) {
      expect(readNewFormOpening(hash,'test-build')).toEqual({blocked:true});
    }
  });
});
