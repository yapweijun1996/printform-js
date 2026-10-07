import { test, expect } from './studio-v3-test.js';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function open(page, size) {
  await page.setViewportSize(size); await page.goto('/studio-v3/'); await ready(page);
  await page.locator('[data-ai-toggle]').click(); await expect(page.locator('.ai-welcome')).toBeVisible();
}
// The empty state is only useful if its last row (the flow) can be seen without scrolling.
const fits = page => page.evaluate(() => {
  const log = document.querySelector('[data-ai-log]').getBoundingClientRect(), flow = document.querySelector('.ai-flow').getBoundingClientRect();
  return flow.top >= log.top && flow.bottom <= log.bottom + 1;
});

test('phone: illustration, scope explanation and every starting row are visible at once',async({page})=> {
  await open(page,{width:390,height:844});
  await expect(page.locator('.ai-hero')).toBeVisible(); await expect(page.locator('.ai-scope-help')).toBeVisible();
  expect(await fits(page)).toBe(true);
});

test('desktop: the illustration gives way so the Attach card and the flow stay visible',async({page})=> {
  await open(page,{width:1440,height:900});
  await expect(page.locator('.ai-hero')).toBeHidden();
  await expect(page.locator('.ai-attach')).toBeInViewport({ratio:1});
  expect(await fits(page)).toBe(true);
});

test('a short window keeps the one-line scope and drops its explanation',async({page})=> {
  await open(page,{width:1280,height:720});
  await expect(page.locator('#ai-scope')).toBeVisible(); await expect(page.locator('.ai-scope-help')).toBeHidden();
});

test('the plus button is a real icon button that opens the file picker',async({page})=> {
  await open(page,{width:1440,height:900});
  const plus = page.locator('.ai-input > .ai-plus');
  await expect(plus.locator('svg')).toBeVisible();
  const chooser = page.waitForEvent('filechooser'); await plus.click(); expect((await chooser).isMultiple()).toBe(true);
});
