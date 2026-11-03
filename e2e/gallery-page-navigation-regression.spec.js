import { test, expect } from '@playwright/test';

async function open(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/gallery/index.html?q=PF-066');
  await page.locator('.gallery-card').click();
  await expect(page.locator('[data-print]')).toBeEnabled();
  await expect(page.locator('[data-page-total]')).toHaveText('/ 10');
  await page.locator('[data-page]').fill('10');
  await page.locator('[data-page]').press('Tab');
  await expect(page.locator('[data-page]')).toHaveValue('10');
}

async function actualPage(page) {
  return page.locator('iframe').evaluate(frame => {
    const view = frame.closest('.frame-wrap');
    const scale = new DOMMatrix(getComputedStyle(frame).transform).a;
    const sheets = [...frame.contentDocument.querySelectorAll('.physical_page_wrapper')];
    const nodes = sheets.length ? sheets : [...frame.contentDocument.querySelectorAll('.printform_page')];
    const top = nodes[0].getBoundingClientRect().top;
    const y = view.scrollTop / scale + top + 2;
    return view.scrollTop > 0 && view.scrollTop + view.clientHeight >= view.scrollHeight - 1
      ? nodes.length : Math.max(1, nodes.findLastIndex(node => node.getBoundingClientRect().top <= y) + 1);
  });
}

async function wheelUp(page) {
  const viewport = page.locator('.document-viewport');
  const before = await viewport.evaluate(node => node.scrollTop);
  const box = await viewport.boundingBox();
  // Use the viewport's own padding rather than the embedded source document.
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -1000);
  await expect.poll(() => viewport.evaluate(node => node.scrollTop)).toBeLessThan(before - 100);
  // Let native wheel momentum and its scroll events finish before blurring.
  await page.waitForTimeout(500);
}

test('Previous and Next retain requested landscape pages at the scroll limit', async ({ page }) => {
  await open(page);
  const input = page.locator('[data-page]');
  await page.locator('[data-prev]').click();
  await expect(input).toHaveValue('9');
  await page.locator('[data-prev]').click();
  await expect(input).toHaveValue('8');
  await page.locator('[data-next]').click();
  await expect(input).toHaveValue('9');
  await page.locator('[data-next]').click();
  await expect(input).toHaveValue('10');
  await wheelUp(page);
  await expect.poll(() => actualPage(page)).toBeLessThan(9);
  await expect.poll(() => input.inputValue()).toBe(String(await actualPage(page)));
});

test('focused page edits survive scrolling and synchronize on blur', async ({ page }) => {
  await open(page);
  const input = page.locator('[data-page]');
  await input.focus();
  await wheelUp(page);
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('10');
  await expect.poll(() => actualPage(page)).toBeLessThan(9);
  await page.locator('[data-zoom]').focus();
  await expect.poll(() => input.inputValue()).toBe(String(await actualPage(page)));
});
