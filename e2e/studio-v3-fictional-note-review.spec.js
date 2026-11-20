import { test, expect } from './studio-v3-test.js';
import { saveProject } from '../studio-v3/file-io.js';
import { newProject } from '../studio-v3/model.js';

test.setTimeout(90000);
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const openReview = page=>page.getByRole('button',{name:'Review fictional note',exact:true});
const change = '<b>Approved fictional note · 虚构数据</b>';
const recoveryKey = 'printform-studio-v3:update-recovery';

async function activeSource(page) {
  const frame = page.locator('#preview-frame');
  await expect(frame).toHaveAttribute('srcdoc',/id="pf-sample-data"/);
  return frame.evaluate(node=> {
    const page = new DOMParser().parseFromString(node.srcdoc,'text/html');
    const read = id=>JSON.parse(page.getElementById(id).textContent);
    return {data:read('pf-sample-data'),manifest:read('pf-manifest'),schema:read('pf-schema')};
  });
}

function savedRecords(page) {
  return page.evaluate(()=>new Promise((resolve,reject)=> {
    const request = indexedDB.open('printform-studio-v3-demo-db');
    request.onerror = ()=>reject(request.error);
    request.onsuccess = ()=> {
      const db = request.result, tx = db.transaction(['datasets','preferences']);
      const datasets = tx.objectStore('datasets').getAll(), preferences = tx.objectStore('preferences').getAll();
      tx.onerror = ()=>{ db.close(); reject(tx.error); };
      tx.oncomplete = ()=>{ db.close(); resolve({datasets:datasets.result,preferences:preferences.result}); };
    };
  }));
}

async function expectPrinted(page,preview,value) {
  await expect.poll(()=>page.evaluate(key=>window.__printedFictionalNotes?.[key],preview? 'preview':'main'),{timeout:15000}).toEqual({value,hasBold:false});
}

test('fictional note previews, applies once and undoes without writing a dataset or calling the provider',async({page,context})=>{
  const provider = [];
  await context.route('https://gpt.yapweijun1996.com/**',route=>{ provider.push(route.request().url()); return route.abort(); });
  await context.addInitScript(()=>{
    window.addEventListener('message',event=>{
      if (event.data?.source !== 'printform-studio-v3-preview' || event.data?.type !== 'rendered') return;
      const main = document.querySelector('#preview-frame'), preview = document.querySelector('#fictional-note-dialog iframe');
      const key = event.source === main?.contentWindow ? 'main' : event.source === preview?.contentWindow ? 'preview' : null;
      if (!key) return;
      const markup = document.createElement('template');
      markup.innerHTML = event.data.payload.pages.map(page=>page.html).join('');
      const note = markup.content.querySelector('[data-v3-id=footer-notes]');
      if (note) (window.__printedFictionalNotes ||= {})[key] = {value:note.textContent,hasBold:Boolean(note.querySelector('b'))};
    });
  });
  await page.goto('/studio-v3/'); await ready(page);
  await page.locator('[data-mode=data]').click();
  // The ordinary app loads a saved starter. Stored origin labels do not authorize this path.
  await expect(openReview(page)).toHaveCount(0);
  const original = await activeSource(page), records = await savedRecords(page);
  expect(records.datasets.length).toBeGreaterThan(0);
  await page.locator('[data-ai-toggle]').click();
  await page.locator('#ai-prompt').fill('/new delivery');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  const create = page.getByRole('link',{name:'Apply & open in new tab'});
  await expect(create).toBeVisible({timeout:30000});
  const opened = context.waitForEvent('page');
  await create.click();
  const fork = await opened;
  await ready(fork);
  await fork.locator('[data-mode=data]').click();
  const baseline = await activeSource(fork);
  expect(baseline.manifest.documentId).not.toBe(original.manifest.documentId);
  expect(baseline.data).toEqual(newProject('delivery').sampleData);
  const review = fork.getByRole('dialog',{name:'Review fictional note'});
  const note = review.getByRole('textbox',{name:'Replacement note'});
  const preview = review.getByRole('button',{name:'Preview note'});
  const apply = review.getByRole('button',{name:'Apply to form'});

  await openReview(fork).click();
  await expect(note).toBeFocused();
  await expect(note).toHaveValue(baseline.data.notes);
  await preview.click();
  await expect(review.getByRole('status')).toContainText('Enter a different note');
  await expect(apply).toBeDisabled();
  await note.fill(change);
  await preview.click();
  await expect(apply).toBeEnabled({timeout:30000});
  await expectPrinted(fork,true,change);
  await expect(fork.locator('#revision')).toHaveText('r0');
  expect(await activeSource(fork)).toEqual(baseline);
  expect(await savedRecords(fork)).toEqual(records);

  await note.fill('Different draft invalidates the reviewed preview');
  await expect(apply).toBeDisabled();
  await review.getByRole('button',{name:'Cancel'}).click();
  await expect(review).toBeHidden();
  await expect(fork.locator('#revision')).toHaveText('r0');
  expect(await activeSource(fork)).toEqual(baseline);
  expect(await fork.evaluate(key=>sessionStorage.getItem(key),recoveryKey)).toBeNull();

  await openReview(fork).click();
  await note.fill(change);
  await preview.click();
  await expect(apply).toBeEnabled({timeout:30000});
  await apply.dblclick().catch(error=> {
    // The first click can close and disable the modal before the second is sent.
    return review.isVisible().then(visible=>{if (visible) throw error;});
  });
  await expect(review).toBeHidden();
  await expect(fork.locator('#revision')).toHaveText(/^r1\b/);
  await ready(fork);
  await expectPrinted(fork,false,change);
  const applied = await activeSource(fork);
  expect(applied.manifest.studioV3).toEqual(baseline.manifest.studioV3);
  expect(applied.schema).toEqual(baseline.schema);
  expect(applied.data).toEqual({...baseline.data,notes:change});
  await expect(openReview(fork)).toHaveCount(0);
  expect(await savedRecords(fork)).toEqual(records);

  await fork.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(fork.locator('#revision')).toHaveText(/^r2\b/);
  await ready(fork);
  await expectPrinted(fork,false,baseline.data.notes);
  expect((await activeSource(fork)).data).toEqual(baseline.data);
  await expect(openReview(fork)).toBeVisible();
  expect(await savedRecords(fork)).toEqual(records);

  const incoming = newProject('delivery');
  incoming.manifest.title = 'Imported matching sample';
  fork.on('dialog',prompt=>prompt.accept());
  await fork.locator('#open-file').setInputFiles({name:'matching.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(incoming))});
  await expect(fork.locator('#document-name')).toHaveValue(incoming.manifest.title);
  await ready(fork);
  await expect(openReview(fork)).toHaveCount(0);
  expect(await savedRecords(fork)).toEqual(records);
  expect(await activeSource(page)).toEqual(original);
  expect(provider).toEqual([]);
});
