import { test, expect } from '@playwright/test';

for (const [number, flag] of [['065', 'ASTER_READY'], ['066', 'ATLAS_READY']]) {
  test(`PF${number} settings preserve handlers, fail closed and recover`, async ({ page }) => {
    await page.goto(`/gallery/index.html?q=PF-${number}`);
    await page.locator('.gallery-card').click();
    const print = page.locator('[data-print]');
    await expect(print).toBeEnabled();
    await page.locator('[data-settings]').click();
    const frame = page.frameLocator('iframe'), body = frame.locator('body');
    await body.evaluate(() => {
      window.__calls = 0;
      window.print = () => window.__calls++;
      const original = window.PrintForm.formatAll;
      window.PrintForm.formatAll = async (...args) => {
        await new Promise((resolve, reject) => { window.__release = resolve; window.__reject = reject; });
        return original.apply(window.PrintForm, args);
      };
    });
    await frame.locator('#count').selectOption(number === '065' ? '60' : '50');
    await expect(print).toBeDisabled();
    await expect.poll(() => body.evaluate(() => typeof window.__reject)).toBe('function');
    await print.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(await body.evaluate(() => window.__calls)).toBe(0);
    await body.evaluate(() => { window.__reject(new Error('held formatter failure')); window.__release = null; });
    await expect(page.locator('.preview-status')).toContainText('could not load');
    await expect(print).toBeDisabled();
    await frame.locator('#reset').click();
    await expect.poll(() => body.evaluate(() => typeof window.__release)).toBe('function');
    await body.evaluate(() => window.__release());
    await expect(print).toBeEnabled();
    expect(await body.evaluate((_, key) => window[key], flag)).toBe(true);
    await page.locator('[data-preview]').click();
    await print.click();
    expect(await body.evaluate(() => window.__calls)).toBe(1);
    const count = await frame.locator('.physical_page_wrapper').count();
    await expect(page.locator('[data-page-total]')).toHaveText(`/ ${count}`);
    await page.locator('[data-settings]').click();
    await expect(frame.locator('#count')).toHaveValue('24');
  });
}

for (const [number, file] of [['063', 'bilingual-academy-invoice'], ['065', 'aster-three-way-match-review-pack'], ['066', 'atlas-landed-cost-dossier']]) {
  test(`PF${number} print geometry and content match standalone at 200% viewer zoom`, async ({ page, context }) => {
    await page.goto(`/gallery/index.html?q=PF-${number}`);
    await page.locator('.gallery-card').click();
    await expect(page.locator('[data-print]')).toBeEnabled();
    await page.locator('[data-zoom]').fill('200');
    await page.locator('[data-zoom]').press('Enter');
    const standalone = await context.newPage();
    await standalone.goto(`/gallery/designs/${file}.html`);
    await expect(standalone.locator('#print')).toBeEnabled();
    await page.emulateMedia({ media: 'print' });
    await standalone.emulateMedia({ media: 'print' });
    const geometry = body => [...body.querySelectorAll('.physical_page_wrapper')].map(node => {
      const box = node.getBoundingClientRect();
      return { width: box.width, height: box.height, text: node.textContent };
    });
    expect(await page.frameLocator('iframe').locator('body').evaluate(geometry)).toEqual(await standalone.locator('body').evaluate(geometry));
    await standalone.close();
  });
}
