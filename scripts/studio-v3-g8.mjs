import fs from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {readCorpus,validateCorpus,digest,publicInput,projectForCase,canonical} from './studio-v3-g8-corpus.mjs';
import {evaluateEvidence,profileErrors} from './studio-v3-g8-evaluator.mjs';
import {saveProject} from '../studio-v3/file-io.js';
import {readRegister} from './studio-v3-task-register.mjs';
import {readInventory} from './studio-v3-g8-inventory.mjs';
import {preflight} from './studio-v3-g8-preflight.mjs';
import {readUpstreamFile,parseUpstreamJson} from './studio-v3-upstream-evidence.mjs';

const SCOPED_COMMANDS = new Set(['validate','input','project','profile','evaluate','preflight','upstream','governance']);
const USAGE = 'Usage: studio-v3-g8.mjs validate | input TASK [--qualification] | project TASK [--qualification] | profile IDENTITY_JSON COLLECTOR_PUBLIC_PEM PROFILE_NAME | evaluate PROFILE_JSON SIGNED_EVIDENCE_JSON | preflight PROFILE_JSON [EVIDENCE_INDEX_JSON] | upstream PROFILE_JSON [EVIDENCE_INDEX_JSON] | governance PROFILE_JSON [EVIDENCE_INDEX_JSON] | canonical EVIDENCE_JSON. Corpus commands accept both --corpus DIR and --register DIR.';

function readScope(command,rawArgs) {
  const {values,positionals} = parseArgs({args:rawArgs,allowPositionals:true,options:{
    corpus:{type:'string',multiple:true},register:{type:'string',multiple:true},qualification:{type:'boolean'}
  }});
  const corpusPaths=values.corpus ?? [], registerPaths=values.register ?? [];
  const overrides=corpusPaths.length>0 || registerPaths.length>0;
  if (overrides && (!SCOPED_COMMANDS.has(command) || corpusPaths.length!==1 || registerPaths.length!==1 || !corpusPaths[0].trim() || !registerPaths[0].trim())) {
    throw new Error('Use exactly one --corpus DIR and one --register DIR together with a corpus command.');
  }
  if (values.qualification && !['input','project'].includes(command)) throw new Error('--qualification is only available for input and project.');
  return {args:positionals,qualification:values.qualification,corpusDir:corpusPaths[0],registerDir:registerPaths[0],overrides};
}

function assertValid(errors) {
  if (errors.length) throw new Error(errors.join('; '));
}

function readEvidenceJson(filename) {
  const file=path.resolve(filename);
  return parseUpstreamJson(readUpstreamFile(path.dirname(file),path.basename(file)));
}

// Offline only: no model calls, execution scheduling, automatic attempts or Pass rows.
function main(command,rawArgs) {
  const scope=readScope(command,rawArgs), {args}=scope;
  if (command==='canonical') {
    console.log(canonical(JSON.parse(fs.readFileSync(args[0],'utf8'))));
    return;
  }
  if (!SCOPED_COMMANDS.has(command)) throw new Error(USAGE);
  const corpus=readCorpus(scope.corpusDir);
  const register=scope.overrides ? readRegister(scope.registerDir) : undefined;
  if (scope.overrides && command!=='validate') assertValid(validateCorpus(corpus,register));
  if (command==='validate') {
    const errors=validateCorpus(corpus,register);
    console.log(JSON.stringify({tasks:corpus.length,holdout:corpus.filter(c=>c.holdout).length,corpusDigest:digest(corpus),errors},null,2));
    if (errors.length) process.exitCode=1;
  } else if (command==='input' || command==='project') {
    const c=corpus.find(item=>item.id===args[0]);
    if (!c) throw new Error('Unknown corpus task ID');
    const input=publicInput(c,{qualification:scope.qualification});
    console.log(command==='project'?saveProject(projectForCase(c)):JSON.stringify(input,null,2));
  } else if (command==='profile') {
    const identity=JSON.parse(fs.readFileSync(args[0],'utf8'));
    const collectorPublicKey=fs.readFileSync(args[1],'utf8');
    const profile={schema:'studio-g8-profile-v1',profile:args[2],modelAlias:identity.modelAlias,identity:identity.identity,releaseIdentity:identity.releaseIdentity,budgets:identity.budgets,corpusDigest:digest(corpus),collectorPublicKey};
    assertValid(profileErrors(profile,corpus));
    console.log(JSON.stringify(profile,null,2));
  } else if (command==='evaluate') {
    const profile=readEvidenceJson(args[0]);
    if (scope.overrides) assertValid(profileErrors(profile,corpus));
    const envelope=readEvidenceJson(args[1]);
    const c=corpus.find(item=>item.id===envelope.evidence?.taskId);
    if (!c) throw new Error('Unknown evidence task ID');
    const result=evaluateEvidence(c,envelope,profile,{corpus,register});
    console.log(JSON.stringify(result,null,2));
    if (result.outcome!=='Pass') process.exitCode=1;
  } else if (command==='preflight' || command==='upstream' || command==='governance') {
    if (!args[0] || args.length>2) throw new Error(`Usage: studio-v3-g8.mjs ${command} PROFILE_JSON [EVIDENCE_INDEX_JSON]`);
    const profile=readEvidenceJson(args[0]);
    if (scope.overrides) assertValid(profileErrors(profile,corpus));
    const result=preflight({corpus,register:register ?? readRegister(),profile,inventory:readInventory(args[1])});
    if (command==='upstream') {
      const upstream=result.prerequisites.find(item=>item.id==='fixed-upstream');
      console.log(JSON.stringify({schema:'studio-upstream-check-v1',offline:true,modelCalls:0,attemptsWritten:0,profile:result.profile,profileDigest:result.profileDigest,...upstream},null,2));
      if (!upstream.verification.verified) process.exitCode=1;
    } else if (command==='governance') {
      const governance=result.prerequisites.find(item=>item.id==='data-governance');
      console.log(JSON.stringify({schema:'studio-governance-check-v1',offline:true,modelCalls:0,attemptsWritten:0,profile:result.profile,profileDigest:result.profileDigest,...governance},null,2));
      if (!governance.verification.reviewable) process.exitCode=1;
    } else {
      console.log(JSON.stringify(result,null,2));
      if (!result.qualified) process.exitCode=1;
    }
  }
}

try {
  main(process.argv[2],process.argv.slice(3));
} catch (error) {
  console.error(JSON.stringify({outcome:'Fail',errors:[error.message]}));
  process.exitCode=1;
}
