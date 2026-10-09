// Records the last successful publication as the release-review baseline (KNO-05).
// The live GitHub Pages site only switches after a deployment succeeds, so a failed deployment cannot advance it.
// Run after a successful deploy, then commit docs/studio-v3-agent-release/:
//   node scripts/record-studio-v3-agent-baseline.mjs [--site https://<owner>.github.io/<repo>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capabilityChanges } from './generate-studio-v3-agent.mjs';
import { RELEASE_DIR } from './studio-v3-agent-review.mjs';

export const DEFAULT_SITE = 'https://yapweijun1996.github.io/printform-js';
const RELEASE = /<meta name="printform-assets" content="\.\/releases\/([a-f0-9]{40})\/">/;

async function getText(fetcher,url,{optional = false} = {}) {
  const response = await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});
  if (optional && response.status === 404) return null;
  if (!response.ok) throw new Error(`Baseline fetch failed (${response.status}): ${url}`);
  return response.text();
}

// Fetches and validates everything first; returns the files to write. Throws (writing nothing) on any inconsistency.
export async function fetchPublishedBaseline({site = DEFAULT_SITE,fetcher = globalThis.fetch} = {}) {
  const page = await getText(fetcher,`${site}/studio-v3/`);
  const release = RELEASE.exec(page)?.[1];
  if (!release) throw new Error('The live Studio v3 page does not name an immutable release.');
  const manifest = JSON.parse(await getText(fetcher,`${site}/studio-v3/releases/${release}/agent/agent-manifest.json`));
  if (manifest.release !== release) throw new Error(`Live manifest release ${manifest.release} does not match page release ${release}.`);
  capabilityChanges(manifest,manifest); // validates the published shape
  const indexText = await getText(fetcher,`${site}/studio-v3/agent-index/dependency-index.json`,{optional:true});
  const index = indexText === null ? null : JSON.parse(indexText);
  // The index is not release-scoped; a mismatch means a deployment is in flight, so stop instead of mixing releases.
  if (index && index.release !== release) throw new Error(`Live dependency index ${index.release} does not match release ${release}; retry after the deployment settles.`);
  return {release,manifest,index,review:{version:1,baseline:{release,packageHash:manifest.packageHash},dispositions:[]}};
}

export function writeBaseline({manifest,index,review},root = process.cwd()) {
  const dir = path.resolve(root,RELEASE_DIR); fs.mkdirSync(dir,{recursive:true});
  const files = {'baseline-manifest.json':manifest,'baseline-index.json':index,'review.json':review};
  for (const [name,value] of Object.entries(files)) {
    const target = path.join(dir,name);
    if (value === null) { fs.rmSync(target,{force:true}); continue; }
    fs.writeFileSync(`${target}.tmp`,`${JSON.stringify(value,null,1)}\n`); fs.renameSync(`${target}.tmp`,target);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), site = args.includes('--site') ? args[args.indexOf('--site') + 1] : DEFAULT_SITE;
  const result = await fetchPublishedBaseline({site});
  writeBaseline(result);
  console.log(`Recorded Studio v3 agent baseline ${result.release.slice(0,12)} (${result.manifest.entries.length} entries${result.index ? ', with dependency index' : ', no dependency index'}). Dispositions were reset.`);
}
