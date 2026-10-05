import { it, expect } from 'vitest';
import { newProject } from '../studio-v3/model.js';
import { parseChatReply, chatRequest, CHAT_PROMPT } from '../studio-v3/ai-chat-protocol.js';
import { runLayoutHarness } from '../studio-v3/ai-harness.js';
import { repairRequest, safeRunDiagnostics } from '../studio-v3/ai-inspection.js';

const envelope = operations => JSON.stringify({kind:'proposal',summary:'Synthetic structural redesign',operations});
const fields = count => Array.from({length:count},(_,i)=>({type:'add_field',section:'footer',field:{id:`note-${i}`,kind:'static',text:'Synthetic note',label:'',format:''}}));
const compact = [{type:'set_style',patch:{font:10}}, {type:'set_section',target:'header',patch:{layout:{columns:1,gap:8}}}];
const request = p => chatRequest(p,{request:'Redesign freely',scope:{mode:'whole'},typography:[],conversation:[]});
it('accepts 24 operations and rejects 25 atomically with count diagnostics', () => {
  const p=newProject(), before=structuredClone(p);
  expect(parseChatReply(envelope(fields(24)),p).design.footer).toHaveLength(26);
  try { parseChatReply(envelope(fields(25)),p); throw new Error('Expected rejection'); }
  catch(e) {
    expect(e.code).toBe('AUTHORING_OPERATION_LIMIT');
    expect(safeRunDiagnostics({errors:[e],metrics:e.metrics},p)).toMatchObject({errors:['AUTHORING_OPERATION_LIMIT'],metrics:{operationCount:25,maxOperations:24}});
  }
  expect(p).toEqual(before);
});
it('rejects global fontSize specifically, while valid field fontSize and global font remain supported', () => {
  const p=newProject(), before=structuredClone(p);
  expect(()=>parseChatReply(envelope([{type:'set_style',patch:{fontSize:10}}]),p)).toThrow('GLOBAL_FONT_PROPERTY_UNSUPPORTED');
  expect(parseChatReply(envelope([{type:'set_style',patch:{font:10}},{type:'set_field',target:'header-company',patch:{valueStyle:{fontSize:14}}}]),p).design.font).toBe(10);
  expect(()=>parseChatReply(envelope([{type:'set_style',patch:{font:99}}]),p)).toThrow('UNSAFE_PROPOSAL');
  expect(p).toEqual(before);
});
it.each([
  ['AUTHORING_OPERATION_LIMIT',envelope(fields(25))],
  ['GLOBAL_FONT_PROPERTY_UNSUPPORTED',envelope([{type:'set_style',patch:{fontSize:10}}])]
])('retains rejected JSON and repairs %s in the actual Harness without committing', async (code,bad) => {
  const p=newProject(), before=structuredClone(p), requests=[];
  const result=await runLayoutHarness({project:p,request:request(p),alias:'demo-fast',signal:new AbortController().signal,
    transport:{plan:async (_,wire)=>{requests.push(JSON.parse(wire));return {text:requests.length===1 ? bad : envelope(compact)};}},
    inspectCandidate:async()=>({ready:true,errors:[]})});
  expect(result.iterations).toBe(2);expect(requests).toHaveLength(2);
  expect(requests[1].repair).toMatchObject({attempt:2,previousProposal:JSON.parse(bad),diagnostics:{errors:[code]}});
  expect(result.design.blocks.header.layout.columns).toBe(1);expect(p).toEqual(before);
});
it('stops after three invalid replies and never creates an unvalidated candidate', async()=> {
  const p=newProject(), before=structuredClone(p);let calls=0;
  await expect(runLayoutHarness({project:p,request:request(p),alias:'demo-fast',signal:new AbortController().signal,
    transport:{plan:async()=>{calls++;return {text:envelope(fields(25))};}},inspectCandidate:async()=>{throw new Error('Invalid proposal reached preview');}})).rejects.toMatchObject({code:'AUTHORING_OPERATION_LIMIT'});
  expect(calls).toBe(3);expect(p).toEqual(before);
});
it('advertises the compact operation contract and treats malformed previous JSON as inert',()=> {
  const wire=JSON.parse(request(newProject()));
  expect(wire.authoring.contract).toMatchObject({maxOperations:24,typography:{globalProperty:'font',elementProperty:'fontSize'}});
  expect(CHAT_PROMPT).toContain('Never emit more than 24 operations');
  expect(JSON.parse(repairRequest(JSON.stringify(wire),{attempt:2,envelope:'not JSON',diagnostics:{errors:['MALFORMED_PROPOSAL']}})).repair.previousProposal).toBeNull();
});
it('reports unavailable assets and forbidden table grids together without applying either', async()=> {
  const p=newProject(), before=structuredClone(p), requests=[];
  const bad=envelope([{type:'set_logo',value:{assetId:null,width:96,height:32}},
    {type:'set_section',target:'items',patch:{layout:{columns:1,gap:0}}}]);
  const result=await runLayoutHarness({project:p,request:request(p),alias:'demo-fast',signal:new AbortController().signal,
    transport:{plan:async(_,wire)=>{requests.push(JSON.parse(wire));return {text:requests.length===1 ? bad : envelope(compact)};}},
    inspectCandidate:async()=>({ready:true,errors:[]})});
  expect(result.iterations).toBe(2);
  expect(requests[1].repair.diagnostics.errors).toEqual(['LOGO_ASSET_UNAVAILABLE','TABLE_SECTION_GRID_UNSUPPORTED']);
  expect(requests[1].repair.previousProposal).toEqual(JSON.parse(bad));expect(p).toEqual(before);
});
