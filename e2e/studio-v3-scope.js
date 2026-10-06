import { expect } from '@playwright/test';
// Scope is derived from referenced elements. These helpers do what a user does.
// Limit the next AI edit to the current selection by referencing it (Add to chat).
export async function limitToSelection(page) {
  await page.locator('.paper-toolbar [data-ai-add]').click();
  await expect(page.locator('[data-ai-element-tags]')).toBeVisible();
}
// Back to editing the whole form: remove every referenced element.
export async function limitToWholeForm(page) {
  const remove = page.locator('.ai-tag-remove');
  while (await remove.count()) await remove.first().click();
  await expect(page.locator('[data-ai-element-tags]')).toBeHidden();
}
