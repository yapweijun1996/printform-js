import {expect,test} from '@playwright/test';
import {clickHeaderAction} from './header-action.js';
import {keepStructureOpen} from './studio-v3-structure.js';
import {previewDocument} from './studio-v3-rendered-probes.js';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const GIF = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const localSource = (type,data)=>`data:image/${type};base64,${data}`;
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const revision = (page,value)=>expect(page.locator('#revision')).toContainText(new RegExp(`^r${value}\\b`));
const input = page=>page.locator('input[data-image-target=header-logo]');
const upload = (page,type,data)=>input(page).setInputFiles({name:`local-logo.${type}`,mimeType:`image/${type}`,buffer:Buffer.from(data,'base64')});
async function state(page) {
  return page.locator('#preview-frame').evaluate(frame=> {
    const html = new DOMParser().parseFromString(frame.srcdoc,'text/html');
    const read = id=>JSON.parse(html.getElementById(id).textContent);
    return {manifest:read('pf-manifest'),data:read('pf-sample-data'),schema:read('pf-schema')};
  });
}
async function visibleLogo(page,source) {
  await expect.poll(()=>previewDocument(page,()=> {
    const logo = document.querySelector('img[data-v3-id=header-logo]');
    return logo && [logo.getAttribute('src'),logo.naturalWidth,logo.naturalHeight];
  })).toEqual([source,1,1]);
}
async function holdDecode(page,source) {
  await page.evaluate(source=> {
    const original = HTMLImageElement.prototype.decode;
    let release;
    const pending = new Promise(resolve=>release=resolve);
    window.releaseLogoDecode = release;
    HTMLImageElement.prototype.decode = function(...args) {
      if (this.src !== source) return original.apply(this,args);
      HTMLImageElement.prototype.decode = original;
      window.logoDecodeStarted = true;
      return pending.then(()=>original.apply(this,args)).then(()=>{ window.logoDecodeSucceeded = true; });
    };
  },source);
}

test.beforeEach(async({page})=> {
  await keepStructureOpen(page);
  await page.goto('/studio-v3/');
  await ready(page);
  await page.locator('#left-panel [data-select=header]').click();
  await page.getByText('Logo / embedded image',{exact:true}).click();
});

test('rejects a signature-only PNG before changing the ready project, then imports the exact working image',async({page})=> {
  const before = await state(page);
  await upload(page,'png','iVBORw0KGgo=');
  await expect(page.locator('#status')).toContainText('The selected image could not be decoded');
  await expect(page.locator('#status')).not.toContainText('data:image/');
  await expect(page.locator('#revision')).toHaveText('r0');
  await expect(page.locator('[data-action=undo]')).toBeDisabled();
  await ready(page);
  expect(await state(page)).toEqual(before);

  await upload(page,'png',PNG);
  await revision(page,1);
  await ready(page);
  const source = localSource('png',PNG), after = await state(page), design = after.manifest.studioV3;
  expect(design.assets).toHaveLength(1);
  expect(design.assets[0]).toEqual({id:design.logo.assetId,src:source,alt:''});
  const expected = structuredClone(before);
  Object.assign(expected.manifest.studioV3,{assets:design.assets,logo:design.logo});
  expect(after).toEqual(expected);
  await visibleLogo(page,source);
  await clickHeaderAction(page,'undo');
  await ready(page);
  await revision(page,2);
  expect(await state(page)).toEqual(before);
});

test('a newer selection for the same logo supersedes an in-flight decode',async({page})=> {
  await holdDecode(page,localSource('png',PNG));
  await upload(page,'png',PNG);
  await expect.poll(()=>page.evaluate(()=>window.logoDecodeStarted)).toBe(true);
  await upload(page,'gif',GIF);
  await page.evaluate(()=>window.releaseLogoDecode());
  await expect.poll(()=>page.evaluate(()=>window.logoDecodeSucceeded)).toBe(true);
  const latest = localSource('gif',GIF);
  await visibleLogo(page,latest);
  await ready(page);
  await revision(page,1);
  const design = (await state(page)).manifest.studioV3;
  expect(design.assets).toEqual([{id:design.logo.assetId,src:latest,alt:''}]);
});

test('a decode that finishes after replacement never attaches to the new document',async({page})=> {
  const before = await state(page);
  await holdDecode(page,localSource('png',PNG));
  await upload(page,'png',PNG);
  await expect.poll(()=>page.evaluate(()=>window.logoDecodeStarted)).toBe(true);
  await clickHeaderAction(page,'new');
  await page.locator('#new-dialog [data-template=purchase]').click();
  await expect(page.locator('#document-name')).toHaveValue(/purchase order/i);
  await ready(page);
  const opened = await state(page);
  expect(opened.manifest.documentId).not.toBe(before.manifest.documentId);
  expect(opened.manifest.studioV3.type).toBe('purchase');
  await expect(page.locator('#revision')).toHaveText('r0');
  await page.evaluate(()=>window.releaseLogoDecode());
  await expect.poll(()=>page.evaluate(()=>window.logoDecodeSucceeded)).toBe(true);
  // The ordinary title edit queues behind the old upload and waits for it to settle.
  await page.locator('#document-name').fill('Confirmed replacement');
  await page.locator('#document-name').press('Tab');
  await revision(page,1);
  await ready(page);
  expect(await state(page)).toEqual({...opened,manifest:{...opened.manifest,title:'Confirmed replacement'}});
});
