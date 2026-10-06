import fs from 'node:fs';
import {expect,it} from 'vitest';

// pdf.js 6.x main build needs very new built-ins (Map.prototype.getOrInsertComputed), which made visual PDF
// rendering fail with "damaged" on Chromium 141. The legacy build is the supported choice for such browsers.
it('loads the pdf.js legacy build for both the page and its worker',()=> {
  const source=fs.readFileSync('studio-v3/reference-pdf-runtime.js','utf8');
  const imports=[...source.matchAll(/from '(pdfjs-dist\/[^']+)'/g)].map(match=>match[1]);
  expect(imports).toHaveLength(2);
  imports.forEach(path=>expect(path).toMatch(/^pdfjs-dist\/legacy\/build\//));
});
