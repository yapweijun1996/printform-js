import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { capabilityCatalog, validateRegistry } from '../studio-v3/agent-registry.js';
import { AGENT_SKILLS } from '../studio-v3/agent-knowledge.js';
import { checkAgentConformance } from './studio-v3-agent-conformance.mjs';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
const json = value => JSON.stringify(canonical(value));
const hash = value => createHash('sha256').update(value).digest('hex');
const revisionPattern = /^(?:[a-f0-9]{40}|local)$/;
const sourceHash = (root,name) => {
  if (!/^[a-zA-Z0-9_./-]+$/.test(name) || name.split('/').includes('..') || path.isAbsolute(name)) throw new Error('Invalid agent resource dependency.');
  const target = path.resolve(root,name);
  if (!fs.statSync(target).isFile()) throw new Error(`Missing agent dependency: ${name}`);
  return hash(fs.readFileSync(target));
};
export function capabilityChanges(previous,current) {
  if (previous && (previous.version!==1 || !revisionPattern.test(previous.release) || !Array.isArray(previous.entries) ||
      new Set(previous.entries.map(e=>e.id)).size!==previous.entries.length || previous.entries.some(e=>typeof e.id!=='string' || !/^[a-f0-9]{64}$/.test(e.hash)))) throw new Error('Invalid published agent baseline.');
  const before=new Map((previous?.entries || []).map(entry=>[entry.id,entry])), after=new Map(current.entries.map(entry=>[entry.id,entry])), changes=[];
  for (const entry of current.entries) {
    const old=before.get(entry.id);
    if (!old || old.hash!==entry.hash) changes.push({id:entry.id,kind:!old ? 'added' : entry.status==='deprecated' && old.status!=='deprecated' ? 'deprecated' : 'changed',reviewRequired:true});
  }
  for (const entry of before.values()) if (!after.has(entry.id)) changes.push({id:entry.id,kind:'removed',reviewRequired:true});
  return {version:1,baseline:previous ? {release:previous.release,packageHash:previous.packageHash} : null,current:{release:current.release,packageHash:current.packageHash},changes};
}
export function generateAgentPackage({root=process.cwd(),output,revision=process.env.GITHUB_SHA || 'local',baseline=null}={}) {
  if (!revisionPattern.test(revision)) throw new Error('Invalid agent package revision.');
  const capabilities=validateRegistry(), catalog=JSON.parse(json(capabilityCatalog()));
  delete catalog.identity; delete catalog.run;
  const entries=capabilities.map(entry=> {
    const sources=Object.fromEntries(entry.sources.map(name=>[name,sourceHash(root,name)]));
    entry.evaluations.forEach(name=>sourceHash(root,name));
    return {id:entry.id,status:entry.status || 'active',hash:hash(json({...entry,sourceHashes:sources}))};
  });
  const skills=AGENT_SKILLS.map(skill=> {
    if (!/^[a-z0-9-]{1,80}$/.test(skill.id) || !skill.description || skill.content.length>16000 || !skill.sources.length || !skill.evaluations.length) throw new Error('Invalid bundled agent skill.');
    skill.evaluations.forEach(name=>sourceHash(root,name));
    return {id:skill.id,description:skill.description,resource:`resources/${skill.id}.md`,hash:hash(skill.content),
      sourceHashes:Object.fromEntries([...new Set(['studio-v3/agent-knowledge.js',...skill.sources])].map(name=>[name,sourceHash(root,name)])),evaluations:skill.evaluations};
  });
  const knowledge={version:1,skills}, contractHash=hash(json({catalog,entries})), knowledgeHash=hash(json(knowledge));
  const runtimeDependencies=['studio-v3/agent-loop.js','studio-v3/agent-release.js','studio-v3/ai-agent-run.js','studio-v3/ai-chat-protocol.js','studio-v3/ai-gateway-config.js','studio-v3/agent-binding-invariants.js','scripts/build-studio-v3.mjs','scripts/studio-v3-pwa.mjs'];
  const packageHash=hash(json({release:revision,contractHash,knowledgeHash,runtimeHashes:Object.fromEntries(runtimeDependencies.map(name=>[name,sourceHash(root,name)]))}));
  entries.push(...skills.map(skill=>({id:`printform.knowledge.${skill.id}`,status:'active',hash:hash(json(skill))})));
  const identity={release:revision,contractHash,knowledgeHash,packageHash};
  const documents={'capabilities.json':json({...catalog,version:1,contractHash,entries})+'\n','knowledge-index.json':json(knowledge)+'\n',
    ...Object.fromEntries(AGENT_SKILLS.map(skill=>[`resources/${skill.id}.md`,skill.content]))};
  const manifest={version:1,...identity,entries,files:Object.fromEntries(Object.entries(documents).map(([name,content])=>[name,hash(content)]))};
  const changes=capabilityChanges(baseline,manifest);
  if (output) {
    const directory=path.resolve(output,'studio-v3/agent');
    for (const [name,content] of Object.entries({...documents,'agent-manifest.json':json(manifest)+'\n','capability-changes.json':json(changes)+'\n'})) {
      const target=path.resolve(directory,name); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,content);
    }
  }
  return {identity,manifest,catalog,knowledge,changes};
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2), baselinePath=args.includes('--baseline') ? args[args.indexOf('--baseline')+1] : null;
  const output=args.includes('--output') ? args[args.indexOf('--output')+1] : undefined;
  const conformance=await checkAgentConformance();
  const result=generateAgentPackage({output,baseline:baselinePath ? JSON.parse(fs.readFileSync(baselinePath,'utf8')) : null});
  console.log(`Studio v3 agent package checked: ${result.catalog.tools.length} tools, ${result.catalog.operations.length} operations, ${result.knowledge.skills.length} skill, ${conformance.examples} contract examples; ${result.changes.changes.length} changes${baselinePath ? '' : ' (initial baseline)'}.`);
}
