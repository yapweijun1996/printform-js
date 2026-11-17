import { test, expect } from '@playwright/test';
test.use({serviceWorkers:'block'});
test('SVG viewer controls survive language changes and zoom interaction', async ({page}) => {
  await page.goto('/gallery/?q=PF-027');
  await expect(page.locator('#advanced-toggle svg')).toBeVisible();
  for (const language of ['en','zh']) {
    await page.locator(`[data-language="${language}"]`).click();
    await page.locator('.gallery-card').click();
    for (const selector of ['[data-settings]','[data-out]','[data-in]','[data-presets]','[data-prev]','[data-next]','[data-close]','[data-print]']) {
      const button = page.locator(selector);
      await expect(button.locator('svg')).toHaveCount(1);
      await expect(button.locator('svg')).toHaveAttribute('aria-hidden','true');
      await expect(button).toHaveAccessibleName(/.+/);
    }
    await expect(page.locator('[data-print]')).toBeEnabled();
    await page.locator('[data-in]').click();
    await expect(page.locator('[data-out]')).toBeEnabled();
    await page.locator('[data-presets]').click();
    await expect(page.locator('.viewer-preset-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.viewer-preset-menu')).toBeHidden();
    await page.locator('[data-close]').click();
    await expect(page.locator('.gallery-card')).toBeFocused();
  }
});
