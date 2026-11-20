import { expect, test } from '@playwright/test';
import { compileProject, designOf, newProject } from '../studio-v3/model.js';
import { saveProject } from '../studio-v3/file-io.js';

test('data row paging changes the visible rows and preserves the form revision', async ({ page }) => {
  await page.goto('/studio-v3/');
  await expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30_000 });
  const revision = await page.locator('#revision').textContent();

  await page.locator('[data-mode=data]').click();
  await page.locator('#database-workbench nav [data-db-group=items]').click();
  const rows = page.locator('.database-row-tools');
  await expect(rows).toContainText('1–25');
  await rows.locator('[data-db-action=next-rows]').click();
  await expect(rows).toContainText('26–45');
  await expect(rows.locator('[data-db-action=next-rows]')).toBeDisabled();
  await rows.locator('[data-db-action=previous-rows]').click();
  await expect(rows).toContainText('1–25');
  await expect(page.locator('#revision')).toHaveText(revision);
  await expect(page.locator('[data-action=undo]')).toBeDisabled();
});

test('a current quality issue selects its component without modifying the form', async ({ page }) => {
  await page.goto('/studio-v3/');
  await expect(page.locator('[data-action=export]')).toBeEnabled({ timeout: 30_000 });
  const project = newProject(), design = designOf(project);
  project.manifest.title = 'Missing customer binding fixture';
  design.customer[0].pointer = '/customer/notSupplied';
  await page.locator('#open-file').setInputFiles({
    name: 'missing-binding.printform.json',
    mimeType: 'application/json',
    buffer: Buffer.from(saveProject(compileProject(project, design)))
  });
  await expect(page.locator('#document-name')).toHaveValue(project.manifest.title);
  const revision = await page.locator('#revision').textContent();

  await page.locator('[data-mode=validate]').click();
  const issue = page.locator('[data-issue=customer-bill]').filter({ hasText: '/customer/notSupplied' }).first();
  await expect(issue).toBeVisible();
  await issue.click();
  await expect(page.locator('[data-mode=design]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-select=customer-bill]')).toHaveClass(/active/);
  await expect(page.locator('#revision')).toHaveText(revision);
  await expect(page.locator('[data-action=undo]')).toBeDisabled();
});
