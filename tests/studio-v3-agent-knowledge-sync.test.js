import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {generateAgentPackage,capabilityChanges} from '../scripts/generate-studio-v3-agent.mjs';
import {importClosure} from '../scripts/studio-v3-agent-impact.mjs';
import {checkReleaseReview} from '../scripts/studio-v3-agent-review.mjs';
import {createModels,fauxProvider,fauxAssistantMessage,fauxToolCall} from '@earendil-works/pi-ai';
import {runAgentLoop} from '../studio-v3/agent-loop.js';
import {newProject} from '../studio-v3/demo-templates.js';

const REV = 'a'.repeat(40);
let base, temp;
// A temporary repository holding exactly the tracked files, so one file can change at a time.
function copyTracked(target) {
  const runtime = importClosure(process.cwd(),['studio-v3/agent-loop.js','studio-v3/agent-release.js','studio-v3/ai-agent-run.js','scripts/build-studio-v3.mjs','scripts/studio-v3-pwa.mjs']).files;
  for (const name of new Set([...Object.keys(base.index.files),...runtime])) {
    fs.mkdirSync(path.dirname(path.join(target,name)),{recursive:true}); fs.copyFileSync(name,path.join(target,name));
  }
}
const regenerate = (mutate,options = {}) => {
  const root = fs.mkdtempSync(path.join(temp,'repo-')); copyTracked(root); mutate?.(root);
  return generateAgentPackage({root,revision:REV,baseline:base.manifest,baselineIndex:base.index,...options});
};
const append = (file,text = '\n// changed\n') => root => fs.appendFileSync(path.join(root,file),text);
const changedIds = result => result.changes.changes.map(change => change.id).sort();
const dependents = file => Object.entries(base.index.entries).filter(([,entry]) => entry.files.includes(file) || entry.evaluations.includes(file)).map(([id]) => id).sort();

beforeAll(() => { temp = fs.mkdtempSync(path.join(os.tmpdir(),'agent-kno-')); base = generateAgentPackage({revision:REV}); });
afterAll(() => fs.rmSync(temp,{recursive:true,force:true}));

describe('Studio v3 agent knowledge synchronization (G2)', () => {

  it('KNO-01: clean inputs reproduce every identity, including after a CRLF checkout', () => {
    const again = regenerate();
    expect(again.identity).toEqual(base.identity); expect(again.changes.changes).toEqual([]);
    const crlf = regenerate(root => { const file = path.join(root,'studio-v3/ai-authoring.js'); fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/\n/g,'\r\n')); });
    expect(crlf.identity).toEqual(base.identity);
  });
  it('KNO-01/02: an evaluation, guide or behavior change moves exactly its dependents and names the cause', () => {
    const evaluation = regenerate(append('tests/studio-v3-agent-contracts.test.js'));
    expect(changedIds(evaluation)).toEqual(dependents('tests/studio-v3-agent-contracts.test.js'));
    expect(evaluation.identity.contractHash).not.toBe(base.identity.contractHash);
    const ledger = regenerate(append('docs/STUDIO_V3_FEATURE_LEDGER.csv','printform.extra.row,Data,Extra,inventory-66,Unexposed,agent-callable,yes,,none,planned:CA-04,planned:CA-02,planned:CA-09,proposed,x,\n'));
    expect(changedIds(ledger)).toEqual(['printform.knowledge.product-workflows']);
    // The guide's source changed, so knowledge identity moves even though this copy still holds the old generated guide text.
    expect(ledger.identity.knowledgeHash).not.toBe(base.identity.knowledgeHash);
    expect(ledger.knowledge.skills.find(skill => skill.id === 'product-workflows').hash).toBe(base.knowledge.skills.find(skill => skill.id === 'product-workflows').hash);
    // Same schema, different behavior: a handler-side edit still demands review, with the edited file as cause.
    const behavior = regenerate(append('studio-v3/ai-authoring.js'));
    const change = behavior.changes.changes.find(item => item.id === 'printform.authoring.set_style');
    expect(change).toMatchObject({kind:'changed',reviewRequired:true,causes:['studio-v3/ai-authoring.js'],impacts:{guides:['form-authoring']}});
    expect(change.impacts.evaluations).toContain('tests/studio-v3-ai-authoring.test.js');
  });
  it('KNO-03: a shared renderer or validator change expands to every transitive dependent', () => {
    const shared = 'studio-v2/core/schema.js', expected = dependents(shared);
    expect(expected.length).toBeGreaterThan(10);
    const result = regenerate(append(shared));
    expect(changedIds(result)).toEqual(expected);
    expect(result.changes.changes.every(change => change.causes.includes(shared))).toBe(true);
    expect(() => regenerate(append('studio-v3/agent-handlers.js','\nexport const load = name => import(name);\n'))).toThrow('Untracked dynamic agent dependency: studio-v3/agent-handlers.js');
  });
  it('KNO-05: an unknown predecessor reports the full current coverage; a malformed baseline is rejected', () => {
    const initial = generateAgentPackage({revision:REV});
    expect(initial.changes.baseline).toBeNull();
    expect(initial.changes.changes.map(change => change.kind)).toEqual(initial.manifest.entries.map(() => 'added'));
    expect(initial.changes.changes.every(change => change.causes === null)).toBe(true);
    expect(() => capabilityChanges({version:1,release:'bad',entries:[]},initial.manifest)).toThrow('Invalid published agent baseline');
  });
});

describe('Studio v3 release review gate (KNO-04)', () => {
  const evaluation = 'tests/studio-v3-agent-contracts.test.js';
  let changed, review;
  beforeAll(() => {
    changed = regenerate(append(evaluation));
    const digest = id => changed.manifest.entries.find(entry => entry.id === id).hash;
    review = kind => ({version:1,baseline:changed.changes.baseline,dispositions:[{entries:Object.fromEntries(changed.changes.changes.map(change => [change.id,digest(change.id)])),
      disposition:kind,justification:'Only test comments changed; behavior and guides are unchanged.',evidence:[evaluation]}]});
  });
  const check = (doc,report = changed.changes) => checkReleaseReview({report,review:doc,manifest:changed.manifest,previousIndex:base.index,currentIndex:changed.index});

  it('accepts digest-bound no-impact and updated dispositions with real evidence', () => {
    expect(check(review('no-impact'))).toEqual({errors:[],reviewed:changed.changes.changes.length});
    expect(check(review('updated')).errors).toEqual([]); // the evaluation itself changed, so it is real updated evidence
  });
  it('blocks missing, stale, extra and baseline-mismatched dispositions', () => {
    expect(check({version:1,baseline:changed.changes.baseline,dispositions:[]}).errors[0]).toMatch(/without an owner disposition/);
    const stale = review('no-impact'); const [id] = Object.keys(stale.dispositions[0].entries); stale.dispositions[0].entries[id] = 'f'.repeat(64);
    expect(check(stale).errors).toContainEqual(expect.stringMatching(new RegExp(`^${id.replace(/\./g,'\\.')}: disposition is stale`)));
    const extra = review('no-impact'); extra.dispositions[0].entries['printform.agent.ghost'] = 'a'.repeat(64);
    expect(check(extra).errors).toContain('printform.agent.ghost: disposition has no matching change; remove it.');
    expect(check({...review('no-impact'),baseline:{release:'b'.repeat(40),packageHash:'x'}}).errors[0]).toMatch(/targets baseline/);
    expect(check(null).errors).toEqual(['Release review file is missing or invalid.']);
  });
  it('rejects unsupported evidence and the first-baseline-only reconciliation', () => {
    const weak = review('no-impact'); weak.dispositions[0].evidence = ['docs/STUDIO_V3.md']; weak.dispositions[0].justification = 'fine';
    const errors = check(weak).errors;
    expect(errors.some(error => error.includes('no-impact needs one of its evaluations'))).toBe(true);
    expect(errors.some(error => error.includes('justification must explain'))).toBe(true);
    const unchanged = review('updated'); unchanged.dispositions[0].evidence = ['studio-v3/agent-registry.js'];
    expect(check(unchanged).errors.some(error => error.includes('updated needs evidence of a changed'))).toBe(true);
    expect(check(review('reconciled')).errors.some(error => error.includes('only allowed for the first full baseline'))).toBe(true);
    const missing = review('no-impact'); missing.dispositions[0].evidence = ['tests/missing.test.js'];
    expect(check(missing).errors.some(error => error.includes('evidence tests/missing.test.js does not exist'))).toBe(true);
  });
  it('allows a full reconciliation for the first baseline and rejects a removal without a tombstone', () => {
    const first = generateAgentPackage({revision:REV});
    const doc = {version:1,baseline:null,dispositions:[{entries:Object.fromEntries(first.manifest.entries.map(entry => [entry.id,entry.hash])),
      disposition:'reconciled',justification:'First baseline: every capability and guide was reviewed against the ledger.',evidence:['docs/STUDIO_V3_FEATURE_LEDGER.csv']}]};
    expect(checkReleaseReview({report:first.changes,review:doc,manifest:first.manifest,currentIndex:first.index}).errors).toEqual([]);
    const removal = {...changed.changes,changes:[{id:'printform.agent.old',kind:'removed',reviewRequired:true,tombstone:false}]};
    const errors = check({version:1,baseline:changed.changes.baseline,dispositions:[{entries:{'printform.agent.old':'removed'},disposition:'no-impact',justification:'Removed tool had no users at all.',evidence:[evaluation]}]},removal).errors;
    expect(errors).toContain('printform.agent.old: removed without a tombstone and replacement advice.');
  });
});

describe('Studio v3 run-bound knowledge identity (KNO-07)', () => {
  const call = (name,args = {}) => fauxAssistantMessage([fauxToolCall(name,args,{id:`c-${name}`})],{stopReason:'toolUse'});
  it('keeps one package identity for a whole run and refreshes it on the next run', async () => {
    let current = {release:'a'.repeat(40),verified:true}, checks = 0;
    const verifyRelease = async () => { checks++; return current; };
    const run = async () => {
      const seen = [], faux = fauxProvider({provider:'kno-07',models:[{id:'kno-07'}]});
      faux.setResponses([call('get_capabilities'),context => { seen.push(JSON.parse(context.messages.at(-1).content[0].text).identity); current = {release:'b'.repeat(40),verified:true};
        return call('read_skill',{id:'form-authoring'}); },context => { seen.push(JSON.parse(context.messages.at(-1).content[0].text).identity); return call('report_blocked',{reason:'Done.'}); }]);
      const models = createModels(); models.setProvider(faux.provider);
      await expect(runAgentLoop({models,model:faux.getModel(),project:newProject(),request:'Check',context:() => '{}',signal:new AbortController().signal,verifyRelease})).rejects.toMatchObject({code:'AGENT_BLOCKED'});
      return seen;
    };
    // The release changed mid-run (current switched to b), but the run kept a; the next run picks up b.
    expect(await run()).toEqual([{release:'a'.repeat(40),verified:true},{release:'a'.repeat(40),verified:true}]);
    expect(await run()).toEqual([{release:'b'.repeat(40),verified:true},{release:'b'.repeat(40),verified:true}]);
    expect(checks).toBe(2);
  });
});
