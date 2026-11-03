import { test, expect } from '@playwright/test';

for (const width of [320, 375, 390, 430]) {
  test(`compact controls and footer fit at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/gallery/index.html?q=PF-061');
    await page.locator('.gallery-card').click();
    await expect(page.locator('[data-print]')).toBeEnabled();
    const bar = page.locator('.viewer-controls');
    expect(await bar.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect((await bar.boundingBox()).height).toBeLessThanOrEqual(56);
    for (const selector of ['[data-read]', '[data-settings]', '[data-out]', '[data-zoom]', '[data-in]', '[data-presets]', '[data-print]', '[data-open]']) {
      const control = page.locator(selector);
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    expect((await page.locator('.pf-dialog-footer').boundingBox()).height).toBeLessThanOrEqual(54);
  });
}

test('presets change scale and Escape closes only popup', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/gallery/index.html?q=PF-061');
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
  const trigger = page.locator('[data-presets]');
  const fit = page.locator('[data-fit]');
  const initial = await page.locator('[data-zoom]').inputValue();
  await expect(fit).toBeHidden();
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: '150%', exact: true }).click();
  await expect(page.locator('[data-zoom]')).toHaveValue('150');
  await expect.poll(() => page.locator('iframe').evaluate(frame => new DOMMatrix(getComputedStyle(frame).transform).a)).toBe(1.5);
  await expect(fit).toBeHidden();
  await trigger.click();
  await fit.focus();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('dialog')).toBeVisible();
  await trigger.click();
  await fit.click();
  await expect(page.locator('[data-zoom]')).toHaveValue(initial);
  expect(await page.locator('[data-zoom]').evaluate(el => el.validity.valid)).toBe(true);
});

for (const language of ['en', 'zh']) {
  test(`localized compact preview ${language}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 320, height: 667 });
    await page.goto('/gallery/index.html?q=PF-061');
    if (language === 'zh') await page.locator('[data-language="zh"]').click();
    await page.locator('.gallery-card').click();
    await expect(page.locator('[data-print]')).toBeEnabled();
    await expect(page.locator('[data-read]')).toHaveAccessibleName(language === 'zh' ? '放大阅读' : 'Read');
    await expect(page.locator('[data-presets]')).toHaveAccessibleName(language === 'zh' ? '缩放预设' : 'Zoom Presets');
    expect(await page.locator('.viewer-controls').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`controls-${language}.png`) });
    await page.locator('[data-settings]').click();
    await expect(page.locator('[data-preview]')).toHaveAccessibleName(language === 'zh' ? '返回预览' : 'Back to Preview');
    await page.locator('[data-preview]').click();
    await expect(page.locator('[data-out]')).toBeVisible();
  });
}
