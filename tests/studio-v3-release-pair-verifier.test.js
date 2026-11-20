// @vitest-environment node
import {afterEach,describe,expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {finalizeStudioV3Pwa} from '../scripts/studio-v3-pwa.mjs';
import {verifyReleasePair,verifyStudioV3Release} from '../scripts/studio-v3-release-verification.mjs';

const roots=[];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const temporary=()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'studio-release-pair-'));
  roots.push(root);
  return root;
};
function write(root,file,content) {
  const target=path.join(root,file);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,content);
  return target;
}
afterEach(()=>{
  for (const root of roots.splice(0)) fs.rmSync(root,{force:true,recursive:true});
});

function artifact(release,sourceRunnerHash='f'.repeat(64)) {
  const root=temporary(), studio=path.join(root,'studio-v3');
  const identity={release,sourceRunnerHash,contractHash:'c'.repeat(64),knowledgeHash:'d'.repeat(64),packageHash:'e'.repeat(64)};
  const documents={'capabilities.json':'{}\n','knowledge-index.json':'{}\n'};
  for (const [name,content] of Object.entries(documents)) write(studio,`agent/${name}`,content);
  const manifest={version:1,...identity,files:Object.fromEntries(Object.entries(documents).map(([name,content])=>[name,hash(content)]))};
  write(studio,'agent/agent-manifest.json',JSON.stringify(manifest));
  write(studio,'agent-index/dependency-index.json',JSON.stringify({release,entries:{}}));
  write(studio,'index.html','<meta name="printform-source-revision" content="__PRINTFORM_V3_REVISION__"><meta name="printform-assets" content="__PRINTFORM_V3_ASSETS__"><script src="app.js"></script><link href="styles.css">');
  write(studio,'sw.js',`const BUILD = '__PRINTFORM_V3_REVISION__';\nconst SHELL = "__PRINTFORM_V3_SHELL__";\n`);
  write(studio,'manifest.webmanifest','{}');
  write(studio,'icon.svg','<svg/>');
  write(studio,'app.js',`const identity = ${JSON.stringify(identity)};`);
  for (const file of ['tokens.css','styles.css','ai-panel.css','update.css','mobile.css']) write(studio,file,'body {}');
  for (const file of ['printform.js','printform-document.js']) write(root,`dist/${file}`,'// Runtime fixture');
  finalizeStudioV3Pwa(root,release);
  const base=path.join(studio,'releases',release);
  const pins={release,appSHA256:hash(fs.readFileSync(path.join(base,'app.js'))),workerSHA256:hash(fs.readFileSync(path.join(studio,'sw.js'))),
    manifestSHA256:hash(fs.readFileSync(path.join(base,'agent/agent-manifest.json'))),dependencyIndexSHA256:hash(fs.readFileSync(path.join(studio,'agent-index/dependency-index.json')))};
  return {root,studio,base,pins};
}

describe('Studio v3 archived release pair evidence',()=>{
  it('checks both archived roots against independent pins and reports companion source identity',()=>{
    const old=artifact('a'.repeat(40)), next=artifact('b'.repeat(40));
    const pins={schema:'studio-v3-rollback-pins-v1',old:old.pins,next:next.pins};
    expect(verifyReleasePair(old.root,next.root,pins)).toMatchObject({sameCompanionSource:true,
      old:{...old.pins,shellFiles:14},next:{...next.pins,shellFiles:14}});
    const different=artifact('c'.repeat(40),'a'.repeat(64));
    expect(verifyReleasePair(old.root,different.root,{...pins,next:different.pins}).sameCompanionSource).toBe(false);
    expect(()=>verifyReleasePair(next.root,old.root,pins)).toThrow('Observed pin mismatch for release');
  });

  it('rejects metadata-only and truncated archives before serving them',()=>{
    const root=temporary(), release='a'.repeat(40), base=`releases/${release}/`;
    write(root,'studio-v3/index.html',`<meta name="printform-source-revision" content="${release}"><meta name="printform-assets" content="./${base}"><script src="${base}app.js"></script>`);
    expect(()=>verifyStudioV3Release(root)).toThrow(/ENOENT/);
    const archived=artifact(release);
    fs.unlinkSync(path.join(archived.base,'styles.css'));
    expect(()=>verifyStudioV3Release(archived.root,archived.pins)).toThrow(/ENOENT/);
  });

  it('rejects shell bytes that do not match their pinned hash',()=>{
    const archived=artifact('a'.repeat(40));
    fs.appendFileSync(path.join(archived.base,'styles.css'),'/* corrupted */');
    expect(()=>verifyStudioV3Release(archived.root,archived.pins)).toThrow('Studio v3 worker hash mismatch');
  });

  it('rejects an app and worker rehashed under the same claimed release if independent pins differ',()=>{
    const archived=artifact('a'.repeat(40)), app=path.join(archived.base,'app.js'), worker=path.join(archived.studio,'sw.js');
    fs.appendFileSync(app,'\n// Changed application with the same claimed release');
    fs.writeFileSync(worker,fs.readFileSync(worker,'utf8').replace(archived.pins.appSHA256,hash(fs.readFileSync(app))));
    expect(verifyStudioV3Release(archived.root).release).toBe(archived.pins.release);
    expect(()=>verifyStudioV3Release(archived.root,archived.pins)).toThrow('Observed pin mismatch for appSHA256');
  });
});
