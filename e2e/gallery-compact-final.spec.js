import { test, expect } from '@playwright/test';

for (const [width, height] of [[667, 375], [568, 320], [320, 375]]) {
  test(`multipage preset is hit-testable at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/gallery/index.html?q=PF-066');
    await page.locator('.gallery-card').click();
    await expect(page.locator('[data-print]')).toBeEnabled();
    expect(await page.locator('.viewer-controls').evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true);
    for (const button of await page.locator('.viewer-controls button:visible').all()) {
      const box = await button.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.locator('[data-presets]').click();
    const last = page.locator('[data-preset="2"]');
    expect(await last.evaluate(button => {
      const r = button.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit === button || button.contains(hit);
    })).toBe(true);
    const menu = await page.locator('.viewer-preset-menu').boundingBox();
    expect(menu.x).toBeGreaterThanOrEqual(0);
    expect(menu.y).toBeGreaterThanOrEqual(0);
    expect(menu.x + menu.width).toBeLessThanOrEqual(width);
    expect(menu.y + menu.height).toBeLessThanOrEqual(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('reopening a failed source resets Settings synchronously', async ({ page }) => {
  await page.goto('/gallery/index.html?q=PF-061');
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
  await page.locator('[data-settings]').click();
  await expect(page.locator('[data-preview]')).toBeVisible();
  await expect(page.locator('[data-read]')).toBeHidden();
  await page.locator('[data-close]').click();
  await page.locator('#search').fill('PF-066');
  await expect(page.locator('.gallery-card')).toHaveCount(1);
  await page.route('**/gallery/designs/**', route => route.abort());
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-read]')).toBeVisible();
  await expect(page.locator('[data-preview]')).toBeHidden();
  await expect(page.locator('[data-settings]')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.document-viewport')).not.toHaveClass(/is-settings/);
  await expect(page.locator('[data-print]')).toBeDisabled();
});
