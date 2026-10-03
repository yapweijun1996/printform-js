import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {admitPublicGateway,openEditor} from './studio-v2-helpers.js';
test('clipped currency blocks evidence and trusted export until corrected and freshly reviewed',async({page},info)=> {
  await page.goto('/studio-v2/');await expect(page.locator('#render-status')).toHaveText('Printable');
  await openEditor(page);await admitPublicGateway(page);
  const originalTheme=await page.locator('#theme-editor').inputValue();
  const data=await page.locator('#sample-editor').inputValue();
  const wrapped=await page.locator('#template-editor').evaluate(editor=> {
    const t=document.createElement('template');t.innerHTML=editor.value;
    for(const n of t.content.querySelectorAll('[data-pf-format="currency"]')) {
      const span=document.createElement('span');span.className='monetary-clip-fixture';
      for(const a of [...n.attributes])if(['data-pf-text','data-pf-format'].includes(a.name)){span.setAttribute(a.name,a.value);n.removeAttribute(a.name);}
      span.textContent=n.textContent;n.replaceChildren(span);
    }
    return t.innerHTML;
  });
  await page.locator('#template-editor').evaluate(n=>n.closest('details').open=true);
  await page.locator('#template-editor').fill(wrapped);
  await page.locator('#theme-editor').evaluate(n=>n.closest('details').open=true);
  const apply=async(theme)=> {
    await page.locator('#theme-editor').fill(theme);await page.locator('#apply-source-button').click();
    await expect(page.locator('#source-diff-modal')).toBeVisible();await page.locator('#source-diff-apply').click();
    await expect(page.locator('#source-diff-modal')).toBeHidden();
  };
  await apply(originalTheme+'\n.monetary-clip-fixture {display:block;height:5px;overflow-y:hidden;white-space:nowrap}');
  await expect(page.locator('#render-status')).toHaveText('Blocked');await expect(page.locator('#issue-list')).toContainText('MONETARY_TOKEN_UNREADABLE');
  await page.frameLocator('#preview-frame').locator('body').screenshot({path:info.outputPath('currency-clipped-preview.png')});
  const blocked=await page.evaluate(async()=> {
    const run=(name,input)=>window.PrintFormStudioAgent.execute(name,input);
    const revision=(await run('get_project_summary',{})).result.revision;
    return {evidence:await run('capture_layout_evidence',{expectedRevision:revision,scenario:'default'}),export:await run('request_export',{}),pack:await run('get_evidence_pack',{})};
  });
  await fs.writeFile(info.outputPath('blocked-monetary.json'),JSON.stringify(blocked,null,2));
  expect(blocked.evidence.result.evidence).toBeNull();expect(blocked.evidence.result.validation.valid).toBe(false);
  expect(blocked.evidence.result.validation.errors.map(x=>x.code)).toContain('MONETARY_TOKEN_UNREADABLE');
  expect(blocked.export.result.ready).toBe(false);
  await expect(page.locator('#export-button')).toBeDisabled();
  await apply(originalTheme+'\n.monetary-clip-fixture {display:block;white-space:nowrap}');
  await expect(page.locator('#render-status')).toHaveText('Printable');expect(await page.locator('#sample-editor').inputValue()).toBe(data);
  await page.frameLocator('#preview-frame').locator('body').screenshot({path:info.outputPath('currency-corrected-preview.png')});
  const fixed=await page.evaluate(async()=> {
    const run=(name,input)=>window.PrintFormStudioAgent.execute(name,input);
    const revision=(await run('get_project_summary',{})).result.revision;
    const captured=[];for(const scenario of ['default','long-text'])captured.push(await run('capture_layout_evidence',{expectedRevision:revision,scenario}));
    await run('begin_layout_review',{expectedRevision:revision});
    const review=await run('complete_layout_review',{expectedRevision:revision,reviewer:'ai-agent',findings:[],summary:'Synthetic currency clipping corrected',evidenceIds:captured.map(x=>x.result.evidence.evidenceId)});
    return {revision,captured,review,export:await run('request_export',{})};
  });
  expect(fixed.captured.every(x=>x.ok)).toBe(true);expect(fixed.review.ok).toBe(true);expect(fixed.export.result.ready).toBe(true);
  page.on('dialog',d=>/Save As|另存为/.test(d.message()) ? d.dismiss() : d.accept());
  const pending=page.waitForEvent('download');await page.locator('#export-button').click();
  await (await pending).saveAs(info.outputPath('corrected-monetary-export.html'));
  const pack=await page.evaluate(async()=> (await window.PrintFormStudioAgent.execute('get_evidence_pack',{})).result.evidencePack);
  expect(pack).toMatchObject({revision:fixed.revision,validation:{status:'PASS'},security:{status:'PASS'},exportHtmlHash:expect.stringMatching(/^sha256:/)});
  await fs.writeFile(info.outputPath('monetary-export-chain.json'),JSON.stringify({blocked,fixed,pack},null,2));
});
