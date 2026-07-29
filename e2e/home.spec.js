import { expect, test } from "@playwright/test";

test("exposes separate Studio v1 and v2 homepage cards", async ({ page }) => {
  await page.goto("/");

  const studioV1 = page.locator('a.card[href="studio/index.html"]');
  const studioV2 = page.locator('a.card[href="studio-v2/"]');

  await expect(studioV1).toHaveCount(1);
  await expect(studioV2).toHaveCount(1);
  await expect(studioV2).toContainText("PrintForm Studio v2");

  await page.getByRole("button", { name: "中文" }).click();
  await expect(studioV2).toContainText("生产级打印表单生成器");

  await studioV2.click();
  await expect(page).toHaveURL(/\/studio-v2\/$/);
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
});
