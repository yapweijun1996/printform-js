import { test, expect } from '@playwright/test';

async function open(page, number) {
  await page.goto(`/gallery/index.html?q=PF-${number}`);
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
  await expect(page.locator('[data-page-total]')).not.toHaveText('/ 0');
}

test('desktop narrow paper defaults to at most 100% while manual zoom reaches 200%', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await open(page, '003');
  await expect(page.locator('[data-zoom]')).toHaveValue('100');
  await page.locator('[data-zoom]').fill('200');
  await page.locator('[data-zoom]').press('Enter');
  await expect(page.locator('[data-zoom]')).toHaveValue('200');
  await page.locator('[data-fit]').click();
  await expect(page.locator('[data-zoom]')).toHaveValue('100');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.locator('[data-close]').click();
  await open(page, '066');
  await expect.poll(async () => Number(await page.locator('[data-zoom]').inputValue())).toBeLessThan(50);
});

test('invalid fractional and empty page jumps restore the current page without errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page, '066');
  const input = page.locator('[data-page]');
  await input.fill('2');
  await input.press('Tab');
  await expect(input).toHaveValue('2');
  for (const value of ['1.5', '', '0', '-1', '999', '1e309']) {
    await input.fill(value);
    await input.press('Tab');
    await expect(input).toHaveValue('2');
  }
  expect(errors).toEqual([]);
});

for (const sequence of [['048'], ['047', '048', '049', '048']]) {
  test(`page jump with Tab preserves visible last sheet through ${sequence.join('-')}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/gallery/index.html');
    for (const number of sequence) {
      await page.locator('#search').fill(`PF-${number}`);
      await page.locator('.gallery-card').click();
      await expect(page.locator('[data-print]')).toBeEnabled();
      await expect(page.locator('[data-page-total]')).not.toHaveText('/ 0');
      const count = Number((await page.locator('[data-page-total]').textContent()).replace('/ ', ''));
      await page.locator('[data-page]').fill(String(count));
      // Re-measurement must not overwrite an in-progress page jump.
      await page.setViewportSize({ width: 375, height: number === '048' ? 668 : 667 });
      await page.locator('[data-page]').press('Tab');
      await expect.poll(() => page.locator('iframe').evaluate(frame => {
        const doc = frame.contentDocument;
        const last = [...doc.querySelectorAll('.physical_page_wrapper')].at(-1) || [...doc.querySelectorAll('.printform_page')].at(-1);
        const box = frame.getBoundingClientRect(), paper = last.getBoundingClientRect();
        const view = frame.closest('.frame-wrap').getBoundingClientRect(), scale = box.width / frame.offsetWidth;
        return box.top + paper.top * scale < view.bottom && box.top + paper.bottom * scale > view.top;
      }), { timeout: 3000 }).toBe(true);
      await expect(page.locator('[data-page]')).toHaveValue(String(count));
      await page.locator('[data-close]').click();
    }
  });
}
