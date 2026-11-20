import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { clickHeaderAction } from './header-action.js';

test('reports file and print requests through the host without claiming completion', async ({ page }) => {
  await page.goto('/studio-v3/');
  await expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30_000 });
  const revision = await page.locator('#revision').textContent();

  const saving = page.waitForEvent('download');
  await clickHeaderAction(page, 'save');
  const saved = await saving;
  expect(saved.suggestedFilename()).toMatch(/\.printform\.json$/);
  const portable = JSON.parse(await readFile(await saved.path(), 'utf8'));
  expect(portable.project.manifest.studioV3).toBeTruthy();
  expect(portable.project.sampleData.items.length).toBeGreaterThan(0);
  await expect(page.locator('#status')).toContainText('Editable form download requested');

  const exporting = page.waitForEvent('download');
  await clickHeaderAction(page, 'export');
  const exported = await exporting;
  expect(exported.suggestedFilename()).toMatch(/\.html$/);
  expect(await readFile(await exported.path(), 'utf8')).toContain('PrintFormDocument');
  await expect(page.locator('#status')).toContainText('Standalone HTML download requested');

  const frame = page.frameLocator('#preview-frame').locator('html');
  await frame.evaluate(html => {
    window.print = () => { html.dataset.printRequested = 'true'; };
  });
  await clickHeaderAction(page, 'print');
  await expect(frame).toHaveAttribute('data-print-requested', 'true');
  await expect(page.locator('#status')).toContainText('Print requested.');
  await expect(page.locator('#revision')).toHaveText(revision);
});
