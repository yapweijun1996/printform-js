import fs from 'node:fs';
import path from 'node:path';
// Independent expected catalogue: adding a published design must not make layout tests stale.
const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../gallery/manifest.json'), 'utf8'));
export const catalogNumbers = manifest.map(design => design.no).sort((a,b) => b.localeCompare(a, 'en', {numeric:true}));
export const catalogCount = catalogNumbers.length;
export const sixtiesNumbers = catalogNumbers.filter(no => no.startsWith('PF-06'));
