import { test, expect } from './studio-v3-test.js';
import { expectApplied } from './ai-applied.js';
import { gateway, save, normalized, diagnostics } from './studio-v3-element-style.js';
import { newProject, designOf, compileProject } from '../studio-v3/model.js';
import { saveProject } from '../studio-v3/file-io.js';

test.use({workInSteps:true});
test.setTimeout(90000);
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled();
const revision = (page,value) => expect(page.locator('#revision')).toHaveText(new RegExp(`^r${value}\\b`));
const frame = page => page.frameLocator('#preview-frame');

async function showStructure(page) {
  const structure = page.locator('[data-layout=structure]').first();
  if (await structure.getAttribute('aria-expanded') !== 'true') await structure.click();
}

async function load(page,project) {
  await page.goto('/studio-v3/');
  await ready(page);
  await page.locator('#open-file').setInputFiles({name:'fixture.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(project))});
  await expect(frame(page).locator('[data-v3-id=header-title]').first()).toHaveText(project.manifest.studioV3.title);
  await ready(page);
}

function toolChain(operations) {
  return [['apply_operations',{summary:'Form edit',operations}],['inspect_draft'],['finish',{summary:'Form edit'}]];
}

async function ask(page,prompt) {
  await page.locator('[data-ai-toggle]').click();
  await page.locator('#ai-prompt').fill(prompt);
  await page.locator('[data-ai-send]').click();
}

test('field add, move and remove agree with a Pi batch and both Undo paths',async({page},info)=>{
  const id = 'field-3a2b1c0d', target = `footer-${id}`;
  const fixture = newProject('delivery'), initial = designOf(fixture);
  initial.title = 'Field collection parity fixture';
  initial.footer.push({id:'obsolete',label:'Obsolete note',pointer:'',format:'',text:'Retire this note'});
  const operations = [
    {type:'add_field',section:'footer',field:{id,label:'New field',text:'New text'}},
    {type:'reorder_fields',section:'footer',order:['footer-notes',target,'footer-signature','footer-obsolete']},
    {type:'remove_field',target:'footer-obsolete'}
  ];
  await gateway(page,toolChain(operations));
  await load(page,compileProject(fixture,initial));
  const before = normalized((await save(page,info,'before.json')).project);
  await showStructure(page);
  await page.locator('#left-panel [data-select=footer]').click();
  // Reproduce the same generated field ID in the explicit Pi operation.
  await page.evaluate(()=>{
    const original = crypto.randomUUID;
    crypto.randomUUID = function() {
      crypto.randomUUID = original;
      return '3a2b1c0d-0607-4809-8102-030405060708';
    };
  });
  await page.locator('#right-panel [data-action=add-field]').click();
  await revision(page,1);
  await page.locator('#right-panel [data-action=move-up]').click();
  await revision(page,2);
  await page.locator('#right-panel [data-action=move-up]').click();
  await revision(page,3);
  await page.locator('#left-panel [data-select=footer-obsolete]').click();
  await page.locator('#right-panel [data-action=remove-field]').click();
  await revision(page,4); await ready(page);
  const checkPrint = async()=>{
    await expect(frame(page).locator(`[data-v3-id="${target}"]`).first()).toHaveText('New text');
    await expect(frame(page).locator('[data-v3-id=footer-obsolete]')).toHaveCount(0);
    const fields = frame(page).locator(`[data-v3-id="${target}"],[data-v3-id=footer-signature]`);
    await expect(fields.first()).toHaveAttribute('data-v3-id',target);
  };
  await checkPrint();
  const ui = (await save(page,info,'ui.json')).project;
  const expected = structuredClone(before);
  expected.manifest.studioV3.footer.splice(1,0,{id,label:'New field',pointer:'',format:'',text:'New text'});
  expected.manifest.studioV3.footer.pop();
  expect(normalized(ui)).toEqual(expected);
  const report = (await diagnostics(page,ui)).diagnostics;
  expect(report.ready).toBe(true);

  for (let i=0;i<4;i++) { await page.locator('[data-action=undo]').click(); await revision(page,5+i); await ready(page); }
  expect(normalized((await save(page,info,'undone.json')).project)).toEqual(before);
  await ask(page,'Insert a New field with New text before the signature and remove the obsolete note.');
  await expectApplied(page,9,{timeout:60000}); await ready(page); await checkPrint();
  const pi = (await save(page,info,'pi.json')).project;
  expect(normalized(pi)).toEqual(expected);
  expect((await diagnostics(page,pi)).diagnostics).toEqual(report);
  await page.locator('[data-ai=undo]').click(); await revision(page,10); await ready(page);
  expect(normalized((await save(page,info,'ai-undone.json')).project)).toEqual(before);
});

test('primary collection editing renders the same supplied rows after manual Pi approval',async({page},info)=>{
  const project = newProject('delivery'), design = designOf(project);
  design.title = 'Table collection parity fixture';
  project.sampleData.lines = structuredClone(project.sampleData.items);
  const alternate = 'Alternate delivery line for collection test';
  project.sampleData.lines[0].description = alternate;
  await gateway(page,toolChain([{type:'set_collection',value:'/lines'}]));
  // Read the actual rendered page from the preview bridge. Firefox can lose
  // Playwright's direct iframe execution context when the preview is replaced.
  await page.addInitScript(()=>{
    window.addEventListener('message',event=>{
      if (event.source !== document.querySelector('#preview-frame')?.contentWindow ||
          event.data?.source !== 'printform-studio-v3-preview' || event.data.type !== 'rendered') return;
      const preview = document.createElement('template');
      preview.innerHTML = event.data.payload.pages[0]?.html || '';
      window.__collectionFirstPrintedRow = preview.content.querySelector('[data-v3-id=items-description]')?.textContent;
    });
  });
  await load(page,compileProject(project,design));
  const before = normalized((await save(page,info,'before.json')).project);
  await showStructure(page);
  await page.locator('#left-panel [data-select=items]').click();
  await page.locator('[data-action=binding]').click();
  await page.getByLabel('Pick a collection',{exact:true}).selectOption('/lines');
  await page.getByRole('button',{name:'Apply collection',exact:true}).click();
  await revision(page,1); await ready(page);
  const printed = () => page.evaluate(()=>window.__collectionFirstPrintedRow);
  await expect.poll(printed).toBe(alternate);
  const ui = (await save(page,info,'ui.json')).project;
  expect(normalized(ui)).toEqual({...before,manifest:{...before.manifest,studioV3:{...before.manifest.studioV3,collection:'/lines'}}});
  const report = (await diagnostics(page,ui)).diagnostics;
  expect(report.ready).toBe(true);
  await page.locator('[data-action=undo]').click();
  await revision(page,2); await ready(page);
  await expect.poll(printed).toBe(project.sampleData.items[0].description);
  expect(normalized((await save(page,info,'undone.json')).project)).toEqual(before);

  await ask(page,'Use the /lines collection for the primary items table.');
  await expect(page.locator('[data-ai-proposal]')).toBeVisible({timeout:60000});
  await page.locator('[data-ai=preview]').click();
  await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await revision(page,2);
  expect(normalized((await save(page,info,'before-approval.json')).project)).toEqual(before);
  await page.locator('[data-ai=apply]').click();
  await expectApplied(page,3); await ready(page);
  await expect.poll(printed).toBe(alternate);
  const pi = (await save(page,info,'pi.json')).project;
  expect(normalized(pi)).toEqual(normalized(ui));
  expect((await diagnostics(page,pi)).diagnostics).toEqual(report);
  await page.locator('[data-ai=undo]').click(); await revision(page,4); await ready(page);
  await expect.poll(printed).toBe(project.sampleData.items[0].description);
  expect(normalized((await save(page,info,'ai-undone.json')).project)).toEqual(before);
});
