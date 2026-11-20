import {expect,test} from '@playwright/test';
import {keepStructureOpen} from './studio-v3-structure.js';
import {previewDocument} from './studio-v3-rendered-probes.js';
import {compileProject,designOf,newProject} from '../studio-v3/model.js';
import {saveProject} from '../studio-v3/file-io.js';

const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const table = (id,label,collection,field,enabled=true)=>({id,label,collection,enabled,repeatHeader:true,breakBefore:false,
  columns:[{id:'ref',label:field,pointer:'./reference',format:'',width:100}]});
function fixture() {
  const project = newProject('delivery'), design = designOf(project);
  project.manifest.title = 'Independent tables search';
  project.sampleData.charges = [{reference:'CHARGE-007'},{reference:'CHARGE-002'}];
  project.sampleData.fees = [{reference:'FEE-018'},{reference:'FEE-004'}];
  project.sampleData.internal = [{reference:'INTERNAL-001'}];
  Object.assign(design.blocks.customer,{enabled:false,label:'Disabled customer'});
  design.additionalTables = [table('table-charges','Source charges','/charges','Charge reference'),
    table('table-fees','Service fees','/fees','Fee reference'),table('table-internal','Internal records','/internal','Internal reference',false)];
  return compileProject(project,design);
}
const paper = page=>previewDocument(page,()=>['items-sku','table-charges-ref','table-fees-ref','table-internal-ref'].map(id=>
  [...document.querySelectorAll(`[data-v3-id=${id}]`)].map(node=>node.textContent.trim())));

test('clearing structure search restores every independent table without changing the rendered source',async({page})=>{
  const errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  await keepStructureOpen(page);
  await page.goto('/studio-v3/');
  await ready(page);
  const project = fixture();
  await page.locator('#open-file').setInputFiles({name:'independent-tables.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(project))});
  await expect(page.locator('#document-name')).toHaveValue(project.manifest.title);
  await ready(page);
  const frame = page.locator('#preview-frame'), source = await frame.getAttribute('srcdoc');
  const output = [project.sampleData.items.map(line=>line.sku),['CHARGE-007','CHARGE-002'],['FEE-018','FEE-004'],[]];
  await expect.poll(()=>paper(page)).toEqual(output);

  const group = id=>page.locator(`[data-tree-group=${id}]`);
  const charges = group('table-charges'), fees = group('table-fees'), internal = group('table-internal');
  const fields = group=>group.locator('.tree-fields');
  const search = page.getByRole('searchbox',{name:'Search structure'});
  await search.fill('No matching field');
  await expect(charges).toBeHidden();
  await expect(fees).toBeHidden();
  await search.clear();
  await expect(charges).toBeVisible();
  await expect(fees).toBeVisible();
  await expect(fields(charges)).toBeVisible();
  await expect(fields(fees)).toBeVisible();

  await charges.getByRole('button',{name:'Collapse Source charges'}).click();
  await expect(fields(charges)).toBeHidden();
  await search.fill('Charge reference');
  await expect(fields(charges)).toBeVisible();
  await search.clear();
  await expect(fields(charges)).toBeHidden();
  await expect(fields(fees)).toBeVisible();
  for (const [disabled,term] of [[internal,'Internal records'],[group('customer'),'Disabled customer']]) {
    await search.fill(term);
    await expect(disabled).toBeVisible();
    await expect(fields(disabled)).toBeVisible();
    await search.clear();
    await expect(fields(disabled)).toBeHidden();
  }

  await fees.getByRole('button',{name:'Fee reference'}).click();
  await expect(page.getByLabel('Label',{exact:true})).toHaveValue('Fee reference');
  await expect(page.locator('#revision')).toHaveText('r0');
  await expect(page.locator('[data-action=undo]')).toBeDisabled();
  await expect(page.locator('[data-action=redo]')).toBeDisabled();
  await expect(frame).toHaveAttribute('srcdoc',source);
  await expect.poll(()=>paper(page)).toEqual(output);
  expect(errors).toEqual([]);
});
