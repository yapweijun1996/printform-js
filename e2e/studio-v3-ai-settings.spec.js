import { test, expect } from './studio-v3-test.js';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function openMenu(page) {
  await page.goto('/studio-v3/'); await ready(page);
  await page.locator('[data-ai-toggle]').click();
  await page.locator('.ai-settings > summary').click();
  await expect(page.locator('.ai-settings-body')).toBeVisible();
}

test('the settings menu buttons look like buttons, not bare text',async({page})=> {
  await openMenu(page);
  for (const action of ['models','clear']) {
    const style = await page.locator(`.ai-settings-body [data-ai=${action}]`).evaluate(n=>{const s=getComputedStyle(n);return {border:s.borderTopWidth,background:s.backgroundColor,width:n.getBoundingClientRect().width,body:n.closest('.ai-settings-body').getBoundingClientRect().width};});
    expect(style.border).toBe('1px'); expect(style.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(style.width).toBeGreaterThan(style.body * .8);
  }
  // The header's own icon buttons stay bare.
  const bare = await page.locator('.ai-header-actions > button').first().evaluate(n=>getComputedStyle(n).borderTopWidth);
  expect(bare).toBe('0px');
});

test('plain wording: no internal names in the settings menu',async({page})=> {
  await openMenu(page);
  const text = await page.locator('.ai-settings-body').innerText();
  expect(text).not.toMatch(/AgentHarness|Pi sessions|GPT Server Demo/);
  expect(text).toContain('never applied automatically'); expect(text).toContain('last 12 messages');
});

test('Escape and an outside click close the menu; the panel stays until the next Escape',async({page})=> {
  await openMenu(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ai-settings-body')).toBeHidden(); await expect(page.locator('#ai-panel')).toBeVisible();
  await page.locator('.ai-settings > summary').click(); await expect(page.locator('.ai-settings-body')).toBeVisible();
  await page.locator('#ai-prompt').click(); await expect(page.locator('.ai-settings-body')).toBeHidden();
  await page.locator('.ai-settings > summary').click(); await page.locator('#ai-model').focus();
  await page.keyboard.press('Escape'); await expect(page.locator('.ai-settings-body')).toBeHidden(); await expect(page.locator('#ai-panel')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('#ai-panel')).toBeHidden();
  await page.locator('[data-ai-toggle]').click(); await expect(page.locator('.ai-settings-body')).toBeHidden();
});
