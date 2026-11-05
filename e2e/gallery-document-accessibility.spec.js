import { test, expect } from '@playwright/test';
import { chooseFit } from './helpers/viewer-presets.js';

const cssPixels = value => Math.round(value * 100) / 100;

test('200% text keeps viewer controls operable and paper reachable after resize', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gallery/index.html?q=PF-066');
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  await page.locator('[data-presets]').click();
  for (const selector of ['[data-fit]', '[data-in]', '[data-next]', '[data-settings]', '[data-close]']) {
    const control = page.locator(selector);
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    expect(cssPixels(box.height)).toBeGreaterThanOrEqual(44);
    expect(cssPixels(box.width)).toBeGreaterThanOrEqual(44);
    expect(cssPixels(box.y + box.height)).toBeLessThanOrEqual(844);
  }
  await page.locator('[data-presets]').click();
  await page.locator('[data-next]').click();
  await expect(page.locator('[data-page]')).toHaveValue('2');
  await page.screenshot({ path: info.outputPath('text-200.png') });
  await page.evaluate(() => document.documentElement.style.fontSize = '');
  await page.setViewportSize({ width: 667, height: 375 });
  await chooseFit(page);
  await expect.poll(() => page.locator('.document-viewport').evaluate(node => node.clientHeight)).toBeGreaterThan(80);
  await page.locator('[data-page]').fill('10');
  await page.locator('[data-page]').press('Enter');
  await expect(page.locator('[data-page]')).toHaveValue('10');
  await page.locator('[data-close]').click();
  await expect(page.locator('.gallery-card')).toBeFocused();
});
