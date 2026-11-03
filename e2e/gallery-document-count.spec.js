import { test, expect } from '@playwright/test';

test('newly rendered physical sheets replace previous session page counts', async ({ page }) => {
  await page.goto('/gallery/index.html');
  for (const number of ['055', '054', '049', '020', '012', '004']) {
    await page.locator('#search').fill(`PF-${number}`);
    await page.locator('.gallery-card').click();
    await expect(page.locator('[data-print]')).toBeEnabled();
    await expect.poll(() => page.locator('iframe').evaluate(frame => {
      const doc = frame.contentDocument;
      const count = doc.querySelectorAll('.physical_page_wrapper').length || doc.querySelectorAll('.printform_page').length;
      return frame.ownerDocument.querySelector('[data-page-total]').textContent === `/ ${count}`;
    })).toBe(true);
    await page.locator('[data-close]').click();
  }
});
