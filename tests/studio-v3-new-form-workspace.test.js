import {describe,expect,it,vi} from 'vitest';
import {readNewFormCommand,readNewFormOpening} from '../studio-v3/new-form-workspace.js';
import {adoptPrivateDraft} from '../studio-v3/new-form-draft.js';

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
    expect(readNewFormOpening(link()+'&mode=draft','test-build')).toEqual({kind:'blank',id:ID,draft:true});
    for (const hash of [link('unknown'),link('blank','v3-bad'),link('blank',ID,'older-build'),link()+'&mode=adopted']) {
      expect(readNewFormOpening(hash,'test-build')).toEqual({blocked:true});
    }
  });
});

describe('private draft adoption',()=>{
  function reviewed() {
    const ids = ['0','1','45','100','500','long'], project = {sampleData:{fixture:true}};
    const bus = {project,revision:2}, state = {matrix:Object.fromEntries(ids.map(id=>[id,{ready:true}]))};
    const routes = {
      getBus:()=>bus,state,drafts:{drafts:new Map(),applying:new Set()},ai:{},settle:vi.fn(),ready:()=>true,
      initialize:vi.fn(),sync:vi.fn()
    };
    const approval = {scenarioIds:ids,verify:vi.fn(candidate=>expect(candidate).toBe(project)),accept:vi.fn()};
    return {bus,routes,approval};
  }
  it('rejects incomplete scenario and pending proposal without opening local data',async()=>{
    const {routes,approval} = reviewed();
    routes.state.matrix.long.ready = false;
    await expect(adoptPrivateDraft(approval,routes)).rejects.toThrow('Run all synthetic samples');
    routes.state.matrix.long.ready = true; routes.ai.proposal = {};
    await expect(adoptPrivateDraft(approval,routes)).rejects.toThrow('pending draft edits');
    expect(routes.initialize).not.toHaveBeenCalled(); expect(approval.accept).not.toHaveBeenCalled();
  });
  it('rechecks the exact revision after initializing the adopted workspace',async()=>{
    const {bus,routes,approval} = reviewed();
    routes.initialize.mockImplementation(()=>{bus.revision++;});
    await expect(adoptPrivateDraft(approval,routes)).rejects.toThrow('draft changed');
    expect(approval.accept).not.toHaveBeenCalled(); expect(document.body.inert).toBe(false);
  });
  it('admits only the reviewed current revision with no data mutation',async()=>{
    const {bus,routes,approval} = reviewed();
    await adoptPrivateDraft(approval,routes);
    expect(bus.revision).toBe(2); expect(approval.verify).toHaveBeenCalledTimes(2);
    expect(approval.accept).toHaveBeenCalledTimes(1); expect(routes.sync).toHaveBeenCalledTimes(1);
    expect(document.body.inert).toBe(false);
  });
});
