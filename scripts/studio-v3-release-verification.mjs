import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseUpstreamJson,readUpstreamFile} from './studio-v3-upstream-evidence.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const pinKeys = ['release','appSHA256','workerSHA256','manifestSHA256','dependencyIndexSHA256'];
const identityKeys = ['contractHash','knowledgeHash','packageHash','sourceRunnerHash'];
const rootShellFiles = ['index.html','manifest.webmanifest','icon.svg'];
const check = (condition,message) => { if (!condition) throw new Error(message); };

function validatePins(pins) {
  check(pins && typeof pins === 'object' && Object.keys(pins).length === pinKeys.length
    && typeof pins.release === 'string' && /^[a-f0-9]{40}$/.test(pins.release)
    && pinKeys.slice(1).every(key=>isHash(pins[key])), 'Invalid observed release pins');
}

export function verifyStudioV3Release(siteRoot, pins) {
  if (pins !== undefined) validatePins(pins);
  const studioRoot = path.resolve(siteRoot,'studio-v3');
  const read = file => readUpstreamFile(studioRoot,file);
  const index = read('index.html'), html = index.toString('utf8');
  const release = /<meta name="printform-source-revision" content="([a-f0-9]{40})">/.exec(html)?.[1];
  check(release, 'Studio v3 release metadata missing');
  const base = `releases/${release}/`, appPath = `${base}app.js`, manifestPath = `${base}agent/agent-manifest.json`;
  check(html.includes(`name="printform-assets" content="./${base}"`) && html.includes(`src="${appPath}"`), 'Studio v3 page assets do not match its release');

  const worker = read('sw.js'), app = read(appPath);
  const manifestBytes = read(manifestPath), dependency = read('agent-index/dependency-index.json');
  const fingerprints = {release,appSHA256:digest(app),workerSHA256:digest(worker),manifestSHA256:digest(manifestBytes),dependencyIndexSHA256:digest(dependency)};
  if (pins) {
    for (const key of pinKeys) check(fingerprints[key] === pins[key], `Observed pin mismatch for ${key}`);
  }

  const manifest = parseUpstreamJson(manifestBytes), dependencyIndex = parseUpstreamJson(dependency);
  check(manifest?.version === 1 && manifest.release === release && dependencyIndex?.release === release
    && identityKeys.every(key=>isHash(manifest[key]) && app.includes(manifest[key])) && app.includes(release), 'Studio v3 app, Agent manifest or index identity mismatch');
  check(read('agent/agent-manifest.json').equals(manifestBytes), 'Studio v3 rolling Agent manifest differs from its immutable release');

  const workerSource = worker.toString('utf8');
  const shellSource = /^const SHELL = (\[.*\]);$/m.exec(workerSource)?.[1];
  check(workerSource.includes(`const BUILD = '${release}';`) && shellSource, 'Studio v3 worker does not describe this release');
  const shell = parseUpstreamJson(Buffer.from(shellSource)), hashes = new Map();
  for (const entry of shell) {
    check(typeof entry?.url === 'string' && entry.url.startsWith('./') && isHash(entry.hash), 'Invalid Studio v3 worker shell entry');
    const file = entry.url.slice(2);
    check(rootShellFiles.includes(file) || file.startsWith(base), 'Studio v3 worker references a foreign release');
    check(!hashes.has(file), 'Duplicate Studio v3 worker shell entry');
    hashes.set(file,entry.hash);
  }
  const agentFiles = Object.entries(manifest.files ?? {});
  check(isHash(manifest.files?.['capabilities.json']) && isHash(manifest.files?.['knowledge-index.json']), 'Studio v3 Agent files missing from manifest');
  const linkedAssets = [...html.matchAll(/\b(?:href|src)="(releases\/[^"]+)"/g)].map(match=>match[1]);
  for (const file of [...rootShellFiles,appPath,manifestPath,`${base}printform.js`,`${base}printform-document.js`,...linkedAssets]) {
    check(hashes.has(file), `Studio v3 worker omits ${file}`);
  }
  for (const [file,hash] of agentFiles) {
    check(isHash(hash) && hashes.get(`${base}agent/${file}`) === hash, `Studio v3 Agent file is not pinned by worker: ${file}`);
  }
  for (const [file,hash] of hashes) {
    // Reuse already read files in the same check. Other paths stay inside the supplied archive.
    const bytes = file === 'index.html' ? index : file === appPath ? app : file === manifestPath ? manifestBytes : read(file);
    check(digest(bytes) === hash, `Studio v3 worker hash mismatch for ${file}`);
  }

  return {...fingerprints,sourceRunnerHash:manifest.sourceRunnerHash,packageHash:manifest.packageHash,shellFiles:hashes.size,agentFiles:agentFiles.length};
}

export function verifyReleasePair(oldRoot,nextRoot,pins) {
  check(pins?.schema === 'studio-v3-rollback-pins-v1', 'Invalid rollback pins schema');
  validatePins(pins.old);
  validatePins(pins.next);
  check(pins.old.release !== pins.next.release, 'Rollback requires two distinct releases');
  const old = verifyStudioV3Release(oldRoot,pins.old), next = verifyStudioV3Release(nextRoot,pins.next);
  return {old,next,sameCompanionSource:old.sourceRunnerHash === next.sourceRunnerHash};
}
