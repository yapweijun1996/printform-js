import {test,expect} from '@playwright/test';
import {clickHeaderAction} from './header-action.js';
import {keepStructureOpen} from './studio-v3-structure.js';
import {upgradeServer,OLD,NEXT} from './studio-v3-upgrade-server.js';
import {DATABASE_NAME} from '../studio-v3/database-store.js';

const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const revision = (page,value)=>expect(page.locator('#revision')).toContainText(new RegExp(`^r${value}\\b`));
async function currentSource(page) {
  const frame = page.locator('#preview-frame');
  await expect(frame).toHaveAttribute('srcdoc',/id="pf-sample-data"/);
  return frame.evaluate(node=> {
    const html = new DOMParser().parseFromString(node.srcdoc,'text/html');
    const read = id=>JSON.parse(html.getElementById(id).textContent);
    return {data:read('pf-sample-data'),schema:read('pf-schema'),manifest:read('pf-manifest')};
  });
}
function capturePaper() {
  if (window !== window.top) return;
  window.addEventListener('message',event=> {
    const message = event.data;
    if (event.source !== document.querySelector('#preview-frame')?.contentWindow ||
        message?.source !== 'printform-studio-v3-preview' || message.type !== 'rendered') return;
    const html = new DOMParser().parseFromString(message.payload.pages.map(page=>page.html).join(''),'text/html');
    const text = id=>html.querySelector(`[data-v3-id=${id}]`)?.textContent.trim();
    window.adoptedPaper = {title:text('header-title'),label:text('label-items-description'),
      rows:[...html.querySelectorAll('.prowitem_processed [data-v3-id=items-sku]')].map(node=>node.textContent.trim())};
  });
}
const paper = page=>page.evaluate(()=>window.adoptedPaper);
async function databaseContents(page) {
  const result = await page.evaluate(name=>new Promise((resolve,reject)=> {
    const request = indexedDB.open(name,1);
    request.onupgradeneeded = ()=>request.transaction.abort();
    request.onerror = ()=>reject(request.error);
    request.onsuccess = ()=> {
      const db = request.result;
      const tx = db.transaction(['datasets','preferences'],'readonly');
      const datasets = tx.objectStore('datasets').getAll(), preferences = tx.objectStore('preferences').getAll();
      tx.oncomplete = ()=>{ db.close(); resolve(JSON.stringify([datasets.result,preferences.result])); };
      tx.onerror = tx.onabort = ()=>{ db.close(); reject(tx.error); };
    };
  }),DATABASE_NAME);
  expect(JSON.parse(result)[0].length).toBeGreaterThan(0);
  return result;
}

test('adopted A4 starter retains its exact paper, pending edit and Undo across a verified update',async({page,context})=> {
  test.setTimeout(120000);
  const server = await upgradeServer();
  const gateway = [];
  let draft;
  try {
    await context.route('https://gpt.yapweijun1996.com/**',route=>{ gateway.push(route.request().url()); return route.abort(); });
    await context.addInitScript(capturePaper);
    await keepStructureOpen(context);
    await page.goto(server.url);
    await ready(page);
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    await page.locator('#document-name').fill('Original tab title');
    await page.locator('#document-name').press('Tab');
    await revision(page,1);
    await ready(page);
    const parent = await currentSource(page), datasets = await databaseContents(page);
    await page.locator('[data-ai-toggle]').click();
    await page.locator('#ai-prompt').fill('/new invoice-ledger');
    await page.locator('[data-ai-send]').click();
    const opened = context.waitForEvent('page');
    await page.getByRole('link',{name:'Refine in draft tab'}).click();
    draft = await opened;
    const adopt = draft.getByRole('button',{name:'Adopt this form'});
    const notice = draft.locator('[data-new-form-return-status]');
    await expect(draft.locator('#status')).toContainText('current layout passed');
    const seed = await currentSource(draft), seedPaper = await paper(draft);
    expect(seed.manifest.documentId).not.toBe(parent.manifest.documentId);
    expect(seed.manifest.studioV3.layoutPreset).toBe('invoice-ledger');
    expect(seed.manifest.studioV3.page.paper).toBe('A4');
    expect(seedPaper.rows).toEqual(seed.data.items.map(row=>row.sku));
    await expect(draft.locator('[data-action=export]')).toBeHidden();
    await adopt.click();
    await expect(notice).toContainText('Run all synthetic samples successfully');

    const title = 'Reviewed A4 invoice 校园';
    await draft.locator('#left-panel [data-select=header]').click();
    await draft.getByLabel('Document heading',{exact:true}).fill(title);
    await draft.getByRole('button',{name:'Apply section',exact:true}).click();
    await revision(draft,1);
    await draft.locator('[data-mode=validate]').click();
    await draft.getByRole('button',{name:'Run all synthetic samples',exact:true}).click();
    await expect(draft.locator('#right-panel').getByText(/pages? · passed/)).toHaveCount(6,{timeout:60000});
    await expect.poll(()=>paper(draft)).toEqual({...seedPaper,title});
    await adopt.click();
    await expect(notice).toContainText('Adopted.');
    await ready(draft);
    await expect(draft.locator('#app-version')).toContainText(OLD.slice(0,12));
    const approved = structuredClone(seed);
    approved.manifest.studioV3.title = title;
    approved.manifest.studioV3.blocks.header.keepTogether = false;
    expect(await currentSource(draft)).toEqual(approved);

    await draft.locator('[data-mode=design]').click();
    await draft.locator('#left-panel [data-select=items-description]').click();
    const label = draft.getByLabel('Label',{exact:true});
    const pending = 'Pending description 项目';
    await label.fill(pending);
    await expect(draft.locator('#draft-state')).toContainText('1 unapplied');
    await expect.poll(()=>paper(draft)).toEqual({...seedPaper,title});
    server.publish();
    await clickHeaderAction(draft,'update');
    await expect(draft.locator('#update-dialog')).toBeVisible({timeout:30000});
    await draft.locator('[data-update-choice=keep]').click();
    await expect(draft.locator('#app-version')).toContainText(NEXT.slice(0,12));
    await ready(draft);
    await revision(draft,1);
    await expect(adopt).toBeHidden();
    await expect(label).toHaveValue(pending);
    await expect(draft.locator('#draft-state')).toContainText('1 unapplied');
    expect(await currentSource(draft)).toEqual(approved);
    await expect.poll(()=>paper(draft)).toEqual({...seedPaper,title});
    expect(await draft.evaluate(()=>Object.keys(sessionStorage).filter(key=>key.includes('recovery')))).toEqual([]);

    await draft.getByRole('button',{name:'Apply field',exact:true}).click();
    await ready(draft);
    await revision(draft,2);
    const applied = structuredClone(approved);
    const description = applied.manifest.studioV3.columns.find(field=>field.id==='description');
    Object.assign(description,{label:pending,showLabel:true});
    expect(await currentSource(draft)).toEqual(applied);
    await expect.poll(()=>paper(draft)).toEqual({...seedPaper,title,label:pending});
    for (const [version,source,expectedPaper] of [[3,approved,{...seedPaper,title}],[4,seed,seedPaper]]) {
      await clickHeaderAction(draft,'undo');
      await ready(draft);
      await revision(draft,version);
      expect(await currentSource(draft)).toEqual(source);
      await expect.poll(()=>paper(draft)).toEqual(expectedPaper);
    }
    await expect(page.locator('#update-dialog')).toBeVisible();
    await page.locator('[data-update-choice=stay]').click();
    await expect(page.locator('#app-version')).toContainText(OLD.slice(0,12));
    await revision(page,1);
    expect(await currentSource(page)).toEqual(parent);
    expect(await databaseContents(draft)).toBe(datasets);
    expect(gateway).toEqual([]);
  } finally { await draft?.close(); await server.close(); }
});
