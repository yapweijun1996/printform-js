// Release review gate (KNO-04/05): every capability/guide change since the last successful publication needs an owner
// disposition bound to the entry's current digest. Missing, stale or unsupported dispositions block publication.
import fs from 'node:fs';
import path from 'node:path';

export const KINDS = Object.freeze(['updated','no-impact','reconciled']);
const SAFE = /^[a-zA-Z0-9_./-]+$/;
const sameBaseline = (a,b) => (a === null && b === null) || (a && b && a.release === b.release && a.packageHash === b.packageHash);

// `report` is generateAgentPackage().changes; `review` is the committed disposition file; indexes are dependency indexes.
export function checkReleaseReview({report,review,manifest,previousIndex = null,currentIndex,root = process.cwd()}) {
  const errors = [], hashes = new Map(manifest.entries.map(entry => [entry.id,entry.hash]));
  if (!review || review.version !== 1 || !Array.isArray(review.dispositions)) return {errors:['Release review file is missing or invalid.'],reviewed:0};
  // Dispositions are written against one baseline; after the baseline advances they no longer apply.
  const applicable = sameBaseline(review.baseline ?? null,report.baseline) ? review.dispositions : [];
  if (applicable !== review.dispositions && review.dispositions.length) errors.push(`Release review targets baseline ${review.baseline?.release || 'none'}, but the build compares with ${report.baseline?.release || 'none'}.`);
  const firstBaseline = !report.baseline || !previousIndex, byId = new Map();
  for (const item of applicable) {
    for (const [id,digest] of Object.entries(item.entries || {})) {
      if (byId.has(id)) errors.push(`${id}: more than one disposition.`);
      byId.set(id,{...item,digest});
    }
  }
  const changed = new Set();
  let reviewed = 0;
  for (const change of report.changes) {
    changed.add(change.id);
    if (change.kind === 'removed' && !change.tombstone) errors.push(`${change.id}: removed without a tombstone and replacement advice.`);
    const item = byId.get(change.id), digest = change.kind === 'removed' ? 'removed' : hashes.get(change.id);
    if (!item) { errors.push(`${change.id}: ${change.kind} without an owner disposition.`); continue; }
    if (item.digest !== digest) { errors.push(`${change.id}: disposition is stale (reviewed ${String(item.digest).slice(0,12)}, now ${String(digest).slice(0,12)}).`); continue; }
    const problems = checkDisposition(change,item,{firstBaseline,previousIndex,currentIndex,root});
    errors.push(...problems); if (!problems.length && (change.kind !== 'removed' || change.tombstone)) reviewed++;
  }
  for (const id of byId.keys()) if (!changed.has(id)) errors.push(`${id}: disposition has no matching change; remove it.`);
  return {errors,reviewed};
}

function checkDisposition(change,item,{firstBaseline,previousIndex,currentIndex,root}) {
  const errors = [], at = change.id, evidence = Array.isArray(item.evidence) ? item.evidence : [];
  if (!KINDS.includes(item.disposition)) return [`${at}: unknown disposition ${item.disposition}.`];
  if (typeof item.justification !== 'string' || item.justification.trim().length < 20) errors.push(`${at}: justification must explain the decision (20+ characters).`);
  if (!evidence.length) errors.push(`${at}: evidence is required.`);
  for (const name of evidence) if (!SAFE.test(name) || name.split('/').includes('..') || !fs.existsSync(path.resolve(root,name))) errors.push(`${at}: evidence ${name} does not exist.`);
  const entry = currentIndex.entries[change.id], related = new Set(entry ? [...entry.files,...entry.evaluations] : []);
  if (item.disposition === 'reconciled' && !firstBaseline) errors.push(`${at}: reconciled is only allowed for the first full baseline.`);
  if (item.disposition === 'no-impact' && !evidence.some(name => entry?.evaluations.includes(name))) errors.push(`${at}: no-impact needs one of its evaluations as evidence.`);
  if (item.disposition === 'updated') {
    // Updated knowledge must point at a dependent file that actually changed since the baseline.
    const updated = name => related.has(name) && (firstBaseline || previousIndex.files[name] !== currentIndex.files[name]);
    if (!evidence.some(updated)) errors.push(`${at}: updated needs evidence of a changed guide, source or evaluation it depends on.`);
  }
  return errors;
}
