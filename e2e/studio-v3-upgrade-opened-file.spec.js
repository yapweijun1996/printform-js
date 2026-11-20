import {expect,test} from '@playwright/test';
import {clickHeaderAction} from './header-action.js';
import {upgradeServer,OLD,NEXT} from './studio-v3-upgrade-server.js';
import {previewDocument} from './studio-v3-rendered-probes.js';
import {newProject} from '../studio-v3/model.js';
import {saveProject} from '../studio-v3/file-io.js';

const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const version = (page,value)=>expect(page.locator('#app-version')).toHaveText(`v3 · ${value.slice(0,12)}`);
const backup = page=>page.evaluate(()=>sessionStorage.getItem('printform-studio-v3:update-recovery'));
const source = page=>page.locator('#preview-frame').evaluate(frame=> {
  const html = new DOMParser().parseFromString(frame.srcdoc,'text/html');
  const read = id=>JSON.parse(html.getElementById(id).textContent);
  return {manifest:read('pf-manifest'),data:read('pf-sample-data'),schema:read('pf-schema')};
});
const paper = page=>previewDocument(page,()=>({
  company:document.querySelector('[data-v3-id=header-company]')?.textContent.trim(),
  rows:[...document.querySelectorAll('.prowitem_processed [data-v3-id=items-sku]')].map(node=>node.textContent.trim())
}));

test('a clean locally opened form updates only after a choice and Keeps its original source',async({page})=> {
  test.setTimeout(90000);
  const server = await upgradeServer();
  try {
    await page.goto(server.url);
    await ready(page);
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    const original = await source(page), fixture = newProject('delivery');
    fixture.manifest.title = 'External dispatch document';
    fixture.sampleData.company.name = 'SYNTHETIC EXTERNAL COMPANY';
    fixture.sampleData.items[0].sku = 'LOCAL-EXACT-0007';
    await page.locator('#open-file').setInputFiles({name:'external.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(fixture))});
    await expect(page.locator('#document-name')).toHaveValue(fixture.manifest.title);
    await ready(page);
    const opened = await source(page), expectedPaper = {company:fixture.sampleData.company.name,rows:fixture.sampleData.items.map(row=>row.sku)};
    expect(opened.manifest.documentId).not.toBe(original.manifest.documentId);
    expect(opened.data).toEqual(fixture.sampleData);
    expect(opened.schema).toEqual(fixture.schema);
    await expect.poll(()=>paper(page)).toEqual(expectedPaper);
    await expect(page.locator('#data-source')).toContainText('Imported data');
    await expect(page.locator('#revision')).toHaveText('r0');
    await expect(page.locator('[data-action=undo]')).toBeDisabled();
    await expect(page.locator('[data-action=redo]')).toBeDisabled();
    server.publish();
    await clickHeaderAction(page,'update');
    await expect(page.locator('#update-dialog')).toBeVisible({timeout:30000});
    await expect(page.locator('[data-update-summary]')).toContainText('opened from a local file');
    expect(await backup(page)).toBeNull();
    await page.locator('[data-update-choice=stay]').click();
    await version(page,OLD);
    expect(await source(page)).toEqual(opened);
    expect(await backup(page)).toBeNull();
    await clickHeaderAction(page,'update');
    await expect(page.locator('#update-dialog')).toBeVisible();
    await page.locator('[data-update-choice=keep]').click();
    await version(page,NEXT);
    await ready(page);
    await expect(page.locator('#document-name')).toHaveValue(fixture.manifest.title);
    await expect(page.locator('#revision')).toHaveText('r0');
    await expect(page.locator('#data-source')).toContainText('Imported data');
    expect(await source(page)).toEqual(opened);
    await expect.poll(()=>paper(page)).toEqual(expectedPaper);
    await expect(page.locator('[data-action=undo]')).toBeDisabled();
    await expect(page.locator('[data-action=redo]')).toBeDisabled();
    expect(await backup(page)).toBeNull();
  } finally { await server.close(); }
});
