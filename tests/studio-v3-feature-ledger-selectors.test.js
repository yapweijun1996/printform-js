import {describe,it,expect} from 'vitest';
import {read,ledgerRows,ledgerEntries,studioSources} from './support/feature-ledger.js';

// Delegated click/submit selectors that start user workflows. Preview internals (data-v3-*),
// element identity (data-ai-tag-id) and validation markers (data-invalid) are not workflows.
const SELECTORS = ['mode','sample','template','demo-template','form','ai','ai-send','ai-add','ai-return','ai-discard','ai-scope',
  'ai-tag-action','layout','update-choice','draft-choice','db-group','db-select','issue','tree-path','fold','select','image-target'];
const camel = attr => attr.replace(/-([a-z])/g,(_,c) => c.toUpperCase());
const escapeRe = text => text.replace(/[-]/g,'\\-');

function selectorEntries(source) {
  const required = new Set();
  for (const attr of SELECTORS) {
    const name = escapeRe(attr);
    for (const m of source.matchAll(new RegExp(`data-${name}="([^"$]+)"`,'g'))) required.add(`${attr}:${m[1]}`);
    for (const m of source.matchAll(new RegExp(`dataset\\.${camel(attr)}\\s*={1,3}\\s*'([^']+)'`,'g'))) required.add(`${attr}:${m[1]}`);
    // Producers only: a `[data-x=...]` query selector is a consumer and must not count.
    const dynamic = new RegExp(`(?<!\\[)data-${name}="?\\$\\{|dataset\\.${camel(attr)}\\s*=(?!=)\\s*(?![\\s'])|(?<![\\[-])data-${name}(?=[\\s>])`).test(source);
    if (dynamic) required.add(`${attr}:*`);
  }
  return required;
}

describe('Studio v3 feature ledger (selector entries)', () => {
  const source = studioSources().map(read).join('\n');
  const rows = ledgerRows();
  const mapped = new Set([...ledgerEntries(rows)].filter(id => id.includes(':')));

  it('maps every workflow selector value to a ledger row', () => {
    const required = [...selectorEntries(source)].sort();
    expect(required.length).toBeGreaterThan(30);
    expect(required.filter(id => !mapped.has(id))).toEqual([]);
  });
  it('does not keep selector entries that no longer exist in the source', () => {
    const present = selectorEntries(source);
    expect([...mapped].filter(id => !present.has(id)).sort()).toEqual([]);
  });
  it('detects a newly added selector value (negative control)', () => {
    const extra = selectorEntries(`${source}\n<button data-mode="pilot-new-mode">`);
    expect(extra.has('mode:pilot-new-mode')).toBe(true);
    expect(mapped.has('mode:pilot-new-mode')).toBe(false);
  });
});
