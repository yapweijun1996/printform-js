import fs from 'node:fs';

// Shared reader for the CA-01 feature ledger tests.
export const read = file => fs.readFileSync(file,'utf8');

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  const [header,...body] = rows;
  return body.map(values => Object.fromEntries(header.map((name,i) => [name,values[i] ?? ''])));
}

export const LEDGER_CSV = 'docs/STUDIO_V3_FEATURE_LEDGER.csv';
export const LEDGER_MD = 'docs/STUDIO_V3_FEATURE_LEDGER.md';
export const ledgerRows = () => parseCsv(read(LEDGER_CSV));
export const ledgerEntries = rows => new Set(rows.flatMap(row => row.ui_entries.split(';').filter(Boolean)));
export const studioSources = () => fs.readdirSync('studio-v3').filter(name => /\.(js|html)$/.test(name)).map(name => `studio-v3/${name}`);
