import { test, expect } from '@playwright/test';
import { keepStructureOpen } from './studio-v3-structure.js';
import { clickHeaderAction } from './header-action.js';
import { newProject } from '../studio-v3/model.js';
import { saveProject } from '../studio-v3/file-io.js';
const frame = page => page.frameLocator('#preview-frame');
const label = page => page.getByLabel('Label',{exact:true});
const choice = (page,value) => page.locator(`[data-draft-choice=${value}]`).click();
async function ready(page) { await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000}); }
test.beforeEach(async ({page}) => {page.on('dialog',d=>d.accept());await keepStructureOpen(page);await page.goto('/studio-v3/');await ready(page);});

test('P0 Item code label → Qty: Stay retains focus, Apply commits and Discard restores; history is correct', async ({page},info) => {
  await page.locator('#left-panel [data-select=items-sku]').click();
  await label(page).fill('Client stock code');
  await expect(page.locator('#draft-state')).toContainText('1 unapplied');
  await expect(page.locator('#revision')).not.toContainText('unsaved template');
  await page.locator('#left-panel [data-select=items-quantity]').click();
  await expect(page.locator('#draft-dialog')).toBeVisible();
  await expect(label(page)).toHaveValue('Client stock code');
  await page.screenshot({path:info.outputPath('P0-draft-guard.png')});
  await choice(page,'stay'); await expect(label(page)).toHaveValue('Client stock code');await expect(label(page)).toBeFocused();
  await page.locator('#left-panel [data-select=items-quantity]').click(); await choice(page,'apply');
  await expect(label(page)).toHaveValue('Qty'); await ready(page);
  await expect(frame(page).locator('.prowheader_processed th').first().locator('..').locator('th').nth(1)).toHaveText('Client stock code');
  await expect(page.locator('#draft-state')).toHaveText('No unapplied edits');
  await expect(page.locator('#revision')).toContainText('unsaved template');
  await page.locator('[data-action=undo]').click(); await ready(page);
  await expect(frame(page).locator('.prowheader_processed').first().locator('th').nth(1)).toHaveText('Item code');
  await page.locator('[data-action=redo]').click(); await ready(page);
  await expect(frame(page).locator('.prowheader_processed').first().locator('th').nth(1)).toHaveText('Client stock code');
  await label(page).fill('Discarded units'); await page.locator('[data-mode=data]').click(); await choice(page,'discard');
  await expect(page.locator('#database-workbench')).toBeVisible();
  await page.locator('[data-mode=design]').click();
  await expect(label(page)).toHaveValue('Qty');
  await page.screenshot({path:info.outputPath('P0-applied-label.png')});
});

test('workspace and Escape retain unapplied values until an explicit choice', async ({page}) => {
  await page.locator('#left-panel [data-select=items-sku]').click(); await label(page).fill('Kept draft');
  for (const target of ['[data-mode=data]','#right-panel [data-action=remove-field]','[data-action=print]']) {
    await page.locator(target).click(); await expect(page.locator('#draft-dialog')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('#draft-dialog')).toBeHidden();
    await expect(label(page)).toHaveValue('Kept draft'); await expect(label(page)).toBeFocused();
  }
  await page.locator('[data-mode=data]').click(); await choice(page,'apply'); await ready(page);
  await expect(page.locator('#database-workbench')).toBeVisible();
  await page.locator('[data-mode=design]').click(); await expect(label(page)).toHaveValue('Kept draft');
});

test('invalid JSON preserves input and blocks both commit and guarded transitions', async ({page}) => {
  await page.locator('[data-mode=data]').click();
  await page.locator('#database-workbench [data-db-group=json]').click();
  const revision = await page.locator('#revision').innerText(), invalid = '{"items": [}';
  await page.locator('#data-json').fill(invalid); await page.getByRole('button',{name:'Apply JSON data',exact:true}).click();
  await expect(page.locator('#data-json')).toHaveValue(invalid); await expect(page.locator('#revision')).toHaveText(revision);
  await page.locator('[data-mode=design]').click(); await choice(page,'apply');
  await expect(page.locator('[data-mode=data]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#data-json')).toHaveValue(invalid); await expect(page.locator('#revision')).toHaveText(revision);
  await page.locator('[data-mode=design]').click(); await choice(page,'discard');
  await expect(page.locator('[data-mode=design]')).toHaveAttribute('aria-current','page');
});

test('Open keeps current drafts after a bad file or a declined replacement and opens a valid retry', async ({ page }) => {
  page.removeAllListeners('dialog');
  const confirmations = [];
  let replace = false;
  page.on('dialog', async dialog => {
    confirmations.push(dialog.message());
    if (replace) await dialog.accept();
    else await dialog.dismiss();
  });
  await page.locator('#left-panel [data-select=items-sku]').click();
  await label(page).fill('Kept after Open');
  const chooseFile = async buffer => {
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-action=open]').click();
    await (await chooser).setFiles({ name: 'replacement.printform.json', mimeType: 'application/json', buffer });
  };

  await chooseFile(Buffer.from('{invalid'));
  await expect(page.locator('#status')).toContainText(/JSON|syntax/i);
  await expect(label(page)).toHaveValue('Kept after Open');
  await expect(page.locator('#draft-state')).toContainText('1 unapplied');
  expect(confirmations).toHaveLength(0);

  const replacement = newProject('purchase');
  const valid = Buffer.from(saveProject(replacement));
  await chooseFile(valid);
  await expect(page.locator('#status')).toHaveText('Open canceled. Your work is retained.');
  await expect(label(page)).toHaveValue('Kept after Open');
  await expect(page.locator('#draft-state')).toContainText('1 unapplied');
  expect(confirmations).toHaveLength(1);

  replace = true;
  await chooseFile(valid);
  await ready(page);
  await expect(page.locator('#document-name')).toHaveValue(replacement.manifest.title);
  await expect(page.locator('#draft-state')).toHaveText('No unapplied edits');
  expect(confirmations).toHaveLength(2);
});


test('New keeps an inspector draft until a starter is chosen and Apply returns to the original form',async({page})=> {
  await page.locator('#left-panel [data-select=items-sku]').click();
  await label(page).fill('Applied before replacement');
  const documentId = ()=>page.locator('#preview-frame').evaluate(frame=> {
    const source = new DOMParser().parseFromString(frame.srcdoc,'text/html');
    return JSON.parse(source.getElementById('pf-manifest').textContent).documentId;
  });
  const original = await page.locator('#document-name').inputValue(), id = await documentId();
  const chooser = page.locator('#new-dialog'), approval = page.locator('#draft-dialog');
  await clickHeaderAction(page,'new');
  await expect(chooser).toBeVisible();
  await expect(approval).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(chooser).toBeHidden();
  await expect(label(page)).toHaveValue('Applied before replacement');
  await expect(page.locator('#revision')).toHaveText('r0');
  await clickHeaderAction(page,'new');
  await chooser.locator('[data-template=purchase]').click();
  await expect(approval).toBeVisible();
  await expect(approval).toContainText('Apply commits the edits and returns to the current form');
  await choice(page,'apply');
  await ready(page);
  await expect(approval).toBeHidden();
  await expect(chooser).toBeHidden();
  await expect(page.locator('#document-name')).toHaveValue(original);
  expect(await documentId()).toBe(id);
  await expect(page.locator('#revision')).toHaveText(/^r1\b/);
  await expect(label(page)).toHaveValue('Applied before replacement');
  await expect(page.locator('#draft-state')).toHaveText('No unapplied edits');
  await expect(page.locator('[data-action=undo]')).toBeEnabled();
});

test('Cancel New and Stay preserve a reviewed CSV and only confirmed replacement clears it',async({page})=> {
  await page.locator('[data-mode=data]').click();
  const csv = 'n,code,description,qty,unit,total\r\n1,00007,Local reviewed row,2,1.25,2.50\r\n';
  await page.locator('#dataset-file').setInputFiles({name:'review-before-new.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.getByRole('heading',{name:'Review local CSV / JSON import'})).toBeVisible();
  for (const [target,source,number] of [['/no','/n',true],['/sku','/code'],['/description','/description'],['/quantity','/qty',true],['/rate','/unit',true],['/amount','/total',true]]) {
    await page.getByLabel(`Source for ${target}`,{exact:true}).selectOption(source);
    if (number) await page.getByLabel(`Conversion for ${target}`,{exact:true}).selectOption('number');
  }
  await page.locator('[data-db-action=import-preview]').click();
  const preview = page.getByRole('region',{name:'Reviewed import preview'});
  await expect(preview).toContainText('00007');
  const before = await page.locator('#preview-frame').getAttribute('srcdoc');
  const name = page.locator('#document-name'), title = await name.inputValue();
  const chooser = page.locator('#new-dialog'), approval = page.locator('#draft-dialog');
  async function expectRetainedReview() {
    await expect(chooser).toBeHidden();
    await expect(approval).toBeHidden();
    await expect(page.locator('.database-source')).toContainText('review-before-new.csv');
    await expect(page.getByLabel('Source for /sku',{exact:true})).toHaveValue('/code');
    await expect(preview).toContainText('00007');
    await expect(page.locator('[data-db-action=import-apply]')).toBeEnabled();
    await expect(page.locator('#draft-state')).toContainText('1 unapplied');
    await expect(page.locator('#revision')).toHaveText('r0');
    await expect(page.locator('#preview-frame')).toHaveAttribute('srcdoc',before);
    await expect(name).toHaveValue(title);
  }
  await clickHeaderAction(page,'new');
  await expect(chooser).toBeVisible();
  await expect(approval).toBeHidden();
  await chooser.getByRole('button',{name:'Cancel',exact:true}).click();
  await expectRetainedReview();

  for (const decision of ['stay','discard']) {
    await clickHeaderAction(page,'new');
    await chooser.locator('[data-template=purchase]').click();
    await expect(approval).toBeVisible();
    await choice(page,decision);
    if (decision === 'stay') await expectRetainedReview();
  }
  await ready(page);
  await expect(name).toHaveValue('Purchase order template');
  await expect(preview).toHaveCount(0);
  await expect(page.locator('#draft-state')).toHaveText('No unapplied edits');
  await expect(page.locator('#revision')).toHaveText('r0');
  await expect(page.locator('#preview-frame')).not.toHaveAttribute('srcdoc',before);
});


test('unavailable Undo and Redo shortcuts leave clean forms clean while available history still works',async({page})=> {
  const revision = page.locator('#revision'), name = page.locator('#document-name');
  const undo = page.locator('[data-action=undo]'), redo = page.locator('[data-action=redo]');
  const toolbar = page.locator('[data-action=new]');
  const initial = await name.inputValue(), frame = page.locator('#preview-frame');
  const original = await frame.getAttribute('srcdoc');
  await toolbar.focus();
  await expect(undo).toBeDisabled();
  await page.keyboard.press('Control+z');
  await expect(revision).toHaveText('r0');
  await expect(frame).toHaveAttribute('srcdoc',original);

  await name.fill('Saved shortcut form');
  await name.press('Tab');
  const download = page.waitForEvent('download');
  await clickHeaderAction(page,'save');
  await download;
  await ready(page);
  await expect(revision).toHaveText('r1');
  const saved = await frame.getAttribute('srcdoc');
  await expect(redo).toBeDisabled();
  await toolbar.focus();
  await page.keyboard.press('Control+Shift+z');
  await expect(revision).toHaveText('r1');
  await expect(frame).toHaveAttribute('srcdoc',saved);

  await page.keyboard.press('Control+z');
  await expect(name).toHaveValue(initial);
  await expect(revision).toHaveText(/^r2\b/);
  await ready(page);
  await toolbar.focus();
  await page.keyboard.press('Control+Shift+z');
  await expect(name).toHaveValue('Saved shortcut form');
  await expect(revision).toHaveText(/^r3\b/);
});

test('an unavailable history shortcut leaves the inspector draft and native editing alone',async({page})=> {
  await page.locator('#left-panel [data-select=items-sku]').click();
  const field = label(page);
  await field.fill('Pending shortcut edit');
  await expect(page.locator('#draft-state')).toContainText('1 unapplied');
  await page.locator('[data-action=new]').focus();
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('#draft-dialog')).toBeHidden();
  await expect(page.locator('#revision')).toHaveText('r0');
  await expect(field).toHaveValue('Pending shortcut edit');
  await field.evaluate(input=>document.addEventListener('keydown',event=> {
    if (event.target === input && event.ctrlKey && event.key.toLowerCase() === 'z') window.nativeUndoPrevented = event.defaultPrevented;
  }));
  await field.press('Control+z');
  expect(await page.evaluate(()=>window.nativeUndoPrevented)).toBe(false);
  await expect(page.locator('#draft-dialog')).toBeHidden();
  await expect(page.locator('#revision')).toHaveText('r0');
});
