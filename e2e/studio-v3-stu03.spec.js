import {test, expect} from './studio-v3-test.js';
import {expectApplied} from './ai-applied.js';
import {gateway, normalized, save} from './studio-v3-element-style.js';
import {mountNumericProbeModules} from './studio-v3-rendered-probes.js';
import {compileProject, designOf, newProject} from '../studio-v3/model.js';
import {saveProject} from '../studio-v3/file-io.js';

test.use({workInSteps:true});
test.setTimeout(120000);
const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
const paper = page => page.frameLocator('#preview-frame');
const request = 'Use the supplied /lines array and bind each item description to ./caption.';
const operations = [
  {type:'set_collection',value:'/lines'},
  {type:'set_field',target:'items-description',patch:{pointer:'./caption'}}
];

function fixture() {
  const project = newProject('delivery'), design = designOf(project);
  design.title = 'STU-03 source order fixture';
  project.sampleData.items = [
    {no:1,sku:'ITEM-010',description:'Original motor',quantity:7},
    {no:2,sku:'ITEM-003',description:'Original bracket',quantity:2}
  ];
  project.sampleData.lines = [
    {no:1,sku:'LINE-031',description:'Unused description 31',caption:'Supplied sensor',quantity:11},
    {no:2,sku:'LINE-008',description:'Unused description 8',caption:'Supplied relay',quantity:3},
    {no:3,sku:'LINE-014',description:'Unused description 14',caption:'Supplied cable',quantity:6}
  ];
  project.sampleData.charges = [{reference:'FEE-007',amount:13.75},{reference:'FEE-002',amount:21.25}];
  design.additionalTables = [{id:'table-charges',label:'Supplied charges',collection:'/charges',enabled:true,repeatHeader:true,breakBefore:false,columns:[
    {id:'reference',label:'Source reference',pointer:'./reference',format:'',width:50},
    {id:'amount',label:'Source charge',pointer:'./amount',format:'currency',width:50}
  ]}];
  return compileProject(project,design);
}

async function diagnose(page,project) {
  const moduleUrl = await mountNumericProbeModules(page);
  return page.evaluate(async ({moduleUrl, project, request, operations}) => {
    const {createDraft, createGrant, createAgentTools, PaperPreview, shareAuthoring, inspectProject, DEMO_CONFIG} = await import(moduleUrl);
    const draft = createDraft(project,{request}), before = structuredClone(project), outcome = {};
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox','allow-scripts allow-modals');
    frame.style.cssText = 'position:absolute;left:-1200px;top:0;width:820px;height:1200px';
    document.body.append(frame);
    const preview = new PaperPreview(frame,()=>{},()=>{});
    const tools = createAgentTools({
      draft, context:current => shareAuthoring(current,{request}), outcome,
      signal:new AbortController().signal, limits:DEMO_CONFIG.agent, grant:createGrant('read-only'),
      inspect:async ({candidate}) => {
        const report = await preview.render(candidate);
        return {report,quality:inspectProject(candidate,report)};
      }
    });
    const call = (name,args={}) => {
      const tool = tools.find(tool => tool.name === name);
      tool.prepareArguments(args);
      return tool.execute(`stu03-${name}`,args);
    };
    const read = async name => JSON.parse((await call(name)).content[0].text);
    try {
      const capabilities = await read('get_capabilities');
      const context = await read('get_context');
      const inspection = await read('inspect_draft');
      let writeError;
      try { await call('apply_operations',{summary:'No write grant',operations}); }
      catch (error) { writeError = error.code; }
      await call('finish_answer',{message:'The eligible primary binding can change after review. The charges use their supplied collection.',observationId:inspection.observation.id});
      return {capabilities,context,inspection,writeError,before,after:draft.project,count:draft.count,outcome};
    } finally {
      preview.cancel(); frame.remove();
    }
  }, {moduleUrl,project,request,operations});
}

async function verifyPaper(page,{items,captions,quantities}) {
  await expect(paper(page).locator('[data-v3-id=items-sku]')).toHaveText(items);
  await expect(paper(page).locator('[data-v3-id=items-description]')).toHaveText(captions);
  await expect(paper(page).locator('[data-v3-id=items-quantity]')).toHaveText(quantities);
  await expect(paper(page).locator('[data-v3-id=table-charges-reference]')).toHaveText(['FEE-007','FEE-002']);
  await expect(paper(page).locator('[data-v3-id=table-charges-amount]')).toHaveText([/13\.75$/, /21\.25$/]);
}

test('G5 STU-03 diagnoses without writes, reviews a two-table binding correction and restores exact source order on Undo', async ({page},info) => {
  const project = fixture();
  const original = {items:['ITEM-010','ITEM-003'],captions:['Original motor','Original bracket'],quantities:['7','2']};
  const corrected = {items:['LINE-031','LINE-008','LINE-014'],captions:['Supplied sensor','Supplied relay','Supplied cable'],quantities:['11','3','6']};
  await gateway(page,[['apply_operations',{summary:'Use reviewed supplied lines and caption',operations}],['inspect_draft'],['finish',{summary:'Review supplied lines binding'}]]);
  await page.goto('/studio-v3/');
  await ready(page);
  await page.locator('#open-file').setInputFiles({name:'two-supplied-tables.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(project))});
  await expect(paper(page).locator('[data-v3-id=header-title]')).toHaveText(project.manifest.studioV3.title);
  await ready(page);
  const saved = (await save(page,info,'source.printform.json')).project;
  const baseline = normalized(saved);
  expect(saved.sampleData).toEqual(project.sampleData);
  await verifyPaper(page,original);

  const diagnosis = await diagnose(page,project);
  expect(diagnosis.capabilities.tools.map(tool=>tool.name)).not.toContain('apply_operations');
  expect(diagnosis.context.bindings).toEqual(expect.arrayContaining([
    expect.objectContaining({pointer:'/lines',type:'array'}),
    expect.objectContaining({pointer:'./caption',type:'string',collection:'/lines'}),
    expect.objectContaining({pointer:'./amount',type:'number',collection:'/charges'})
  ]));
  expect(JSON.stringify(diagnosis.context)).not.toContain('FEE-007');
  expect(diagnosis.inspection.ready).toBe(true);
  expect(diagnosis.outcome.answer).toMatchObject({taskOutcome:'answered',observation:{id:diagnosis.inspection.observation.id}});
  expect(diagnosis.writeError).toBe('GRANT_DENIED');
  expect(diagnosis.count).toBe(0);
  expect(diagnosis.after).toEqual(diagnosis.before);
  await expect(page.locator('#revision')).toHaveText('r0');
  await verifyPaper(page,original);

  await page.locator('[data-ai-toggle]').click();
  await page.locator('#ai-prompt').fill(request);
  await page.locator('[data-ai-send]').click();
  await expect(page.locator('[data-ai-proposal]')).toBeVisible({timeout:60000});
  await page.locator('[data-ai=preview]').click();
  await expect(page.locator('[data-ai=apply]')).toBeEnabled();
  await verifyPaper(page,corrected);
  await expect(page.locator('#revision')).toHaveText('r0');
  expect(normalized((await save(page,info,'preapproval.printform.json')).project)).toEqual(baseline);

  await page.locator('[data-ai=apply]').click();
  await expectApplied(page,1);
  await ready(page);
  await verifyPaper(page,corrected);
  const revised = normalized((await save(page,info,'approved.printform.json')).project);
  const expected = structuredClone(baseline);
  expected.manifest.studioV3.collection = '/lines';
  const description = expected.manifest.studioV3.columns.find(field=>field.id === 'description');
  Object.assign(description,{pointer:'./caption',lastPointer:'./caption'});
  expect(revised).toEqual(expected);

  await page.locator('[data-ai=undo]').click();
  await expect(page.locator('#revision')).toContainText(/^r2\b/);
  await ready(page);
  await verifyPaper(page,original);
  expect(normalized((await save(page,info,'undone.printform.json')).project)).toEqual(baseline);
});
