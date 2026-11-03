import { test, expect } from '@playwright/test';
import { chooseFit } from './helpers/viewer-presets.js';

test('Read uses natural scale with guidance and returns to fit', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/gallery/index.html?q=PF-061');
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
  const scale = () => page.locator('iframe').evaluate(frame => new DOMMatrix(getComputedStyle(frame).transform).a);
  const fitted = await scale();
  expect(fitted).toBeLessThan(1);
  await expect(page.getByRole('button', { name: 'Read', exact: true })).toBeVisible({ timeout: 3000 });
  await page.getByRole('button', { name: 'Read', exact: true }).click();
  await expect.poll(scale).toBe(1);
  await expect(page.getByText('Pan and scroll to read')).toBeVisible();
  await expect(page.locator('.document-viewport')).toBeFocused();
  await chooseFit(page);
  await expect.poll(scale).toBeCloseTo(fitted, 3);
});

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
