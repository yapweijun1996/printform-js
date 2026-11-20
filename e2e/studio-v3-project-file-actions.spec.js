import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { clickHeaderAction } from './header-action.js';
import { gateway } from './studio-v3-element-style.js';
import { newProject } from '../studio-v3/model.js';
import { saveProject } from '../studio-v3/file-io.js';

test('reports file and print requests through the host without claiming completion', async ({ page }) => {
  await page.goto('/studio-v3/');
  await expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30_000 });
  const revision = await page.locator('#revision').textContent();

  const saving = page.waitForEvent('download');
  await clickHeaderAction(page, 'save');
  const saved = await saving;
  expect(saved.suggestedFilename()).toMatch(/\.printform\.json$/);
  const portable = JSON.parse(await readFile(await saved.path(), 'utf8'));
  expect(portable.project.manifest.studioV3).toBeTruthy();
  expect(portable.project.sampleData.items.length).toBeGreaterThan(0);
  await expect(page.locator('#status')).toContainText('Editable form download requested');

  const exporting = page.waitForEvent('download');
  await clickHeaderAction(page, 'export');
  const exported = await exporting;
  expect(exported.suggestedFilename()).toMatch(/\.html$/);
  expect(await readFile(await exported.path(), 'utf8')).toContain('PrintFormDocument');
  await expect(page.locator('#status')).toContainText('Standalone HTML download requested');

  const frame = page.frameLocator('#preview-frame').locator('html');
  await frame.evaluate(html => {
    window.print = () => { html.dataset.printRequested = 'true'; };
  });
  await clickHeaderAction(page, 'print');
  await expect(frame).toHaveAttribute('data-print-requested', 'true');
  await expect(page.locator('#status')).toContainText('Print requested.');
  await expect(page.locator('#revision')).toHaveText(revision);
});


const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function share(page,kind) {
  const pending = page.waitForEvent('download');
  await page.locator(`#share-dialog [data-action=${kind}]`).click();
  const download = await pending;
  return {name:download.suggestedFilename(),content:await readFile(await download.path(),'utf8')};
}
async function documentSections(page,html) {
  const sections = text=> {
    const doc = new DOMParser().parseFromString(text,'text/html');
    const read = id=>JSON.parse(doc.getElementById(id).textContent);
    return {manifest:read('pf-manifest'),schema:read('pf-schema'),sampleData:read('pf-sample-data')};
  };
  const markup = html ?? await page.locator('#preview-frame').getAttribute('srcdoc');
  return page.evaluate(sections,markup);
}
function withoutReceipt(content) {
  const {localImport,...manifest} = content.manifest;
  return {...content,manifest};
}

test('Share downloads the committed copy while preserving an invalid pending import review',async({page})=> {
  const project = newProject(), filename = 'original-private-source.csv', sourceOnly = 'ORIGINAL-UNMAPPED-SHARE-CANARY';
  project.manifest.title = 'Source-bearing share form';
  project.sampleData.customer.name = 'Committed local customer';
  project.manifest.localImport = {version:1,format:'csv',filename,sourceText:`client,extra\r\nCommitted local customer,${sourceOnly}\r\n`,
    sourcePointer:'',targetPointer:'',mappings:[{target:'/customer/name',source:'/client',conversion:'preserve'}]};
  await page.goto('/studio-v3/');
  await ready(page);
  await page.locator('#open-file').setInputFiles({name:'source-bearing.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(project))});
  const name = page.locator('#document-name');
  await expect(name).toHaveValue(project.manifest.title);
  await ready(page);
  await name.fill('Saved locally before sharing');
  await name.press('Tab');
  const revision = page.locator('#revision');
  await expect(revision).toHaveText('r1 · unsaved template');
  await ready(page);
  const committed = await documentSections(page);
  expect(committed.manifest.localImport).toEqual(project.manifest.localImport);
  await page.locator('[data-mode=data]').click();
  const pendingFilename = 'pending-review.csv', pendingValue = 'PENDING-INVALID-SHARE-CANARY';
  await page.locator('#dataset-file').setInputFiles({name:pendingFilename,mimeType:'text/csv',buffer:Buffer.from(`lookup,extra\r\n00009,${pendingValue}\r\n`)});
  await page.getByLabel('Source for /sku',{exact:true}).selectOption('/lookup');
  await page.locator('[data-db-action=import-preview]').click();
  const error = page.locator('#database-notice'), review = page.getByRole('heading',{name:'Review local CSV / JSON import'});
  await expect(error).toContainText('Map required');
  const priorError = await error.innerText();
  const dialog = page.locator('#share-dialog');
  const retained = async()=> {
    await expect(review).toBeVisible();
    await expect(page.locator('.database-source')).toContainText(pendingFilename);
    await expect(page.getByLabel('Source for /sku',{exact:true})).toHaveValue('/lookup');
    await expect(error).toHaveText(priorError);
    await expect(page.locator('[data-db-action=import-apply]')).toBeDisabled();
    await expect(page.locator('#draft-state')).toContainText('1 unapplied');
    await expect(revision).toHaveText('r1 · unsaved template');
    await expect(page.locator('[data-action=undo]')).toBeEnabled();
    expect(await documentSections(page)).toEqual(committed);
  };
  await clickHeaderAction(page,'share');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#draft-dialog')).toBeHidden();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await retained();
  for (const kind of ['save-share','export-share']) {
    await clickHeaderAction(page,'share');
    await expect(dialog).toBeVisible();
    const download = await share(page,kind);
    expect(download.name).toBe(kind === 'save-share' ? 'printform-share.printform.json' : 'printform-share.html');
    for (const marker of [filename,sourceOnly,pendingFilename,pendingValue]) expect(download.content).not.toContain(marker);
    const content = kind === 'save-share' ? JSON.parse(download.content).project : await documentSections(page,download.content);
    if (kind === 'save-share') expect(content.revision).toBe(1);
    expect({manifest:content.manifest,schema:content.schema,sampleData:content.sampleData}).toEqual(withoutReceipt(committed));
    await retained();
  }
});

test('Share holds HTML during an unapplied paper preview and editable bytes still come from the committed form',async({page})=> {
  await gateway(page,[['apply_operations',{summary:'Prepared draft margin',operations:[{type:'set_page',patch:{margins:{top:12}}}]}],['inspect_draft'],['finish',{summary:'Prepared draft margin'}]]);
  await page.goto('/studio-v3/');
  await ready(page);
  const committed = await documentSections(page);
  const dialog = page.locator('#share-dialog'), html = dialog.locator('[data-action=export-share]');
  await page.locator('[data-ai-toggle]').click();
  await page.locator('#ai-prompt').fill('Change the top page margin to 12 px.');
  await page.locator('[data-ai-send]').click();
  await expect(page.locator('[data-ai-proposal]')).toBeVisible({timeout:60000});
  await page.locator('[data-ai=preview]').click();
  await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await expect.poll(async()=> (await documentSections(page)).manifest.studioV3.page.margins.top).toBe(12);
  await expect(page.locator('#ai-preview-banner')).toBeVisible();
  await clickHeaderAction(page,'share');
  await expect(dialog).toBeVisible();
  await expect(html).toBeDisabled();
  const {content} = await share(page,'save-share'), {revision,...editable} = JSON.parse(content).project;
  expect(revision).toBe(0);
  expect(editable).toEqual(withoutReceipt(committed));
  await expect(page.locator('#ai-preview-banner')).toBeVisible();
  await page.locator('[data-ai=discard]').click();
  await ready(page);
  expect(await documentSections(page)).toEqual(committed);
  await clickHeaderAction(page,'share');
  await expect(html).toBeEnabled();
  const standalone = await share(page,'export-share');
  expect(await documentSections(page,standalone.content)).toEqual(withoutReceipt(committed));
  await expect(page.locator('#revision')).toHaveText('r0');
});
