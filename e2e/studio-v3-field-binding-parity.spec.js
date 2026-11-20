import {test,expect} from './studio-v3-test.js';
import {expectApplied} from './ai-applied.js';
import {gateway,save,normalized,diagnostics} from './studio-v3-element-style.js';
import {newProject,designOf,compileProject} from '../studio-v3/model.js';
import {saveProject} from '../studio-v3/file-io.js';

test.use({workInSteps:true});
test.setTimeout(90000);
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled();
const target = 'header-number';
const pointer = '/document/reference';
const code = '0123456789012';
const text = 'Support <literal> & 茶';
const options = {format:'EAN13',moduleWidth:3,height:51,displayValue:true};
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const edits = {
  bound: {patch:{pointer}, prompt:'Bind the document number to /document/reference.'},
  static: {patch:{kind:'static',text},prompt:`Use exactly "${text}" as literal document number text.`},
  image: {patch:{kind:'image',assetId:'mark',width:65.25,height:32.5,fit:'contain',text:'',format:''},prompt:'Use the embedded asset mark with width 65.25 and height 32.5.'},
  barcode: {patch:{kind:'barcode',pointer,barcode:options,text:'',format:''},prompt:'Render the existing /document/reference string as EAN13 with module width 3 and height 51. Keep the printed text.'}
};

async function editInspector(page,mode) {
  const structure = page.locator('[data-layout=structure]').first();
  if (await structure.getAttribute('aria-expanded') !== 'true') await structure.click();
  await page.locator(`#left-panel [data-select="${target}"]`).click();
  await page.locator('[data-action=binding]').click();
  const form = page.locator('form[data-form=binding]');
  await form.getByLabel('Value source',{exact:true}).selectOption(mode);
  if (mode === 'bound' || mode === 'barcode') await form.locator('[name=pointer]').fill(pointer);
  if (mode === 'static') await form.locator('[name=text]').fill(text);
  if (mode === 'image') {
    await form.getByText('Embedded image source',{exact:true}).click();
    await form.locator('[name=assetId]').selectOption('mark');
    await form.locator('[name=imageWidth]').fill('65.25');
    await form.locator('[name=imageHeight]').fill('32.5');
  }
  if (mode === 'barcode') {
    await form.getByText('Offline barcode',{exact:true}).click();
    await form.locator('[name=barcodeFormat]').selectOption('EAN13');
    await form.locator('[name=barcodeModuleWidth]').fill('3');
    await form.locator('[name=barcodeHeight]').fill('51');
  }
  await form.getByRole('button',{name:'Apply binding',exact:true}).click();
  await expect(page.locator('#revision')).toHaveText(/^r1\b/);
  await ready(page);
}

async function checkPreview(page,mode) {
  const value = page.frameLocator('#preview-frame').locator(`[data-v3-id="${target}"]`).first();
  if (mode === 'image') {
    await expect(value).toHaveCSS('width','65.25px');
    await expect(value).toHaveCSS('height','32.5px');
    await expect(value).toHaveCSS('object-fit','contain');
    await expect.poll(()=>value.evaluate(node=>node.complete && node.naturalWidth)).toBe(1);
  } else if (mode === 'barcode') {
    await expect(value.locator('svg rect').first()).toBeVisible();
    await expect(value.locator('svg text')).toHaveText(code);
  } else await expect(value).toHaveText(mode === 'static' ? text : code);
}

for (const [mode,{patch,prompt}] of Object.entries(edits)) {
  test(`field ${mode} Inspector and Pi render equivalent candidates and preserve Undo`,async({page},info)=> {
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await gateway(page,[['apply_operations',{summary:'Change the selected field',operations:[{type:'set_field',target,patch}]}],['inspect_draft'],['finish',{summary:'Change the selected field'}]]);
    await page.goto('/studio-v3/');
    await ready(page);
    const project = newProject();
    project.sampleData.document.reference = code;
    const design = designOf(project);
    design.assets = [{id:'mark',src:PNG,alt:'Fictional mark'}];
    await page.locator('#open-file').setInputFiles({name:'binding-fixture.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(compileProject(project,design)))});
    await expect(page.locator('#status')).toContainText('Opened editable');
    await ready(page);
    const before = normalized((await save(page,info,'before.json')).project);
    await editInspector(page,mode);
    await checkPreview(page,mode);
    const ui = (await save(page,info,'ui.json')).project;
    const uiReport = (await diagnostics(page,ui)).diagnostics;
    expect(uiReport.ready).toBe(true);
    await page.locator('[data-action=undo]').click();
    await ready(page);
    expect(normalized((await save(page,info,'human-undo.json')).project)).toEqual(before);

    await page.locator('[data-ai-toggle]').click();
    await page.locator('#ai-prompt').fill(prompt);
    await page.locator('[data-ai-send]').click();
    await expect(page.locator('[data-ai-proposal]')).toBeVisible({timeout:60000});
    await page.locator('[data-ai=preview]').click();
    await expect(page.locator('[data-ai=apply]')).toBeEnabled();
    await expect(page.locator('#revision')).toHaveText(/^r2\b/);
    await page.locator('[data-ai=apply]').click();
    await expectApplied(page,3);
    await ready(page);
    await checkPreview(page,mode);
    const pi = (await save(page,info,'pi.json')).project;
    expect(normalized(pi)).toEqual(normalized(ui));
    expect((await diagnostics(page,pi)).diagnostics).toEqual(uiReport);
    await page.locator('[data-ai=undo]').click();
    await ready(page);
    expect(normalized((await save(page,info,'pi-undo.json')).project)).toEqual(before);
    expect(errors).toEqual([]);
  });
}
