import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
test.setTimeout(20000);

async function open(page) {
  await page.goto('/gallery/index.html?q=PF-061');
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
}

test('preset and Fit restore trigger focus', async ({ page }) => {
  await open(page);
  const trigger = page.locator('[data-presets]');
  for (const selector of ['[data-preset="1.5"]', '[data-fit]']) {
    await trigger.click();
    await page.locator(selector).click();
    await expect(trigger).toBeFocused({ timeout: 1500 });
  }
});

test('Read and Settings dismiss presets', async ({ page }) => {
  await open(page);
  const trigger = page.locator('[data-presets]');
  const menu = page.locator('.viewer-preset-menu');
  await trigger.click();
  await page.locator('[data-read]').click();
  await expect(menu).toBeHidden({ timeout: 1500 });
  await trigger.click();
  await page.locator('[data-settings]').click();
  await page.locator('[data-preview]').click();
  await expect(menu).toBeHidden();
});

test('outside pointer in source frame dismisses presets', async ({ page }) => {
  await open(page);
  await page.frameLocator('iframe').locator('body').evaluate(body => {
    body.ownerDocument.addEventListener('pointerdown', () => { window.__pointerSeen = true; }, { once: true });
  });
  await page.locator('[data-presets]').click();
  const box = await page.locator('.document-viewport').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await page.frameLocator('iframe').locator('body').evaluate(() => window.__pointerSeen)).toBe(true);
  await expect(page.locator('.viewer-preset-menu')).toBeHidden({ timeout: 1500 });
});

test('outside pointer in viewer chrome dismisses presets', async ({ page }) => {
  await open(page);
  await page.locator('[data-presets]').click();
  await page.locator('[data-zoom]').click();
  await expect(page.locator('.viewer-preset-menu')).toBeHidden({ timeout: 1500 });
});

test('focused reading viewport pans horizontally with arrow keys', async ({ page }) => {
  await open(page);
  await page.locator('[data-read]').click();
  const viewport = page.locator('.document-viewport');
  await expect(viewport).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => viewport.evaluate(el => el.scrollLeft), { timeout: 1500 }).toBeGreaterThan(0);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => viewport.evaluate(el => el.scrollLeft), { timeout: 1500 }).toBe(0);
  const zoom = page.locator('[data-zoom]');
  await zoom.focus();
  await page.keyboard.press('ArrowRight');
  expect(await viewport.evaluate(el => el.scrollLeft)).toBe(0);
});

test('closing and reopening resets the popup', async ({ page }) => {
  await open(page);
  await page.locator('[data-presets]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).toBeVisible();
  await page.locator('[data-presets]').click();
  await page.locator('dialog').evaluate(dialog => dialog.close());
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
  await expect(page.locator('.viewer-preset-menu')).toBeHidden();
  await expect(page.locator('[data-presets]')).toHaveAttribute('aria-expanded', 'false');
});
