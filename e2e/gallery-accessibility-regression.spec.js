import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 320, height: 844 } });

async function open(page) {
  await page.goto('/gallery/index.html?q=PF-061');
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
}

test('Escape in source closes presets before the modal', async ({ page }) => {
  await open(page);
  const trigger = page.locator('[data-presets]');
  await trigger.click();
  // Traverse from the trigger through the open menu and into the source.
  async function tabIntoFrame() {
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      if (await page.locator('iframe').evaluate(el => document.activeElement === el)) break;
    }
    expect(await page.locator('iframe').evaluate(el => document.activeElement === el)).toBe(true);
  }
  await tabIntoFrame();
  await page.keyboard.press('Escape');
  await expect(page.locator('.viewer-preset-menu')).toBeHidden();
  await expect(page.locator('dialog')).toBeVisible();
  await expect(trigger).toBeFocused();
  await tabIntoFrame();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).toBeHidden();
});

test('keyboard return from settings focuses a pannable viewport', async ({ page }) => {
  await open(page);
  await page.locator('[data-read]').click();
  await page.locator('[data-settings]').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-preview]').focus();
  await page.keyboard.press('Enter');
  const viewport = page.locator('.document-viewport');
  await expect(viewport).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
});
