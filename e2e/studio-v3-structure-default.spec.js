import { test, expect } from '@playwright/test';
async function ready(page) { await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000}); }
const toggle = page => page.locator('.paper-toolbar [data-layout=structure]');
const tree = page => page.locator('#left-panel [data-tree-group]').first();
test.beforeEach(async({page})=> { await page.goto('/studio-v3/'); await ready(page); });
test.use({viewport:{width:1366,height:768}});
test('Design starts without the structure panel and an explicit toggle opens it',async({page})=> {
  await expect(toggle(page)).toHaveAttribute('aria-expanded','false');
  await expect(tree(page)).toBeHidden();
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-expanded','true');
  await expect(tree(page)).toBeVisible();
  await toggle(page).click();
  await expect(tree(page)).toBeHidden();
});
test('Data and Validate keep their sample lists even while the Design tree is hidden',async({page})=> {
  await expect(tree(page)).toBeHidden();
  await page.locator('[data-mode=data]').click();
  await expect(page.locator('#left-panel [data-sample]').first()).toBeVisible();
  await page.locator('[data-mode=validate]').click();
  await expect(page.locator('#left-panel [data-sample]').first()).toBeVisible();
  await page.locator('[data-mode=design]').click();
  await expect(tree(page)).toBeHidden();
});
test('an opened structure panel is remembered after reload and across modes',async({page})=> {
  await toggle(page).click(); await expect(tree(page)).toBeVisible();
  await page.locator('[data-mode=data]').click(); await page.locator('[data-mode=design]').click();
  await expect(tree(page)).toBeVisible();
  await page.reload(); await ready(page);
  await expect(toggle(page)).toHaveAttribute('aria-expanded','true');
  await expect(tree(page)).toBeVisible();
});
