// @vitest-environment node
import {afterEach,describe,expect,it} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {CORPUS_DIR,digest,readCorpus} from '../scripts/studio-v3-g8-corpus.mjs';
import {expectedState} from '../scripts/studio-v3-g8-evaluator.mjs';
import {ATTEMPT_COLUMNS} from '../scripts/studio-v3-task-register.mjs';
import {fixture,geometry,profile,seal} from './support/g8-evidence-fixture.js';

const roots=[];
const run=(...args)=>spawnSync(process.execPath,['scripts/studio-v3-g8.mjs',...args],{encoding:'utf8'});
afterEach(()=>{
  for (const root of roots.splice(0)) fs.rmSync(root,{recursive:true,force:true});
});

function isolatedPair({match=true}={}) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'g8-cli-unit-'));
  roots.push(root);
  const corpus=path.join(root,'corpus'), register=path.join(root,'register');
  fs.cpSync(CORPUS_DIR,corpus,{recursive:true});
  fs.mkdirSync(register);
  const familyFile=path.join(corpus,'authoring.json'), cases=JSON.parse(fs.readFileSync(familyFile,'utf8'));
  const c=cases.find(item=>item.id==='T-authoring-02');
  const priorDigest=digest(c.input);
  c.input.prompt+=' Synthetic CLI scope check.';
  const inputDigest=digest(c.input);
  fs.writeFileSync(familyFile,JSON.stringify(cases));
  const tasks=fs.readFileSync('docs/studio-v3-task-register/tasks.csv','utf8');
  fs.writeFileSync(path.join(register,'tasks.csv'),match?tasks.replace(priorDigest,inputDigest):tasks);
  fs.writeFileSync(path.join(register,'attempts.csv'),ATTEMPT_COLUMNS.join(',')+'\n');
  return {root,c,corpus,register,flags:['--corpus',corpus,'--register',register]};
}

function jsonFile(root,name,value) {
  const target=path.join(root,name);
  fs.writeFileSync(target,JSON.stringify(value));
  return target;
}

describe('G8 CLI explicit corpus/register scope',()=>{
  it('retains the default historical corpus and prevents partial or repeated overrides',()=>{
    const historical=run('validate');
    expect(historical.status).toBe(0);
    expect(JSON.parse(historical.stdout)).toEqual({tasks:60,holdout:20,corpusDigest:profile.corpusDigest,errors:[]});
    for (const flags of [
      ['--corpus','missing-corpus'],['--register','missing-register'],
      ['--corpus','one','--corpus','two','--register','three'],
      ['--corpus=','--register','something']
    ]) {
      const failed=run('validate',...flags);
      expect(failed.status).toBe(1);
      expect(failed.stdout).toBe('');
      expect(failed.stderr).toContain('Use exactly one --corpus DIR and one --register DIR together');
    }
  });

  it('does not fall back to the historical register if a paired directory is unreadable',()=>{
    const pair=isolatedPair();
    const failed=run('validate','--corpus',pair.corpus,'--register',path.join(pair.root,'missing'));
    expect(failed.status).toBe(1);
    expect(failed.stdout).toBe('');
    expect(failed.stderr).toContain('ENOENT');
  });

  it('rejects changed corpus inputs before disclosing a task or consuming a profile',()=>{
    const pair=isolatedPair({match:false});
    const validation=run('validate',...pair.flags);
    expect(validation.status).toBe(1);
    expect(JSON.parse(validation.stdout).errors).toContain('T-authoring-02: frozen register/input mismatch');
    for (const args of [['input',pair.c.id],['project',pair.c.id],['profile','unused'],['preflight','unused']]) {
      const failed=run(...args,...pair.flags);
      expect(failed.status).toBe(1);
      expect(failed.stdout).toBe('');
      expect(failed.stderr).toContain('T-authoring-02: frozen register/input mismatch');
      expect(failed.stderr).not.toContain(pair.c.input.prompt);
    }
  });

  it('threads the selected pair into profile creation, input, evidence evaluation and preflight',()=>{
    const pair=isolatedPair();
    const identity=jsonFile(pair.root,'identity.json',profile);
    const key=path.join(pair.root,'collector.pem');
    fs.writeFileSync(key,profile.collectorPublicKey);
    const created=run('profile',identity,key,profile.profile,...pair.flags);
    expect(created.status).toBe(0);
    const selected=JSON.parse(created.stdout), profileFile=jsonFile(pair.root,'profile.json',selected);
    expect(selected.corpusDigest).toBe(digest(readCorpus(pair.corpus)));
    expect(selected.corpusDigest).not.toBe(profile.corpusDigest);

    const input=run('input',pair.c.id,...pair.flags);
    expect(input.status).toBe(0);
    expect(JSON.parse(input.stdout)).toMatchObject({prompt:pair.c.input.prompt,inputDigest:digest(pair.c.input)});

    const historicalProfile=jsonFile(pair.root,'old-profile.json',profile);
    const mismatch=run('preflight',historicalProfile,'unused-index',...pair.flags);
    expect(mismatch.status).toBe(1);
    expect(mismatch.stdout).toBe('');
    expect(mismatch.stderr).toContain('profile corpus digest mismatch');

    const {evidence}=fixture(pair.c.id);
    evidence.inputDigest=digest(pair.c.input);
    evidence.profileDigest=digest(selected);
    evidence.events[0].promptDigest=digest(pair.c.input.prompt);
    const body=JSON.stringify({model:selected.modelAlias,input:pair.c.input.prompt});
    evidence.providerBodies=[{route:selected.identity.provider_route,body,digest:digest(body)}];
    evidence.candidate=expectedState(pair.c);
    evidence.geometry=geometry(pair.c);
    const evaluated=run('evaluate',profileFile,jsonFile(pair.root,'evidence.json',seal(evidence)),...pair.flags);
    expect(evaluated.status).toBe(0);
    expect(JSON.parse(evaluated.stdout).outcome).toBe('Pass');

    const before=fs.readFileSync(path.join(pair.register,'attempts.csv'),'utf8');
    const checked=run('preflight',profileFile,...pair.flags);
    expect(checked.status).toBe(1);
    expect(JSON.parse(checked.stdout)).toMatchObject({
      qualified:false,modelCalls:0,attemptsWritten:0,counts:{required:180,registeredTotal:0}
    });
    expect(fs.readFileSync(path.join(pair.register,'attempts.csv'),'utf8')).toBe(before);
  });

  it('keeps held-out inputs gated in the paired scope',()=>{
    const pair=isolatedPair();
    const heldOut=readCorpus(pair.corpus).find(item=>item.holdout);
    const denied=run('input',heldOut.id,...pair.flags);
    expect(denied.status).toBe(1);
    expect(denied.stdout).toBe('');
    expect(denied.stderr).toContain('Held-out input is reserved');
  });
});
