import { test, expect } from '@playwright/test';

for (const width of [320, 375, 390, 430]) {
  test(`PF061 single-page toolbar is compact at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/gallery/index.html?q=PF-061');
    await page.locator('.gallery-card').click();
    await expect(page.locator('[data-print]')).toBeEnabled();
    await expect(page.locator('[data-page-total]')).toHaveText('/ 1');
    expect((await page.locator('.viewer-controls').boundingBox()).height).toBeLessThanOrEqual(56);
    await expect(page.locator('[data-prev]')).toBeHidden();
    await expect(page.locator('[data-next]')).toBeHidden();
  });
}
