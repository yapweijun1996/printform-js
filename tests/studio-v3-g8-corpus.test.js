import {describe,it,expect} from 'vitest';
import {agentBody} from '../studio-v3/agent-wire.js';
import {AGENT_TOOL_DEFINITIONS} from '../studio-v3/agent-registry.js';
import {readRegister} from '../scripts/studio-v3-task-register.mjs';
import {validateCorpus,publicInput,digest,projectForCase,stateOf} from '../scripts/studio-v3-g8-corpus.mjs';
import {evaluateEvidence,expectedState} from '../scripts/studio-v3-g8-evaluator.mjs';
import {saveProject} from '../studio-v3/file-io.js';
import {verifySourceArtifact} from '../studio-v3/source-workspace-artifact.js';
import {changesBetween,sha,treeDigest,LIMITS} from '../coding-runner/policy.mjs';
import {corpus,profile,fixture,sourceFixture,geometry,seal} from './support/g8-evidence-fixture.js';

// All signed inputs in this file are synthetic consumer-unit evidence, never real attempts.
const evaluate = ({c,evidence},p=profile) => evaluateEvidence(c,seal(evidence),p,{corpus});
function replaceArtifactBytes(evidence,content) {
  const path='artifacts/form.printform-operations.json', artifact=evidence.artifact, previousId=artifact.id;
  const tree=evidence.source.finalTree, file=tree.entries.find(entry=>entry.path===path), build=evidence.source.calls.at(-1);
  Object.assign(file,{content,bytes:Buffer.byteLength(content),digest:sha(content)});
  tree.treeDigest=treeDigest(tree.entries);
  Object.assign(build.receipt,{afterDigest:tree.treeDigest,changes:changesBetween(build.inputTree.entries,tree.entries)});
  Object.assign(artifact,{content,bytes:file.bytes,contentDigest:file.digest,treeDigest:tree.treeDigest});
  artifact.id=`artifact-${sha(JSON.stringify([artifact.workspaceId,artifact.buildCallId,path,artifact.sourceRevision,artifact.treeDigest,artifact.contentDigest,artifact.imageDigest]))}`;
  evidence.events.find(event=>event.artifactId===previousId).artifactId=artifact.id;
}

describe('G8 frozen corpus and independent evidence consumer',()=> {
  it.each([
    ['duplicate key',content=>`{"operations":[],${content.slice(1)}`,'artifact JSON invalid'],
    ['duplicate decoded key',content=>`{"\\u006fperations":[],${content.slice(1)}`,'artifact JSON invalid'],
    ['over-limit bytes',content=>content+' '.repeat(LIMITS.artifactBytes+1-Buffer.byteLength(content)),'artifact exceeds runner byte limit']
  ])('rejects independently rebound %s just like the Studio artifact importer',async(_name,mutate,reason)=>{
    const f=sourceFixture();
    expect(evaluate(f).outcome).toBe('Pass');
    replaceArtifactBytes(f.evidence,mutate(f.evidence.artifact.content));
    await expect(verifySourceArtifact(f.evidence.artifact,f.evidence.artifact)).rejects.toMatchObject({code:'ARTIFACT_REJECTED'});
    const evaluated=evaluate(f);
    expect(evaluated.outcome).toBe('Fail');
    expect(evaluated.errors).toContain(reason);
  });

  it('retains exact hashing for a valid UTF-8 BOM artifact within the runner limit',async()=>{
    const f=sourceFixture();
    const content='\uFEFF'+f.evidence.artifact.content;
    replaceArtifactBytes(f.evidence,content+' '.repeat(LIMITS.artifactBytes-Buffer.byteLength(content)));
    await expect(verifySourceArtifact(f.evidence.artifact,f.evidence.artifact)).resolves.toEqual(f.c.oracle.artifact);
    expect(evaluate(f).outcome).toBe('Pass');
  });


  it('binds all sixty actual distinct inputs, twenty holdouts and six essential slots without recording synthetic attempts',()=> {
    expect(validateCorpus(corpus)).toEqual([]);
    expect(corpus).toHaveLength(60);
    expect(new Set(corpus.map(c=>digest(c.input))).size).toBe(60);
    expect(corpus.filter(c=>c.holdout)).toHaveLength(20);
    expect(corpus.filter(c=>c.essential)).toHaveLength(6);
    expect(readRegister().attempts.rows.some(a=>a.profile==='synthetic-unit-only')).toBe(false);
  });
  it('rejects extra frozen register entries while preserving draft and retired rows',()=> {
    const register=readRegister(), original=register.tasks.rows.find(row=>row.id==='T-qa-06');
    const extra={...original,id:'T-qa-07',status:'draft'};
    register.tasks.rows.push(extra);
    expect(validateCorpus(corpus,register)).toEqual([]);
    extra.status='retired';
    expect(validateCorpus(corpus,register)).toEqual([]);
    extra.status='frozen';
    expect(validateCorpus(corpus,register)).toEqual(['T-qa-07: frozen register row missing from corpus']);
  });
  it('materializes an editable cheap read-only essential with exactly its frozen state',()=> {
    const c=corpus.find(c=>c.id==='T-qa-01');
    expect(stateOf(projectForCase(c))).toEqual(c.input.state);
  });
  it('keeps held-out inputs behind explicit qualification access, away from normal smoke',()=> {
    const c=corpus.find(c=>c.holdout);
    expect(()=>publicInput(c)).toThrow('Held-out');
    expect(publicInput(c,{qualification:true}).inputDigest).toBe(digest(c.input));
  });
  it.each(['input','oracle'])('rejects a mutated frozen %s',field=> {
    const changed=structuredClone(corpus);changed[0][field].tampered=true;
    expect(validateCorpus(changed).some(e=>e.includes('mismatch'))).toBe(true);
  });
  it('computes exact numeric answer correctness rather than accepting a signed success flag',()=> {
    const f=fixture();expect(evaluate(f).outcome).toBe('Pass');
    f.evidence.answer='{"fontPt":12}';f.evidence.passed=true;
    expect(evaluate(f).errors).toContain('wrong delivered numeric/boolean answer');
  });
  it('rejects model-authored unsigned observations even when all values are plausible',()=> {
    const f=fixture();expect(evaluateEvidence(f.c,{evidence:f.evidence,signature:''},profile,{corpus}).outcome).toBe('Fail');
  });
  it('rejects evidence edited after signing',()=> {
    const f=fixture(),envelope=seal(f.evidence);envelope.evidence.answer='{"fontPt":99}';
    expect(evaluateEvidence(f.c,envelope,profile,{corpus}).errors).toContain('independent collector signature invalid/missing');
  });
  it.each(['source_commit','app_digest','knowledge_digest','runner_image','provider_route','model_version','browser_os','budgets_digest'])('rejects frozen execution identity drift in %s',key=> {
    const f=fixture();f.evidence.identity[key]='changed';expect(evaluate(f).outcome).toBe('Fail');
  });
  it.each(['providerBodies','events','before','after','usage','inputDigest','profileDigest','runId','baseRevision','finalRevision','finalDocumentId'])('cannot Pass without %s',key=> {
    const f=fixture();delete f.evidence[key];expect(evaluate(f).outcome).toBe('Fail');
  });
  it('recomputes actual serialized provider bytes and rejects a substituted model alias',()=> {
    const f=fixture();f.evidence.providerBodies[0].body='{"model":"different"}';
    expect(evaluate(f).outcome).toBe('Fail');
    f.evidence.providerBodies[0].digest=digest(f.evidence.providerBodies[0].body);
    expect(evaluate(f).errors).toContain('actual dispatched model alias differs from frozen profile');
  });
  it('accepts the strict wire emitted by the real encoder with the full tool catalog',()=>{
    const f=fixture('T-data-01');
    const body=agentBody({alias:profile.modelAlias,stream:true,
      context:{systemPrompt:'Synthetic request only.',messages:[{role:'user',content:f.c.input.prompt}],tools:AGENT_TOOL_DEFINITIONS}});
    f.evidence.providerBodies=[{route:profile.identity.provider_route,body,digest:digest(body)}];
    f.evidence.events.push({type:'tool-result',tool:'report_blocked',reason:'Synthetic refusal evidence.'});
    expect(evaluate(f)).toMatchObject({admissible:true,outcome:'Blocked',errors:[]});
  });
  it('retains observed disclosure from a hashed request to a foreign route',()=>{
    const f=fixture(),request=f.evidence.providerBodies[0];
    request.body=JSON.stringify({model:profile.modelAlias,input:f.c.input.prompt,extra:f.c.input.state.data.company.name});
    request.route='https://other-synthetic.example.test';
    request.digest=digest(request.body);
    const result=evaluate(f);
    expect(result).toMatchObject({admissible:false,outcome:'Fail',critical_violation:'yes'});
    expect(result.errors).toContain('critical ungranted fixture-value disclosure');
  });
  it('rejects ungranted fictional values on actual outgoing provider bytes',()=> {
    const f=fixture(),p=f.evidence.providerBodies[0];p.body=JSON.stringify({model:profile.modelAlias,input:f.evidence.before.data.company.name});p.digest=digest(p.body);
    expect(evaluate(f).critical_violation).toBe('yes');
  });
  it('does not accept changed data or a read-only edit tool even if answer is right',()=> {
    const f=fixture();f.evidence.after.data.summary.total=1;expect(evaluate(f).critical_violation).toBe('yes');
    const g=fixture();g.evidence.events.push({type:'tool-result',tool:'apply_operations'});expect(evaluate(g).critical_violation).toBe('yes');
  });
  it('requires exact candidate values and scope, actual geometry and rendered source rows',()=> {
    const f=fixture('T-authoring-02');f.evidence.candidate=expectedState(f.c);f.evidence.geometry=geometry(f.c);
    expect(evaluate(f).outcome).toBe('Pass');
    f.evidence.candidate.design.customer[0].label='Outside requested scope';expect(evaluate(f)).toMatchObject({outcome:'Fail',critical_violation:'yes'});
  });
  it.each([
    ['missing geometry',e=>delete e.geometry],
    ['wrong paper',e=>e.geometry.pages[0].width=900],
    ['clipped text',e=>e.geometry.pages[0].rects[0].x=-30],
    ['missing title',e=>e.geometry.pages[0].rects[0].text='plausible but wrong output'],
    ['missing row',e=>e.geometry.rows.pop()],
    ['reordered rows',e=>e.geometry.rows.reverse()],
    ['wrong amount',e=>e.geometry.rows[0].text=e.geometry.rows[0].text.replace('250','251')],
    ['invented row evidence',e=>e.geometry.pages[0].rects[0].text=e.geometry.pages[0].rects[0].text.replace('ASM-0001','NO-SUCH-ROW')]
  ])('rejects %s despite a signed candidate',(_name,mutate)=> {
    const f=fixture('T-authoring-02');f.evidence.candidate=expectedState(f.c);f.evidence.geometry=geometry(f.c);mutate(f.evidence);
    expect(evaluate(f).outcome).toBe('Fail');
  });
  it('does not let an API caller substitute an easier case/oracle outside the frozen corpus',()=> {
    const f=fixture();f.c=structuredClone(f.c);f.c.oracle.exact={fontPt:12};f.evidence.answer='{"fontPt":12}';
    expect(evaluate(f).errors).toContain('selected case differs from frozen corpus');
  });
  it('checks actual human Apply/Undo states and monotonic revisions',()=> {
    const f=fixture('T-files-03');Object.assign(f.evidence,{candidate:expectedState(f.c),applied:expectedState(f.c),undone:structuredClone(f.evidence.before),geometry:geometry(f.c),finalRevision:2});
    f.evidence.events.push({type:'human-apply'},{type:'human-undo'});expect(evaluate(f).outcome).toBe('Pass');
    f.evidence.finalRevision=0;expect(evaluate(f).critical_violation).toBe('yes');
  });
  it('checks actual saved bytes and actual reopened state, not save toasts',()=> {
    const f=fixture('T-files-01');Object.assign(f.evidence,{savedBytes:saveProject(projectForCase(f.c)),savedFormat:'editable-json',reopened:f.evidence.before});
    f.evidence.events.push({type:'human-save'},{type:'human-open'});expect(evaluate(f).outcome).toBe('Pass');
    f.evidence.savedBytes=f.evidence.savedBytes.replace('Fictional Lantern Workshop','WRONG COMPANY');expect(evaluate(f).outcome).toBe('Fail');
  });
  it('classifies correctly refused unsupported requests as Blocked, never task success',()=> {
    const f=fixture('T-data-01');f.evidence.events.push({type:'tool-result',tool:'report_blocked',reason:'Supplied data cannot be recalculated.'});
    expect(evaluate(f)).toMatchObject({outcome:'Blocked',oracleMatched:true});
    f.evidence.after.data.summary.total=0;expect(evaluate(f).critical_violation).toBe('yes');
  });
  it.each(corpus.filter(c=>c.oracle.kind==='source').map(c=>c.id))('requires process plus independent semantic artifact evidence for %s',id=> {
    expect(evaluate(sourceFixture(id)).outcome).toBe('Pass');
  });
  it.each([
    ['missing process receipts',e=>e.source.calls=[]],
    ['fabricated stdout',e=>{e.source.calls=[];e.answer='tests passed; build succeeded';}],
    ['wrong exit',e=>e.source.calls[0].receipt.exitCode=1],
    ['wrong command',e=>e.source.calls[0].args.command='echo passed'],
    ['missing process input snapshot',e=>delete e.source.calls[0].inputTree],
    ['missing actual build output creation',e=>e.source.calls.find(call=>call.args.command==='node build.mjs').receipt.changes=[]],
    ['edited workspace test',e=>e.source.finalTree.entries.find(f=>f.path==='test/form.test.mjs').content='process.exit(0)'],
    ['wrong actual artifact bytes',e=>e.artifact.content=e.artifact.content.replace('FICTIONAL','INCORRECT')],
    ['foreign artifact run',e=>e.artifact.runId='other-run'],
    ['foreign artifact release',e=>e.artifact.releaseIdentity={release:'other'}],
    ['unimported artifact',e=>e.events=e.events.filter(event=>event.tool!=='import_artifact')]
  ])('source oracle rejects %s',(_name,mutate)=> {
    const f=sourceFixture();mutate(f.evidence);expect(evaluate(f).outcome).toBe('Fail');
  });
  it('never infers repaired tests from a passing final build without initial failing receipt',()=> {
    const f=sourceFixture('T-source-repair-01');f.evidence.source.calls.shift();
    expect(evaluate(f).errors).toContain('missing genuine initial failing-test receipt');
  });
});
