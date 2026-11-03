import { test, expect } from "@playwright/test";

async function open(page, number) {
  await page.goto(`/gallery/index.html?q=PF-${number}`);
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
}

for (const width of [375, 390]) for (const number of ['065', '066']) {
  test(`PF${number} fits real paper edges on ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 375 ? 667 : 844 });
    await open(page, number);
    const edges = await page.locator('iframe').evaluate(frame => {
      const sheet = frame.contentDocument.querySelector('.physical_page_wrapper');
      const rect = sheet.getBoundingClientRect(), box = frame.getBoundingClientRect();
      const scale = box.width / frame.offsetWidth;
      return { left: box.left + rect.left * scale, right: box.left + rect.right * scale,
        top: box.top + rect.top * scale, viewport: innerWidth };
    });
    expect(edges.left).toBeGreaterThanOrEqual(-0.01);
    expect(edges.right).toBeLessThanOrEqual(edges.viewport + 0.01);
    expect(edges.top).toBeLessThan(200);
    await expect(page.locator('[data-settings]')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('[data-out]')).toBeDisabled();
    await page.screenshot({ path: info.outputPath(`pf${number}-${width}.png`) });
  });
}

test('Atlas zoom stage reaches right edge and last sheet without phantom space', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await open(page, '066');
  await page.locator('[data-page]').fill('10');
  await page.locator('[data-page]').press('Enter');
  await expect(page.locator('[data-page]')).toHaveValue('10');
  const sourceHeight = await page.frameLocator('iframe').locator('body').evaluate(body => {
    const sheets = body.querySelectorAll('.physical_page_wrapper');
    return sheets[sheets.length - 1].getBoundingClientRect().bottom - sheets[0].getBoundingClientRect().top;
  });
  for (const zoom of ['50', '100', '200']) {
    await page.locator('[data-zoom]').fill(zoom);
    await page.locator('[data-zoom]').press('Enter');
    await expect.poll(() => page.locator('.viewer-stage').evaluate(stage => stage.getBoundingClientRect().width)).toBeCloseTo(1122.48 * Number(zoom) / 100, 0);
    await expect.poll(() => page.locator('.viewer-stage').evaluate(stage => stage.getBoundingClientRect().height)).toBeCloseTo(sourceHeight * Number(zoom) / 100, 0);
    await page.locator('[data-page]').fill('10');
    await page.locator('[data-page]').press('Enter');
    await expect(page.locator('[data-page]')).toHaveValue('10');
    const bounds = await page.locator('.document-viewport').evaluate(view => {
      view.scrollLeft = view.scrollWidth;
      const stage = view.querySelector('.viewer-stage').getBoundingClientRect();
      const box = view.getBoundingClientRect();
      return { right: stage.right - box.right, remaining: view.scrollHeight - view.clientHeight - view.scrollTop };
    });
    expect(Math.abs(bounds.right)).toBeLessThan(2);
    expect(bounds.remaining).toBeLessThan(1600);
    await expect(page.locator('[data-page-total]')).toHaveText('/ 10');
  }
});
