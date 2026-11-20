import {test,expect} from './studio-v3-test.js';
import {newProject} from '../studio-v3/model.js';
import {saveProject} from '../studio-v3/file-io.js';
import {clickHeaderAction} from './header-action.js';

test.setTimeout(90000);
const RECOVERY_KEY = "printform-studio-v3:update-recovery";
const ready = page=>expect(page.locator('[data-action=export]')).toBeEnabled();
const preview = page=>page.locator('#local-new-form-dialog');
const send = async(page,request)=>{
  await page.locator('#ai-prompt').fill(request);
  await page.getByRole('button',{name:'Send message',exact:true}).click();
};
async function renderedSource(frame) {
  await expect(frame).toHaveAttribute('srcdoc',/id="pf-sample-data"/);
  return frame.evaluate(node=>{
    const parsed = new DOMParser().parseFromString(node.srcdoc,'text/html');
    const json = id=>JSON.parse(parsed.getElementById(id).textContent);
    return {manifest:json('pf-manifest'),schema:json('pf-schema'),sampleData:json('pf-sample-data')};
  });
}
function record(project) {
  return {file:saveProject(project),id:project.manifest.documentId,session:{
    sample:'erp',source:{kind:'imported-data'},erpSource:{kind:'imported-data'},erpData:project.sampleData,database:null
  }};
}

for (const [viewport,kind] of [[{width:1440,height:900},'invoice'],[{width:390,height:844},'blank']]) {
  test(`local ${kind} preview opens an independent fictional document at ${viewport.width}px`,async({page,context},info)=>{
    await page.setViewportSize(viewport);
    const gateway = [];
    await context.route('https://gpt.yapweijun1996.com/**',route=>{gateway.push(route.request().url());return route.abort();});
    const originalFixture = newProject();
    originalFixture.manifest.title = 'Original private order';
    originalFixture.sampleData.company.name = 'PRIVATE_COMPANY_CANARY';
    const originalRecord = record(originalFixture), staleBackup = JSON.stringify({
      version:1,project:originalRecord,history:{cursor:0,entries:[{revision:0,project:originalRecord}]},
      ui:{mode:'design',selected:'items',tab:'properties',sample:'erp',dirty:true,dataDraft:null},forms:[],database:{}
    });
    await context.addInitScript(({key,staleBackup})=>{
      if (window === window.top && new URLSearchParams(location.hash.slice(1)).has('new-form')) sessionStorage.setItem(key,staleBackup);
    },{key:RECOVERY_KEY,staleBackup});
    await page.goto('/studio-v3/'); await ready(page);
    await page.locator('#open-file').setInputFiles({name:'private.printform.json',mimeType:'application/json',buffer:Buffer.from(saveProject(originalFixture))});
    await expect(page.locator('#document-name')).toHaveValue(originalFixture.manifest.title); await ready(page);
    await page.locator('#document-name').fill('Original revised order');
    await page.locator('#document-name').press('Tab');
    await expect(page.locator('#revision')).toContainText('r1'); await ready(page);
    const original = await renderedSource(page.locator('#preview-frame'));
    expect(original.sampleData.company.name).toBe('PRIVATE_COMPANY_CANARY');
    const structure = page.locator('[data-layout=structure]').first();
    if (await structure.getAttribute('aria-expanded') !== 'true') await structure.click();
    await page.locator('#left-panel [data-select=footer]').click();
    const pendingLabel = page.locator('form[data-form=block] [name=label]');
    await pendingLabel.fill('Pending original footer');
    await expect(page.locator('#draft-state')).toContainText('1 unapplied edit');
    const closeProperty = page.locator('#right-panel .drawer-close');
    if (await closeProperty.isVisible()) await closeProperty.click();
    await page.locator('[data-ai-toggle]').click();

    await send(page,'/new invoice and copy my saved data');
    await expect(page.locator('[data-ai-status]')).toContainText('Local commands');
    await expect(preview(page)).toBeHidden();
    expect(context.pages()).toHaveLength(1);

    await send(page,`/new ${kind}`);
    await expect(preview(page)).toBeVisible();
    const apply = preview(page).getByRole('link',{name:'Apply & open in new tab',exact:true});
    await expect(apply).toBeVisible({timeout:30000});
    await preview(page).getByRole('button',{name:'Cancel'}).click();
    await expect(preview(page)).toBeHidden();
    expect(context.pages()).toHaveLength(1);
    await expect(page.locator('#draft-state')).toContainText('1 unapplied edit');

    await send(page,`/new ${kind}`);
    await expect(apply).toBeVisible({timeout:30000});
    await page.screenshot({path:info.outputPath(`fork-preview-${viewport.width}.png`)});
    const candidate = await renderedSource(preview(page).locator('iframe'));
    const expected = newProject('invoice',kind === 'blank');
    expect(candidate.manifest.documentId).not.toBe(original.manifest.documentId);
    expect(candidate.manifest.studioV3).toEqual(expected.manifest.studioV3);
    expect(candidate.schema).toEqual(expected.schema);
    expect(candidate.sampleData).toEqual(expected.sampleData);
    expect(await apply.getAttribute('href')).not.toContain('PRIVATE_COMPANY_CANARY');
    const opened = context.waitForEvent('page');
    await apply.click();
    const fork = await opened;
    await ready(fork);
    const adopted = await renderedSource(fork.locator('#preview-frame'));
    expect(adopted).toEqual(candidate);
    expect(await fork.evaluate(key=>sessionStorage.getItem(key),RECOVERY_KEY)).toBe(staleBackup);
    expect(await fork.evaluate(()=>window.opener)).toBeNull();
    expect(new URL(fork.url()).hash).toBe('');
    await fork.reload(); await ready(fork);
    expect(await renderedSource(fork.locator('#preview-frame'))).toEqual(candidate);

    await fork.locator('#document-name').fill('Independent edited title');
    await fork.locator('#document-name').press('Tab');
    await expect(fork.locator('#revision')).toContainText('r1'); await ready(fork);
    const back = fork.getByRole('button',{name:'Return to original form'});
    await back.click();
    await expect(fork.locator('[data-new-form-return-status]')).toContainText('Save or resolve unapplied work');
    const download = fork.waitForEvent('download');
    await clickHeaderAction(fork,'save'); await download;
    await expect(fork.locator('#revision')).toHaveText('r1');
    const closed = fork.waitForEvent('close');
    await back.click(); await closed;

    await expect(page.locator('#revision')).toContainText('r1');
    await expect(page.locator('#document-name')).toHaveValue('Original revised order');
    expect(await renderedSource(page.locator('#preview-frame'))).toEqual(original);
    await expect(page.locator('[data-action=undo]')).toBeEnabled();
    await expect(page.locator('#draft-state')).toContainText('1 unapplied edit');
    expect(await pendingLabel.inputValue()).toBe('Pending original footer');
    expect(gateway).toEqual([]);
  });
}

test('a fork recipe for an obsolete build opens only local return guidance',async({page,context})=>{
  const requests = [];
  await context.route('https://gpt.yapweijun1996.com/**',route=>{requests.push(route.request().url());return route.abort();});
  await page.goto('/studio-v3/#new-form=invoice&document=v3-767f7389-09bc-4510-95fb-7f8a4bcc1828&build=obsolete');
  await expect(page.locator('[data-new-form-return-status]')).toContainText('build changed');
  await expect(page.getByRole('button',{name:'Return to original form'})).toBeFocused();
  await expect(page.locator('.studio-grid')).toBeHidden();
  await page.keyboard.press('Control+s');
  await expect(page.locator('#preview-frame')).not.toHaveAttribute('srcdoc',/.+/);
  expect(requests).toEqual([]);
});
