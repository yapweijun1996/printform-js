import { test, expect } from '@playwright/test';

test('PF066 preserves zoom edits through resize and normalizes committed values', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/gallery/index.html?q=PF-066');
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
  const zoom = page.locator('[data-zoom]');
  const stageWidth = () => page.locator('.viewer-stage').evaluate(stage => stage.getBoundingClientRect().width);
  const actualScale = () => page.locator('iframe').evaluate(frame => new DOMMatrix(getComputedStyle(frame).transform).a);
  await zoom.focus();
  await zoom.fill('200');
  for (const width of [390, 375]) {
    const before = await stageWidth();
    await page.setViewportSize({ width, height: 667 });
    // Stage geometry changes only after the real ResizeObserver has redrawn.
    await expect.poll(stageWidth).not.toBe(before);
    await expect(zoom).toBeFocused();
    await expect(zoom).toHaveValue('200');
  }
  await zoom.press('Enter');
  await expect.poll(actualScale).toBe(2);
  await expect(zoom).toHaveValue('200');
  for (const [typed, normalized, scale] of [['250', '200', 2], ['', '50', .5]]) {
    await zoom.fill(typed);
    await zoom.press('Enter');
    await expect(zoom).toHaveValue(normalized);
    await expect.poll(actualScale).toBe(scale);
  }
});
