import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const compile = promisify(execFile);
import { finalizeStudioV3Pwa } from '../scripts/studio-v3-pwa.mjs';

const rollbackRoots = [process.env.PRINTFORM_ROLLBACK_OLD,process.env.PRINTFORM_ROLLBACK_NEXT];
export const exactRollback = rollbackRoots.some(Boolean);
function artifactRevision(root) {
  if (!root) throw new Error('Set both exact rollback artifact roots.');
  const page = fs.readFileSync(path.join(root,'studio-v3/index.html'),'utf8');
  const revision = /<meta name="printform-source-revision" content="([a-f0-9]{40})">/.exec(page)?.[1];
  if (!revision) throw new Error(`Studio v3 release metadata missing in ${root}`);
  return revision;
}
export const OLD = exactRollback ? artifactRevision(rollbackRoots[0]) : 'a'.repeat(40);
export const NEXT = exactRollback ? artifactRevision(rollbackRoots[1]) : 'b'.repeat(40);
if (OLD === NEXT) throw new Error('Use two different Studio v3 releases for the rollback drill.');
export async function upgradeServer() {
  const temp = exactRollback ? null : fs.mkdtempSync(path.join(os.tmpdir(),'printform-upgrade-'));
  const roots = new Map([OLD,NEXT].map((revision,index)=>[revision,path.resolve(rollbackRoots[index] || path.join(temp ?? '',revision))]));
  if (temp) for (const revision of [OLD,NEXT]) {
    const root = path.join(temp,revision); fs.mkdirSync(root,{recursive:true});
    fs.cpSync('site-dist/studio-v3',path.join(root,'studio-v3'),{recursive:true});
    fs.cpSync('site-dist/dist',path.join(root,'dist'),{recursive:true});
    fs.copyFileSync('studio-v3/index.html',path.join(root,'studio-v3/index.html'));
    fs.copyFileSync('studio-v3/sw.js',path.join(root,'studio-v3/sw.js'));
    // Compile each fixture against its own generated knowledge identity, as a real release does.
    await compile(process.execPath,['--input-type=module','-e',
      "import {buildStudioV3App} from './scripts/build-studio-v3.mjs'; await buildStudioV3App({root:process.cwd(),output:process.argv[1],revision:process.argv[2]});",root,revision],{timeout:20000,maxBuffer:1024*1024});
    // Different bytes in build B demonstrate that immutable URLs really switch.
    fs.appendFileSync(path.join(root,'studio-v3/app.js'),`\n;globalThis.__upgradeFixtureBuild='${revision}';\n`);
    if (revision === NEXT) fs.appendFileSync(path.join(root,'studio-v3/styles.css'),'\n:root { --upgrade-marker:build-b; }\n');
    finalizeStudioV3Pwa(root,revision);
    // Match a Pages deployment: only the currently deployed release is hosted.
    fs.readdirSync(path.join(root,'studio-v3/releases')).filter(name=>name !== revision).forEach(name=>fs.rmSync(path.join(root,'studio-v3/releases',name),{recursive:true}));
  }
  let current = OLD, fail = false;
  const types = {'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
  const server = http.createServer((request,response)=> {
    const url = new URL(request.url,'http://localhost');
    const root = roots.get(current);
    let file = path.resolve(root,`.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(root+path.sep)) { response.writeHead(404); response.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
    if (fail && file.includes(`/releases/${NEXT}/styles.css`)) { response.writeHead(200,{'Content-Type':'text/css'}); response.end('/* partial deployment */'); return; }
    if (!fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
    response.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:`http://127.0.0.1:${server.address().port}/studio-v3/`,publish:({broken = false,revision = NEXT}={})=> { current = revision; fail = broken; },
    close:async()=> { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); if (temp) fs.rmSync(temp,{recursive:true,force:true}); }};
}
