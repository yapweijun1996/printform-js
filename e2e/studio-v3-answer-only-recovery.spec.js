import {expect,test} from '@playwright/test';
import {clickHeaderAction} from './header-action.js';
import {NEXT,upgradeServer} from './studio-v3-upgrade-server.js';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});

test('a clean independent form keeps Answer only through automatic update without changing the original history',async({page,context})=>{
  test.setTimeout(90000);
  const server = await upgradeServer();
  try {
    await page.goto(server.url);
    await ready(page);
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    const originalTitle = await page.locator('#document-name').inputValue();
    await page.locator('#document-name').fill('Unfinished original');
    await page.locator('#document-name').press('Tab');
    await expect(page.locator('#revision')).toContainText(/^r1\b/);
    await ready(page);

    await page.locator('[data-ai-toggle]').click();
    await page.locator('#ai-prompt').fill('/new purchase');
    await page.getByRole('button',{name:'Send message',exact:true}).click();
    const apply = page.getByRole('link',{name:'Apply & open in new tab',exact:true});
    const opening = context.waitForEvent('page');
    await apply.click();
    const independent = await opening;
    await ready(independent);
    await independent.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    const forkTitle = await independent.locator('#document-name').inputValue();
    expect(forkTitle).not.toBe('Unfinished original');
    await expect(independent.locator('#revision')).toHaveText('r0');

    await independent.locator('[data-ai-toggle]').click();
    await independent.getByLabel('More settings',{exact:true}).click();
    const answerOnly = independent.getByLabel('Answer only (requires Work in steps)',{exact:true});
    await answerOnly.check();
    await independent.locator('[data-ai=close]').click();
    server.publish();
    await clickHeaderAction(independent,'update');
    await expect(independent.locator('#app-version')).toContainText(NEXT.slice(0,12),{timeout:30000});
    await ready(independent);
    await expect(independent.locator('#update-dialog')).toBeHidden();
    await expect(independent.locator('#document-name')).toHaveValue(forkTitle);
    await expect(independent.locator('#revision')).toHaveText('r0');
    await independent.locator('[data-ai-toggle]').click();
    await independent.getByLabel('More settings',{exact:true}).click();
    await expect(answerOnly).toBeChecked();
    await expect(independent.locator('.ai-scope-help')).toContainText('Answer only');

    // The original tab offers the shared worker update, but requires its own approval.
    await expect(page.locator('#update-dialog')).toBeVisible({timeout:30000});
    await page.locator('[data-update-choice=stay]').click();
    await expect(page.locator('#document-name')).toHaveValue('Unfinished original');
    await expect(page.locator('#revision')).toContainText(/^r1\b/);
    await expect(page.locator('[data-action=undo]')).toBeEnabled();
    await page.getByLabel('More settings',{exact:true}).click();
    await expect(page.getByLabel('Answer only (requires Work in steps)',{exact:true})).not.toBeChecked();
    await page.locator('[data-ai=close]').click();
    await clickHeaderAction(page,'undo');
    await ready(page);
    await expect(page.locator('#document-name')).toHaveValue(originalTitle);
    await expect(page.locator('#revision')).toContainText(/^r2\b/);
  } finally {
    await server.close();
  }
});
