import { test, expect } from './studio-v3-test.js';

test('blocks service worker registration in the top frame only', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/studio-v3/');
  const outcome = await page.evaluate(() => navigator.serviceWorker.register('/studio-v3/sw.js').then(() => 'registered', error => error.name));
  expect(outcome).toBe('SecurityError');
  await expect(page.locator('[data-action=export]')).toBeEnabled({timeout: 30000});
  // The sandboxed preview must render cleanly: no injected script may throw inside it.
  await expect(page.locator('#status')).not.toContainText(/error|timed out|did not start/i);
  // Reading navigator.serviceWorker inside the sandboxed frame throws an uncaught SecurityError.
  expect(pageErrors).toEqual([]);
});

test.describe('opt-out', () => {
  test.use({blockServiceWorkers: false});
  test('leaves registration untouched', async ({ page }) => {
    await page.goto('/studio-v3/');
    expect(await page.evaluate(() => navigator.serviceWorker.register.toString().includes('[native code]'))).toBe(true);
  });
});
