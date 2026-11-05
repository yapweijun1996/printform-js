import { test, expect } from '@playwright/test';

const cssPixels = value => Math.round(value * 100) / 100;

async function openDesign(page, number) {
  await page.goto(`/gallery/index.html?q=PF-${number}`);
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
  await expect(page.locator('[data-page-total]')).not.toHaveText('/ 0');
}

function assertInsideToolbar(page) {
  return page.locator('.viewer-controls').evaluate(toolbar => {
    const bounds = toolbar.getBoundingClientRect();
    const nodes = [...toolbar.querySelectorAll('button, input')].filter(node => !node.hidden && node.getClientRects().length);
    return {
      fits: toolbar.scrollWidth <= toolbar.clientWidth && toolbar.scrollHeight <= toolbar.clientHeight,
      groups: ['.viewer-modes', '.viewer-tools', '.viewer-pages'].map(selector => {
        const rect = toolbar.querySelector(selector).getBoundingClientRect();
        return { selector, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      }),
      controls: nodes.map(node => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      }),
      toolbar: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom }
    };
  });
}

for (const colorScheme of ['light', 'dark']) for (const width of [1024, 1920]) {
  test(`PF-042 desktop toolbar is grouped in one row (${width}px, ${colorScheme})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme });
    await openDesign(page, '042');
    const toolbar = page.locator('.viewer-controls');
    await expect(toolbar).toHaveCSS('grid-template-areas', /modes.*tools.*pages/);
    const layout = await assertInsideToolbar(page);
    expect(layout.fits).toBe(true);
    expect(new Set(layout.controls.map(control => Math.round(control.top)))).toEqual(new Set([Math.round(layout.toolbar.top + 4)]));
    expect(new Set(layout.controls.map(control => cssPixels(control.height)))).toEqual(new Set([44]));
    expect(layout.controls.every(control => cssPixels(control.left) >= cssPixels(layout.toolbar.left) && cssPixels(control.right) <= cssPixels(layout.toolbar.right) && cssPixels(control.top) >= cssPixels(layout.toolbar.top) && cssPixels(control.bottom) <= cssPixels(layout.toolbar.bottom))).toBe(true);
    const modes = layout.groups.find(group => group.selector === '.viewer-modes');
    const tools = layout.groups.find(group => group.selector === '.viewer-tools');
    const pages = layout.groups.find(group => group.selector === '.viewer-pages');
    expect(Math.abs((tools.left + tools.right) / 2 - (layout.toolbar.left + layout.toolbar.right) / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(modes.left - layout.toolbar.left - 8)).toBeLessThanOrEqual(1);
    expect(Math.abs(pages.right - layout.toolbar.right + 8)).toBeLessThanOrEqual(1);
    const zoom = await page.locator('[data-zoom]').boundingBox();
    expect(cssPixels(zoom.width)).toBeGreaterThanOrEqual(44);
    expect(cssPixels(zoom.height)).toBeGreaterThanOrEqual(44);
    const canvas = await page.locator('.document-viewport').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, shadow: getComputedStyle(el.querySelector('.viewer-stage')).boxShadow }));
    expect(canvas.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(canvas.shadow).not.toBe('none');
    await expect(page.locator('[data-read]')).toBeVisible();
    await expect(page.locator('[data-page-total]')).toHaveText('/ 5');
  });
}

for (const width of [320, 390, 767]) {
  test(`PF-042 compact toolbar wraps without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openDesign(page, '042');
    const layout = await assertInsideToolbar(page);
    expect(layout.fits).toBe(true);
    expect(layout.controls.every(control => cssPixels(control.left) >= cssPixels(layout.toolbar.left) && cssPixels(control.right) <= cssPixels(layout.toolbar.right) && cssPixels(control.top) >= cssPixels(layout.toolbar.top) && cssPixels(control.bottom) <= cssPixels(layout.toolbar.bottom))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('[data-page]').fill('2');
    await page.locator('[data-page]').press('Enter');
    await expect(page.locator('[data-page]')).toHaveValue('2');
    await page.locator('[data-zoom]').fill('125');
    await page.locator('[data-zoom]').press('Enter');
    await expect(page.locator('[data-zoom]')).toHaveValue('125');
  });
}

for (const [width, height] of [[320, 375], [568, 320], [667, 375]]) {
  test(`PF-042 short viewport stays contained at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openDesign(page, '042');
    const layout = await assertInsideToolbar(page);
    expect(layout.fits).toBe(true);
    expect(layout.controls.every(control => cssPixels(control.left) >= cssPixels(layout.toolbar.left) && cssPixels(control.right) <= cssPixels(layout.toolbar.right) && cssPixels(control.top) >= cssPixels(layout.toolbar.top) && cssPixels(control.bottom) <= cssPixels(layout.toolbar.bottom))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('single-page toolbar remains one compact row and preserves settings, Read and preset focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await openDesign(page, '061');
  const toolbar = page.locator('.viewer-controls');
  expect(cssPixels((await toolbar.boundingBox()).height)).toBeLessThanOrEqual(56);
  await expect(page.locator('.viewer-pages')).toBeHidden();
  const layout = await assertInsideToolbar(page);
  expect(layout.fits).toBe(true);
  await page.locator('[data-presets]').click();
  await expect(page.locator('[data-presets]')).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-presets]')).toBeFocused();
  await page.locator('[data-presets]').click();
  await page.getByRole('button', { name: '150%', exact: true }).click();
  await expect(page.locator('[data-presets]')).toBeFocused();
  await page.locator('[data-presets]').click();
  await page.locator('[data-fit]').click();
  await expect(page.locator('[data-presets]')).toBeFocused();
  await page.locator('[data-settings]').click();
  await expect(page.locator('[data-preview]')).toBeVisible();
  await expect(page.locator('[data-read]')).toBeHidden();
  await page.locator('[data-preview]').click();
  await expect(page.locator('[data-read]')).toBeVisible();
  await page.locator('[data-read]').click();
  await expect(page.locator('.document-viewport')).toBeFocused();
  const beforePan = await page.locator('.document-viewport').evaluate(element => element.scrollLeft);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.locator('.document-viewport').evaluate(element => element.scrollLeft)).toBeGreaterThan(beforePan);
});

for (const language of ['en', 'zh']) for (const colorScheme of ['light', 'dark']) {
  test(`single-page toolbar keeps localized accessible names (${language}, ${colorScheme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.goto('/gallery/index.html?q=PF-061');
    if (language === 'zh') await page.locator('[data-language="zh"]').click();
    await page.locator('.gallery-card').click();
    await expect(page.locator('[data-print]')).toBeEnabled();
    await expect(page.locator('[data-read]')).toHaveAccessibleName(language === 'zh' ? '放大阅读' : 'Read');
    await expect(page.locator('[data-zoom]')).toHaveAccessibleName(language === 'zh' ? '缩放百分比' : 'Zoom percentage');
    expect((await assertInsideToolbar(page)).fits).toBe(true);
  });
}
