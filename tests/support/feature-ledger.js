import fs from 'node:fs';
import {parseCsv} from '../../scripts/studio-v3-task-register.mjs';

// Shared reader for the CA-01 feature ledger tests.
export const read = file => fs.readFileSync(file,'utf8');

export const LEDGER_CSV = 'docs/STUDIO_V3_FEATURE_LEDGER.csv';
export const LEDGER_MD = 'docs/STUDIO_V3_FEATURE_LEDGER.md';
export const ledgerRows = () => parseCsv(read(LEDGER_CSV)).rows;
export const ledgerEntries = rows => new Set(rows.flatMap(row => row.ui_entries.split(';').filter(Boolean)));
export const studioSources = () => fs.readdirSync('studio-v3').filter(name => /\.(js|html)$/.test(name)).map(name => `studio-v3/${name}`);
