import { test, expect } from '@playwright/test';

test('payment certificate retains all recovery rows and prints through Gallery', async ({ page }) => {
  await page.goto('/gallery/index.html?q=PF-068');
  await expect(page.locator('.gallery-card')).toHaveCount(1);
  await page.locator('.gallery-card').click();
  const frame = page.frameLocator('dialog iframe');
  await expect(frame.locator('.printform_page')).toHaveCount(6, { timeout: 60000 });
  await expect(frame.locator('.recovery-entry.prowitem_processed')).toHaveCount(200);
  await expect(frame.locator('[data-row-id="signatures"].prowitem_processed')).toHaveCount(1);
  await expect(frame.locator('[data-page-number]')).toHaveText(['1', '2', '3', '4', '5', '6']);
  const child = page.frames().find(f => f.url().includes('subcontractor-payment-certificate'));
  expect(child).toBeTruthy();
});

test('payment certificate PDF has six pages', async ({ page }) => {
  await page.goto('/gallery/designs/subcontractor-payment-certificate.html');
  await page.waitForFunction(() => window.__printFormProcessed === true, null, { timeout: 60000 });
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length).toBe(6);
});
