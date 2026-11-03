import { expect, test } from '@playwright/test';

const widths = [320, 360, 390, 768, 1440, 1920];

test('restores language preference and translates the rendered homepage', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.locator('a[href="studio-v3/"]')).toContainText('通用表单试点');
  await expect(page.locator('a[href="studio-v2/"]')).toContainText('尚未达到生产就绪');
  await page.reload();
  await expect(page.getByRole('button', { name: '中文', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveTitle(/可打印的商务表单/);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('a[href="studio-v2/"]')).toContainText('Not production ready');
});

test('stays usable when browser storage access is denied', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {
    get() { throw new DOMException('Denied', 'SecurityError'); }
  }));
  await page.goto('/');
  await page.getByRole('button', { name: '中文', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('navigation')).toHaveAccessibleName('主导航');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(errors).toEqual([]);
});

test('loads the captured invoice and publishes every local destination', async ({ page, request }) => {
  await page.goto('/');
  const image = page.locator('.preview img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth)).toBe(750);
  expect(await image.evaluate(img => img.naturalHeight)).toBe(1050);
  await expect(page.locator('iframe')).toHaveCount(0);
  const paths = await page.locator('a[href]').evaluateAll(links => [...new Set(links
    .map(link => link.getAttribute('href')).filter(href => !href.startsWith('#') && !href.startsWith('https:')))]);
  for (const path of paths) {
    const response = await request.get(`/${path}`);
    expect(response.status(), path).toBe(200);
  }
});
test('reflows expanded homepage headings at 320px with 200% root text in both languages', async ({ page }) => {
  await page.goto('/');
  await page.locator('summary').click();
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });

  for (const language of ['EN', '中文']) {
    await page.getByRole('button', { name: language, exact: true }).click();
    const headings = page.locator('main h1, main h2, main h3');
    for (const heading of await headings.all()) {
      await expect(heading).toBeVisible();
      const box = await heading.boundingBox();
      expect(box, language).not.toBeNull();
      expect(box.x + box.width, language).toBeLessThanOrEqual(320);
    }
    await expect(page.locator('.test-links a').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), language).toBeLessThanOrEqual(320);
  }
});

test('reflows in both languages, including expanded fixtures and large text', async ({ page }) => {
  await page.goto('/');
  await page.locator('summary').click();
  for (const language of ['EN', '中文']) {
    await page.getByRole('button', { name: language, exact: true }).click();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${language} at ${width}`).toBe(true);
      for (const target of ['.primary', '.secondary', '[data-lang="zh"]', '[data-lang="en"]']) {
        const box = await page.locator(target).boundingBox();
        expect(box.height, target).toBeGreaterThanOrEqual(44);
        expect(box.width, target).toBeGreaterThanOrEqual(44);
      }
    }
  }
  await page.setViewportSize({ width: 320, height: 720 });
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).colorScheme)).toBe('light');
});

test('supports keyboard skip, language switching and fixture disclosure', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.goto('/');
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '中文', exact: true })).toBeFocused();
  const focusStyle = await page.locator(':focus').evaluate(el => {
    const css = getComputedStyle(el);
    return { style: css.outlineStyle, width: parseFloat(css.outlineWidth) };
  });
  expect(focusStyle.style).not.toBe('none');
  expect(focusStyle.width).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  for (let i = 0; i < 30; i++) {
    if (await page.locator('summary').evaluate(el => el === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(page.locator('summary')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('details')).toHaveAttribute('open', '');
  await page.keyboard.press('Tab');
  await expect(page.locator('a[href="index_subtotal_test.html"]')).toBeFocused();
});

test('keeps a usable English landing page without scripts', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(test.info().project.use.baseURL + '/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.primary')).toHaveAttribute('href', 'gallery/index.html');
  await expect(page.locator('.languages')).toBeHidden();
  await page.locator('summary').click();
  await expect(page.locator('a[href="index021.html"]')).toBeVisible();
  await context.close();
});

test('resolves homepage assets and navigation beneath the repository subpath', async ({ page }) => {
  await page.route('**/printform-js/**', route => {
    const url = new URL(route.request().url());
    url.pathname = url.pathname.replace(/^\/printform-js/, '');
    return route.continue({ url: url.href });
  });
  await page.goto('/printform-js/');
  await expect(page.getByRole('button', { name: '中文', exact: true })).toBeVisible();
  await expect.poll(() => page.locator('.preview img').evaluate(img => img.naturalWidth)).toBe(750);
  const destinations = await page.locator('.primary, .secondary').evaluateAll(links => links.map(link => new URL(link.href).pathname));
  expect(destinations).toEqual(['/printform-js/gallery/index.html', '/printform-js/demo001.html']);
  await page.locator('.primary').click();
  await expect(page).toHaveURL(/\/printform-js\/gallery\/index.html$/);
});
