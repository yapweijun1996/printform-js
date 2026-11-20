import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { clickHeaderAction } from './header-action.js';
import { demoStarterRecords } from '../studio-v3/demo-catalog.js';

const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});

// Use the actual rendered output bridge so reopening an opaque Firefox frame
// does not lose the utility-world context while the assertions are attached.
function observeNativePaper() {
  const project = root => [...root.querySelectorAll('.printform_page')].map(page => ({
    heading:page.querySelector('[data-v3-id=header-title]')?.textContent,
    rows:[...page.querySelectorAll('.prowitem_processed')].map(row=>({
      index:Number(row.dataset.pfRowIndex),
      sku:row.querySelector('[data-v3-id=items-sku]')?.textContent.trim(),
      description:row.querySelector('[data-v3-id=items-description]')?.textContent.trim(),
      amount:row.querySelector('[data-v3-id=items-amount]')?.textContent.trim()
    })),
    tableHeader:page.querySelectorAll('[data-v3-id=items-header]').length,
    pageNumber:page.querySelector('[data-v3-id=page-number]')?.textContent,
    amounts:[...page.querySelectorAll('[data-v3-id=totals-total]')].map(node=>node.textContent.trim())
  }));
  window.portableFacts = ()=>project(document);
  window.addEventListener('message',event=> {
    if (event.source !== document.querySelector('#preview-frame')?.contentWindow) return;
    const message = event.data;
    if (message?.source !== 'printform-studio-v3-preview' || message.type !== 'rendered') return;
    const sheets = new DOMParser().parseFromString(message.payload.pages.map(page=>page.html).join(''),'text/html');
    window.portablePreview = project(sheets);
  });
}

async function download(page,info,action,prefix = '') {
  const pending = page.waitForEvent('download');
  await clickHeaderAction(page,action);
  const item = await pending, name = item.suggestedFilename(), path = info.outputPath(prefix+name);
  await item.saveAs(path);
  return {name,path,buffer:await readFile(path)};
}

async function reopen(page,artifact,mimeType,title,revision) {
  await page.goto('/studio-v3/');
  await ready(page);
  await page.locator('#open-file').setInputFiles({name:artifact.name,mimeType,buffer:artifact.buffer});
  await expect(page.locator('#document-name')).toHaveValue(title);
  await ready(page);
  await expect(page.locator('#revision')).toHaveText(revision);
}

async function checkStandalone(page,href,expected,source,revision) {
  await page.goto(href);
  await expect(page.locator('html')).toHaveAttribute('data-printform-status','ready');
  expect(await page.evaluate(()=>window.portableFacts())).toEqual(expected);
  const data = await page.evaluate(()=>{
    const json = id=>JSON.parse(document.getElementById(id).textContent);
    return {data:json('pf-sample-data'),manifest:json('pf-manifest'),schema:json('pf-schema'),revision:json('pf-attestation').evidence.revision};
  });
  expect(data).toEqual({data:source.sampleData,manifest:source.manifest,schema:source.schema,revision});
  await expect(page.locator('meta[http-equiv=Content-Security-Policy]')).toHaveAttribute('content',/connect-src 'none'/);
  await page.emulateMedia({media:'print'});
  const geometry = await page.locator('.physical_page_wrapper').evaluateAll(nodes=>nodes.map(node=>{
    const {width,height} = node.getBoundingClientRect();
    return [width,height];
  }));
  expect(geometry).toHaveLength(expected.length);
  for (const [width,height] of geometry) {
    expect(Math.abs(width-794)).toBeLessThan(1);
    expect(Math.abs(height-1123)).toBeLessThan(1);
  }
  expect(await page.evaluate(()=>window.portableFacts())).toEqual(expected);
}

async function checkPdf(bytes,expected) {
  const loading = getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
  try {
    const pdf = await loading.promise;
    expect(pdf.numPages).toBe(expected.length);
    const compact = value=>value.replace(/\s+/g,'');
    const skus = new Set(expected.flatMap(sheet=>sheet.rows.map(row=>row.sku)));
    const printedSkus = text=>(text.match(/DEMO-[A-Z]+-\d{2}/g) || []).filter(token=>skus.has(token));
    for (const [index,sheet] of expected.entries()) {
      const page = await pdf.getPage(index+1);
      const [left,top,right,bottom] = page.view;
      expect(Math.abs(right-left-210*72/25.4)).toBeLessThan(1);
      expect(Math.abs(bottom-top-297*72/25.4)).toBeLessThan(1);
      const {items} = await page.getTextContent();
      const text = compact(items.map(item=>item.str || '').join(''));
      expect(printedSkus(text)).toEqual(sheet.rows.map(row=>row.sku));
      for (const amount of [...sheet.rows.map(row=>row.amount),...sheet.amounts]) expect(text).toContain(compact(amount));
    }
  } finally { await loading.destroy(); }
}

test('preserves A4 preset, reviewed metadata, exact source rows and Undo through native portable handoff',async({page,browser,browserName},info)=>{
  test.setTimeout(120000);
  const source = demoStarterRecords('SalesInvoice').find(record=>record.data.demo.scenario === 'campus');
  const title = 'Reviewed campus invoice 校园';
  await page.context().addInitScript(observeNativePaper);
  await page.goto('/studio-v3/');
  await ready(page);
  await clickHeaderAction(page,'new');
  const templates = page.locator('#new-dialog details').filter({hasText:'Business demo templates'});
  await templates.locator('summary').click();
  await templates.locator('[data-demo-template=SalesInvoice]').click();
  await ready(page);
  await page.locator('[data-mode=data]').click();
  await page.locator('#database-choice').selectOption(source.id);
  await ready(page);
  await expect.poll(()=>page.evaluate(()=>window.portablePreview?.flatMap(page=>page.rows).length)).toBe(source.data.items.length);
  const originalTitle = await page.locator('#document-name').inputValue();
  const baseline = await page.evaluate(()=>window.portablePreview);
  expect(baseline.length).toBeGreaterThan(1);
  const currency = new Intl.NumberFormat('en-MY',{style:'currency',currency:'MYR'});
  expect(baseline.flatMap(sheet=>sheet.rows)).toEqual(source.data.items.map(({sku,description,amount},index)=>({
    index,sku,description:description.trim(),amount:currency.format(amount)
  })));
  expect(baseline.filter(sheet=>sheet.rows.length).every(sheet=>sheet.tableHeader === 1)).toBe(true);
  expect(baseline.flatMap(sheet=>sheet.amounts)).toEqual([currency.format(source.data.summary.total)]);

  const revised = Number((await page.locator('#revision').innerText()).match(/^r(\d+)/)[1])+1;
  await page.locator('#document-name').fill(title);
  await page.locator('#document-name').press('Tab');
  await expect(page.locator('#revision')).toContainText(new RegExp(`^r${revised}\\b`));
  await ready(page);
  expect(await page.evaluate(()=>window.portablePreview)).toEqual(baseline);
  const editable = await download(page,info,'save'), html = await download(page,info,'export');
  const saved = JSON.parse(editable.buffer).project;
  expect(saved).toMatchObject({revision:revised,manifest:{title,studioV3:{layoutPreset:'invoice-ledger',page:{paper:'A4'}}}});
  expect(saved.sampleData).toEqual(source.data);
  expect(editable.name).toBe('Reviewed-campus-invoice-校园.printform.json');
  expect(html.name).toBe('Reviewed-campus-invoice-校园.html');
  await expect(page.locator('#revision')).toHaveText(`r${revised}`);

  for (const [artifact,mimeType] of [[editable,'application/json'],[html,'text/html']]) {
    const cold = await browser.newContext();
    try {
      await cold.addInitScript(observeNativePaper);
      const opened = await cold.newPage();
      await reopen(opened,artifact,mimeType,title,`r${revised}`);
      expect(await opened.evaluate(()=>window.portablePreview)).toEqual(baseline);
      const reopened = JSON.parse((await download(opened,info,'save',mimeType === 'text/html' ? 'reopened-html-' : 'reopened-json-')).buffer).project;
      const expectedManifest = {...saved.manifest,documentId:reopened.manifest.documentId};
      if (expectedManifest.localImport === null) delete expectedManifest.localImport;
      expect(reopened).toEqual({...saved,manifest:expectedManifest});
      expect(reopened.manifest.documentId).not.toBe(saved.manifest.documentId);
      await expect(opened.locator('[data-action=undo]')).toBeDisabled();
    } finally { await cold.close(); }
  }

  const isolated = await browser.newContext();
  try {
    await isolated.addInitScript(observeNativePaper);
    const standalone = await isolated.newPage(), unexpected = [];
    const routeUrl = 'https://studio-portable.test/reviewed-invoice.html';
    await standalone.route('**/*',route=> {
      if (route.request().url() === routeUrl && route.request().isNavigationRequest()) return route.fulfill({contentType:'text/html',body:html.buffer});
      unexpected.push(route.request().url());
      return route.abort();
    });
    await checkStandalone(standalone,routeUrl,baseline,saved,revised);
    expect(unexpected).toEqual([]);
  } finally { await isolated.close(); }

  // The bundled Linux WebKit reports an internal error on offline file navigation.
  if (browserName !== 'webkit') {
    const offline = await browser.newContext({offline:true});
    try {
      await offline.addInitScript(observeNativePaper);
      const filePage = await offline.newPage(), outbound = [];
      filePage.on('request',request=> { if (/^https?:/.test(request.url())) outbound.push(request.url()); });
      // Preserve the original downloaded bytes for the native file-origin test.
      await checkStandalone(filePage,pathToFileURL(html.path).href,baseline,saved,revised);
      expect(outbound).toEqual([]);
      if (browserName === 'chromium') {
        const pdf = await filePage.pdf({preferCSSPageSize:true,printBackground:true});
        await checkPdf(pdf,baseline);
      }
    } finally { await offline.close(); }
  }

  await clickHeaderAction(page,'undo');
  await expect(page.locator('#document-name')).toHaveValue(originalTitle);
  await expect(page.locator('#revision')).toContainText(new RegExp(`^r${revised+1}\\b`));
  await ready(page);
  expect(await page.evaluate(()=>window.portablePreview)).toEqual(baseline);
  const undone = JSON.parse((await download(page,info,'save','undone-')).buffer).project;
  expect(undone).toEqual({...saved,revision:revised+1,manifest:{...saved.manifest,title:originalTitle}});
});
